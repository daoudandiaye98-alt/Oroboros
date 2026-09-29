/* Prüfstand · Audit für oroboros-design.com
   ─────────────────────────────────────────────────────────────────────────────
   Misst, statt zu schätzen. Lädt / und /en bei 1440×900 und 390×844 (mobil
   emuliert) und prüft:

     Konsole        Fehler und Warnungen, nicht abgefangene Ausnahmen
     Netz           fehlgeschlagene Anfragen, Antworten ≥ 400
     Layout         CLS (PerformanceObserver), waagerechtes Scrollen
     Laufzeit       lange Aufgaben nach load, Bildzeiten beim Scrollen durch die
                    Bühne (p50/p95/p99), Bilder > 50 ms
     Leistung       FCP / LCP bei vierfach gedrosselter CPU, Ladegewicht
     Verweise       jeder interne Link (auch /arbeiten/*, Rechtsseiten, Anker),
                    Kauflinks nur im Format — ein GET legte bei Angel einen
                    Auftrag an
     Zugänglichkeit Überschriftenfolge, Alternativtexte, Beschriftungen,
                    sichtbarer Fokus, Kontrast Fließtext ≥ 4,5:1 (Dokument aus
                    den CSS-Farben, Bühne aus Bildpunkten unter dem Text)
     Bewegung       prefers-reduced-motion: Standbild statt WebGL, nur Deckkraft
     Ausfall        Bühnenmodul gesperrt / kein WebGL: alles bleibt lesbar
     Angel          Beratungs-Widget gegen den Vertrag (Schnittstelle gestellt)
     Formular       Website-Check gegen den Vertrag (Schnittstelle gestellt)
     SEO            Titel, Beschreibung, canonical, hreflang, Open Graph,
                    JSON-LD, robots.txt, sitemap.xml
     Zwilling       index.html und en.html: Stil, Skripte, Aufbau identisch

   Aufruf:  node pruefstand/audit.mjs [--basis=URL] [--json=DATEI] [--schnell]
   Ohne --basis startet ein eigener Server mit den Adressregeln von Vercel
   (pruefstand/server.mjs), sonst prüft das Audit die angegebene Adresse.

   Ehrlich vorweg: Chromium headless rendert WebGL mit SwiftShader auf der CPU.
   Bildzeiten sind dort um ein Vielfaches schlechter als auf jeder echten
   Grafikkarte — sie taugen zum Vergleich vorher/nachher, nicht als Aussage
   über ein Telefon.                                                            */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
/* --wurzel=VERZEICHNIS prüft einen anderen Stand derselben Seite (z. B. einen
   git worktree des Vorgängers) mit demselben Messgerät — vorher/nachher ehrlich */
const WURZEL = ARGS.wurzel ? path.resolve(String(ARGS.wurzel)) : path.resolve(HIER, '..');
const SCHNELL = Boolean(ARGS.schnell);
/* --nur=seiten,angel … führt nur diese Teile aus (zum Nacharbeiten) */
const NUR = ARGS.nur ? new Set(String(ARGS.nur).split(',')) : null;
const teil = (n) => !NUR || NUR.has(n);
/* --profil=desktop|mobil und --pfad=/|/en schränken die Hauptmatrix ein */
const PROFILE_LAUF = ARGS.profil ? [String(ARGS.profil)] : ['desktop', 'mobil'];
const PFADE_LAUF = ARGS.pfad ? [String(ARGS.pfad)] : ['/', '/en'];

/* Kauflinks: nur diese Schlüssel sind vereinbart. */
const ANGEBOTE = [
  'nennbar_paket', 'nennbar_einbau', 'nennbar_monitor', 'nennbar_pruefliste_100', 'nennbar_pruefliste_500',
  'losgeschickt_beta', 'losgeschickt_monat', 'losgeschickt_plus', 'bildtakt_auftakt', 'bildtakt_takt',
  'website_48h', 'ki_automation_starter', 'ki_chat_website', 'ki_content_takt',
];
const ANLIEGEN = ['website_check', 'neue_website', 'software', 'ki', 'sonstiges'];
const ANGEL_ERSTE = {
  // Auftrag: „Sag mir …“ — auf der Seite durchgehend gesiezt: „Sagen Sie mir …“
  de: 'Ich bin Angel. Sagen Sie mir in einem Satz, was Sie brauchen — eine Website, Sichtbarkeit in KI-Antworten, Automation oder Video.',
  en: 'I’m Angel. Tell me in one sentence what you need — a website, visibility in AI answers, automation or video.',
};

/* ── Playwright finden: lokal, NODE_PATH oder global ─────────────────────── */
async function ladePlaywright() {
  try { return await import('playwright'); } catch { /* weiter */ }
  const orte = [];
  if (process.env.NODE_PATH) orte.push(...process.env.NODE_PATH.split(path.delimiter));
  try { orte.push(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()); } catch { /* weiter */ }
  orte.push('/home/claude/.npm-global/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules');
  for (const ort of orte) {
    try { return createRequire(path.join(ort, 'noop.js'))('playwright'); } catch { /* weiter */ }
  }
  throw new Error('Playwright nicht gefunden (npm i -g playwright; Browser liegen unter PLAYWRIGHT_BROWSERS_PATH).');
}

/* ── Kleine Werkzeuge ────────────────────────────────────────────────────── */
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
function perzentil(werte, p) {
  if (!werte.length) return null;
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
}
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

/* Relative Leuchtdichte und Kontrast nach WCAG 2.x */
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const leucht = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const kontrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/* PNG → RGBA, ohne Fremdpaket (8 Bit, nicht verschachtelt — so liefert Chromium) */
function dekodierePng(buf) {
  let pos = 8, breite = 0, hoehe = 0, tiefe = 0, typ = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const art = buf.toString('ascii', pos + 4, pos + 8);
    const d = buf.subarray(pos + 8, pos + 8 + len);
    if (art === 'IHDR') { breite = d.readUInt32BE(0); hoehe = d.readUInt32BE(4); tiefe = d[8]; typ = d[9]; if (d[12] !== 0) throw new Error('PNG verschachtelt'); }
    else if (art === 'IDAT') idat.push(d);
    else if (art === 'IEND') break;
    pos += 12 + len;
  }
  if (tiefe !== 8) throw new Error(`PNG-Bittiefe ${tiefe}`);
  const kan = { 0: 1, 2: 3, 4: 2, 6: 4 }[typ];
  const roh = zlib.inflateSync(Buffer.concat(idat));
  const zeile = breite * kan;
  const rgba = Buffer.alloc(breite * hoehe * 4);
  let vor = Buffer.alloc(zeile), p = 0;
  for (let y = 0; y < hoehe; y++) {
    const f = roh[p++];
    const cur = Buffer.from(roh.subarray(p, p + zeile)); p += zeile;
    for (let x = 0; x < zeile; x++) {
      const a = x >= kan ? cur[x - kan] : 0, b = vor[x], c = x >= kan ? vor[x - kan] : 0;
      let v = cur[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < breite; x++) {
      const o = (y * breite + x) * 4, i = x * kan;
      if (kan >= 3) { rgba[o] = cur[i]; rgba[o + 1] = cur[i + 1]; rgba[o + 2] = cur[i + 2]; rgba[o + 3] = kan === 4 ? cur[i + 3] : 255; }
      else { rgba[o] = rgba[o + 1] = rgba[o + 2] = cur[i]; rgba[o + 3] = kan === 2 ? cur[i + 1] : 255; }
    }
    vor = cur;
  }
  return { breite, hoehe, rgba };
}

/* ── Was in jeder Seite vor dem ersten Skript mitläuft ───────────────────── */
const MESSFUEHLER = `
(() => {
  const A = window.__audit = { schichten: [], lang: [], lcp: null, webgl: [], raf: 0, fehler: [] };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) A.schichten.push({ t: e.startTime, v: e.value,
      quellen: (e.sources || []).map((s) => s.node ? (s.node.id ? '#' + s.node.id : (s.node.className && s.node.className.baseVal === undefined ? '.' + String(s.node.className).split(' ')[0] : s.node.nodeName)) : '?').slice(0, 3) }); })
      .observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) A.lang.push({ t: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
  try {
    new PerformanceObserver((l) => { const e = l.getEntries(); const z = e[e.length - 1];
      A.lcp = { t: z.startTime, groesse: z.size, element: z.element ? (z.element.tagName + (z.element.id ? '#' + z.element.id : '') + (z.element.className && typeof z.element.className === 'string' ? '.' + z.element.className.split(' ')[0] : '')) : null }; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (_) {}
  const roh = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (art, ...rest) {
    const ctx = roh.call(this, art, ...rest);
    if (/webgl/i.test(String(art))) {
      let renderer = null;
      try { const ext = ctx && ctx.getExtension('WEBGL_debug_renderer_info'); renderer = ctx && ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null; } catch (_) {}
      A.webgl.push({ art: String(art), ok: Boolean(ctx), renderer });
    }
    return ctx;
  };
  const rafRoh = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) => { A.raf++; return rafRoh(fn); };
})();`;

const KEIN_WEBGL = `
(() => {
  const roh = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (art, ...rest) {
    if (/webgl/i.test(String(art))) return null;
    return roh.call(this, art, ...rest);
  };
})();`;

