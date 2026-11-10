/* Oroboros Design · Regie der Startseite
   ─────────────────────────────────────────────────────────────────────────────
   Eine Uhr für die Bühne: geglätteter Scrollwert, Maus, Folien, Zeiger, Blende, Kopf.
   Geglättet wird genau ein Wert (der Bühnenscroll s) — Kamera und Band lesen ihn ohne
   eigene Glättung; so ist der eingeschwungene Zustand mit dem Übergang identisch.
   Die Uhr läuft nur, solange die Bühne im Bild und der Tab sichtbar ist.

   FOLIEN   Auftritt und Abgang je Folie im Bühnenwert s ∈ [0, 1]
   GLAETTUNG je Sekunde: x += (Ziel − x) · (1 − e^(−λ·dt)), dt ≤ 0,1 s
   Schalter in der Adresse (Messen, Standbilder):
     ?webgl=erzwingen  rechnet die Bühne auch auf Software-WebGL
     ?guete=fest       keine Güteregelung, kein Aufgeben
     ?zeit=<s>         hält die Szenenzeit fest (Leerlauf des Bands steht)               */
(function () {
  'use strict';
  var H = document.documentElement;
  var Q = new URLSearchParams(location.search);
  var still = H.classList.contains('still');
  /* Sprache aus <html lang>: dieselbe Regie für / und /en. */
  var EN = String(H.lang || '').slice(0, 2) === 'en';
  var T = EN
    ? { namen: ['The offer', 'Your details', 'The build', 'Online'], pflicht: 'Please enter your name and a valid email address.', senden: 'Sending …', ok: 'Thank you. Your question has arrived — you will hear from us within one working day.', fehler: 'That did not work. Please write to info@oroboros-design.com or on WhatsApp — both reach us right away.' }
    : { namen: ['Das Angebot', 'Ihre Angaben', 'Der Bau', 'Online'], pflicht: 'Bitte Namen und eine gültige E-Mail angeben.', senden: 'Wird gesendet …', ok: 'Danke. Ihre Frage ist angekommen — Sie hören innerhalb eines Werktags von uns.', fehler: 'Das hat nicht geklappt. Schreiben Sie bitte an info@oroboros-design.com oder per WhatsApp — beides erreicht uns sofort.' };

  var FOLIEN = [
    { ein: [-1, -0.5], aus: [0.06, 0.13], nr: '00 / 03', name: T.namen[0] },
    { ein: [0.2, 0.27], aus: [0.4, 0.46], nr: '01 / 03', name: T.namen[1] },
    { ein: [0.5, 0.57], aus: [0.68, 0.74], nr: '02 / 03', name: T.namen[2] },
    { ein: [0.76, 0.82], aus: [0.88, 0.93], nr: '03 / 03', name: T.namen[3] },
  ];
  var GLAETTUNG = { scroll: 4.2, maus: 3.0 };

  var ORO = window.ORO = { s: 0, ziel: 0, zeit: 0, zeichnen: null, schmutzig: true, gueteFest: Q.get('guete') === 'fest', grund: null };
  var buehne = document.querySelector('.buehne');
  var fest = document.querySelector('.buehne-fest');
  var kopf = document.getElementById('kopf');
  var dok = document.getElementById('dok');
  var folien = [].slice.call(document.querySelectorAll('.folie'));
  var zeigerNr = document.getElementById('zeiger-nr'), zeigerName = document.getElementById('zeiger-name');
  var leiste = document.getElementById('leiste');
  var schluss = document.getElementById('kontakt');

  var klemme = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var stufe = function (a, b, x) { var t = klemme((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  var aus3 = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* ── Kopf: hell über dem Dokument, klar über der Bühne ─────────────────── */
  function kopfSetzen() {
    var hell = !buehne || dok.getBoundingClientRect().top <= 72 || (!still && !H.classList.contains('ohne-buehne') && (ORO.s > 0.94 || ORO.ziel > 0.985));
    kopf.classList.toggle('hell', hell);
  }

  /* ── Folien ────────────────────────────────────────────────────────────── */
  var aktiv = -1;
  function folienSetzen(s) {
    var vorn = 0;
    for (var i = 0; i < folien.length; i++) {
      var f = FOLIEN[i], el = folien[i];
      var ein = stufe(f.ein[0], f.ein[1], s), raus = stufe(f.aus[0], f.aus[1], s);
      var an = ein > 0.001 && raus < 0.999;
      if (an !== el.classList.contains('an')) { el.classList.toggle('an', an); if (an) el.removeAttribute('inert'); else el.setAttribute('inert', ''); }
      if (!an) continue;
      var kinder = el.children, n = kinder.length;
      for (var k = 0; k < n; k++) {
        var e = klemme(ein * (1 + 0.16 * n) - k * 0.16);            /* gestaffelt herein */
        var a = klemme(raus * (1 + 0.1 * n) - k * 0.1);              /* gestaffelt hinaus */
        kinder[k].style.setProperty('--o', (aus3(e) * (1 - a)).toFixed(3));
        kinder[k].style.setProperty('--y', ((1 - aus3(e)) * 34 - a * a * 46).toFixed(1) + 'px');
      }
    }
    for (var j = 1; j < FOLIEN.length; j++) if (s >= FOLIEN[j].ein[0]) vorn = j;       /* die zuletzt begonnene Station */
    if (vorn !== aktiv) { aktiv = vorn; zeigerNr.textContent = FOLIEN[vorn].nr; zeigerName.textContent = FOLIEN[vorn].name; }
    fest.style.setProperty('--s', s.toFixed(4));
    fest.style.setProperty('--hinweis', (1 - stufe(0.005, 0.04, s)).toFixed(3));
    fest.style.setProperty('--zeiger', (1 - stufe(0.9, 0.96, s)).toFixed(3));
    fest.style.setProperty('--schleier', (1 - stufe(0.84, 0.94, s)).toFixed(3));
    var ruht = H.classList.contains('buehne-ruht');
    /* Die Blende folgt dem geglätteten Wert — und dem rohen, sobald die Seite wirklich am Ende der Bühne steht:
       wer schnell durchscrollt, sieht nie eine dunkle Kante gegen das helle Dokument laufen. */
    fest.style.setProperty('--blende', Math.max(ruht ? stufe(0.84, 0.985, s) : stufe(0.975, 0.998, s), stufe(0.965, 0.998, ORO.ziel)).toFixed(3));
  }

  /* ── Die Uhr ───────────────────────────────────────────────────────────── */
  var maus = { x: 0, y: 0, zx: 0, zy: 0 };
  var strecke = 1, laeuft = false, zuletzt = 0, zeitFest = Q.has('zeit') ? parseFloat(Q.get('zeit')) : null;
  function messen() { strecke = Math.max(1, buehne.offsetHeight - window.innerHeight); }
  function zielLesen() { ORO.ziel = klemme(window.scrollY / strecke); }
  function bild(jetzt) {
    laeuft = false;
    var dt = Math.min(0.1, (jetzt - zuletzt) / 1000 || 0.016); zuletzt = jetzt;
    var ds = ORO.ziel - ORO.s;
    ORO.s += ds * (1 - Math.exp(-GLAETTUNG.scroll * dt));
    if (Math.abs(ds) < 0.00008) ORO.s = ORO.ziel;
    maus.x += (maus.zx - maus.x) * (1 - Math.exp(-GLAETTUNG.maus * dt));
    maus.y += (maus.zy - maus.y) * (1 - Math.exp(-GLAETTUNG.maus * dt));
    ORO.zeit = zeitFest !== null ? zeitFest : ORO.zeit + dt;
    folienSetzen(ORO.s);
    kopfSetzen();
    ORO.schmutzig = false;                                          /* die Szene darf ein weiteres Bild verlangen */
    if (ORO.zeichnen) ORO.zeichnen(ORO.s, ORO.zeit, maus);
    anstossen();
  }
  function imBild() { return window.scrollY < strecke + window.innerHeight * 0.4; }
  function anstossen() {
    if (laeuft || document.hidden) return;
    var bewegt = Math.abs(ORO.ziel - ORO.s) > 0.00008 || ORO.schmutzig;
    var lebt = ORO.zeichnen && imBild() && zeitFest === null;       /* der Leerlauf des Bands */
    if (!bewegt && !lebt) return;
    laeuft = true; requestAnimationFrame(bild);
  }

  ORO.standbild = function (grund) {
    ORO.grund = grund; ORO.zeichnen = null;
    /* Fällt die Szene mitten im Lauf aus, bleibt die Strecke — sonst spränge die Seite. */
    if (H.classList.contains('buehne-lebt')) { H.classList.remove('buehne-lebt'); H.classList.add('buehne-ruht'); }
    else { H.classList.add('ohne-buehne'); messen(); }
    ORO.schmutzig = true; anstossen();
  };

  if (buehne && !still) {
    messen(); zielLesen(); ORO.s = ORO.ziel; folienSetzen(ORO.s);
    window.addEventListener('scroll', function () { zielLesen(); anstossen(); }, { passive: true });
    window.addEventListener('resize', function () { messen(); zielLesen(); ORO.schmutzig = true; anstossen(); });
    document.addEventListener('visibilitychange', function () { zuletzt = performance.now(); anstossen(); });
    if (matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', function (e) { maus.zx = e.clientX / window.innerWidth * 2 - 1; maus.zy = e.clientY / window.innerHeight * 2 - 1; }, { passive: true });

    /* Hardware-Probe: nur wo eine Grafikkarte rechnet, wird die Szene geladen. */
    var darf = false;
    try {
      var probe = document.createElement('canvas');
      darf = !!probe.getContext('webgl2', { failIfMajorPerformanceCaveat: Q.get('webgl') !== 'erzwingen' });
      var ext = darf && probe.getContext('webgl2').getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
    } catch (e) { darf = false; }
    if (darf) import('/vendor/band.js').then(function () { ORO.schmutzig = true; anstossen(); }).catch(function () { ORO.standbild('modul'); });
    else ORO.standbild('kein-webgl');
    zuletzt = performance.now(); anstossen();
  } else {
    window.addEventListener('scroll', kopfSetzen, { passive: true });
  }
  kopfSetzen();

  /* Messschnittstelle — liest, steuert nicht (außer springe) */
  window.__band = {
    s: function () { return ORO.s; }, ziel: function () { return ORO.ziel; }, grund: function () { return ORO.grund; },
    strecke: function () { return strecke; },
    zustand: function () { return ORO.messung ? ORO.messung.zustand() : null; },
    platten: function () { return ORO.messung ? ORO.messung.platten() : null; },
    springe: function (s) { window.scrollTo({ top: s * strecke, behavior: 'instant' }); zielLesen(); ORO.s = ORO.ziel; ORO.schmutzig = true; folienSetzen(ORO.s); kopfSetzen(); if (ORO.zeichnen) ORO.zeichnen(ORO.s, zeitFest !== null ? zeitFest : ORO.zeit, maus); },
  };

  /* ── Auftritte im Dokument: einmal, beim ersten Sichtkontakt ───────────── */
  var auf = [].slice.call(document.querySelectorAll('.auf'));
  if (still || !('IntersectionObserver' in window)) auf.forEach(function (e) { e.classList.add('da'); });
  else {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('da'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    auf.forEach(function (e) { io.observe(e); });
    /* Was per Anker oder Tastatur erreicht wird, ist sofort da. */
    document.addEventListener('focusin', function (e) { var a = e.target.closest && e.target.closest('.auf'); if (a) a.classList.add('da'); });
  }

  /* ── Leiste am Daumen: im Dokument da, am Schluss weg ───────────────────── */
  if (leiste && 'IntersectionObserver' in window) {
    var imDok = false, amSchluss = false;
    var setzen = function () { leiste.classList.toggle('da', imDok && !amSchluss); };
    new IntersectionObserver(function (es) { imDok = es[0].isIntersecting; setzen(); }, { rootMargin: '-45% 0px -45% 0px' }).observe(dok);
    new IntersectionObserver(function (es) { amSchluss = es[0].isIntersecting; setzen(); }, { rootMargin: '0px 0px -20% 0px' }).observe(schluss);
  }

  /* ── Fragen-Formular: Vertrag aktion=anfrage ───────────────────────────── */
  var form = document.getElementById('frage');
  if (form) {
    var ZIEL = 'https://angel.oroboros-design.com/api/oeffentlich?aktion=anfrage';
    var status = document.getElementById('frage-status');
    var knopf = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = {}; new FormData(form).forEach(function (v, k) { d[k] = v; });
      var name = form.elements.name, mail = form.elements.email;
      name.setAttribute('aria-invalid', String(String(d.name).trim().length < 2));
      mail.setAttribute('aria-invalid', String(!mail.checkValidity() || !String(d.email).trim()));
      if (name.getAttribute('aria-invalid') === 'true' || mail.getAttribute('aria-invalid') === 'true') {
        status.className = 'status fehler'; status.textContent = T.pflicht;
        (name.getAttribute('aria-invalid') === 'true' ? name : mail).focus();
        return;
      }
      knopf.disabled = true; status.className = 'status'; status.textContent = T.senden;
      d.sprache = EN ? 'en' : 'de'; d.quelle = location.pathname + (document.referrer ? ' ← ' + document.referrer.slice(0, 80) : '');
      fetch(ZIEL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); form.reset(); status.className = 'status ok'; status.textContent = T.ok; })
        .catch(function () { status.className = 'status fehler'; status.textContent = T.fehler; })
        .then(function () { knopf.disabled = false; });
    });
  }
})();
