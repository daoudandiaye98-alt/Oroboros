/* Oroboros Design · Akt I — „Das Band“ in WebGL
   ─────────────────────────────────────────────────────────────────────────────
   Eine Welt, ein Vorgang: Der Ring ist ein Tor. Durch ihn läuft ein Band mit
   Website-Platten. Hinter dem Tor sind sie Bauplan (kühle Linien), vor dem Tor
   sind sie fertig (die echten Seiten aus /portfolio). Die Grenze ist die
   Ringebene z = 0 — der Shader liest die Weltkoordinate, nichts wird umgeschaltet.
   Am Ende kommt eine leere, helle Platte durch das Tor und füllt das Bild:
   sie ist das Dokument, das danach weiterläuft. Dunkel → hell hat damit eine
   sichtbare Ursache.

   Dieses Modul zeichnet nur. Takt, geglätteter Scrollwert und Folien führt die
   Regie der Seite (window.ORO). Fehlt WebGL, lädt das Modul nicht oder wird es
   zu langsam, steht das Standbild — die Seite bleibt vollständig.

   Parameter:
     TOR      Ringradius, Rohr, Komet
     BAND     Plattenmaß, Abstand, Neigung, Strecke, Leerlauf- und Scrolltempo
     KAMERA   vier Stationen (Position, Blickpunkt, Bildversatz) je Seitenverhältnis
     FINALE   die helle Platte: wann sie startet, wann sie das Bild füllt
     GUETE    Pixelmaß-Stufen und die Grenze, ab der das Standbild übernimmt        */

import * as THREE from './three.module.min.js';

const ORO = window.ORO;
const leinwand = document.getElementById('buehne');

const MOBIL = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
const DPR = Math.min(window.devicePixelRatio || 1, MOBIL ? 1.5 : 2);
const GUETE = [1, 0.85, 0.7, 0.55];
const GRENZE = { runter: 26, fenster: 40, aufgeben: 70 };

const TOR = { R: 2.25, rohr: 0.034 };
const BAND = { b: 2.4, h: 1.5, abstand: 2.7, anzahl: 9, neigung: 0.86, hinten: -13.2, leerlauf: 0.22, scroll: 13.5, y: 0.0 };
const FINALE = { start: 0.8, ende: 0.985, raeumen: [0.66, 0.86], schub: 25 };
const PERLE = new THREE.Color('#f4f2ec');

const BILDER = ['halden', 'lumen', 'northside', 'ridgeline', 'halden-szene', 'lumen-szene', 'northside-szene', 'ridgeline-szene'];

/* ── Kamera: vier Stationen, dazwischen Catmull-Rom ───────────────────────── */
const KAMERA = [
  { s: 0.00, p: [-5.9, 1.2, 7.6], z: [0.1, 0.05, 1.0], v: 1 },
  { s: 0.34, p: [-8.4, 2.9, -0.6], z: [0.0, -0.15, -3.3], v: 1 },
  { s: 0.62, p: [-6.6, 1.25, 3.9], z: [0.0, 0.0, 0.3], v: 1 },
  { s: 0.86, p: [0.0, 0.0, 9.6], z: [0.0, 0.0, 0.0], v: 1, halt: true },
  { s: 1.00, p: [0.0, 0.0, 9.6], z: [0.0, 0.0, 0.0], v: 0, halt: true },
];
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3();
/* Hermite mit Catmull-Rom-Tangenten; an einer Station mit halt steht die Kamera (Tangente 0) — sonst schwingt die
   Bahn über den Punkt hinaus und die Kamera verlässt im Finale die Achse (gemessen: 0,49 Einheiten seitlich). */
