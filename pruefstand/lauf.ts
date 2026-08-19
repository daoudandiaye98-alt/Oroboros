/**
 * Der Prüfstand — der Einstiegspunkt.
 *
 *   npm run pruefstand                                    (Vorgabe: lokal)
 *   npm run pruefstand -- --adresse https://…             (Vercel-Vorschau)
 *   npm run pruefstand -- --breiten 1280,1920
 *   npm run pruefstand -- --kontrollen 3.3
 *
 * Schreibt `pruefstand/artefakte/bericht.json` und die Aufnahmen daneben.
 * Endet mit Code 1, sobald ein Launch Gate gefallen ist.
 *
 * Portiert aus `pawn-prototype/tools/pruefstand/lauf.ts`. Weggefallen sind die
 * Teile, die auf PAWNs Datenschicht zeigten (die Hüllen-Regel für Supabase,
 * die Kennzeichen `data-nicht-gefunden` und `data-daten-fehlen`, die
 * Bypass-Kopfzeile für ein geschütztes Vercel-Projekt) sowie die zwei
 * heftspezifischen Kontrollen. Was blieb, misst jede Seite jedes Projekts.
 */
import { chromium, type Browser, type Page } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BREITEN, CHROMIUM_PFAD, RUHE_MS, SCHWELLEN, SEITEN, UNSINN_PFAD,
  VORGABE_ZIEL, ZIELE, type Breite, type SeitenZiel, type ZielName,
} from "./pruefstand.config";
import { ausnahmeFuer, abgelaufen } from "./ausnahmen";
import {
  messeFokus, messeKnopfVerdeckung, messeKontrast, messeKopfdaten,
  messeLayout, messeTrefferflaechen, type Befund,
} from "./messen";

const ORDNER = join(process.cwd(), "pruefstand", "artefakte");

/**
 * tsx/esbuild hängt an benannte Funktionen einen Helfer `__name`, den es im
 * Browser nicht gibt — jede `page.evaluate`-Rückrufsfunktion mit einer
 * benannten inneren Funktion stürzt sonst mit „__name is not defined" ab. Ein
 * Zeilen-Ersatz vor jeder Navigation, damit im Messcode nichts verrenkt
 * geschrieben werden muss.
 */
async function nameHelferSetzen(page: Page) {
  await page.addInitScript(() => {
    const g = globalThis as unknown as { __name?: unknown };
    if (!g.__name) g.__name = (f: unknown) => f;
  });
}

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * `--kontrollen 3.4,3.3` misst nur diese Kontrollen. Gedacht für den Fall, dass
 * eine Zahl neu erhoben werden muss, ohne den ganzen Lauf zu wiederholen: der
 * Teillauf benutzt dieselben Messfunktionen, also sind die Zahlen dieselben.
 * Der Bericht hält fest, dass es ein Teillauf war — sonst liest ihn später
 * jemand als Gesamtbild.
 */
const NUR_KONTROLLEN = argument("kontrollen")?.split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Passt ein Name zu dem, wonach gefragt wurde?
 *
 * Kontrollen haben zwei Ebenen: der Lauf ruft Gruppen auf (`5.x`), die Befunde
 * tragen Einzelnamen (`5.1`). Verglichen wird deshalb in BEIDE Richtungen — wer
 * die Gruppe nennt, bekommt ihre Einzelbefunde; wer einen Einzelnamen nennt,
 * bekommt seine Gruppe gemessen.
 */
function trifft(name: string, frage: string): boolean {
  return name === frage || name.startsWith(`${frage}.`) || frage.startsWith(`${name}.`);
}

function gefragt(gruppe: string): boolean {
  return !NUR_KONTROLLEN || NUR_KONTROLLEN.some((k) => trifft(gruppe, k));
}

/**
 * Der Abbruch-Befund einer ganzen Seite.
 *
 * `01` tragen nur die Stellen, an denen eine Seite gar nicht erst vermessen
 * wird: Umleitung, Fehlerstatus, Ladefehler. Er ist keine Kontrolle, sondern
 * die Begründung dafür, dass keine Kontrolle lief — und er kommt IMMER durch,
 * auch im Teillauf. Ein Messgerät, das schweigt, wenn es nicht messen konnte,
 * ist das gefährlichere Messgerät: die Stille liest sich wie „nichts zu
 * beanstanden".
 */
const ABBRUCH = "01";