/* ── Ausführungsrahmen ───────────────────────────────────────────────────── */
/* Chromium ohne Zusatzschalter: WebGL läuft dort über SwiftShader und trägt das
   Merkmal „major performance caveat“ — genau wie bei einem Besucher, dessen
   Grafiktreiber gesperrt ist. (--use-angle=swiftshader würde das Merkmal
   verdecken und SwiftShader als echte Grafikkarte ausgeben.) Die lebende Bühne
   misst das Audit trotzdem: mit ?webgl=erzwingen. */
const GL_ARGS = [];
const PROFILE = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobil: {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  },
};

const UMGEBUNG_MELDUNGEN = [/Automatic fallback to software WebGL has been deprecated/, /GPU stall due to ReadPixels/];

let BASIS = '';
let playwright, browser;

async function neueSeite(profil, extra = {}) {
  const ctx = await browser.newContext({ ...PROFILE[profil], ...extra.kontext });
  await ctx.addInitScript({ content: MESSFUEHLER });
  if (extra.keinWebgl) await ctx.addInitScript({ content: KEIN_WEBGL });
  const page = await ctx.newPage();
  const log = { konsole: [], umgebung: [], ausnahmen: [], fehlanfragen: [], anfragen: [], gesperrt: new Set() };
  page.on('console', (m) => {
    const t = m.type();
    if (t !== 'error' && t !== 'warning') return;
    const text = m.text().slice(0, 300);
    // Vom Messaufbau verursacht, nicht von der Seite: der Hinweis auf Software-WebGL
    // (nur bei ?webgl=erzwingen) und der Stau durch die Bildschirmfotos des Audits
    if (UMGEBUNG_MELDUNGEN.some((r) => r.test(text))) log.umgebung.push({ art: t, text });
    else log.konsole.push({ art: t, text });
  });
  page.on('pageerror', (e) => log.ausnahmen.push(String(e.message || e).slice(0, 300)));
  page.on('requestfailed', (r) => {
    const f = r.failure();
    log.fehlanfragen.push({ url: r.url(), grund: f ? f.errorText : '?', gewollt: log.gesperrt.has(r.url()) });
  });
  page.on('response', async (r) => {
    const s = r.status();
    if (s >= 400) log.fehlanfragen.push({ url: r.url(), grund: `HTTP ${s}` });
  });
  page.on('request', (r) => log.anfragen.push(r.url()));
  page.__log = log;
  return { ctx, page, log };
}

async function lade(page, pfad) {
  await page.goto(BASIS + pfad, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await warte(1200);
}

/* Messgrößen der Bühne, unabhängig davon, welche Fassung der Seite läuft */
async function buehne(page) {
  return page.evaluate(() => {
    const b = window.__bronze;
    const stage = document.getElementById('stage');
    const stageH = b && b.stageH ? b.stageH() : Math.max(1, (stage ? stage.offsetHeight : innerHeight) - innerHeight);
    const anker = b && b.anker ? b.anker() : [0, 0.34, 0.62, 0.94];
    return { stageH, anker, hatMess: Boolean(b) };
  });
}

async function scrolleZu(page, y) {
  await page.evaluate((yy) => window.scrollTo({ top: yy, left: 0, behavior: 'instant' }), y);
}

/* Wartet, bis der geglättete Bühnenwert dem Ziel folgt (höchstens 8 s) */
async function wartBisRuhe(page, ziel) {
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    const s = await page.evaluate(() => (window.__bronze && window.__bronze.scroll ? window.__bronze.scroll() : null));
    if (s == null) { await warte(1500); return null; }
    if (Math.abs(s - ziel) < 0.003) { await warte(250); return s; }
    await warte(120);
  }
  return page.evaluate(() => window.__bronze.scroll());
}

/* ── Einzelprüfungen ─────────────────────────────────────────────────────── */

async function pruefeStatisch(page) {
  return page.evaluate(() => {
    const sichtbarImBaum = (el) => {
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (n.getAttribute('aria-hidden') === 'true') return false;
        const cs = getComputedStyle(n);
        if (cs.display === 'none') return false;
      }
      return true;
    };
    const h = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(sichtbarImBaum).map((e) => ({ stufe: Number(e.tagName[1]), text: (e.getAttribute('aria-label') || e.textContent).trim().replace(/\s+/g, ' ').slice(0, 60) }));
    const sprung = [];
    for (let i = 1; i < h.length; i++) if (h[i].stufe > h[i - 1].stufe + 1) sprung.push(`${h[i - 1].stufe}→${h[i].stufe} bei „${h[i].text}“`);
    const h1 = h.filter((x) => x.stufe === 1).length;
    const ohneAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.getAttribute('src'));
    const felder = [...document.querySelectorAll('input, select, textarea')].filter((f) => f.type !== 'hidden' && sichtbarImBaum(f) && !f.closest('[aria-hidden="true"]'));
    const ohneLabel = felder.filter((f) => !(f.labels && f.labels.length) && !f.getAttribute('aria-label') && !f.getAttribute('aria-labelledby')).map((f) => f.name || f.id);
    const knoepfe = [...document.querySelectorAll('button, a[href]')].filter(sichtbarImBaum);
    const ohneName = knoepfe.filter((k) => !(k.getAttribute('aria-label') || k.textContent.trim() || k.getAttribute('title') || k.querySelector('img[alt]:not([alt=""])'))).map((k) => k.outerHTML.slice(0, 80));
    return {
      lang: document.documentElement.lang || null,
      ueberschriften: { anzahl: h.length, h1, spruenge: sprung, liste: h },
      ohneAlt, ohneLabel, ohneName,
      titel: document.title,
    };
  });
}

/* Bis die Bühne steht: erstes Bild (oder Standbild) und vier Sekunden Einschwingen */
async function warteAufBuehne(page) {
  await page.waitForFunction(() => /buehne-lebt|kein-webgl/.test(document.documentElement.className) || !window.OROBOROS, null, { timeout: 30000 }).catch(() => {});
  await warte(4000);
}

/* Bildzeiten, wie ein Besucher sie bekommt: Standardadresse, eingeschwungen */
async function pruefeBildzeitenStandard(pfad, profil) {
  const { ctx, page, log } = await neueSeite(profil);
  const r = { pfad, profil };
  try {
    await lade(page, pfad);
    await warteAufBuehne(page);
    r.bildzeiten = await messeBildzeiten(page, SCHNELL ? 3500 : 7000);
    r.zustand = await page.evaluate(() => ({ klassen: document.documentElement.className, zustand: window.__bronze && window.__bronze.zustand ? window.__bronze.zustand() : null, guete: window.__bronze && window.__bronze.guete ? window.__bronze.guete() : null }));
  } catch (e) { r.abbruch = String(e.stack || e).slice(0, 400); }
  r.ausnahmen = log.ausnahmen;
  await ctx.close();
  return r;
}

/* Die Bühne in einem Zug durchscrollen und jede Bildzeit messen */
async function messeBildzeiten(page, dauerMs) {
  const { stageH } = await buehne(page);
  await scrolleZu(page, 0);
  await warte(600);
  const deltas = await page.evaluate(async ({ dauer, ende }) => new Promise((resolve) => {
    const d = [];
    let t0 = null, letzte = null;
    function tick(jetzt) {
      if (t0 === null) { t0 = jetzt; letzte = jetzt; }
      const u = Math.min(1, (jetzt - t0) / dauer);
      window.scrollTo({ top: Math.round(u * ende), left: 0, behavior: 'instant' });
      d.push(jetzt - letzte); letzte = jetzt;
      if (u < 1) requestAnimationFrame(tick); else resolve(d.slice(3));
    }
    requestAnimationFrame(tick);
  }), { dauer: dauerMs, ende: stageH });
  return {
    bilder: deltas.length,
    p50: r1(perzentil(deltas, 0.5)), p95: r1(perzentil(deltas, 0.95)), p99: r1(perzentil(deltas, 0.99)),
    max: r1(Math.max(...deltas)), ueber50: deltas.filter((x) => x > 50).length,
  };
}

async function pruefeWaagerecht(page) {
  return page.evaluate(() => {
    const vor = window.scrollX;
    window.scrollTo({ left: 400, top: window.scrollY, behavior: 'instant' });
    const x = window.scrollX;
    window.scrollTo({ left: vor, top: window.scrollY, behavior: 'instant' });
    const vw = document.documentElement.clientWidth;
    const breit = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      if (r.right > vw + 1.5) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
        let clip = false;
        // Beschnitten durch einen Kasten der Seite ist Absicht — durch body/html nur verdeckt
        for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
          const c = getComputedStyle(n);
          if ((c.overflowX === 'hidden' || c.overflowX === 'clip' || c.overflow === 'hidden') && n.getBoundingClientRect().right <= vw + 1.5) { clip = true; break; }
        }
        if (!clip) breit.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '')) + ` (${Math.round(r.right)} > ${vw})`);
      }
    }
    return { scrollX: x, scrollBreite: document.documentElement.scrollWidth, breite: vw, ueberstand: [...new Set(breit)].slice(0, 12) };
  });
}