function hermite(p0, p1, p2, p3, t, halt1, halt2) {
  const m1 = halt1 ? 0 : (p2 - p0) / 2, m2 = halt2 ? 0 : (p3 - p1) / 2;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2;
}
const weich = (t) => t * t * (3 - 2 * t);
function kameraBei(s, pos, ziel) {
  let i = 0;
  while (i < KAMERA.length - 2 && s > KAMERA[i + 1].s) i++;
  const k0 = KAMERA[Math.max(0, i - 1)], k1 = KAMERA[i], k2 = KAMERA[i + 1], k3 = KAMERA[Math.min(KAMERA.length - 1, i + 2)];
  const t = weich(Math.min(1, Math.max(0, (s - k1.s) / (k2.s - k1.s))));
  for (let a = 0; a < 3; a++) {
    pos.setComponent(a, hermite(k0.p[a], k1.p[a], k2.p[a], k3.p[a], t, k1.halt, k2.halt));
    ziel.setComponent(a, hermite(k0.z[a], k1.z[a], k2.z[a], k3.z[a], t, k1.halt, k2.halt));
  }
  return k1.v + (k2.v - k1.v) * t;
}

/* ── Renderer ─────────────────────────────────────────────────────────────── */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: leinwand, antialias: !MOBIL, alpha: true, powerPreference: 'high-performance', premultipliedAlpha: true });
} catch (e) {
  ORO.standbild('kein-webgl');
  throw e;
}
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const szene = new THREE.Scene();
const kamera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

/* ── Das Tor ──────────────────────────────────────────────────────────────── */
const uZeit = { value: 0 };
const uHell = { value: 1 };
const torMat = new THREE.ShaderMaterial({
  uniforms: { uZeit, uHell }, transparent: true, depthWrite: false,   /* nach dem Schein gezeichnet: die Farbe des Rings bleibt Gold, nicht Gelb */
  vertexShader: /* glsl */`
    varying vec2 vP;
    void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform float uZeit; uniform float uHell; varying vec2 vP;
    void main(){
      float vW = atan(vP.y, vP.x);
      float kopf = mod(uZeit*0.55, 6.2831853);
      float d = mod(kopf - vW, 6.2831853);
      float komet = exp(-d*0.9) + exp(-(6.2831853-d)*5.0);      /* Schweif nach hinten, weiche Stirn — keine Naht */
      vec3 gold = vec3(1.0,0.68,0.17), weiss = vec3(1.0,0.96,0.88);
      vec3 c = mix(gold, weiss, clamp(0.06 + komet*1.25,0.0,1.0));
      gl_FragColor = vec4(c*uHell, 1.0);
    }`,
});
const tor = new THREE.Mesh(new THREE.TorusGeometry(TOR.R, TOR.rohr, 10, 220), torMat);
tor.renderOrder = 60;
szene.add(tor);