function passtZurFrage(kontrolle: string): boolean {
  if (kontrolle === ABBRUCH) return true;
  return !NUR_KONTROLLEN || NUR_KONTROLLEN.some((k) => trifft(kontrolle, k));
}

function commit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unbekannt";
  }
}

async function seiteMessen(
  browser: Browser, basis: string, seite: SeitenZiel, breite: Breite,
  ruhigeBewegung = false,
): Promise<Befund[]> {
  const page = await browser.newPage({
    viewport: { width: breite.breite, height: breite.hoehe },
    hasTouch: breite.eingabe === "finger",
    isMobile: breite.eingabe === "finger",
    locale: "de-DE",
    reducedMotion: ruhigeBewegung ? "reduce" : "no-preference",
  });
  await nameHelferSetzen(page);
  const befunde: Befund[] = [];

  // 4.7 Gewicht + Konsolenfehler laufen nebenher mit.
  let gewicht = 0;
  const groessen: { url: string; bytes: number }[] = [];
  const konsole: string[] = [];
  const fehlgeschlagen: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") konsole.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => konsole.push("pageerror: " + e.message.slice(0, 160)));
  page.on("requestfailed", (r) => {
    fehlgeschlagen.push(`${r.url().slice(0, 90)} — ${r.failure()?.errorText}`);
  });
  page.on("response", async (r) => {
    try {
      const laenge = Number(r.headers()["content-length"] ?? 0);
      const bytes = laenge > 0 ? laenge : (await r.body().catch(() => Buffer.alloc(0))).length;
      gewicht += bytes;
      groessen.push({ url: r.url().split("/").pop()?.slice(0, 48) ?? "", bytes });
    } catch { /* Antwort nicht lesbar — zählt nicht mit */ }
  });

  const adresse = basis + seite.pfad;
  try {
    const antwort = await page.goto(adresse, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(RUHE_MS);

    if (new URL(page.url()).host !== new URL(basis).host) {
      return [{
        kontrolle: ABBRUCH, gate: false, status: "nicht_pruefbar",
        seite: seite.pfad, breite: breite.breite, gemessen: page.url(), schwelle: basis,
        notiz: "Adresse leitet auf einen fremden Host um — es wurde nicht das Werk geladen, "
          + "deshalb wurde auf dieser Seite nichts gemessen.",
      }];
    }
    if (antwort && antwort.status() >= 400) {
      return [{
        kontrolle: ABBRUCH, gate: false, status: "nicht_pruefbar",
        seite: seite.pfad, breite: breite.breite, gemessen: antwort.status(), schwelle: "< 400",
        notiz: "Seite antwortet mit Fehlerstatus — nicht messbar.",
      }];
    }

    if (ruhigeBewegung) {
      /*
       * 3.9 — der zweite Durchlauf mit „Bewegung reduzieren".
       *
       * Hier zählt nur, DASS die Seite trägt: kein Absturz, und der primäre Weg
       * bleibt erreichbar. Alle anderen Kontrollen würden dieselben Zahlen
       * liefern wie im ersten Durchlauf und den Bericht verdoppeln.
       *
       * Zusätzlich wird festgehalten, ob die Endzustände wirklich da sind —
       * genau das ist die Zusage des Fallbacks: nichts bewegt sich, aber alles
       * ist zu sehen. Ein Fallback, der die Bewegung abschaltet und den Inhalt
       * gleich mit, wäre schlimmer als gar keiner.
       */
      /*
       * Erst die ganze Seite einmal durchrollen, dann messen.
       *
       * Ein Auftritt läuft, wenn sein Container zu 20 % sichtbar wird — was
       * nie gesehen wurde, ist zu Recht noch unsichtbar. Ohne diesen Durchlauf
       * meldete die Kontrolle genau das als Fehler: vier Karten mit
       * `opacity 0`, die schlicht noch unter der Falz standen. Gemessen am
       * 19.08.2026, 390 und 1280, vier Befunde je Breite — ein Messgerät, das
       * seinen eigenen blinden Fleck als Befund ausgibt.
       */
      const hoehe = await page.evaluate(() => window.innerHeight);
      const gesamt = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < gesamt; y += Math.max(1, Math.round(hoehe / 2))) {
        await page.evaluate((z) => window.scrollTo(0, z), y);
        await page.waitForTimeout(200);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(600);

      const unsichtbar = await page.evaluate(() => {
        const tot: string[] = [];
        for (const el of Array.from(document.querySelectorAll("[data-rolle]"))) {
          const cs = getComputedStyle(el);
          if (parseFloat(cs.opacity) < 0.99) {
            tot.push(`${el.tagName.toLowerCase()}[data-rolle=${el.getAttribute("data-rolle")}] `
              + `opacity ${cs.opacity}`);
          }
        }
        return tot;
      });
      befunde.push({
        kontrolle: "3.9", gate: true,
        status: unsichtbar.length > 0 ? "gefallen" : "bestanden",
        seite: seite.pfad, breite: breite.breite,
        auswahl: unsichtbar.slice(0, SCHWELLEN.liste_laenge).join(" · ") || undefined,
        gemessen: unsichtbar.length, schwelle: 0,
        notiz: "Bei „Bewegung reduzieren“: Elemente mit einer Rolle, die nach dem Auftritt "
          + "immer noch unsichtbar sind. Der Fallback darf die Bewegung nehmen, nicht den Inhalt.",
      });
      const verdeckung = await messeKnopfVerdeckung(page, seite.pfad, breite.breite);
      befunde.push(...verdeckung.map((b) => ({ ...b, kontrolle: "3.9", gate: false })));
      await page.close();
      return befunde;
    }

    // Jede Kontrolle sagt, wie lange sie gebraucht hat — damit „das dauert lange"
    // eine Zahl bekommt statt eines Gefühls.
    const mitUhr = async (name: string, f: () => Promise<Befund[]>) => {
      if (NUR_KONTROLLEN && !gefragt(name)) return;
      const t = Date.now();
      const r = await f();
      process.stderr.write(`    ${name} ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
      befunde.push(...r);
    };
    await mitUhr("3.8", () => messeLayout(page, seite.pfad, breite.breite));
    await mitUhr("3.5", () => messeTrefferflaechen(page, seite.pfad, breite));
    await mitUhr("3.10", () => messeKnopfVerdeckung(page, seite.pfad, breite.breite));
    await mitUhr("5.x", () => messeKopfdaten(page, seite.pfad, breite.breite));
    await mitUhr("3.4", () => messeFokus(page, seite.pfad, breite.breite));
    // Kontrast zuletzt: er stellt Bewegung still und färbt Glyphen um.
    await mitUhr("3.3", () => messeKontrast(page, seite.pfad, breite.breite));

    // 3.7 — die Aufnahme, gegen die jede Zahl gegengelesen werden kann.
    if (!NUR_KONTROLLEN) {
      mkdirSync(ORDNER, { recursive: true });
      await page.screenshot({
        path: join(ORDNER, `${seite.name}--${breite.name.replace(/\s+/g, "-")}.png`),
        fullPage: true,
      });
    }

    groessen.sort((a, b) => b.bytes - a.bytes);
    befunde.push({
      kontrolle: "4.7", gate: true,
      status: gewicht > SCHWELLEN.gewicht_seite ? "gefallen" : "bestanden",
      seite: seite.pfad, breite: breite.breite,
      auswahl: groessen.slice(0, SCHWELLEN.liste_laenge)
        .map((g) => `${g.url} ${Math.round(g.bytes / 1024)}kB`).join(" · "),
      gemessen: gewicht, schwelle: SCHWELLEN.gewicht_seite,
      notiz: `Gesamtgewicht der Seite in Byte über ${groessen.length} Antworten`,
    });
    befunde.push({
      kontrolle: "—", gate: false,
      status: konsole.length + fehlgeschlagen.length > 0 ? "gefallen" : "bestanden",
      seite: seite.pfad, breite: breite.breite,
      auswahl: [...konsole.slice(0, 5), ...fehlgeschlagen.slice(0, 5)].join(" · ") || undefined,
      gemessen: konsole.length + fehlgeschlagen.length, schwelle: 0,
      notiz: `${konsole.length} Konsolenfehler, ${fehlgeschlagen.length} fehlgeschlagene Anfragen`,
    });
  } catch (e) {
    befunde.push({
      kontrolle: ABBRUCH, gate: false, status: "nicht_pruefbar",
      seite: seite.pfad, breite: breite.breite, gemessen: null, schwelle: null,
      notiz: `Messung abgebrochen: ${(e as Error).message}`,
    });
  } finally {
    await page.close();
  }
  return befunde;
}

/** 4.3 Wege · 4.5 404 — beides über echte Anfragen, einmal je Lauf. */
async function wegeUnd404(browser: Browser, basis: string): Promise<Befund[]> {
  const befunde: Befund[] = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "de-DE" });
  await nameHelferSetzen(page);
  try {
    await page.goto(basis + SEITEN[0].pfad, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(RUHE_MS);
    const links = await page.evaluate((host) => {
      const intern: string[] = [];
      const extern: string[] = [];
      const post: string[] = [];
      for (const a of Array.from(document.querySelectorAll("a[href]"))) {
        const href = (a as HTMLAnchorElement).href;
        if (/^(mailto|tel):/i.test(href)) post.push(href);
        else if (href.startsWith("http") && new URL(href).host !== host) extern.push(href);
        else if (href.startsWith("http")) intern.push(new URL(href).pathname);
      }
      return {
        intern: [...new Set(intern)], extern: [...new Set(extern)].slice(0, 20), post: [...new Set(post)],
      };
    }, new URL(basis).host);

    // Interne Wege: eine SPA beantwortet jede Adresse mit 200 und der Hülle.
    // Deshalb wird zusätzlich geprüft, ob die Anwendung dort ihre 404-Ansicht zeigt.
    const schlecht: string[] = [];
    for (const pfad of links.intern.slice(0, 40)) {
      const antwort = await page.goto(basis + pfad, { waitUntil: "domcontentloaded", timeout: 30_000 })
        .catch(() => null);
      await page.waitForTimeout(400);
      const status = antwort?.status() ?? 0;
      const zeigt404 = await page.evaluate(
        () => /404|nicht gefunden|not found/i.test(document.body.innerText.slice(0, 400)));
      if (status >= 400 || zeigt404) schlecht.push(`${pfad} (${status}${zeigt404 ? ", 404-Ansicht" : ""})`);
    }
    befunde.push({
      kontrolle: "4.3", gate: true, status: schlecht.length > 0 ? "gefallen" : "bestanden",
      seite: SEITEN[0].pfad, breite: 1280,
      auswahl: schlecht.slice(0, SCHWELLEN.liste_laenge).join(" · ") || undefined,
      gemessen: schlecht.length, schwelle: 0,
      notiz: `${links.intern.length} interne Wege gefunden, ${Math.min(links.intern.length, 40)} angesteuert · `
        + `${links.extern.length} externe Adressen und ${links.post.length} mailto/tel wurden nicht angefasst `
        + "(externe Ziele gehören nicht in einen automatischen Lauf).",
    });

    const unsinn = await page.goto(basis + UNSINN_PFAD, { waitUntil: "domcontentloaded", timeout: 30_000 })
      .catch(() => null);
    await page.waitForTimeout(1200);
    const zurueck = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).some((a) => {
        const h = (a as HTMLAnchorElement).getAttribute("href") ?? "";
        return h === "/" || h.endsWith("/");
      }));
    const status = unsinn?.status() ?? 0;
    befunde.push({
      kontrolle: "4.5", gate: true,
      status: status === 404 && zurueck ? "bestanden" : "gefallen",
      seite: UNSINN_PFAD, breite: 1280,
      gemessen: `Status ${status}, Weg zurück ${zurueck ? "vorhanden" : "fehlt"}`,
      schwelle: "Status 404 und ein Weg zurück",
      notiz: status === 200
        ? "Die Adresse antwortet mit 200. Bei einer SPA mit Rewrite ist das die Hülle — für "
          + "Suchmaschinen ist eine erfundene Adresse damit eine gültige Seite. Wer den Status "
          + "setzen will, braucht Vorrendern oder eine 404-Regel am Rand; in Phase 0 gibt es "
          + "beides noch nicht."
        : "",
    });
  } catch (e) {
    befunde.push({
      kontrolle: "4.3", gate: true, status: "nicht_pruefbar", seite: SEITEN[0].pfad, breite: 1280,
      gemessen: null, schwelle: null, notiz: `Wege-Prüfung abgebrochen: ${(e as Error).message}`,
    });
  } finally {
    await page.close();
  }
  return befunde;
}

async function haupt() {
  const freieAdresse = argument("adresse") ?? process.env.PRUEFSTAND_ADRESSE?.trim();
  const zielName = (freieAdresse ? "vorschau" : (argument("ziel") ?? VORGABE_ZIEL)) as ZielName;
  const ziel = freieAdresse
    ? { adresse: freieAdresse.replace(/\/+$/, ""), hinweis: "frei übergebene Adresse" }
    : ZIELE[zielName];
  if (!ziel || !ziel.adresse) {
    console.error(
      `Kein messbares Ziel „${zielName}". Bekannt: ${Object.keys(ZIELE).join(", ")}. `
      + "Die Vorschau braucht --adresse https://…",
    );
    process.exit(2);
  }
  const nurSeiten = argument("seiten")?.split(",").map((s) => s.trim());
  const seiten = nurSeiten ? SEITEN.filter((s) => nurSeiten.includes(s.name)) : SEITEN;
  const nurBreiten = argument("breiten")?.split(",").map((b) => Number(b.trim()));
  const breiten = nurBreiten ? BREITEN.filter((b) => nurBreiten.includes(b.breite)) : BREITEN;

  /*
   * Steht ein Ausgangs-Proxy in der Umgebung (Container, CI), muss der Browser
   * ihn benutzen — sonst misst er nur einen Verbindungsfehler. Für ein lokales
   * Ziel gilt das nicht: die Umleitung über den Proxy beantwortet 127.0.0.1
   * mit 405. Chromium versteht die üblichen NO_PROXY-Listen mit CIDR und
   * Sternchen nicht; eine falsch geparste Liste schaltet den Proxy
   * stillschweigend ganz ab.
   */
  const lokalesZiel = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(ziel.adresse).hostname);
  const proxyServer = lokalesZiel ? undefined : (process.env.HTTPS_PROXY ?? process.env.https_proxy);
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PFAD,
    proxy: proxyServer ? { server: proxyServer, bypass: "localhost,127.0.0.1,::1" } : undefined,
  });

  const befunde: Befund[] = [];
  for (const seite of seiten) {
    for (const breite of breiten) {
      process.stderr.write(`… ${seite.pfad} @ ${breite.name}\n`);
      befunde.push(...await seiteMessen(browser, ziel.adresse, seite, breite));
    }
  }

  /*
   * 3.9 — zweiter Durchlauf mit „Bewegung reduzieren".
   *
   * Zwei Lagen, nicht eine: einmal das Telefon hochkant, einmal der
   * Schreibtisch. Der Fallback muss auf beiden Seiten derselbe sein, und ein
   * Fehler, der nur auf einer Breite auftritt, fällt bei einer Lage nicht auf.
   */
  const bewegungsLagen = [BREITEN[0], BREITEN[2]]
    .filter((b, i, alle) => alle.indexOf(b) === i)
    .filter((b) => breiten.includes(b));
  for (const seite of seiten) {
    for (const lage of bewegungsLagen) {
      process.stderr.write(`… ${seite.pfad} @ ${lage.name} (Bewegung reduziert)\n`);
      befunde.push(...await seiteMessen(browser, ziel.adresse, seite, lage, true));
    }
  }

  process.stderr.write("… Wege und 404\n");
  if (!NUR_KONTROLLEN) befunde.push(...await wegeUnd404(browser, ziel.adresse));
  await browser.close();

  const gates = befunde.filter((b) => b.gate);
  const bericht = {
    ziel: zielName,
    adresse: ziel.adresse,
    zeitpunkt: new Date().toISOString(),
    commit: commit(),
    // Steht hier etwas, war es ein Teillauf: die Gate-Zahlen unten zählen dann
    // nur diese Kontrollen und sind kein Gesamtstand.
    nur_kontrollen: NUR_KONTROLLEN ?? null,
    gates: {
      bestanden: gates.filter((b) => b.status === "bestanden").length,
      gefallen: gates.filter((b) => b.status === "gefallen").length,
      nicht_pruefbar: gates.filter((b) => b.status === "nicht_pruefbar").length,
    },
    befunde,
  };

  mkdirSync(ORDNER, { recursive: true });
  writeFileSync(join(ORDNER, "bericht.json"), JSON.stringify(bericht, null, 2));

  const heute = new Date().toISOString().slice(0, 10);
  const gefalleneBefunde = gates.filter((b) => b.status === "gefallen");
  const entschuldigt = gefalleneBefunde.filter((b) => ausnahmeFuer(b.kontrolle, heute) !== null);
  const gefallen = gefalleneBefunde.length - entschuldigt.length;
  const verstrichen = abgelaufen(heute)
    .filter((a) => gefalleneBefunde.some((b) => b.kontrolle === a.kontrolle));
  const aktiveAusnahmen = [...new Set(entschuldigt.map((b) => ausnahmeFuer(b.kontrolle, heute)!))];

  process.stderr.write(
    `\n${zielName} · ${ziel.adresse}\n`
    + (NUR_KONTROLLEN ? `TEILLAUF — nur ${NUR_KONTROLLEN.join(", ")}\n` : "")
    + `Gates: ${bericht.gates.bestanden} bestanden · ${gefallen} gefallen · `
    + `${bericht.gates.nicht_pruefbar} nicht prüfbar`
    + (aktiveAusnahmen.length > 0
      ? ` · ${aktiveAusnahmen.length} Ausnahme(n) aktiv (${entschuldigt.length} Befund(e) entschuldigt)`
      : "")
    + `\nBericht: pruefstand/artefakte/bericht.json\n`,
  );

  if (aktiveAusnahmen.length > 0) {
    process.stderr.write(`\nDokumentierte Ausnahmen (zählen nicht als gefallen — bis zum Wecker):\n`);
    for (const a of aktiveAusnahmen) {
      process.stderr.write(`  ${a.kontrolle.padEnd(5)} ${a.name} · Termin ${a.termin} · Wecker ${a.wecker}\n`);
    }
  }
  if (verstrichen.length > 0) {
    process.stderr.write(`\nAUSNAHME ABGELAUFEN — zählt wieder als gefallen:\n`);
    for (const a of verstrichen) {
      process.stderr.write(
        `  ${a.kontrolle.padEnd(5)} ${a.name} · Wecker war ${a.wecker}. `
        + `Verlängern geht nur bewusst, in ausnahmen.ts.\n`,
      );
    }
  }

  /*
   * Im Teillauf: ALLE Befunde der gefragten Kontrollen, auch die bestandenen.
   * Wer ausdrücklich nach drei Kontrollen fragt, will ihre Zahlen sehen und
   * nicht ihr Urteil. „Kein Gate gefallen" beantwortet keine Frage nach einer
   * Zahl — es sagt nur, dass niemand widersprochen hat.
   */
  if (NUR_KONTROLLEN) {
    const liste = befunde.filter((b) => passtZurFrage(b.kontrolle));
    process.stderr.write(
      `\nBefunde der gefragten Kontrollen — plus jede Seite, die gar nicht gemessen wurde (${liste.length}):\n`,
    );
    for (const b of liste.slice(0, 200)) {
      const ort = `${b.seite} @ ${b.breite}px`;
      const beleg = [
        b.gemessen !== null ? `gemessen ${b.gemessen}` : null,
        b.schwelle !== null ? `soll ${b.schwelle}` : null,
        b.notiz,
      ].filter(Boolean).join(" · ");
      process.stderr.write(`  ${b.status.padEnd(14)} ${b.kontrolle.padEnd(8)} ${ort.padEnd(34)} ${beleg}\n`);
    }
  }

  /*
   * Die gefallenen Gates einzeln ins Log.
   *
   * `bericht.json` bleibt die vollständige Quelle; diese Liste ist der Auszug,
   * den man ohne Download lesen kann. Eine Zahl ohne Fundstelle ist kein
   * Befund, sondern eine Behauptung — deshalb steht in jeder Zeile, WAS
   * gemessen wurde, WOGEGEN und WO.
   */
  if (gefallen > 0) {
    const liste = gefalleneBefunde.filter((b) => ausnahmeFuer(b.kontrolle, heute) === null);
    process.stderr.write(`\nGefallene Gates (${liste.length}):\n`);
    for (const b of liste.slice(0, 60)) {
      const ort = `${b.seite} @ ${b.breite}px`;
      const beleg = [
        b.auswahl,
        b.gemessen !== null ? `gemessen ${b.gemessen}` : null,
        b.schwelle !== null ? `soll ${b.schwelle}` : null,
        b.notiz,
      ].filter(Boolean).join(" · ");
      process.stderr.write(`  ${b.kontrolle.padEnd(5)} ${ort.padEnd(44)} ${beleg}\n`);
    }
    if (liste.length > 60) {
      process.stderr.write(`  … ${liste.length - 60} weitere, vollständig in bericht.json\n`);
    }
  }

  process.exit(gefallen > 0 ? 1 : 0);
}

void haupt();