/* Kontrast im Dokument: Farben aus CSS, Hintergrund aus den Vorfahren */
async function pruefeKontrastDokument(page) {
  return page.evaluate(() => {
    const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const t = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: t[0], g: t[1], b: t[2], a: t.length > 3 ? t[3] : 1 }; };
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const ueber = (o, u) => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a: 1 });
    const fehler = [], unsicher = [];
    let geprueft = 0;
    const wurzel = document.getElementById('doc') || document.querySelector('main') || document.body;
    const alle = [...wurzel.querySelectorAll('*'), ...document.querySelectorAll('.legal *, footer *')];
    for (const el of new Set(alle)) {
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      if (!text) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[aria-hidden="true"]') && !el.closest('label')) continue;
      if (el.closest('.check-topf, .visually-hidden, .sr-only, [hidden], dialog:not([open])')) continue;
      // Hintergrund: Schichten von innen nach außen sammeln, außen beginnen
      const schichten = [];
      let bild = false;
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n);
        if (c.backgroundImage && c.backgroundImage !== 'none' && !/^url\(/.test(c.backgroundImage)) bild = bild || n !== document.body;
        const b = parse(c.backgroundColor);
        if (b && b.a > 0) schichten.push(b);
        if (b && b.a >= 1) break;
      }
      let grund = { r: 0, g: 0, b: 0, a: 1 };
      for (let i = schichten.length - 1; i >= 0; i--) grund = ueber(schichten[i], grund);
      const f = parse(cs.color);
      if (!f) continue;
      let deck = 1;
      for (let n = el; n; n = n.parentElement) deck *= Number(getComputedStyle(n).opacity);
      const farbe = ueber({ ...f, a: f.a * deck }, grund);
      const k = (Math.max(L(farbe), L(grund)) + 0.05) / (Math.min(L(farbe), L(grund)) + 0.05);
      const px = parseFloat(cs.fontSize), w = Number(cs.fontWeight);
      const gross = px >= 24 || (px >= 18.66 && w >= 700);
      const soll = gross ? 3 : 4.5;
      geprueft++;
      const eintrag = { text: text.slice(0, 40), kontrast: Math.round(k * 100) / 100, soll, px, deck: Math.round(deck * 100) / 100 };
      if (bild) { unsicher.push(eintrag); continue; }
      if (k < soll) fehler.push(eintrag);
    }
    return { geprueft, fehler: fehler.slice(0, 20), anzahlFehler: fehler.length, unsicher: unsicher.length };
  });
}

/* Kontrast auf der Bühne: allen Text auf einmal ausblenden, den Hintergrund
   einmal fotografieren, dann je Textfeld Bildpunkt für Bildpunkt rechnen.
   Gewertet wird das 5. Perzentil — die hellsten 5 % unter dem Text zählen. */
async function pruefeKontrastBuehne(page, beschriftung) {
  const ziele = await page.evaluate(() => {
    const out = [];
    const bereiche = [...document.querySelectorAll('#stage, .main-header, #kopf')];
    const seen = new Set();
    for (const b of bereiche) for (const el of b.querySelectorAll('*')) {
      if (seen.has(el)) continue; seen.add(el);
      // Zerlegte Titel zählen als ein Ziel: der Titel, nicht jeder Buchstabe
      if (el.closest('.char, .z, .w')) continue;
      const zerlegt = el.querySelector('.char, .z');
      const text = zerlegt ? (el.getAttribute('aria-label') || el.textContent).trim() : [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      if (!text) continue;
      if (zerlegt && !el.matches('.slide-title, [aria-label]')) continue;
      if (el.closest('.visually-hidden')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let deck = 1;
      for (let n = el; n; n = n.parentElement) deck *= Number(getComputedStyle(n).opacity);
      if (zerlegt) { const zs = [...el.querySelectorAll('.char, .z')]; deck *= zs.reduce((a, z) => a + Number(getComputedStyle(z).opacity), 0) / zs.length; }
      if (deck < 0.9) continue;
      let eigen = null;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/);
        if (m) { const t = m[1].split(/[ ,/]+/).map(Number); if (t.length < 4 || t[3] > 0.9) { eigen = t; break; } }
      }
      const farbquelle = zerlegt ? getComputedStyle(zerlegt) : cs;
      const m = farbquelle.color.match(/rgba?\(([^)]+)\)/);
      const f = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      out.push({ text: text.slice(0, 40), farbe: { r: f[0], g: f[1], b: f[2], a: (f.length > 3 ? f[3] : 1) }, px: parseFloat(cs.fontSize), w: Number(cs.fontWeight), eigen,
        box: { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(innerWidth, r.right) - Math.max(0, r.left), height: Math.min(innerHeight, r.bottom) - Math.max(0, r.top) } });
      if (out.length >= 24) break;
    }
    return out;
  });
  const fehler = [];
  let geprueft = 0;
  const offen = ziele.filter((z) => !z.eigen);
  for (const z of ziele.filter((z) => z.eigen)) {
    const soll = z.px >= 24 || (z.px >= 18.66 && z.w >= 700) ? 3 : 4.5;
    const k = kontrast(leucht(z.farbe.r, z.farbe.g, z.farbe.b), leucht(z.eigen[0], z.eigen[1], z.eigen[2]));
    geprueft++;
    if (k < soll) fehler.push({ ort: beschriftung, text: z.text, kontrast: r1(k), soll });
  }
  if (!offen.length) return { geprueft, fehler };
  const stil = await page.addStyleTag({ content: '#stage *, .main-header *, #kopf * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }' });
  let png;
  try { png = await page.screenshot({ scale: 'css', animations: 'disabled' }); }
  finally { await stil.evaluate((n) => n.remove()); }
  const bild = dekodierePng(png);
  for (const z of offen) {
    const soll = z.px >= 24 || (z.px >= 18.66 && z.w >= 700) ? 3 : 4.5;
    const { r, g, b, a } = z.farbe;
    const werte = [];
    const x0 = Math.floor(z.box.x), y0 = Math.floor(z.box.y), x1 = Math.min(bild.breite, Math.ceil(z.box.x + z.box.width)), y1 = Math.min(bild.hoehe, Math.ceil(z.box.y + z.box.height));
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const i = (y * bild.breite + x) * 4;
      const br = bild.rgba[i], bg = bild.rgba[i + 1], bb = bild.rgba[i + 2];
      const fr = r * a + br * (1 - a), fg = g * a + bg * (1 - a), fb = b * a + bb * (1 - a);
      werte.push(kontrast(leucht(fr, fg, fb), leucht(br, bg, bb)));
    }
    if (!werte.length) continue;
    const k = perzentil(werte, 0.05);
    geprueft++;
    if (k < soll) fehler.push({ ort: beschriftung, text: z.text, kontrast: r1(k), soll });
  }
  return { geprueft, fehler };
}

/* Tab für Tab: bekommt jedes Ziel einen sichtbaren Fokus? */
async function pruefeFokus(page, maximal = 160) {
  await scrolleZu(page, 0);
  await warte(300);
  await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.focus(); });
  const gesehen = new Set();
  const fehler = [], verdeckt = [];
  let ziele = 0;
  for (let i = 0; i < maximal; i++) {
    await page.keyboard.press('Tab');
    await warte(40);
    const z = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const kennung = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '|' + (el.getAttribute('href') || '') + '|' + (el.textContent || el.getAttribute('aria-label') || el.name || '').trim().slice(0, 30);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
      let deck = 1;
      for (let n = el; n; n = n.parentElement) deck *= Number(getComputedStyle(n).opacity);
      const kopf = document.querySelector('.main-header');
      let fest = false;
      for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') { fest = true; break; }
      const kopfUnten = kopf && getComputedStyle(kopf).position === 'fixed' && !kopf.contains(el) && !fest ? kopf.getBoundingClientRect().bottom : 0;
      return { kennung, ring, deck, sichtbar: r.width > 0 && r.height > 0, unterKopf: kopfUnten > 0 && r.top < kopfUnten - 2 && r.bottom > 0 };
    });
    if (!z) continue;
    if (gesehen.has(z.kennung)) break;
    gesehen.add(z.kennung);
    ziele++;
    if (!z.ring || z.deck < 0.5 || !z.sichtbar) fehler.push({ ziel: z.kennung.slice(0, 90), ring: z.ring, deck: r3(z.deck) });
    if (z.unterKopf) verdeckt.push(z.kennung.slice(0, 90));
  }
  return { ziele, fehler, verdeckt };
}

async function sammleVerweise(page) {
  return page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))]);
}

/* Durch das Dokument wandern, damit jeder Auftritt einmal feuert */
async function durchsDokument(page) {
  const hoehe = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = await page.evaluate(() => innerHeight);
  const { stageH } = await buehne(page);
  const waagerecht = [];
  for (let y = stageH; y < hoehe; y += Math.round(vh * 0.6)) {
    await scrolleZu(page, y);
    await warte(SCHNELL ? 120 : 260);
    if (waagerecht.length < 40) waagerecht.push(await pruefeWaagerecht(page));
  }
  await scrolleZu(page, hoehe);
  await warte(1400);
  const unsichtbar = await page.evaluate(() => {
    const out = [];
    const doc = document.getElementById('doc') || document.querySelector('main');
    if (!doc) return out;
    for (const el of doc.querySelectorAll('h2, h3, p, li, a, button, .card, .row')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest('[hidden], details:not([open]) .answer, .check-topf, [aria-hidden="true"]')) continue;
      let deck = 1;
      for (let n = el; n; n = n.parentElement) deck *= Number(getComputedStyle(n).opacity);
      if (deck < 0.95) out.push({ el: el.tagName.toLowerCase() + ' ' + (el.textContent || '').trim().slice(0, 40), deck: Math.round(deck * 100) / 100 });
    }
    return out;
  });
  return { waagerecht, unsichtbar };
}