/* Schein um das Rohr: von jeder Seite ein weicher Schlauch aus Licht, nicht eine flache Scheibe. */
const scheinMat = new THREE.ShaderMaterial({
  uniforms: { uZeit, uHell, uFarbe: { value: new THREE.Vector3(1.0, 0.46, 0.1) }, uKraft: { value: 0.5 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true, side: THREE.FrontSide,
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vV; varying vec2 vP;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position.xy; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    uniform float uZeit; uniform float uHell; uniform vec3 uFarbe; uniform float uKraft; varying vec3 vN; varying vec3 vV; varying vec2 vP;
    void main(){
      float vW = atan(vP.y, vP.x);
      float f = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 3.2);
      float kopf = mod(uZeit*0.55, 6.2831853);
      float dk = mod(kopf - vW, 6.2831853);
      float komet = exp(-dk*0.7) + exp(-(6.2831853-dk)*3.0);
      gl_FragColor = vec4(uFarbe * f * uKraft * (0.7 + komet*1.3) * uHell, 0.0);
    }`,
});
szene.add(new THREE.Mesh(new THREE.TorusGeometry(TOR.R, 0.3, 16, 160), scheinMat));
const scheinWeit = scheinMat.clone();
scheinWeit.uniforms = { uZeit, uHell, uFarbe: { value: new THREE.Vector3(0.3, 0.5, 1.0) }, uKraft: { value: 0.2 } };
szene.add(new THREE.Mesh(new THREE.TorusGeometry(TOR.R, 0.95, 16, 120), scheinWeit));

/* Zweiter, kühler Ring knapp dahinter — die Bauplan-Seite des Tors. */
const kuehl = new THREE.Mesh(new THREE.TorusGeometry(TOR.R + 0.09, 0.011, 8, 200), new THREE.MeshBasicMaterial({ color: 0x79dcff, transparent: true, opacity: 0.75 }));
kuehl.position.z = -0.14;
szene.add(kuehl);

/* ── Die Schienen: kühl hinter dem Tor, warm davor ────────────────────────── */
const schieneMat = new THREE.ShaderMaterial({
  uniforms: { uHell },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
  vertexShader: /* glsl */`varying float vZ; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vZ = w.z; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    uniform float uHell; varying float vZ;
    void main(){
      vec3 kalt = vec3(0.35,0.78,1.0), warm = vec3(1.0,0.66,0.24);
      float t = smoothstep(-0.25, 0.25, vZ);
      float aus = smoothstep(-13.0,-7.0,vZ) * (1.0 - smoothstep(5.0,10.0,vZ));
      gl_FragColor = vec4(mix(kalt*0.5, warm*0.75, t) * aus * uHell, 0.0);
    }`,
});
for (const x of [-0.7, 0.7]) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 24), schieneMat);
  s.position.set(x * 0.64 - 0.0, -0.98, -1.5);
  szene.add(s);
}

/* ── Die Platten ──────────────────────────────────────────────────────────── */
const PLATTE_VS = /* glsl */`
  varying vec2 vUv; varying vec3 vWelt;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWelt = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const PLATTE_FS = /* glsl */`
  precision highp float;
  uniform sampler2D uBild; uniform float uZeit; uniform float uArt; uniform float uSicht; uniform float uHell; uniform float uBildDa; uniform vec3 uPerle; uniform float uLeer; uniform float uVoll;
  varying vec2 vUv; varying vec3 vWelt;
  float kasten(vec2 p, vec2 c, vec2 h, float r){ vec2 d = abs(p-c)-h+r; return length(max(d,0.0)) + min(max(d.x,d.y),0.0) - r; }
  float strich(float d, float w){ float a = fwidth(d)*1.2; return 1.0 - smoothstep(w, w+a, abs(d)); }
  float flaeche(float d){ float a = fwidth(d)*1.2; return 1.0 - smoothstep(0.0, a, d); }
  vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)), vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c)); }
  void main(){
    vec2 p = vec2(vUv.x*1.6, vUv.y);
    float rand = kasten(p, vec2(0.8,0.5), vec2(0.8,0.5), 0.035);
    float maske = flaeche(rand);
    if (maske < 0.01) discard;

    /* Abstand zur Ringebene, leicht bewegt — die Drucklinie */
    float d = vWelt.z + sin(vWelt.y*13.0 + uZeit*2.4)*0.012 + sin(vWelt.x*9.0 - uZeit*1.7)*0.008;
    float fertig = smoothstep(-0.015, 0.015, d);

    /* Bauplan: Gerüst einer Seite */
    float w = 0.0035;
    float l = strich(rand, w*1.4);
    l = max(l, strich(p.y - 0.895, w) * step(0.05,p.x) * step(p.x,1.55));
    l = max(l, flaeche(kasten(p, vec2(0.12,0.945), vec2(0.045,0.014), 0.012)));
    l = max(l, flaeche(kasten(p, vec2(1.42,0.945), vec2(0.09,0.02), 0.02))*0.9);
    if (uArt < 0.5) {
      l = max(l, flaeche(kasten(p, vec2(0.42,0.72), vec2(0.32,0.03), 0.01)));
      l = max(l, flaeche(kasten(p, vec2(0.34,0.63), vec2(0.24,0.03), 0.01)));
      l = max(l, flaeche(kasten(p, vec2(0.30,0.53), vec2(0.20,0.011), 0.008))*0.6);
      l = max(l, strich(kasten(p, vec2(0.22,0.42), vec2(0.12,0.035), 0.035), w));
      float b = kasten(p, vec2(1.15,0.56), vec2(0.36,0.27), 0.03);
      l = max(l, strich(b, w));
      l = max(l, strich((p.y-0.56) - (p.x-1.15)*0.75, w*0.8) * flaeche(b) * 0.6);
      l = max(l, strich((p.y-0.56) + (p.x-1.15)*0.75, w*0.8) * flaeche(b) * 0.6);
      for (int i=0;i<3;i++){ float x = 0.29 + float(i)*0.51; l = max(l, strich(kasten(p, vec2(x,0.14), vec2(0.22,0.09), 0.02), w)); }
    } else if (uArt < 1.5) {
      float b = kasten(p, vec2(0.8,0.6), vec2(0.72,0.24), 0.03);
      l = max(l, strich(b, w));
      l = max(l, flaeche(kasten(p, vec2(0.8,0.63), vec2(0.36,0.035), 0.01)));
      l = max(l, flaeche(kasten(p, vec2(0.8,0.53), vec2(0.22,0.012), 0.008))*0.6);
      for (int i=0;i<4;i++){ float x = 0.215 + float(i)*0.39; l = max(l, strich(kasten(p, vec2(x,0.17), vec2(0.165,0.11), 0.02), w)); }
    } else {
      float b = kasten(p, vec2(0.42,0.46), vec2(0.34,0.36), 0.03);
      l = max(l, strich(b, w));
      l = max(l, strich(length(p-vec2(0.42,0.46))-0.12, w));
      l = max(l, flaeche(kasten(p, vec2(1.16,0.72), vec2(0.30,0.032), 0.01)));
      l = max(l, flaeche(kasten(p, vec2(1.08,0.62), vec2(0.22,0.032), 0.01)));
      for (int i=0;i<4;i++){ float y = 0.48 - float(i)*0.075; l = max(l, flaeche(kasten(p, vec2(1.14,y), vec2(0.28 - float(i)*0.03,0.008), 0.006))*0.55); }
      l = max(l, strich(kasten(p, vec2(0.98,0.14), vec2(0.12,0.035), 0.035), w));
    }
    /* feines Raster */
    vec2 g = abs(fract(p*10.0)-0.5);
    float raster = (1.0 - smoothstep(0.0, fwidth(p.x)*10.0*1.5, min(g.x,g.y))) * 0.10;

    vec3 kalt = vec3(0.45,0.84,1.0);
    float nah = exp(min(d,0.0)*1.6);                       /* Bauplan leuchtet auf, kurz bevor er das Tor erreicht */
    vec3 planFarbe = kalt * (l*(0.55 + nah*0.9) + raster*(0.5+nah)) + vec3(0.03,0.05,0.13);
    float planAlpha = clamp(l*0.9 + raster + 0.32, 0.0, 1.0);

    /* Fertig: die echte Seite — oder, im Finale, die leere helle Platte */
    vec3 bild = srgb(texture2D(uBild, vUv).rgb);     /* Textur und Perle kommen linear — hier zurück in Anzeigewerte */
    bild = mix(vec3(0.07,0.08,0.16), bild, uBildDa);
    vec3 perle = srgb(uPerle);
    vec3 seite = mix(perle, vec3(0.055,0.063,0.133), clamp(l,0.0,1.0) * 0.72 * (1.0-uVoll));   /* das Gerüst des Dokuments, in Tinte */
    vec3 fertigFarbe = mix(bild, seite, uLeer);
    float kante = strich(rand, 0.006);
    fertigFarbe += vec3(1.0,0.86,0.6) * kante * 0.35 * (1.0-uLeer);
    float glut = exp(-max(d,0.0)*5.5);            /* frisch aus dem Tor: noch warm */
    fertigFarbe += vec3(1.0,0.62,0.2) * glut * 0.55 * (1.0 - uLeer*0.6);

    vec3 farbe = mix(planFarbe, fertigFarbe, fertig);
    float alpha = mix(planAlpha, 1.0, fertig);
    float linie = exp(-abs(d)*70.0);              /* die Drucklinie selbst */
    farbe += vec3(1.0,0.9,0.7) * linie * 1.4;
    alpha = max(alpha, linie);

    alpha *= maske * uSicht;
    gl_FragColor = vec4(farbe * uHell * alpha, alpha);
  }`;

const lader = new THREE.TextureLoader();
const leerTex = new THREE.DataTexture(new Uint8Array([18, 20, 40, 255]), 1, 1);
leerTex.needsUpdate = true;
const plattenGeo = new THREE.PlaneGeometry(BAND.b, BAND.h);
const platten = [];
const STRECKE = BAND.abstand * BAND.anzahl;
for (let i = 0; i < BAND.anzahl; i++) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uBild: { value: leerTex }, uZeit, uArt: { value: i % 3 }, uSicht: { value: 1 }, uHell, uBildDa: { value: 0 }, uPerle: { value: PERLE }, uLeer: { value: 0 }, uVoll: { value: 0 } },
    vertexShader: PLATTE_VS, fragmentShader: PLATTE_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(plattenGeo, mat);
  m.rotation.y = -BAND.neigung;
  m.userData.z0 = 0.15 + i * BAND.abstand;
  szene.add(m);
  platten.push(m);
}
/* Bilder nach und nach — erst die vorderen, dann der Rest (auf dem Telefon nur vier). */
const bildZahl = MOBIL ? 4 : BILDER.length;
BILDER.slice(0, bildZahl).forEach((name, i) => {
  lader.load(`/arbeiten/vorschau/${name}.webp`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    platten.forEach((p, j) => { if (j % bildZahl === i) { p.material.uniforms.uBild.value = t; p.material.uniforms.uBildDa.value = 1; } });
    ORO.schmutzig = true;
  });
});

