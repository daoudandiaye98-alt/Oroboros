/**
 * Erzeugt die Bildsequenzen der Landing — zwei Formatsätze, je zwei Stufen —
 * und vermisst den Ring in jedem Frame der Rückfahrt.
 *
 *   node scripts/sequenz-bauen.mjs
 *
 * Läuft NICHT im Vercel-Build. Die fertigen Frames liegen unter `public/seq/`
 * im Repo, damit die Auslieferung kein ffmpeg braucht.
 *
 * ZWEI STUFEN, WEIL ES ZWEI FRAGEN SIND.
 *   Vorlauf  jeder vierte Frame, klein und grob. Er entscheidet, WANN die
 *            Seite freigegeben wird.
 *   Voll     alle Frames in voller Auflösung, Güte 68. Er entscheidet, WIE
 *            SCHARF das Bild ist, und strömt im Hintergrund nach.
 *
 * ZWEI ABSCHNITTE, WEIL ES ZWEI FILME SIND.
 *   1…100    der Hauptfilm: Wirbel, Düne, Traverse, Einrollen.
 *   101…170  die Rückfahrt: die Kamera zieht zurück, der Ring wird klein.
 *
 * DER HAUPTABSCHNITT WIRD NICHT NEU KODIERT, wo er schon existiert. Der
 * Bauauftrag verbietet es ausdrücklich, und die Prüfung vergleicht die
 * Prüfsummen. Das Skript prüft deshalb, ob die Frames schon da sind, und rührt
 * sie dann nicht an.
 *
 * DER VORLAUF ENTSTEHT AUS DEN FERTIGEN FRAMES, nicht aus dem Film. Zweimal
 * unabhängig abzutasten hieße, zwei um Sekundenbruchteile verschobene Reihen
 * zu bekommen; beim Ersetzen im Array spränge das Bild.
 *
 * ————————————————————————————————————————————————————————————————————————
 * WARUM DIE RÜCKFAHRT VERMESSEN WIRD
 * ————————————————————————————————————————————————————————————————————————
 *
 * Am Ende muss der Ring des Tieres genau so groß auf dem Schirm stehen, wie
 * das erste O des Wortes es verlangt. Bis zum Kontinuitäts-Auftrag wurde er
 * dafür SKALIERT — das Bild wurde kleiner als sein Fenster, und der freie Rand
 * war die sichtbare Kante, die diesen Auftrag ausgelöst hat.
 *
 * Jetzt kommt die Größe aus der WAHL DES FRAMES. Die Kamera fährt zehn
 * Sekunden zurück und durchläuft dabei jedes gebrauchte Maß; welcher Frame
 * gebraucht wird, hängt vom Fenster ab und wird zur Laufzeit gerechnet. Dafür
 * braucht die Laufzeit zu JEDEM Frame Mitte und Durchmesser des Rings — das
 * ist `ring.json`.
 *
 * Der Anker je Satz steht unten. Er ist die eine Messung, die von Hand kommt:
 * über Frame 0 wurde eine Ellipse gelegt und nachgezogen, bis sie die
 * Außenkante des Körpers rundherum berührt (`pruefstand/ringmass.mjs`, die
 * Aufnahmen liegen im Bericht). Alles Weitere verfolgt der Detektor selbst.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import { ringMessen } from "./ring-messen.mjs";

const BILDRATE = 10;
const VORLAUF_SCHRITT = 4;
const VOLL_GUETE = 68;
const HAUPT_FRAMES = 100;

/**
 * Wie viele Frames der Rückfahrt je Satz kodiert werden — und warum es je
 * Satz eine andere Zahl ist.
 *
 * Der Bauauftrag sagt: „Die Bühne endet an dem Frame, an dem der Ring das
 * Lockup-Maß erreicht — und keinen Frame später. Alle Frames nach dem
 * gewählten werden nicht kodiert." Welcher Frame das ist, hängt vom FENSTER
 * ab, und das Bauskript kennt kein Fenster. Kodiert wird deshalb bis zum
 * tiefsten Maß, das ein Fenster DIESES Satzes verlangen kann.
 *
 * Das Zielmaß ist neu: der Ring soll 0,1456 der Fensterbreite messen — das
 * ist der Mittelwert der beiden Zeilen aus §6 (57 px auf 390, 209 px auf
 * 1440). Bis zum Kontinuitätsauftrag waren es 0,231; der Ring wird also
 * kleiner und die Fahrt länger, nicht kürzer.
 *
 * Gerechnet wird mit
 *
 *     zielAnteil = 0,1456 · fensterB / zeigB      zeigB = Bildbreite · Deckung
 *
 * also 0,1456, sobald die Breite die Deckung bestimmt, und
 * 0,1456 · (fensterB/fensterH) · (bildH/bildB), solange die Höhe es tut.
 *
 *   3:4   Hochformat, immer höhengedeckt. Das schmalste ausgelieferte
 *         Telefon liegt bei W/H 0,42 → zielAnteil 0,0816. Gemessen ist der
 *         Ring bei Frame 75 auf 0,0817 der Bildbreite. Kodiert: 78.
 *   16:9  Querformat. Unter W/H 1,793 höhengedeckt, darüber breitengedeckt.
 *         Das ungünstigste ist W/H 1,20 → zielAnteil 0,0975; gemessen bei
 *         Frame 48. Kodiert: 55.
 *
 * Es gibt eine harte Obergrenze von unten: unterhalb von rund 0,09 der
 * Bildbreite ist der Ring bei der Messbreite 320 keine zehn Bildpunkte mehr
 * groß, und der Detektor springt (in der 3:4-Fahrt ab Frame 83 um 15 bis
 * 21 % je Frame). Beide Zahlen liegen darunter, und die Monotonieprüfung
 * unten fängt den Fall ohnehin ab.
 */