/* Folien: an jedem Anker genau eine Folie lesbar */
async function pruefeFolien(page) {
  const { stageH, anker } = await buehne(page);
  const ergebnis = [];
  for (let i = 0; i < anker.length; i++) {
    await scrolleZu(page, Math.round(anker[i] * stageH));
    await wartBisRuhe(page, anker[i]);
    await warte(500);
    const lage = await page.evaluate(() => {
      const titel = [...document.querySelectorAll('.slide')].map((s) => {
        const t = s.querySelector('.slide-title');
        let deck = getComputedStyle(t).visibility === 'hidden' ? 0 : 1;
        for (let n = t; n; n = n.parentElement) deck *= Number(getComputedStyle(n).opacity);
        const zeichen = t ? [...t.querySelectorAll('.char, .z')] : [];
        const zeichenDeck = zeichen.length ? zeichen.reduce((a, c) => a + Number(getComputedStyle(c).opacity), 0) / zeichen.length : 1;
        return { id: s.id, deck: Math.round(deck * zeichenDeck * 100) / 100 };
      });
      return titel;
    });
    ergebnis.push({ anker: anker[i], folien: lage, lesbar: lage.filter((f) => f.deck > 0.9).map((f) => f.id) });
  }
  return ergebnis;
}

/* ── Hauptlauf je Seite und Gerät ────────────────────────────────────────── */
async function pruefeSeite(pfad, profil) {
  const { ctx, page, log } = await neueSeite(profil);
  const r = { pfad, profil, dauer: {} };
  const t = (name, t0) => { r.dauer[name] = Date.now() - t0; };
  try {
    let t0 = Date.now();
    // Die Hauptmatrix sieht die lebende Bühne: ?webgl=erzwingen rechnet auch auf SwiftShader
    await lade(page, pfad + '?webgl=erzwingen');
    r.statisch = await pruefeStatisch(page);
    t('laden', t0); t0 = Date.now();
    r.webgl = await page.evaluate(() => window.__audit.webgl);
    await warteAufBuehne(page);
    r.bildzeitenWebgl = await messeBildzeiten(page, SCHNELL ? 3500 : 7000);
    r.guete = await page.evaluate(() => (window.__bronze && window.__bronze.guete ? window.__bronze.guete() : null));
    t('bildzeiten', t0); t0 = Date.now();
    r.folien = await pruefeFolien(page);
    t('folien', t0); t0 = Date.now();
    // Kontrast auf der Bühne: an jedem Anker (die Seite steht dort still)
    r.kontrastBuehne = { geprueft: 0, fehler: [] };
    const { stageH, anker } = await buehne(page);
    for (const a of anker) {
      await scrolleZu(page, Math.round(a * stageH));
      await wartBisRuhe(page, a);
      await warte(900);
      const k = await pruefeKontrastBuehne(page, `Bühne s=${a}`);
      r.kontrastBuehne.geprueft += k.geprueft;
      r.kontrastBuehne.fehler.push(...k.fehler);
    }
    t('kontrastBuehne', t0); t0 = Date.now();
    const doc = await durchsDokument(page);
    t('dokument', t0); t0 = Date.now();
    r.waagerecht = {
      gescrollt: doc.waagerecht.some((w) => w.scrollX !== 0),
      scrollBreiteMax: Math.max(...doc.waagerecht.map((w) => w.scrollBreite)),
      breite: doc.waagerecht[0] ? doc.waagerecht[0].breite : null,
      ueberstand: [...new Set(doc.waagerecht.flatMap((w) => w.ueberstand))].slice(0, 12),
    };
    r.unsichtbarNachScroll = doc.unsichtbar;
    r.kontrastDokument = await pruefeKontrastDokument(page);
    t('kontrastDokument', t0); t0 = Date.now();
    r.fokus = await pruefeFokus(page);
    t('fokus', t0); t0 = Date.now();
    r.verweise = await sammleVerweise(page);
    const a = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const load = nav ? nav.loadEventEnd : 0;
      const A = window.__audit;
      // CLS nach Sitzungsfenstern (1 s Lücke, 5 s Deckel), wie Chrome es zählt
      let max = 0, fenster = 0, start = 0, letzte = -1e9;
      for (const s of A.schichten) {
        if (s.t - letzte > 1000 || s.t - start > 5000) { fenster = 0; start = s.t; }
        fenster += s.v; letzte = s.t; max = Math.max(max, fenster);
      }
      const nachLoad = A.lang.filter((l) => l.t > load);
      return {
        cls: max, clsSumme: A.schichten.reduce((x, s) => x + s.v, 0), clsQuellen: A.schichten.filter((s) => s.v > 0.001).slice(0, 6),
        langeAufgaben: A.lang.length, langeNachLoad: nachLoad.length, laengsteNachLoad: nachLoad.reduce((m, l) => Math.max(m, l.d), 0),
        laengsteGesamt: A.lang.reduce((m, l) => Math.max(m, l.d), 0),
      };
    });
    Object.assign(r, a);
  } catch (e) {
    r.abbruch = String(e && e.stack ? e.stack : e).slice(0, 600);
  }
  r.konsole = log.konsole;
  r.konsoleUmgebung = log.umgebung;
  r.ausnahmen = log.ausnahmen;
  r.fehlanfragen = log.fehlanfragen.filter((f) => !f.gewollt);
  await ctx.close();
  return r;
}

/* ── Leistung: vierfach gedrosselte CPU ──────────────────────────────────── */
async function pruefeLeistung(pfad, profil) {
  const { ctx, page, log } = await neueSeite(profil);
  const bytes = { gesamt: 0, js: 0, css: 0, bild: 0, schrift: 0, html: 0 };
  page.on('response', async (res) => {
    try {
      const b = await res.body();
      const t = (res.headers()['content-type'] || '').toLowerCase();
      bytes.gesamt += b.length;
      if (t.includes('javascript')) bytes.js += b.length; else if (t.includes('css')) bytes.css += b.length;
      else if (t.startsWith('image/')) bytes.bild += b.length; else if (t.includes('font')) bytes.schrift += b.length;
      else if (t.includes('html')) bytes.html += b.length;
    } catch { /* Umleitungen haben keinen Körper */ }
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto(BASIS + pfad, { waitUntil: 'load', timeout: 90000 });
  const loadMs = Date.now() - t0;
  await warte(5000);
  const m = await page.evaluate(() => {
    const p = Object.fromEntries(performance.getEntriesByType('paint').map((e) => [e.name, e.startTime]));
    const nav = performance.getEntriesByType('navigation')[0];
    const A = window.__audit;
    const load = nav ? nav.loadEventEnd : 0;
    const nachLoad = A.lang.filter((l) => l.t > load);
    const erstesBild = performance.getEntriesByName('buehne:erstes-bild')[0];
    return {
      fcp: p['first-contentful-paint'] ?? null, fp: p['first-paint'] ?? null, lcp: A.lcp,
      dcl: nav ? nav.domContentLoadedEventEnd : null, load,
      erstesBuehnenbild: erstesBild ? erstesBild.startTime : null,
      langeNachLoad: nachLoad.map((l) => Math.round(l.d)), laengsteNachLoad: nachLoad.reduce((x, l) => Math.max(x, l.d), 0),
      langeVorLoad: A.lang.filter((l) => l.t <= load).map((l) => Math.round(l.d)),
    };
  });
  await ctx.close();
  return { pfad, profil, drossel: 4, loadMs, ...m, bytes, ausnahmen: log.ausnahmen };
}

/* ── Bewegung reduziert ──────────────────────────────────────────────────── */
async function pruefeReduziert(pfad, profil) {
  const { ctx, page, log } = await neueSeite(profil, { kontext: { reducedMotion: 'reduce' } });
  const r = { pfad, profil };
  try {
    await lade(page, pfad);
    const raf0 = await page.evaluate(() => window.__audit.raf);
    await warte(1500);
    const raf1 = await page.evaluate(() => window.__audit.raf);
    r.rafImLeerlaufProSek = Math.round((raf1 - raf0) / 1.5);
    r.webgl = await page.evaluate(() => window.__audit.webgl.filter((w) => w.ok).length);
    r.standbild = await page.evaluate(() => {
      const img = [...document.images].find((i) => /oroboros-still/.test(i.currentSrc || i.src));
      if (!img) return { da: false };
      const b = img.getBoundingClientRect();
      let deck = 1;
      for (let n = img; n; n = n.parentElement) deck *= Number(getComputedStyle(n).opacity);
      return { da: true, geladen: img.complete && img.naturalWidth > 0, sichtbar: deck > 0.5 && b.width > 100 && b.bottom > 0 && b.top < innerHeight, deck: Math.round(deck * 100) / 100 };
    });
    r.folien = await pruefeFolien(page);
    // Bewegt sich im Dokument etwas anderes als die Deckkraft?
    await scrolleZu(page, await page.evaluate(() => (document.getElementById('doc') || document.body).offsetTop));
    await warte(150);
    r.dokumentSofortSichtbar = await page.evaluate(() => {
      const doc = document.getElementById('doc') || document.querySelector('main');
      const els = [...doc.querySelectorAll('h2, .lead, p')].filter((e) => { const b = e.getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0; });
      return els.every((e) => { let d = 1; for (let n = e; n; n = n.parentElement) d *= Number(getComputedStyle(n).opacity); return d > 0.95; });
    });
    r.transformiert = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.slide *, .doc *, #doc *')) {
        const t = getComputedStyle(el).transform;
        if (t && t !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t) && el.getBoundingClientRect().width > 0) {
          const tr = getComputedStyle(el).transitionProperty;
          out.push(el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') + ' ' + t.slice(0, 40) + (tr && tr !== 'all' ? '' : ''));
        }
      }
      return [...new Set(out)].slice(0, 10);
    });
    r.laufendeUebergaenge = await page.evaluate(() => {
      const bewegte = new Set();
      for (const a of document.getAnimations()) {
        const eff = a.effect;
        const kf = eff && eff.getKeyframes ? eff.getKeyframes() : [];
        const props = new Set(kf.flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))));
        for (const p of props) if (/transform|translate|scale|rotate|^top$|^left$|^right$|^bottom$|width|height|margin|padding|inset|offset/i.test(p)) bewegte.add(p);
      }
      return [...bewegte];
    });
  } catch (e) { r.abbruch = String(e.stack || e).slice(0, 500); }
  r.ausnahmen = log.ausnahmen;
  r.ok = !r.abbruch && r.webgl === 0 && r.standbild && r.standbild.sichtbar && r.dokumentSofortSichtbar && r.folien.every((f) => f.lesbar.length === 1) && r.laufendeUebergaenge.length === 0 && r.ausnahmen.length === 0;
  await ctx.close();
  return r;
}