/* Die helle Platte des Finales: steht frontal, kommt durch das Tor, füllt das Bild. */
const finaleMat = new THREE.ShaderMaterial({
  uniforms: { uBild: { value: leerTex }, uZeit, uArt: { value: 1 }, uSicht: { value: 0 }, uHell: { value: 1 }, uBildDa: { value: 0 }, uPerle: { value: PERLE }, uLeer: { value: 1 }, uVoll: { value: 0 } },
  vertexShader: PLATTE_VS, fragmentShader: PLATTE_FS, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
});
const finale = new THREE.Mesh(plattenGeo, finaleMat);
finale.renderOrder = 999;
szene.add(finale);

/* ── Funken um das Tor und Staub im Raum ──────────────────────────────────── */
function punkte(n, bau, vs, groesse) {
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(n * 3), b = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) bau(i, a, b);
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  g.setAttribute('aSaat', new THREE.BufferAttribute(b, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uZeit, uHell, uFluss: { value: 0 }, uPx: { value: 1 }, uGroesse: { value: groesse } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true,
    vertexShader: vs,
    fragmentShader: /* glsl */`
      varying vec3 vFarbe; varying float vA;
      void main(){ float r = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,r); gl_FragColor = vec4(vFarbe*a*a*vA, 0.0); }`,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  szene.add(p);
  return p;
}
const funken = punkte(MOBIL ? 150 : 280, (i, a, b) => {
  b[i * 3] = Math.random() * Math.PI * 2; b[i * 3 + 1] = Math.random(); b[i * 3 + 2] = Math.random();
}, /* glsl */`
  attribute vec3 aSaat; uniform float uZeit; uniform float uHell; uniform float uPx; uniform float uGroesse;
  varying vec3 vFarbe; varying float vA;
  void main(){
    float w = aSaat.x + uZeit*(0.05 + aSaat.y*0.22);
    float leben = fract(aSaat.z + uZeit*(0.08 + aSaat.y*0.1));
    float r = ${TOR.R.toFixed(2)} + sin(aSaat.z*40.0 + uZeit*0.6)*0.10*(0.3+leben);
    float z = (leben*leben)*2.6*(0.4+aSaat.y) - 0.05;          /* treiben mit dem Band nach vorn */
    vec3 p = vec3(cos(w)*r, sin(w)*r, z);
    vec4 mv = modelViewMatrix * vec4(p,1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uGroesse * uPx * (0.5 + aSaat.y) * (1.0 - leben*0.6) / -mv.z;
    vFarbe = mix(vec3(1.0,0.7,0.3), vec3(1.0,0.95,0.85), aSaat.y);
    vA = (1.0 - leben) * uHell;
  }`, 46);
const staub = punkte(MOBIL ? 260 : 520, (i, a, b) => {
  b[i * 3] = (Math.random() - 0.5) * 34; b[i * 3 + 1] = (Math.random() - 0.5) * 18; b[i * 3 + 2] = Math.random();
}, /* glsl */`
  attribute vec3 aSaat; uniform float uZeit; uniform float uHell; uniform float uFluss; uniform float uPx; uniform float uGroesse;
  varying vec3 vFarbe; varying float vA;
  void main(){
    float z = mod(aSaat.z*40.0 + uFluss*0.35, 40.0) - 26.0;
    vec3 p = vec3(aSaat.x, aSaat.y, z);
    vec4 mv = modelViewMatrix * vec4(p,1.0);
    gl_Position = projectionMatrix * mv;
    float fl = 0.6 + 0.4*sin(uZeit*(0.6+aSaat.z*1.5) + aSaat.x*3.0);
    gl_PointSize = uGroesse * uPx * (0.4 + fract(aSaat.z*7.0)) / -mv.z;
    vFarbe = mix(vec3(0.55,0.78,1.0), vec3(1.0,0.82,0.55), step(0.0, z) * 0.8);
    vA = fl * 0.75 * smoothstep(-26.0,-18.0,z) * (1.0 - smoothstep(8.0,14.0,z)) * uHell;
  }`, 30);

/* ── Größe ────────────────────────────────────────────────────────────────── */
let stufe = 0, breite = 0, hoehe = 0, hochformat = false, abstandFaktor = 1;
function groesse(erzwingen) {
  const b = leinwand.clientWidth, h = leinwand.clientHeight;
  if (!b || !h) return;
  if (!erzwingen && b === breite && h === hoehe) return;
  breite = b; hoehe = h;
  const pr = DPR * GUETE[stufe];
  renderer.setPixelRatio(pr);
  renderer.setSize(b, h, false);
  const seit = b / h;
  hochformat = seit < 1.05;
  kamera.fov = hochformat ? 52 : 38;
  abstandFaktor = hochformat ? Math.min(2.0, Math.max(1.0, 0.7 / seit)) : Math.min(1.5, Math.max(1.0, 1.75 / seit));
  kamera.aspect = seit;
  kamera.updateProjectionMatrix();
  const px = h * pr;
  funken.material.uniforms.uPx.value = px / 900;
  staub.material.uniforms.uPx.value = px / 900;
  ORO.schmutzig = true;
}
new ResizeObserver(() => groesse(false)).observe(leinwand);
groesse(true);

/* ── Zeichnen ─────────────────────────────────────────────────────────────── */
const pos = new THREE.Vector3(), ziel = new THREE.Vector3(), blick = new THREE.Vector3();
const zeiten = [];
let bilder = 0, aufgegeben = false;
const istZustand = { s: 0, fluss: 0, finale: 0 };

function setze(s, zeit, maus) {
  uZeit.value = zeit;
  /* Band: Leerlauf + Scroll */
  const fluss = zeit * BAND.leerlauf + s * BAND.scroll;
  istZustand.s = s; istZustand.fluss = fluss;
  staub.material.uniforms.uFluss.value = fluss;

  /* Kamera */
  const versatz = kameraBei(s, pos, ziel);
  pos.sub(ziel).multiplyScalar(abstandFaktor).add(ziel);
  if (maus) { pos.x += maus.x * 0.28; pos.y += -maus.y * 0.18; }
  kamera.position.copy(pos);
  kamera.lookAt(ziel);
  /* Bildversatz: Szene rechts (quer) bzw. oben (hoch), damit die Schrift frei steht; im Finale mittig. */
  if (hochformat) kamera.setViewOffset(breite, hoehe, 0, hoehe * 0.23 * versatz, breite, hoehe);
  else kamera.setViewOffset(breite, hoehe, -breite * 0.2 * versatz, 0, breite, hoehe);

  /* Finale: die helle Platte */
  const f = Math.min(1, Math.max(0, (s - FINALE.start) / (FINALE.ende - FINALE.start)));
  istZustand.finale = f;
  /* Das Band läuft leer, bevor die letzte Platte kommt: es beschleunigt, und was vorn hinausfährt, kommt hinten nicht wieder. */
  const r = Math.min(1, Math.max(0, (s - FINALE.raeumen[0]) / (FINALE.raeumen[1] - FINALE.raeumen[0])));
  const schub = FINALE.schub * r * r * (3 - 2 * r);

  kamera.getWorldDirection(blick);
  for (let i = 0; i < platten.length; i++) {
    const p = platten[i];
    const u0 = p.userData.z0 + fluss - BAND.hinten, u = u0 + schub;
    const weg = Math.floor(u / STRECKE) > Math.floor(u0 / STRECKE);
    const z = (u % STRECKE + STRECKE) % STRECKE + BAND.hinten;
    p.position.set(0, BAND.y + Math.sin(zeit * 0.5 + i * 1.7) * 0.03, z);
    const vorn = BAND.hinten + STRECKE;
    const ein = Math.min(1, Math.max(0, (z + 6.6) / 3.2)), aus = Math.min(1, (vorn - z) / 2.2);   /* hinter dem Tor nur die nächsten zwei, drei Baupläne */
    /* nichts darf der Kamera ins Gesicht fliegen */
    const zurKamera = p.position.distanceTo(pos);
    const nah = Math.min(1, Math.max(0, (zurKamera - 2.6) / 2.4));
    p.material.uniforms.uSicht.value = weg ? 0 : Math.max(0, Math.min(ein, aus)) * nah;
    p.visible = p.material.uniforms.uSicht.value > 0.004;
    p.renderOrder = 100 - Math.round(zurKamera * 4);
  }
  if (f > 0) {
    const fe = f * f * (3 - 2 * f);
    const endZ = pos.z - 0.55;
    finale.position.set(0, 0, -9 + (endZ + 9) * fe);
    finale.visible = true;
    finaleMat.uniforms.uSicht.value = Math.min(1, f * 6);
    finaleMat.uniforms.uVoll.value = Math.min(1, Math.max(0, (f - 0.42) / 0.3));
  } else finale.visible = false;

  /* Kurz vor Schluss dunkelt das Tor nicht ab — es wird von der Platte verdeckt. Schienen und Funken weichen. */
  uHell.value = 1;
}

function zeichnen(s, zeit, maus) {
  if (aufgegeben) return;
  const t0 = performance.now();
  setze(s, zeit, maus);
  renderer.render(szene, kamera);
  bilder++;
  if (bilder < 4) ORO.schmutzig = true;
  if (bilder === 2) document.documentElement.classList.add('buehne-lebt');
  /* Gütemessung: nur was wirklich gezeichnet wurde */
  const dt = performance.now() - t0;
  if (bilder > 8) {
    zeiten.push(dt);
    if (zeiten.length >= GRENZE.fenster) {
      const sortiert = zeiten.slice().sort((a, b) => a - b);
      const p90 = sortiert[Math.floor(sortiert.length * 0.9)], median = sortiert[Math.floor(sortiert.length / 2)];
      zeiten.length = 0;
      if (!ORO.gueteFest) {
        if (median > GRENZE.aufgeben && stufe === GUETE.length - 1) { aufgegeben = true; ORO.standbild('zu-langsam'); return; }
        if (p90 > GRENZE.runter && stufe < GUETE.length - 1) { stufe++; groesse(true); }
      }
    }
  }
}

leinwand.addEventListener('webglcontextlost', (e) => { e.preventDefault(); aufgegeben = true; ORO.standbild('kontext-verloren'); });

ORO.zeichnen = zeichnen;
ORO.messung = {
  zustand: () => ({ ...istZustand, stufe, pixelmass: DPR * GUETE[stufe], bilder, hochformat, abstandFaktor }),
  platten: () => platten.map((p) => ({ z: +p.position.z.toFixed(2), sicht: +p.material.uniforms.uSicht.value.toFixed(2) })),
  projiziere: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(kamera); return { x: (v.x * 0.5 + 0.5) * breite, y: (-v.y * 0.5 + 0.5) * hoehe, vorn: v.z < 1 }; },
};
ORO.schmutzig = true;