const RUECK_FRAMES = { "film-3x4": 78, "film-16x9": 55 };

/**
 * Die zwei Sätze, mit dem Anker ihrer Ringvermessung.
 *
 * Der 9:16-Satz ist fort. Der Prolog liegt nur in 3:4 und 16:9 vor, und ein
 * Hochformat-Telefon, das den Prolog in 3:4 sieht und die Heldensequenz in
 * 9:16, bekommt an der Fuge einen Schnitt von 16,7 von 255 — dieselbe Szene
 * in zwei verschiedenen Aufnahmen. Mit dem 3:4-Satz sind es 3,1.
 *
 * `breite`/`hoehe` ist das Maß, in dem der Hauptabschnitt bereits kodiert IST.
 * Die neuen Rückfahrten liegen in genau diesen Maßen vor — an der Fuge zwischen
 * Frame 100 und 101 gibt es deshalb nichts zu skalieren und nichts zu
 * beschneiden.
 *
 * `anker` ist die Handmessung an Frame 0 der Rückfahrt: Mitte als Anteil der
 * Bildbreite bzw. -höhe, `d` der Außendurchmesser des Körpers als Anteil der
 * BILDBREITE, `mittellinie` derselbe Ring auf der Mitte des Körpers gemessen.
 * Der Detektor verfolgt die Mittellinie und leitet die Kante in jedem Frame
 * frisch daraus ab — siehe `ring-messen.mjs`.
 */
const SAETZE = [
  {
    name: "film-3x4", haupt: "film-3x4", rueck: "rueckfahrt-3x4",
    breite: 828, hoehe: 1108, vorBreite: 360, vorGuete: 52,
    anker: { cx: 0.4882, cy: 0.4968, d: 0.5029, mittellinie: 0.4941 },
  },
  {
    name: "film-16x9", haupt: "film-16x9", rueck: "rueckfahrt-16x9",
    breite: 1284, hoehe: 716, vorBreite: 480, vorGuete: 55,
    anker: { cx: 0.5156, cy: 0.5040, d: 0.2439, mittellinie: 0.2380 },
  },
];

const zeit = (kb, mbit) => (kb * 8 / 1024 / mbit).toFixed(1);
const nummer = (i) => `f${String(i).padStart(3, "0")}`;

/** Wandelt alle PNG eines Ordners in WebP und löscht die PNG. */
async function nachWebp(ordner, guete) {
  const pngs = readdirSync(ordner).filter((n) => n.endsWith(".png")).sort();
  for (const png of pngs) {
    const von = join(ordner, png);
    await sharp(von).webp({ quality: guete }).toFile(von.replace(/\.png$/, ".webp"));
    unlinkSync(von);
  }
  return pngs.length;
}