/* ── Ausfall: Bühnenmodul gesperrt, oder kein WebGL ──────────────────────── */
async function pruefeAusfall(pfad, profil, art) {
  const { ctx, page, log } = await neueSeite(profil, { keinWebgl: art === 'kein-webgl' });
  if (art === 'modul-gesperrt') {
    await page.route(/\/vendor\/(stage\.js|three[^/]*\.js)(\?.*)?$/, (route) => { log.gesperrt.add(route.request().url()); return route.abort('blockedbyclient'); });
  }
  const r = { pfad, profil, art };
  try {
    // Gesperrtes Modul: erzwingen, damit die Seite es wirklich anfordert
    await lade(page, art === 'modul-gesperrt' ? pfad + '?webgl=erzwingen' : pfad);
    r.standbild = await page.evaluate(() => {
      const img = [...document.images].find((i) => /oroboros-still/.test(i.currentSrc || i.src));
      if (!img) return { da: false, sichtbar: false };
      const b = img.getBoundingClientRect();
      let deck = 1;
      for (let n = img; n; n = n.parentElement) deck *= Number(getComputedStyle(n).opacity);
      return { da: true, sichtbar: deck > 0.5 && b.width > 100 && b.bottom > 0 && b.top < innerHeight };
    });
    r.folien = await pruefeFolien(page);
    const d = await durchsDokument(page);
    r.unsichtbar = d.unsichtbar.length;
    r.unsichtbarBeispiele = d.unsichtbar.slice(0, 6);
  } catch (e) { r.abbruch = String(e.stack || e).slice(0, 500); }
  r.ausnahmen = log.ausnahmen;
  r.ok = !r.abbruch && r.standbild.sichtbar && r.folien.every((f) => f.lesbar.length === 1) && r.unsichtbar === 0 && r.ausnahmen.length === 0;
  await ctx.close();
  return r;
}

/* ── Angel: Beratungs-Widget gegen den Vertrag ───────────────────────────── */
async function pruefeAngel(pfad, profil) {
  const { ctx, page, log } = await neueSeite(profil);
  const r = { pfad, profil, schritte: {} };
  const s = r.schritte;
  const anfragen = [];
  let modus = 'ok';
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  await page.route(/angel-phi-eight\.vercel\.app\/api\/oeffentlich\?aktion=beratung/, async (route) => {
    const q = route.request();
    if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let koerper = null;
    try { koerper = JSON.parse(q.postData() || 'null'); } catch { koerper = 'kein JSON'; }
    anfragen.push({ methode: q.method(), koerper });
    if (modus === 'netz') return route.abort('internetdisconnected');
    if (modus === '429') return route.fulfill({ status: 429, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ fehler: 'Zu viele Anfragen' }) });
    const antwort = anfragen.length === 1
      ? { sitzung: 'audit-sitzung-1', antwort: 'Gern. Für eine neue Website ist die Website in 48 Stunden das Richtige.', angebote: [{ schluessel: 'website_48h', titel: 'Website in 48 Stunden', preis: '1.500 €', link: 'https://angel-phi-eight.vercel.app/api/oeffentlich?aktion=checkout&angebot=website_48h&ref=oroboros-website' }], naechsterSchritt: 'kontakt', frage: 'Wohin darf ich das Angebot schicken?' }
      : { sitzung: 'audit-sitzung-1', antwort: 'Danke, ist notiert.', angebote: [], naechsterSchritt: 'frage' };
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(antwort) });
  });
  try {
    await lade(page, pfad);
    const opener = page.locator('.main-header [data-angel]').first();
    s.kopfknopf = (await opener.count()) > 0;
    if (!s.kopfknopf) { r.ok = false; r.fehlt = true; await ctx.close(); return r; }
    s.kontaktknopf = (await page.locator('#kontakt [data-angel]').count()) > 0;
    await opener.click();
    await warte(500);
    const dlg = page.locator('[role="dialog"]#angel');
    s.dialogOffen = await dlg.isVisible();
    s.ariaModal = (await dlg.getAttribute('aria-modal')) === 'true';
    s.beschriftet = Boolean((await dlg.getAttribute('aria-labelledby')) || (await dlg.getAttribute('aria-label')));
    const erste = await page.locator('#angel .angel-nachricht.von-angel').first().innerText().catch(() => '');
    const sprache = await page.evaluate(() => document.documentElement.lang);
    s.ersteNachrichtLokal = anfragen.length === 0 && erste.replace(/^(Angel|Sie|You):\s*/, '').trim() === (ANGEL_ERSTE[sprache] || '');
    s.ersteNachricht = erste.trim().slice(0, 140);
    s.fokusImDialog = await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('#angel')));
    s.maxlength = await page.locator('#angel textarea').getAttribute('maxlength');
    if (profil === 'mobil') {
      const b = await dlg.boundingBox();
      const vp = page.viewportSize();
      s.vollbild = Boolean(b && b.width >= vp.width - 1 && b.height >= vp.height - 1);
    }
    // Fokusfalle
    let draussen = 0;
    for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('#angel'))))) draussen++; }
    s.fokusfalle = draussen === 0;
    // 1. Nachricht
    const fertig = async (n) => {
      const t0 = Date.now();
      while (Date.now() - t0 < 8000) {
        if (anfragen.length >= n && !(await page.evaluate(() => Boolean(document.querySelector('#angel .angel-tippt'))))) break;
        await warte(100);
      }
      await warte(200);
    };
    await page.locator('#angel textarea').fill('Ich brauche eine neue Website für meinen Salon');
    await page.locator('#angel textarea').press('Enter');
    await fertig(1);
    const a1 = anfragen[0] && anfragen[0].koerper;
    s.anfrage1 = a1;
    s.vertrag1 = Boolean(a1 && typeof a1.text === 'string' && a1.text.length > 0 && a1.text.length <= 1000 && ['de', 'en'].includes(a1.sprache) && a1.seite === new URL(BASIS + pfad).pathname && !('sitzung' in a1 && a1.sitzung));
    s.angebotsknopf = await page.evaluate(() => {
      const a = document.querySelector('#angel a.angel-angebot');
      return a ? { href: a.getAttribute('href'), target: a.getAttribute('target') || null, text: a.textContent.trim() } : null;
    });
    s.angebotRichtig = Boolean(s.angebotsknopf && /aktion=checkout&angebot=website_48h/.test(s.angebotsknopf.href) && !s.angebotsknopf.target);
    s.sitzungGespeichert = await page.evaluate(() => { try { return Object.values(sessionStorage).some((v) => String(v).includes('audit-sitzung-1')); } catch { return false; } });
    s.kontaktfelder = await page.locator('#angel input[type="email"]').isVisible().catch(() => false);
    // 2. Nachricht mit Kontakt
    if (s.kontaktfelder) {
      await page.locator('#angel input[autocomplete="name"]').fill('Audit Prüfer');
      await page.locator('#angel input[type="email"]').fill('pruefer@example.com');
    }
    await page.locator('#angel textarea').fill('Gern, bitte per Mail');
    await page.locator('#angel textarea').press('Enter');
    await fertig(2);
    const a2 = anfragen[1] && anfragen[1].koerper;
    s.anfrage2 = a2;
    s.vertrag2 = Boolean(a2 && a2.sitzung === 'audit-sitzung-1' && a2.kontakt && a2.kontakt.email === 'pruefer@example.com' && a2.kontakt.name === 'Audit Prüfer');
    // 3. Drosselung
    modus = '429';
    await page.locator('#angel textarea').fill('Noch eine Frage');
    await page.locator('#angel textarea').press('Enter');
    await fertig(3);
    const t429 = await page.locator('#angel').innerText();
    s.drosselText = /viele Gespräche|lot of conversations|many conversations/i.test(t429);
    // 4. Netz weg
    modus = 'netz';
    await page.locator('#angel textarea').fill('Und jetzt?');
    await page.locator('#angel textarea').press('Enter');
    await fertig(4);
    s.formularAngebot = await page.evaluate(() => Boolean(document.querySelector('#angel a[href="#kontakt"], #angel [data-zum-formular]')));
    // 5. Esc schließt, Fokus zurück
    await page.keyboard.press('Escape');
    await warte(400);
    s.escSchliesst = !(await dlg.isVisible());
    s.fokusZurueck = await page.evaluate(() => Boolean(document.activeElement && document.activeElement.matches('.main-header [data-angel]')));
  } catch (e) { r.abbruch = String(e.stack || e).slice(0, 500); }
  r.ausnahmen = log.ausnahmen;
  const muss = ['kopfknopf', 'kontaktknopf', 'dialogOffen', 'ariaModal', 'beschriftet', 'ersteNachrichtLokal', 'fokusImDialog', 'fokusfalle', 'vertrag1', 'angebotRichtig', 'sitzungGespeichert', 'kontaktfelder', 'vertrag2', 'drosselText', 'formularAngebot', 'escSchliesst', 'fokusZurueck'];
  if (profil === 'mobil') muss.push('vollbild');
  r.fehlend = muss.filter((k) => !s[k]);
  r.ok = !r.abbruch && r.fehlend.length === 0 && s.maxlength === '1000' && r.ausnahmen.length === 0;
  await ctx.close();
  return r;
}
const ANGEL_ERSTE_DE = ANGEL_ERSTE.de;

