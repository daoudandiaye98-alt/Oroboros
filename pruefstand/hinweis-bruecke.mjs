/**
 * §5 und §6 ansehen: der Rollhinweis im Stand, und die Brücke in ihrer Mitte.
 *
 *   node pruefstand/hinweis-bruecke.mjs [port]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const PORT = Number(process.argv[2] ?? 4178);
const AUS = "pruefstand/artefakte/bruecke";
mkdirSync(AUS, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });
for (const a of [{n:"390x844",w:390,h:844,d:3},{n:"1440x900",w:1440,h:900,d:2}]) {
  const c = await b.newContext({ viewport:{width:a.w,height:a.h}, deviceScaleFactor:a.d });
  const p = await c.newPage();
  const fehler = [];
  p.on("pageerror", (e) => fehler.push(String(e)));
  await p.goto(`http://127.0.0.1:${PORT}/`, { waitUntil:"domcontentloaded" });
  // Warten, bis der Prolog übergeben hat — vorher gibt es keine Bühne.
  await p.waitForFunction(() => !document.querySelector(".prolog"), null, {timeout:60000}).catch(()=>{});
  // Auf den Auftritt warten, nicht auf eine Uhrzeit raten.
  await p.waitForFunction(() => {
    const h = document.querySelector(".hinweis");
    return h && getComputedStyle(h).opacity === "1";
  }, null, {timeout:15000}).catch(() => console.log(`   ! ${a.n}: Hinweis bleibt unsichtbar`));
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${AUS}/${a.n}-1-hinweis.png` });
  const hz = await p.evaluate(() => {
    const h = document.querySelector(".hinweis");
    const r = h.getBoundingClientRect();
    return { klassen: h.className, deckung: getComputedStyle(h).opacity,
             unten: Math.round(window.innerHeight - r.bottom), hoehe: Math.round(r.height) };
  });
  console.log(`${a.n}  Hinweis: ${hz.klassen} · Deckung ${hz.deckung} · ${hz.hoehe} px hoch · ${hz.unten} px über der Kante`);

  // Die Brücke über ihr ganzes Fenster ansehen, nicht nur in der Mitte:
  // das Tier steht an jeder Stelle woanders.
  const w = await p.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return { v: parseFloat(s.getPropertyValue("--bruecke-von")),
             b: parseFloat(s.getPropertyValue("--bruecke-bis")) };
  });
  for (const anteil of [0.25, 0.5, 0.75]) {
    const pp = w.v + (w.b - w.v) * anteil;
    await p.evaluate((pp) => {
      const k = document.querySelector(".buehne");
      window.scrollTo(0, k.offsetTop + (k.offsetHeight - window.innerHeight) * pp);
    }, pp);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${AUS}/${a.n}-2-bruecke-${String(pp.toFixed(2)).replace(".","")}.png` });
    const st = await p.evaluate(() => {
      const e = document.querySelector(".bruecke"), h = document.querySelector(".hinweis");
      const r = e.getBoundingClientRect();
      return { d: (+getComputedStyle(e).opacity).toFixed(2), oben: Math.round(r.top),
               unten: Math.round(r.bottom), hd: (+getComputedStyle(h).opacity).toFixed(2) };
    });
    console.log(`${a.n}  p=${pp.toFixed(2)}  Brücke Deckung ${st.d} · Band ${st.oben}–${st.unten} px`
      + ` · Hinweis Deckung ${st.hd} · Fehler ${fehler.length}`);
  }
  await c.close();
}
await b.close();
console.log(`Aufnahmen in ${AUS}`);