function gewicht(ordner) {
  return readdirSync(ordner)
    .filter((n) => n.endsWith(".webp"))
    .reduce((s, n) => s + statSync(join(ordner, n)).size, 0);
}

for (const satz of SAETZE) {
  const voll = join("public/seq", satz.name);
  mkdirSync(voll, { recursive: true });

  /* ————— Hauptabschnitt: nur, wenn er fehlt ————— */
  if (existsSync(join(voll, nummer(HAUPT_FRAMES) + ".webp"))) {
    console.log(`${satz.name.padEnd(11)} Hauptabschnitt vorhanden — nicht angefasst`);
  } else {
    execFileSync(ffmpeg, [
      "-hide_banner", "-loglevel", "error",
      "-i", join("assets", `${satz.haupt}.mp4`),
      "-vf", `fps=${BILDRATE},scale=${satz.breite}:${satz.hoehe}:force_original_aspect_ratio=increase,crop=${satz.breite}:${satz.hoehe}`,
      join(voll, "f%03d.png"),
    ]);
    const n = await nachWebp(voll, VOLL_GUETE);
    console.log(`${satz.name.padEnd(11)} Hauptabschnitt neu: ${n} Frames à ${satz.breite}px`);
  }

  /* ————— Rückfahrt: immer neu, angehängt ab 101 ————— */
  // Alte Rückfahrten fallen weg. Sie stammen aus den Fünfsekündern und sind
  // durch die weiten Fahrten ersetzt; stehen bleiben dürfen sie nicht, sonst
  // hinge hinter dem neuen Ende noch das alte.
  for (const n of readdirSync(voll)) {
    const i = Number(n.slice(1, 4));
    if (n.endsWith(".webp") && i > HAUPT_FRAMES) unlinkSync(join(voll, n));
  }
  const zwischen = `${voll}--rueck`;
  rmSync(zwischen, { recursive: true, force: true });
  mkdirSync(zwischen, { recursive: true });
  execFileSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error",
    "-i", join("assets", `${satz.rueck}.mp4`),
    "-vf", `fps=${BILDRATE},scale=${satz.breite}:${satz.hoehe}:force_original_aspect_ratio=increase,crop=${satz.breite}:${satz.hoehe}`,
    "-frames:v", String(RUECK_FRAMES[satz.name]),
    join(zwischen, "f%03d.png"),
  ]);

  /* ————— Der Ring, Frame für Frame ————— */
  // Gemessen wird auf den PNG, bevor sie zu WebP werden: die Messung soll die
  // Kamerafahrt sehen, nicht die Artefakte der Kompression.
  const pngs = readdirSync(zwischen).filter((n) => n.endsWith(".png")).sort();
  const roh = [];
  let vorher = satz.anker;
  for (const png of pngs) {
    const r = await ringMessen(join(zwischen, png), vorher);
    vorher = r;
    roh.push(r);
  }

  /*
   * DER DURCHMESSER KOMMT AUS DER MITTELLINIE MAL EINEM FAKTOR, NICHT AUS DER
   * KANTENSUCHE JE FRAME.
   *
   * Beide Größen sind gemessen, aber sie sind verschieden gut zu messen. Die
   * Mittellinie ist ein Helligkeitsmaximum auf einer Fläche und läuft ruhig:
   * über die kodierten siebzig Frames ist der größte Schritt 1,7 %. Die
   * Außenkante ist ein Übergang, ihr Maximum ist flach, und Sandkräusel
   * verschieben es — ihr Verhältnis zur Mittellinie schwankt zwischen 1,084
   * und 1,132.
   *
   * Dieses Verhältnis ist aber physikalisch KONSTANT: es ist die Dicke des
   * Schlangenkörpers im Verhältnis zum Ring, und eine reine Zoomfahrt ändert
   * daran nichts. Der Median über alle Frames ist damit die beste Schätzung
   * einer Größe, die sich nicht ändert — und er glättet, ohne etwas zu
   * erfinden.
   *
   * Geprüft an der Handmessung: 3:4, Frame 40, Mittellinie 0,2008, Faktor
   * 1,108 → 0,2225. Von Hand an der Aufnahme abgelesen: 0,2231.
   */
  const verhaeltnisse = roh.map((r) => r.kanteRoh / r.mittellinie).sort((a, b) => a - b);
  const faktor = verhaeltnisse[Math.floor(verhaeltnisse.length / 2)];

  const ringe = roh.map((r) => ({
    cx: Number(r.cx.toFixed(5)),
    cy: Number(r.cy.toFixed(5)),
    d: Number((r.mittellinie * faktor).toFixed(5)),
  }));

  /*
   * Die Messung muss monoton fallen — die Kamera fährt nur zurück.
   *
   * Ein Anstieg heißt: der Detektor ist auf etwas anderes gesprungen. Das darf
   * nicht still durchgehen, denn eine falsche Ringgröße heißt ein Ring, der
   * neben seinem Buchstaben steht, und das sieht man erst in der Aufnahme.
   *
   * Die Schwelle liegt bei 3 %, und zwar gemessen: über die siebzig kodierten
   * Frames ist der größte echte Schritt nach oben 1,7 % Rauschen. Ein
   * verlorener Ring sieht ganz anders aus — ab Frame 83, wo der Ring auf zehn
   * Bildpunkte Radius geschrumpft ist, springt die Messung um 15 bis 21 %.
   * Genau deshalb enden die kodierten Frames vorher.
   */
  let ausreisser = 0;
  for (let i = 1; i < ringe.length; i++) if (ringe[i].d > ringe[i - 1].d * 1.03) ausreisser++;
  if (ausreisser > 0) {
    throw new Error(
      `${satz.name}: ${ausreisser} Frame(s), in denen der Ring um über 3 % wächst. `
      + "Der Detektor hat den Ring verloren — nicht weiterbauen.",
    );
  }

  writeFileSync(join(voll, "ring.json"), JSON.stringify({
    hauptFrames: HAUPT_FRAMES,
    bild: { breite: satz.breite, hoehe: satz.hoehe },
    ringe,
  }));

  await nachWebp(zwischen, VOLL_GUETE);
  readdirSync(zwischen).filter((n) => n.endsWith(".webp")).sort()
    .forEach((n, i) => renameSync(join(zwischen, n), join(voll, nummer(HAUPT_FRAMES + 1 + i) + ".webp")));
  rmSync(zwischen, { recursive: true, force: true });

  /* ————— Vorlauf: aus den fertigen Frames herunterrechnen ————— */
  const vor = `${voll}-vor`;
  rmSync(vor, { recursive: true, force: true });
  mkdirSync(vor, { recursive: true });
  const gesamt = HAUPT_FRAMES + RUECK_FRAMES[satz.name];
  let vorZahl = 0;
  for (let i = 0; i < gesamt; i += VORLAUF_SCHRITT) {
    await sharp(join(voll, nummer(i + 1) + ".webp"))
      .resize({ width: satz.vorBreite })
      .webp({ quality: satz.vorGuete })
      .toFile(join(vor, nummer(vorZahl + 1) + ".webp"));
    vorZahl++;
  }

  const vg = gewicht(voll), wg = gewicht(vor);
  console.log(
    `${"".padEnd(11)} voll ${String(gesamt).padStart(3)} Frames`
    + ` · ${(vg / 1024 / 1024).toFixed(2)} MB · 1,6 Mbit/s ${zeit(vg / 1024, 1.6)} s`,
  );
  console.log(
    `${"".padEnd(11)} vor  ${String(vorZahl).padStart(3)} Frames à ${satz.vorBreite}px`
    + ` · ${(wg / 1024).toFixed(0)} kB`,
  );
  console.log(
    `${"".padEnd(11)} Ring ${ringe[0].d.toFixed(4)} → ${ringe.at(-1).d.toFixed(4)} der Bildbreite`
    + ` · Mitte ${ringe[0].cx.toFixed(3)}/${ringe[0].cy.toFixed(3)}`
    + ` → ${ringe.at(-1).cx.toFixed(3)}/${ringe.at(-1).cy.toFixed(3)}`
    + ` · Kantenfaktor ${faktor.toFixed(4)}`,
  );
}