/* ── Website-Check-Formular gegen den Vertrag ────────────────────────────── */
async function pruefeFormular(pfad) {
  const { ctx, page, log } = await neueSeite('desktop');
  const r = { pfad };
  let koerper = null;
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  await page.route(/angel-phi-eight\.vercel\.app\/api\/oeffentlich\?aktion=anfrage/, async (route) => {
    const q = route.request();
    if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    try { koerper = JSON.parse(q.postData() || 'null'); } catch { koerper = 'kein JSON'; }
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ angekommen: true }) });
  });
  try {
    await lade(page, pfad);
    await page.evaluate(() => document.getElementById('kontakt').scrollIntoView({ behavior: 'instant' }));
    await warte(900);
    await page.locator('#check button[type="submit"]').click();
    await warte(300);
    r.leerAbgewiesen = koerper === null && /Namen|name/i.test(await page.locator('#check-status').innerText());
    await page.locator('#c-name').fill('Audit Prüfer');
    await page.locator('#c-mail').fill('pruefer@example.com');
    await page.locator('#c-web').fill('beispiel.de');
    await page.locator('#c-text').fill('Test aus dem Prüfstand');
    await page.locator('#check button[type="submit"]').click();
    await page.waitForFunction(() => /Danke|Thank/.test(document.getElementById('check-status').textContent), null, { timeout: 5000 }).catch(() => {});
    r.koerper = koerper;
    const felder = ['name', 'email', 'website', 'anliegen', 'nachricht', 'sprache', 'quelle'];
    r.felderDa = koerper && felder.every((f) => f in koerper);
    r.anliegenGueltig = koerper && ANLIEGEN.includes(koerper.anliegen);
    r.status = await page.locator('#check-status').innerText();
    r.ok = Boolean(r.leerAbgewiesen && r.felderDa && r.anliegenGueltig && /Danke|Thank/.test(r.status)) && log.ausnahmen.length === 0;
  } catch (e) { r.abbruch = String(e.stack || e).slice(0, 400); r.ok = false; }
  r.ausnahmen = log.ausnahmen;
  await ctx.close();
  return r;
}

/* ── Verweise: intern auflösen, Anker finden, Kauflinks im Format prüfen ─── */
async function pruefeVerweise(seitenVerweise) {
  const htmlCache = new Map();
  async function hole(url) {
    if (htmlCache.has(url)) return htmlCache.get(url);
    let e;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const text = (res.headers.get('content-type') || '').includes('html') ? await res.text() : '';
      e = { status: res.status, endUrl: res.url, text };
    } catch (err) { e = { status: 0, fehler: String(err) }; }
    htmlCache.set(url, e);
    return e;
  }
  const kaputt = [], kauflinks = [], extern = new Set();
  const besucht = new Set();
  const warteschlange = [...seitenVerweise.entries()].map(([seite, liste]) => ({ seite, liste }));
  let intern = 0;
  while (warteschlange.length) {
    const { seite, liste } = warteschlange.shift();
    for (const href of liste) {
      if (!href || href.startsWith('javascript:')) continue;
      if (/^(mailto|tel):/i.test(href)) { extern.add(href.split('?')[0]); continue; }
      const url = new URL(href, BASIS + seite);
      if (url.origin !== new URL(BASIS).origin) {
        if (/aktion=checkout/.test(url.search)) {
          const a = url.searchParams.get('angebot');
          kauflinks.push({ seite, angebot: a, ref: url.searchParams.get('ref'), ok: ANGEBOTE.includes(a) && Boolean(url.searchParams.get('ref')) && url.origin === 'https://angel-phi-eight.vercel.app' });
        } else extern.add(url.origin + url.pathname);
        continue;
      }
      intern++;
      if (href.startsWith('#')) {
        const id = decodeURIComponent(href.slice(1));
        if (!id) continue;
        const e = await hole(BASIS + seite);
        if (!new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(e.text)) kaputt.push({ seite, href, grund: 'Anker fehlt' });
        continue;
      }
      const ziel = url.origin + url.pathname;
      const e = await hole(ziel);
      if (e.status !== 200) { kaputt.push({ seite, href, grund: `HTTP ${e.status}` }); continue; }
      if (e.endUrl && e.endUrl !== ziel && new URL(e.endUrl).pathname !== url.pathname) {
        // eine Umleitung ist kein Fehler, aber ein unnötiger Umweg
        kaputt.push({ seite, href, grund: `Umleitung → ${new URL(e.endUrl).pathname}`, nurHinweis: true });
      }
      if (url.hash && url.hash.length > 1) {
        const id = decodeURIComponent(url.hash.slice(1));
        if (!new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(e.text)) kaputt.push({ seite, href, grund: 'Anker fehlt im Ziel' });
      }
      // eine Ebene tiefer: Seiten, die wir noch nicht kennen
      const pfad = new URL(e.endUrl || ziel).pathname;
      if (e.text && !besucht.has(pfad) && !seitenVerweise.has(pfad)) {
        besucht.add(pfad);
        const unter = [...e.text.matchAll(/href=["']([^"'#][^"']*|#[^"']+)["']/g)].map((m) => m[1]);
        warteschlange.push({ seite: pfad, liste: unter });
      }
    }
  }
  return { intern, kaputt: kaputt.filter((k) => !k.nurHinweis), umwege: kaputt.filter((k) => k.nurHinweis), kauflinks, extern: [...extern].sort() };
}

/* ── Unterseiten: /arbeiten/* und Rechtsseiten auf Fehler laden ─────────── */
async function pruefeUnterseiten(pfade) {
  const out = [];
  for (const p of pfade) {
    const { ctx, page, log } = await neueSeite('desktop');
    try { await lade(page, p); await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await warte(800); } catch (e) { log.ausnahmen.push(String(e)); }
    const w = await pruefeWaagerecht(page).catch(() => null);
    out.push({ pfad: p, konsolenfehler: log.konsole.filter((k) => k.art === 'error').length, warnungen: log.konsole.filter((k) => k.art === 'warning').length, ausnahmen: log.ausnahmen, fehlanfragen: log.fehlanfragen, waagerecht: w ? w.scrollX !== 0 : null });
    await ctx.close();
  }
  return out;
}

/* ── SEO ─────────────────────────────────────────────────────────────────── */
async function pruefeSeo() {
  const seiten = ['/', '/en'];
  const out = { seiten: {} };
  for (const p of seiten) {
    const res = await fetch(BASIS + p);
    const html = await res.text();
    const meta = (n) => { const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]*content=["']([^"']*)["']`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${n}["']`, 'i')); return m ? m[1] : null; };
    const titel = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || null;
    const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1] || null;
    const hreflang = [...html.matchAll(/<link[^>]+rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi)].map((m) => `${m[1]}=${m[2]}`);
    const ld = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    const typen = [];
    let ldFehler = 0;
    const sammle = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(sammle); if (o['@type']) typen.push(...[].concat(o['@type'])); for (const v of Object.values(o)) if (v && typeof v === 'object') sammle(v); };
    for (const b of ld) { try { sammle(JSON.parse(b)); } catch { ldFehler++; } }
    const zaehle = (t) => typen.filter((x) => x === t).length;
    out.seiten[p] = {
      titel, titelLaenge: titel ? titel.length : 0, beschreibung: meta('description'), beschreibungLaenge: (meta('description') || '').length,
      canonical, hreflang, og: { titel: meta('og:title'), bild: meta('og:image'), url: meta('og:url'), beschreibung: Boolean(meta('og:description')) }, twitter: meta('twitter:card'),
      jsonLd: { bloecke: ld.length, fehler: ldFehler, organisation: zaehle('Organization') + zaehle('ProfessionalService') + zaehle('LocalBusiness'), service: zaehle('Service'), produkt: zaehle('Product'), angebote: zaehle('Offer') },
    };
  }
  const robots = await fetch(BASIS + '/robots.txt');
  const robotsText = robots.status === 200 ? await robots.text() : '';
  const sitemap = await fetch(BASIS + '/sitemap.xml');
  const sitemapText = sitemap.status === 200 ? await sitemap.text() : '';
  out.robots = { da: robots.status === 200, verweistAufSitemap: /sitemap:\s*https:\/\/oroboros-design\.com\/sitemap\.xml/i.test(robotsText) };
  out.sitemap = { da: sitemap.status === 200, adressen: [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) };
  const s = out.seiten;
  out.ok = Object.values(s).every((x) => x.titel && x.titelLaenge <= 70 && x.beschreibung && x.beschreibungLaenge >= 70 && x.beschreibungLaenge <= 170 && x.canonical && x.hreflang.length >= 3 && x.og.titel && x.og.bild && x.og.url && x.jsonLd.bloecke > 0 && x.jsonLd.fehler === 0 && x.jsonLd.organisation > 0 && x.jsonLd.service > 0 && x.jsonLd.produkt > 0)
    && out.robots.da && out.robots.verweistAufSitemap && out.sitemap.da && out.sitemap.adressen.includes('https://oroboros-design.com/') && out.sitemap.adressen.includes('https://oroboros-design.com/en');
  return out;
}

