#!/usr/bin/env node
/* Prüfstand — mechanische QA der Seite. Ein Lauf, ein Exit-Code, ein Beleg (pruefstand/ergebnisse/audit.json).

   node pruefstand/server.mjs &          # Auslieferung wie Vercel, Port 4173
   node pruefstand/audit.mjs             # alles
   node pruefstand/audit.mjs --netz      # dazu die fremden Ziele (Kasse, Nennbar, Bildtakt) über das Netz

   Was hier steht, ist messbar. Was nur ein Auge beurteilt (Wirkung der Fahrt, Komposition je Format), steht
   nicht hier — dafür gibt es die Standbilder aus pruefstand/bilder.mjs, und die muss jemand ansehen. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASIS = process.env.BASIS || 'http://127.0.0.1:4173';
const NETZ = process.argv.includes('--netz');
const KASSE = 'https://angel.oroboros-design.com/api/oeffentlich';
const SEITEN = ['/', '/buchen', '/portfolio', '/en', '/en/book'];
const WEITERE = ['/impressum', '/datenschutz', '/agb', '/widerruf', '/mail/launch', '/arbeiten/halden', '/arbeiten/lumen', '/arbeiten/northside', '/arbeiten/ridgeline'];
const BREITEN = [[390, 844], [768, 1024], [1440, 900], [1920, 1080]];
const SWGL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const befunde = [];
const ok = (name, bestanden, wert) => { befunde.push({ name, ok: !!bestanden, wert }); if (!bestanden) console.log('  ✗', name, '—', typeof wert === 'string' ? wert : JSON.stringify(wert)); };
const horche = (p, fehler) => { p.on('pageerror', (e) => fehler.push('Ausnahme: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); }); };

/* ── Kontrast (WCAG 2.1), aus den Tokens in vendor/oro.css ─────────────────── */
const css = readFileSync(join(WURZEL, 'vendor/oro.css'), 'utf8');
const token = (n) => (css.match(new RegExp(`--${n}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
for (const [vorn, hinten, min] of [['tinte', 'perle', 4.5], ['leise', 'perle', 4.5], ['leise', 'papier', 4.5], ['gold-tief', 'perle', 4.5], ['licht', 'nacht', 4.5], ['licht-leise', 'nacht', 4.5], ['gold', 'nacht', 4.5], ['tinte', 'gold', 4.5], ['perle', 'tinte', 4.5]]) {
  const k = kontrast(token(vorn), token(hinten));
  ok(`Kontrast ${vorn} auf ${hinten} ≥ ${min}`, k >= min, k);
}

const b = await chromium.launch({ channel: 'chrome', args: SWGL });

/* ── Je Seite und Breite: Fehler, Überlauf, eine Überschrift, Bilder, Trefferflächen ── */
const titel = new Map(), intern = new Set(), fremd = new Set();
for (const pfad of SEITEN) for (const [w, h] of BREITEN) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const fehler = []; horche(p, fehler);
  await p.goto(BASIS + pfad, { waitUntil: 'load' });
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
  await p.waitForLoadState('networkidle');
  const m = await p.evaluate(() => {
    const sichtbar = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const klein = [...document.querySelectorAll('a, button, summary, input:not([type=hidden])')].filter((e) => sichtbar(e) && !e.closest('p, small, .topf, .sprung, .ruf') && e.getBoundingClientRect().height < 44).map((e) => (e.textContent || e.name || '').trim().slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().height));
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h1: document.querySelectorAll('h1').length, kaputt: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src), ohneAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length, klein,
      titel: document.title, beschreibung: document.querySelector('meta[name=description]')?.content || '', links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')) };
  });
  const wo = `${pfad} @${w}`;
  ok(`${wo}: keine Fehler in der Konsole`, fehler.length === 0, fehler.slice(0, 3));
  ok(`${wo}: kein waagerechter Überlauf`, m.sw <= m.cw, `${m.sw} > ${m.cw}`);
  ok(`${wo}: genau eine h1`, m.h1 === 1, m.h1);
  ok(`${wo}: alle Bilder geladen, alle mit alt`, m.kaputt.length === 0 && m.ohneAlt === 0, { kaputt: m.kaputt, ohneAlt: m.ohneAlt });
  if (w === 390) ok(`${wo}: Trefferflächen ≥ 44 px`, m.klein.length === 0, m.klein.slice(0, 6));
  if (w === 1440) { titel.set(pfad, [m.titel, m.beschreibung]); ok(`${pfad}: Titel und Beschreibung gesetzt`, m.titel.length > 10 && m.beschreibung.length > 50, [m.titel.length, m.beschreibung.length]); }
  for (const l of m.links) { if (/^(mailto:|tel:|#)/.test(l)) continue; if (/^https?:/.test(l)) fremd.add(l); else intern.add(l.split('#')[0] || '/'); }
  await ctx.close();
}
ok('Titel je Seite verschieden', new Set([...titel.values()].map((t) => t[0])).size === titel.size, [...titel.values()].map((t) => t[0]));

/* ── Links: jedes interne Ziel antwortet mit 200; die weiteren Seiten laden ohne Fehler ── */
for (const l of [...intern, ...WEITERE]) { const r = await fetch(BASIS + l, { redirect: 'follow' }); ok(`Link ${l} → 200`, r.status === 200, r.status); }
for (const pfad of WEITERE) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const fehler = []; horche(p, fehler);
  await p.route(/^https:\/\/oroboros-design\.com\//, (r) => r.abort());            // Mail-Bilder zeigen auf die Domain — hier nicht Gegenstand
  await p.goto(BASIS + pfad, { waitUntil: 'load' }); await p.waitForTimeout(400);
  const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok(`${pfad} @390: lädt ohne Fehler, kein Überlauf`, fehler.filter((f) => !/ERR_FAILED|Failed to load resource/.test(f)).length === 0 && m.sw <= m.cw, { fehler: fehler.slice(0, 2), ...m });
  await ctx.close();
}
const r404 = await fetch(BASIS + '/gibt-es-nicht'); ok('Unbekannte Adresse → 404 mit eigener Seite', r404.status === 404 && /Startseite/.test(await r404.text()), r404.status);

/* ── Die Bühne ─────────────────────────────────────────────────────────────── */
{ // 1 · läuft: an jeder Station genau eine Folie lesbar; am Ende ist das Bild Perle und der Kopf hell
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const fehler = []; horche(p, fehler);
  await p.goto(BASIS + '/?webgl=erzwingen&guete=fest&zeit=0', { waitUntil: 'load' });
  await p.waitForFunction(() => document.documentElement.classList.contains('buehne-lebt'), null, { timeout: 30000 }).catch(() => {});
  ok('Bühne: Szene startet (html.buehne-lebt)', await p.evaluate(() => document.documentElement.classList.contains('buehne-lebt')), await p.evaluate(() => window.__band.grund()));
  for (const s of [0, 0.34, 0.62, 0.86]) {
    await p.evaluate((s) => window.__band.springe(s), s); await p.waitForTimeout(250);
    const f = await p.evaluate(() => [...document.querySelectorAll('.folie')].map((e) => ({ an: e.classList.contains('an'), o: +getComputedStyle(e.firstElementChild).opacity, inert: e.hasAttribute('inert') })));
    ok(`Bühne s=${s}: genau eine Folie lesbar, die anderen inert`, f.filter((x) => x.an && x.o > 0.9).length === 1 && f.filter((x) => !x.an).every((x) => x.inert), f);
  }
  await p.evaluate(() => window.__band.springe(1)); await p.waitForTimeout(700); await p.evaluate(() => window.__band.springe(1)); await p.waitForTimeout(300);
  const ende = await p.evaluate(() => ({ kopfHell: document.getElementById('kopf').classList.contains('hell'), finale: window.__band.zustand().finale }));
  const png = await p.screenshot({ clip: { x: 700, y: 440, width: 40, height: 40 } });
  const farbe = await p.evaluate(async (d) => { const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode(); const c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return [...x.getImageData(20, 20, 1, 1).data].slice(0, 3); }, png.toString('base64'));
  ok('Bühne s=1: das Bild ist Perle (244,242,236 ± 6), der Kopf hell', ende.kopfHell && farbe.every((v, i) => Math.abs(v - [244, 242, 236][i]) <= 6), { farbe, ...ende });
  // 2 · echtes Scrollen mit dem Rad durch die ganze Bühne
  await p.evaluate(() => window.__band.springe(0));
  const strecke = await p.evaluate(() => window.__band.strecke());
  for (let y = 0; y < strecke + 1400; y += 240) { await p.mouse.wheel(0, 240); await p.waitForTimeout(30); }
  await p.waitForFunction(() => window.__band.s() > 0.999, null, { timeout: 8000 }).catch(() => {});
  const nach = await p.evaluate(() => ({ s: window.__band.s(), y: scrollY, preise: document.getElementById('t-preise').getBoundingClientRect().top < innerHeight }));
  ok('Bühne: Rad-Scroll erreicht s=1 und das Dokument', nach.s > 0.999 && nach.preise, nach);
  ok('Bühne: keine Fehler in der Konsole', fehler.length === 0, fehler.slice(0, 3));
  await ctx.close();
}
{ // Bühne auf /en: dieselbe Regie, englische Beschriftung
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const fehler = []; horche(p, fehler);
  await p.goto(BASIS + '/en?webgl=erzwingen&guete=fest&zeit=0', { waitUntil: 'load' });
  await p.waitForFunction(() => document.documentElement.classList.contains('buehne-lebt'), null, { timeout: 30000 }).catch(() => {});
  await p.evaluate(() => window.__band.springe(0.34)); await p.waitForTimeout(300);
  const name = await p.evaluate(() => document.getElementById('zeiger-name').textContent);
  ok('/en: Bühne läuft, Zeiger auf Englisch', name === 'Your details' && fehler.length === 0, { name, fehler: fehler.slice(0, 2) });
  await ctx.close();
}
for (const [name, opt, vorher] of [
  ['reduzierte Bewegung', { reducedMotion: 'reduce' }, null],
  ['kein WebGL', {}, null],
  ['Modul band.js gesperrt', {}, (p) => p.route('**/vendor/band.js', (r) => r.abort())],
]) {
  const eigen = await chromium.launch({ channel: 'chrome', args: vorher ? SWGL : ['--disable-3d-apis'] });   // WebGL abgeschaltet: die Probe der Seite bekommt keinen Kontext
  const ctx = await eigen.newContext({ viewport: { width: 390, height: 844 }, ...opt });
  const p = await ctx.newPage(); const fehler = [], geholt = []; p.on('pageerror', (e) => fehler.push(e.message)); p.on('request', (r) => geholt.push(r.url()));
  if (vorher) await vorher(p);
  await p.goto(BASIS + (vorher ? '/?webgl=erzwingen' : '/'), { waitUntil: 'load' }); await p.waitForTimeout(1200);
  const m = await p.evaluate(() => ({ kl: document.documentElement.className, h1: +getComputedStyle(document.querySelector('.folie.erste h1')).opacity, knopf: !!document.querySelector('.folie.erste .knopf')?.getBoundingClientRect().height, buehne: document.querySelector('.buehne').offsetHeight, vh: innerHeight, bild: document.querySelector('.buehne-fest img').naturalWidth }));
  ok(`Rückfall „${name}“: Standbild, Angebot lesbar, keine Ausnahme`, /still|ohne-buehne/.test(m.kl) && m.h1 === 1 && m.knopf && m.bild > 0 && m.buehne <= m.vh * 1.05 && fehler.length === 0, { ...m, fehler });
  if (!vorher) ok(`Rückfall „${name}“: three.js wird nicht geladen`, !geholt.some((u) => /three\.module/.test(u)), geholt.filter((u) => /vendor\/.*\.js/.test(u)));
  await eigen.close();
}

/* ── Buchung: zwei Wahlen, vier Ziele; Vorwahl aus der Mail; Unsinn fällt auf den Standard ── */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  const ziel = () => p.evaluate(() => document.getElementById('b-weiter').href);
  const soll = (aktion, angebot, ref = 'oroboros-website') => `${KASSE}?aktion=${aktion}&angebot=${angebot}&ref=${ref}`;
  await p.goto(BASIS + '/buchen');
  ok('Buchen: Standard · sofort', (await ziel()) === soll('checkout', 'website_standard'), await ziel());
  await p.locator('input[value=premium]').check(); ok('Buchen: Premium · sofort', (await ziel()) === soll('checkout', 'website_premium'), await ziel());
  await p.locator('input[value=rechnung]').check(); ok('Buchen: Premium · Rechnung', (await ziel()) === soll('rechnung_anfordern', 'website_premium'), await ziel());
  await p.locator('input[value=standard]').check(); ok('Buchen: Standard · Rechnung', (await ziel()) === soll('rechnung_anfordern', 'website_standard'), await ziel());
  await p.goto(BASIS + '/buchen?paket=premium&ref=mail-launch'); ok('Buchen: Vorwahl und Herkunft aus der Mail', (await ziel()) === soll('checkout', 'website_premium', 'mail-launch'), await ziel());
  await p.goto(BASIS + '/buchen?paket=x&ref=%3Cscript%3E'); ok('Buchen: unlesbare Angaben fallen auf den Standard', (await ziel()) === soll('checkout', 'website_standard'), await ziel());
  /* Ein Klick zur Kasse (10.11.): die Paketknöpfe der Startseiten führen direkt zu Stripe — Deutsch und Englisch. */
  const pakete = async (pfad) => { await p.goto(BASIS + pfad); return p.evaluate(() => [...document.querySelectorAll('.paket .unten .knopf')].map((a) => a.href)); };
  ok('Startseite: Paketknöpfe direkt zur Kasse', JSON.stringify(await pakete('/')) === JSON.stringify([soll('checkout', 'website_standard'), soll('checkout', 'website_premium')]), await pakete('/'));
  const en = (angebot, ref = 'oroboros-website-en') => `${KASSE}?aktion=checkout&angebot=${angebot}&lang=en&ref=${ref}`;
  ok('/en: Paketknöpfe direkt zur englischen Kasse', JSON.stringify(await pakete('/en')) === JSON.stringify([en('website_standard'), en('website_premium')]), await pakete('/en'));
  ok('/en?ref=kalt-…: die Herkunft aus der Kaltmail geht mit zur Kasse', JSON.stringify(await pakete('/en?ref=kalt-0a1b2c3d4e5f6071')) === JSON.stringify([en('website_standard', 'kalt-0a1b2c3d4e5f6071'), en('website_premium', 'kalt-0a1b2c3d4e5f6071')]), await pakete('/en?ref=kalt-0a1b2c3d4e5f6071'));
  await p.goto(BASIS + '/en/book');
  ok('/en/book nach /en?ref=kalt-…: die Herkunft bleibt in der Sitzung', (await ziel()) === `${KASSE}?aktion=checkout&angebot=website_standard&lang=en&ref=kalt-0a1b2c3d4e5f6071`, await ziel());
  await p.evaluate(() => sessionStorage.clear()); await p.goto(BASIS + '/en/book');
  ok('/en/book: Standard', (await ziel()) === `${KASSE}?aktion=checkout&angebot=website_standard&lang=en&ref=oroboros-website-en`, await ziel());
  await p.locator('input[value=premium]').check(); ok('/en/book: Premium', (await ziel()) === `${KASSE}?aktion=checkout&angebot=website_premium&lang=en&ref=oroboros-website-en`, await ziel());
  await p.goto(BASIS + '/en/book?package=premium&ref=kalt-0a1b2c3d4e5f6071'); ok('/en/book: Vorwahl und Herkunft aus der Kaltmail', (await ziel()) === `${KASSE}?aktion=checkout&angebot=website_premium&lang=en&ref=kalt-0a1b2c3d4e5f6071`, await ziel());
  ok('/en/book: Knopf nennt den Preis', /Pay €199 & start/.test(await p.evaluate(() => document.getElementById('b-knopf').textContent)), await p.evaluate(() => document.getElementById('b-knopf').textContent));
  await p.goto(BASIS + '/'); await p.keyboard.press('Tab');
  const fokus = await p.evaluate(() => ({ text: document.activeElement.textContent.trim(), umriss: getComputedStyle(document.activeElement).outlineStyle }));
  ok('Tastatur: erster Halt ist der Sprunglink, Fokus sichtbar', /Preisen springen/.test(fokus.text) && fokus.umriss !== 'none', fokus);
  await ctx.close();
}
await b.close();

/* ── Die Mail ──────────────────────────────────────────────────────────────── */
{
  const html = readFileSync(join(WURZEL, 'mail/launch.html'), 'utf8'), vorlage = readFileSync(join(WURZEL, 'mail/launch.vorlage.html'), 'utf8');
  ok('Mail: unter 102 KB (Gmail kürzt darüber)', Buffer.byteLength(html) < 102 * 1024, Math.round(Buffer.byteLength(html) / 1024) + ' KB');
  ok('Mail: kein Platzhalter in der gefüllten Fassung', !/\{\{/.test(html), (html.match(/\{\{[^}]+\}\}/g) || []).slice(0, 3));
  const bilder = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  ok('Mail: jedes Bild mit alt, Breite und Höhe', bilder.length === 5 && bilder.every((i) => /\balt="[^"]+"/.test(i) && /\bwidth="\d+"/.test(i) && /\bheight="\d+"/.test(i)), bilder.length);
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  ok('Mail: nur eigene Ziele (Domain, WhatsApp, mailto, tel)', hrefs.every((h) => /^(https:\/\/oroboros-design\.com\/|https:\/\/wa\.me\/4917679219526|mailto:info@oroboros-design\.com|tel:\+4915158775031)/.test(h)), hrefs.filter((h) => !/^(https:\/\/oroboros-design\.com\/|https:\/\/wa\.me\/|mailto:|tel:)/.test(h)));
  ok('Mail: Buchen, Portfolio und Rückfrage vorhanden', hrefs.some((h) => h.startsWith('https://oroboros-design.com/buchen')) && hrefs.some((h) => h.startsWith('https://oroboros-design.com/portfolio')) && hrefs.some((h) => h.startsWith('https://wa.me/')) && /Antworten Sie einfach auf diese E-Mail/.test(html), hrefs.length);
  for (const z of [...new Set(hrefs.filter((h) => h.startsWith('https://oroboros-design.com/')).map((h) => new URL(h).pathname))]) { const r = await fetch(BASIS + z); ok(`Mail-Ziel ${z} → 200`, r.status === 200, r.status); }
  ok('Mail: Impressum und Abmeldung im Fuß', /Eulenbergstraße 22/.test(html) && /abmelden/.test(html) && /\{\{abmelden\}\}/.test(vorlage), '');
  ok('Mail: Klartext-Fassung vorhanden', existsSync(join(WURZEL, 'mail/launch.txt')) && !/\{\{/.test(readFileSync(join(WURZEL, 'mail/launch.txt'), 'utf8')), '');
}

/* ── Gewicht ───────────────────────────────────────────────────────────────── */
const kb = (f) => +(statSync(join(WURZEL, f)).size / 1024).toFixed(1);
const gewicht = { 'index.html': kb('index.html'), 'oro.css': kb('vendor/oro.css'), 'regie.js': kb('vendor/regie.js'), 'band.js': kb('vendor/band.js'), 'three (nur mit Grafikkarte)': kb('vendor/three.module.min.js'), 'Standbild quer': kb('vendor/img/band-still.webp'), 'Standbild hoch': kb('vendor/img/band-still-hoch.webp'), 'Schriften': +(kb('vendor/fonts/Sora-var.woff2') + kb('vendor/fonts/Outfit-400.woff2') + kb('vendor/fonts/Outfit-600.woff2') + kb('vendor/fonts/InstrumentSerif-400-italic.woff2')).toFixed(1) };
const erstbild = gewicht['index.html'] + gewicht['oro.css'] + gewicht['regie.js'] + gewicht['Standbild quer'] + gewicht['Schriften'];
ok('Gewicht: erstes Bild ohne Szene unter 300 KB (unkomprimiert)', erstbild < 300, Math.round(erstbild) + ' KB');

/* ── Fremde Ziele (nur mit --netz) ─────────────────────────────────────────── */
if (NETZ) {
  for (const u of [...fremd].filter((u) => /angel\.oroboros-design\.com\/(nennbar|bildtakt)/.test(u))) { const r = await fetch(u); ok(`Netz: ${u} → 200`, r.status === 200, r.status); }
  for (const a of ['website_standard', 'website_premium']) {
    const k = await fetch(`${KASSE}?aktion=checkout&angebot=${a}&ref=pruefstand`, { redirect: 'manual' });
    ok(`Netz: Kasse ${a} → 303 zu Stripe`, k.status === 303 && /^https:\/\/checkout\.stripe\.com\//.test(k.headers.get('location') || ''), k.status);
    const ke = await fetch(`${KASSE}?aktion=checkout&angebot=${a}&lang=en&ref=pruefstand`, { redirect: 'manual' });
    ok(`Netz: englische Kasse ${a} → 303 zu Stripe`, ke.status === 303 && /^https:\/\/checkout\.stripe\.com\//.test(ke.headers.get('location') || ''), ke.status);
    const r = await fetch(`${KASSE}?aktion=rechnung_anfordern&angebot=${a}&ref=pruefstand`); const t = await r.text();
    ok(`Netz: Rechnung ${a} → Formular mit Preis`, r.status === 200 && /Rechnung erstellen/.test(t) && t.includes(a === 'website_standard' ? '99' : '199'), r.status + ' ' + (t.match(/<h1>([^<]*)/) || [])[1]);
  }
}

const rot = befunde.filter((x) => !x.ok);
mkdirSync(join(WURZEL, 'pruefstand/ergebnisse'), { recursive: true });
writeFileSync(join(WURZEL, 'pruefstand/ergebnisse/audit.json'), JSON.stringify({ am: new Date().toISOString(), basis: BASIS, netz: NETZ, kontrollen: befunde.length, rot: rot.length, gewicht, befunde }, null, 1));
console.log(`\n${befunde.length} Kontrollen · ${befunde.length - rot.length} grün · ${rot.length} rot${NETZ ? '' : ' · fremde Ziele nicht geprüft (--netz)'}`);
console.log('Gewicht (KB):', JSON.stringify(gewicht));
process.exit(rot.length ? 1 : 0);