/* ── Zwilling: DE und EN dürfen sich nur im Text unterscheiden ───────────── */
function pruefeZwilling() {
  const de = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
  const en = fs.readFileSync(path.join(WURZEL, 'en.html'), 'utf8');
  const stile = (h) => [...h.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  const skripte = (h) => [...h.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => m[2]);
  const ids = (h) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const kauf = (h) => [...h.matchAll(/aktion=checkout&(?:amp;)?angebot=([a-z0-9_]+)/g)].map((m) => m[1]);
  const felder = (h) => [...h.matchAll(/\sname="([^"]+)"/g)].map((m) => m[1]).filter((n) => !['description', 'viewport', 'theme-color', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'robots'].includes(n));
  const diff = (a, b) => ({ nurDe: a.filter((x) => !b.includes(x)), nurEn: b.filter((x) => !a.includes(x)) });
  const r = {
    stilGleich: JSON.stringify(stile(de)) === JSON.stringify(stile(en)),
    skripteGleich: JSON.stringify(skripte(de)) === JSON.stringify(skripte(en)),
    skripteDe: skripte(de).length, skripteEn: skripte(en).length,
    ids: diff(ids(de), ids(en)), kauflinksDe: kauf(de).length, kauflinksEn: kauf(en).length, kaufGleich: JSON.stringify(kauf(de)) === JSON.stringify(kauf(en)),
    felder: diff(felder(de), felder(en)),
  };
  r.ok = r.stilGleich && r.skripteGleich && !r.ids.nurDe.length && !r.ids.nurEn.length && r.kaufGleich && !r.felder.nurDe.length && !r.felder.nurEn.length;
  return r;
}

/* ── Zusammenfassung ─────────────────────────────────────────────────────── */
function zusammenfassen(e) {
  const haupt = e.seiten;
  const summe = (f) => haupt.reduce((a, x) => a + f(x), 0);
  const maxi = (f) => haupt.reduce((a, x) => Math.max(a, f(x) ?? 0), 0);
  const nach = (profil) => haupt.filter((x) => x.profil === profil);
  const z = {
    konsolenfehler: summe((x) => (x.konsole || []).filter((k) => k.art === 'error').length + (x.ausnahmen || []).length),
    konsolenwarnungen: summe((x) => (x.konsole || []).filter((k) => k.art === 'warning').length),
    fehlanfragen: summe((x) => (x.fehlanfragen || []).length) + e.unterseiten.reduce((a, u) => a + u.fehlanfragen.length, 0),
    unterseitenFehler: e.unterseiten.reduce((a, u) => a + u.konsolenfehler + u.ausnahmen.length, 0),
    clsMax: r3(maxi((x) => x.cls)),
    laengsteAufgabeNachLoadMs: Math.round(Math.max(0, ...e.leistung.map((l) => l.laengsteNachLoad || 0))),
    laengsteAufgabeNachLoadWebglMs: Math.round(maxi((x) => x.laengsteNachLoad)),
    umgebungsmeldungen: summe((x) => (x.konsoleUmgebung || []).length),
    bildzeitP95Desktop: r1(Math.max(0, ...e.bildzeiten.filter((x) => x.profil === 'desktop').map((x) => (x.bildzeiten ? x.bildzeiten.p95 : 0)))),
    bildzeitP95Mobil: r1(Math.max(0, ...e.bildzeiten.filter((x) => x.profil === 'mobil').map((x) => (x.bildzeiten ? x.bildzeiten.p95 : 0)))),
    bildzeitP95DesktopWebgl: r1(Math.max(0, ...nach('desktop').map((x) => (x.bildzeitenWebgl ? x.bildzeitenWebgl.p95 : 0)))),
    bildzeitP95MobilWebgl: r1(Math.max(0, ...nach('mobil').map((x) => (x.bildzeitenWebgl ? x.bildzeitenWebgl.p95 : 0)))),
    buehneStandard: [...new Set(e.bildzeiten.map((x) => (x.zustand && x.zustand.zustand ? (x.zustand.zustand.webgl ? 'WebGL' : 'Standbild: ' + (x.zustand.zustand.grund || '?')) : 'alt')))].join(' | '),
    bilderUeber50ms: summe((x) => (x.bildzeitenWebgl ? x.bildzeitenWebgl.ueber50 : 0)),
    fcp4xDesktopMs: Math.round((e.leistung.find((l) => l.profil === 'desktop' && l.pfad === '/') || {}).fcp || 0),
    lcp4xDesktopMs: Math.round(((e.leistung.find((l) => l.profil === 'desktop' && l.pfad === '/') || {}).lcp || {}).t || 0),
    fcp4xMobilMs: Math.round((e.leistung.find((l) => l.profil === 'mobil' && l.pfad === '/') || {}).fcp || 0),
    lcp4xMobilMs: Math.round(((e.leistung.find((l) => l.profil === 'mobil' && l.pfad === '/') || {}).lcp || {}).t || 0),
    kaputteVerweise: e.verweise.kaputt.length,
    kauflinksFalsch: e.verweise.kauflinks.filter((k) => !k.ok).length,
    kauflinks: e.verweise.kauflinks.length,
    kontrastFehlerDokument: summe((x) => (x.kontrastDokument ? x.kontrastDokument.anzahlFehler : 0)),
    kontrastFehlerBuehne: summe((x) => (x.kontrastBuehne ? x.kontrastBuehne.fehler.length : 0)),
    ueberschriftenFehler: summe((x) => (x.statisch ? x.statisch.ueberschriften.spruenge.length + (x.statisch.ueberschriften.h1 === 1 ? 0 : 1) : 1)),
    ohneAlt: summe((x) => (x.statisch ? x.statisch.ohneAlt.length : 0)),
    ohneLabel: summe((x) => (x.statisch ? x.statisch.ohneLabel.length : 0)),
    fokusOhneRing: summe((x) => (x.fokus ? x.fokus.fehler.length : 0)),
    fokusUnterKopf: summe((x) => (x.fokus ? x.fokus.verdeckt.length : 0)),
    waagerechtesScrollen: haupt.filter((x) => x.waagerecht && x.waagerecht.gescrollt).length,
    ueberstand: summe((x) => (x.waagerecht ? x.waagerecht.ueberstand.length : 0)),
    folienUeberlagert: summe((x) => (x.folien || []).filter((f) => f.lesbar.length !== 1).length),
    unsichtbarNachScroll: summe((x) => (x.unsichtbarNachScroll || []).length),
    reduziertOk: e.reduziert.length ? e.reduziert.every((r) => r.ok) : null,
    ausfallOk: e.ausfall.length ? e.ausfall.every((r) => r.ok) : null,
    angelOk: e.angel.length ? e.angel.every((r) => r.ok) : null,
    formularOk: e.formular.length ? e.formular.every((r) => r.ok) : null,
    seoOk: e.seo.ok,
    zwillingOk: e.zwilling.ok,
  };
  return z;
}

const jn = (w) => (w == null ? '—' : w ? 'ok' : 'FEHLER');
function drucke(e) {
  const z = e.zusammenfassung;
  const zeilen = [
    ['Konsolenfehler + Ausnahmen (/, /en × 2 Geräte)', z.konsolenfehler, 0],
    ['Konsolenwarnungen', z.konsolenwarnungen, 0],
    ['Fehlgeschlagene Anfragen (inkl. Unterseiten)', z.fehlanfragen, 0],
    ['Fehler auf Unterseiten (/arbeiten/*, Recht)', z.unterseitenFehler, 0],
    ['CLS (größtes Sitzungsfenster)', z.clsMax, '≤ 0,1'],
    ['Längste Aufgabe nach load, Standard, CPU 4× (ms)', z.laengsteAufgabeNachLoadMs, '≤ 200'],
    ['Längste Aufgabe nach load, WebGL erzwungen (ms)', z.laengsteAufgabeNachLoadWebglMs, '—'],
    ['  Meldungen des Messaufbaus (SwiftShader, Fotos)', z.umgebungsmeldungen, ''],
    ['Bildzeit p95 Desktop 1440×900, Standard (ms)', z.bildzeitP95Desktop, '≤ 25'],
    ['Bildzeit p95 Mobil 390×844, Standard (ms)', z.bildzeitP95Mobil, '—'],
    ['  Bühne im Standardlauf', z.buehneStandard, ''],
    ['Bildzeit p95 Desktop, WebGL erzwungen/SwiftShader (ms)', z.bildzeitP95DesktopWebgl, '—'],
    ['Bildzeit p95 Mobil, WebGL erzwungen/SwiftShader (ms)', z.bildzeitP95MobilWebgl, '—'],
    ['Bilder > 50 ms, WebGL erzwungen', z.bilderUeber50ms, '—'],
    ['FCP Desktop, CPU 4× (ms)', z.fcp4xDesktopMs, '< 1500'],
    ['LCP Desktop, CPU 4× (ms)', z.lcp4xDesktopMs, '—'],
    ['FCP Mobil, CPU 4× (ms)', z.fcp4xMobilMs, '< 1500'],
    ['LCP Mobil, CPU 4× (ms)', z.lcp4xMobilMs, '—'],
    ['Kaputte interne Verweise', z.kaputteVerweise, 0],
    ['Kauflinks (falsch / gesamt)', `${z.kauflinksFalsch} / ${z.kauflinks}`, '0 / –'],
    ['Kontrastfehler Dokument (< 4,5:1)', z.kontrastFehlerDokument, 0],
    ['Kontrastfehler Bühne (Bildpunkte, 5. Perzentil)', z.kontrastFehlerBuehne, 0],
    ['Überschriften: Sprünge / h1 ≠ 1', z.ueberschriftenFehler, 0],
    ['Bilder ohne alt', z.ohneAlt, 0],
    ['Felder ohne Beschriftung', z.ohneLabel, 0],
    ['Fokus ohne sichtbaren Ring', z.fokusOhneRing, 0],
    ['Fokus unter dem festen Kopf', z.fokusUnterKopf, 0],
    ['Waagerechtes Scrollen (Läufe)', z.waagerechtesScrollen, 0],
    ['Überstehende Elemente', z.ueberstand, 0],
    ['Anker mit ≠ 1 lesbaren Folie', z.folienUeberlagert, 0],
    ['Unsichtbar nach dem Durchscrollen', z.unsichtbarNachScroll, 0],
    ['Reduzierte Bewegung: Standbild, nur Deckkraft', jn(z.reduziertOk), 'ok'],
    ['Ausfall (Modul gesperrt / kein WebGL)', jn(z.ausfallOk), 'ok'],
    ['Angel-Widget gegen Vertrag', jn(z.angelOk), 'ok'],
    ['Website-Check-Formular gegen Vertrag', jn(z.formularOk), 'ok'],
    ['SEO (Meta, JSON-LD, robots, sitemap)', z.seoOk ? 'ok' : 'FEHLER', 'ok'],
    ['Zwilling DE/EN (Stil, Skript, Aufbau)', z.zwillingOk ? 'ok' : 'FEHLER', 'ok'],
  ];
  const b = Math.max(...zeilen.map((x) => x[0].length));
  console.log('\nPrüfstand · ' + e.zeit + ' · ' + e.basis + (e.gpu ? ' · WebGL: ' + e.gpu : ''));
  console.log('─'.repeat(b + 28));
  for (const [n, w, soll] of zeilen) console.log(n.padEnd(b + 2) + String(w).padStart(10) + (soll !== '' ? '   Soll ' + soll : ''));
  console.log('─'.repeat(b + 28));
}

/* ── Ablauf ──────────────────────────────────────────────────────────────── */
async function main() {
  playwright = await ladePlaywright();
  let server = null;
  if (ARGS.basis) BASIS = String(ARGS.basis).replace(/\/+$/, '');
  else { server = await starteServer(0, WURZEL); BASIS = server.basis; }
  browser = await playwright.chromium.launch({ args: GL_ARGS });
  const e = { zeit: new Date().toISOString(), basis: BASIS, wurzel: WURZEL, seiten: [], bildzeiten: [], leistung: [], reduziert: [], ausfall: [], angel: [], formular: [], unterseiten: [] };
  const melde = (t) => process.stdout.write(t + '\n');
  try {
    if (teil('seiten')) for (const pfad of PFADE_LAUF) for (const profil of PROFILE_LAUF) {
      melde(`· ${pfad} ${profil}`);
      const x = await pruefeSeite(pfad, profil);
      melde('  ' + JSON.stringify(x.dauer) + (x.abbruch ? ' ABBRUCH ' + x.abbruch.split('\n')[0] : ''));
      e.seiten.push(x);
    }
    if (teil('seiten') || teil('bildzeiten')) for (const pfad of PFADE_LAUF) for (const profil of PROFILE_LAUF) {
      melde(`· Bildzeiten ${pfad} ${profil}`);
      e.bildzeiten.push(await pruefeBildzeitenStandard(pfad, profil));
    }
    const gl = e.seiten.flatMap((s) => s.webgl || []).find((w) => w.renderer);
    e.gpu = gl ? gl.renderer : 'keins';
    if (teil('leistung')) {
      melde('· Leistung (CPU 4×)');
      for (const profil of ['desktop', 'mobil']) e.leistung.push(await pruefeLeistung('/', profil));
      if (!SCHNELL) e.leistung.push(await pruefeLeistung('/en', 'desktop'));
    }
    if (teil('reduziert')) {
      melde('· Bewegung reduziert');
      for (const [p, pr] of [['/', 'desktop'], ['/', 'mobil'], ['/en', 'desktop']]) e.reduziert.push(await pruefeReduziert(p, pr));
    }
    if (teil('ausfall')) {
      melde('· Ausfall');
      e.ausfall.push(await pruefeAusfall('/', 'desktop', 'modul-gesperrt'));
      e.ausfall.push(await pruefeAusfall('/', 'mobil', 'kein-webgl'));
      e.ausfall.push(await pruefeAusfall('/en', 'desktop', 'kein-webgl'));
    }
    if (teil('angel')) {
      melde('· Angel');
      for (const [p, pr] of [['/', 'desktop'], ['/', 'mobil'], ['/en', 'desktop']]) e.angel.push(await pruefeAngel(p, pr));
    }
    if (teil('formular')) {
      melde('· Formular');
      for (const p of ['/', '/en']) e.formular.push(await pruefeFormular(p));
    }
    e.verweise = { intern: 0, kaputt: [], umwege: [], kauflinks: [], extern: [] };
    if (teil('verweise')) {
      melde('· Verweise');
      const karte = new Map();
      for (const s of e.seiten.filter((x) => x.profil === 'desktop' || PROFILE_LAUF.length === 1)) if (!karte.has(s.pfad)) karte.set(s.pfad, s.verweise || []);
      if (!karte.size) {
        for (const p of ['/', '/en']) {
          const html = await (await fetch(BASIS + p)).text();
          karte.set(p, [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/g)].map((m) => m[1]));
        }
      }
      e.verweise = await pruefeVerweise(karte);
      const unter = new Set();
      for (const [, liste] of karte) for (const h of liste) {
        if (!h || !h.startsWith('/') || h.startsWith('//')) continue;
        const p = new URL(h, BASIS).pathname;
        if (p !== '/' && p !== '/en' && !/\.(webp|jpg|png|xml|txt)$/.test(p)) unter.add(p.replace(/\/+$/, ''));
      }
      melde('· Unterseiten');
      e.unterseiten = await pruefeUnterseiten([...unter].sort());
    }
    melde('· SEO und Zwilling');
    e.seo = await pruefeSeo();
    e.zwilling = pruefeZwilling();
    e.zusammenfassung = zusammenfassen(e);
  } finally {
    await browser.close();
    if (server) await server.schliessen();
  }
  drucke(e);
  const ziel = ARGS.json ? path.resolve(String(ARGS.json)) : path.join(HIER, 'ergebnisse', 'letzter-lauf.json');
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, JSON.stringify(e, null, 1));
  console.log('Ergebnis: ' + path.relative(process.cwd(), ziel));
  const z = e.zusammenfassung;
  const bestanden = z.konsolenfehler === 0 && z.fehlanfragen === 0 && z.kaputteVerweise === 0 && z.waagerechtesScrollen === 0 && z.reduziertOk && z.ausfallOk && z.angelOk && z.formularOk && z.seoOk && z.zwillingOk && z.kontrastFehlerDokument === 0 && z.ueberschriftenFehler === 0 && z.ohneAlt === 0 && z.fokusOhneRing === 0 && z.clsMax <= 0.1;
  process.exitCode = bestanden ? 0 : 1;
}

main().catch((err) => { console.error(err); process.exitCode = 2; });
