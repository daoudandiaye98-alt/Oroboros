/* Oroboros Design · Akt I — die Bühne in WebGL
   ─────────────────────────────────────────────────────────────────────────────
   Dieses Modul zeichnet nur. Den Takt, den geglätteten Scrollwert, die Folien
   und die Naht zum Dokument führt die Regie im Inline-Skript der Seite
   (window.OROBOROS.buehne). Fehlt dieses Modul, fehlt WebGL oder geht der
   Kontext verloren, steht das Standbild — die Seite bleibt vollständig.

   Parameter (README, „Die Bühne“):
     RING, ringPoint, ringRadius   Geometrie des Oroboros (N 320, M 28, R 1.4)
     FOLLOW, pivotSpin             Nachführung gegen die Kamerabahn (gemessen)
     cameraTarget                  Umlaufbahn, Höhe, Blickpunkt je Seitenverhältnis
     UMGEBUNG                      das Licht, das die Bronze spiegelt — gerechnet, nicht gebacken
     GUETE                         Gütestufen: Pixelmaß, Auflösung des Grundes, Funken, Takt
     WELLEN                        Flüssigbronze-Shader (Zeitskala 0.08, Palette → Saphir)
     NAHT                          Abdunkeln und Entsättigen, wenn das Dokument aufsteigt  */

import * as THREE from './three.module.min.js';

const O = window.OROBOROS;
const B = O && O.buehne;
performance.mark('buehne:modul');

/* ── Gütestufen ────────────────────────────────────────────────────────────
   Start bei „voll“. Misst die Bühne auf einem Schirm mit Pixeldichte unter 1,5
   viel Luft (p90 < 9 ms), rechnet sie überabgetastet (Pixelmaß 1,5) — das ist
   hier die Kantenglättung, ohne MSAA, das in schwachen Grafikpfaden die
   Bildzeit verdoppelt. Wird es eng (p90 > 24 ms in 45 Bildern), geht sie
   stufenweise herunter, zuletzt auf den Halbtakt: der Ring zeichnet jedes
   zweite Bild, Schrift und Scroll laufen weiter im vollen Takt. Hinauf geht
   es nur einmal, am Anfang — ein Pendeln wäre sichtbarer als jede Stufe. */
const MOBIL = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
const DPR = window.devicePixelRatio || 1;
const DPR_DECKEL = MOBIL ? 1.5 : 2;
const GUETE = [
  { name: 'hoch', skala: 1.0, grund: 0.5, funken: 450, takt: 1, ueber: true },
  { name: 'voll', skala: 1.0, grund: 0.5, funken: 450, takt: 1 },
  { name: 'mittel', skala: 0.85, grund: 0.4, funken: 450, takt: 1 },
  { name: 'spar', skala: 0.72, grund: 0.3, funken: 320, takt: 1 },
  { name: 'knapp', skala: 0.6, grund: 0.25, funken: 240, takt: 1 },
  { name: 'halbtakt', skala: 0.6, grund: 0.25, funken: 240, takt: 2 },
];
const START = 1;
const GRENZE = { runter: 24, hinauf: 9, fenster: 45, aufwaermen: 8, aufgeben: 50 };
const NAHT = { dunkel: 0.6, grau: 0.85, belichtung: 2.2 };

const RING = { N: 320, M: 28, R: 1.4, span: Math.PI * 2 * 0.965, snout: 0.075 };
const FOLLOW = { k: 0.98, a: 0.96, p: 6.152, c: -0.42 };
const RING_BOUND = 1.075 / Math.tan(25 * Math.PI / 180);

/* ── Geometrie des Oroboros (unverändert aus „Bronze und Zeit“) ────────── */
function ringPoint(t, ziel = new THREE.Vector3()) {
  const a = t * RING.span - Math.PI * 0.5;
  return ziel.set(Math.cos(a) * RING.R, Math.sin(a) * RING.R, Math.sin(t * Math.PI * 2) * 0.42 + Math.sin(t * Math.PI * 2 * 3) * 0.06);
}
function ringRadius(t) {
  const tt = Math.max(0, t);
  const taper = 0.30 - 0.215 * Math.pow(tt, 0.72);
  const headBulge = Math.exp(-Math.pow(tt / 0.055, 2)) * 0.085;
  const neck = -Math.exp(-Math.pow((tt - 0.11) / 0.05, 2)) * 0.035;
  let r = taper + headBulge + neck;
  if (t < 0) { const s = Math.min(1, -t / RING.snout); r *= 0.14 + 0.86 * Math.pow(1 - s, 0.55); }
  return Math.max(0.03, r);
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1);
function ringFrame(t) {
  const c = ringPoint(t);
  const tan = ringPoint(t + 0.002, _a).sub(ringPoint(t - 0.002, _b)).normalize().clone();
  const nrm = new THREE.Vector3().crossVectors(tan, UP).normalize();
  const bin = new THREE.Vector3().crossVectors(tan, nrm).normalize();
  return { c, tan, nrm, bin };
}
const ringCentreline = [];
function createOuroborosGeometry() {
  const { N, M } = RING;
  const pos = new Float32Array((N + 1) * (M + 1) * 3), uvs = new Float32Array((N + 1) * (M + 1) * 2), idx = [];
  const t0 = -RING.snout;
  const off = new THREE.Vector3();
  ringCentreline.length = 0;
  let p = 0, q = 0;
  for (let i = 0; i <= N; i++) {
    const t = t0 + (i / N) * (1 - t0);
    const { c, nrm, bin } = ringFrame(t);
    const r = ringRadius(t);
    const flat = t < 0.06 ? 0.82 : 1;
    if (i % 2 === 0) ringCentreline.push(c.clone());
    for (let j = 0; j <= M; j++) {
      const v = j / M, ang = v * Math.PI * 2;
      const scale = 1 + 0.026 * Math.sin(ang * 9) * Math.sin(t * N * 0.42) + 0.014 * Math.sin(t * N * 0.9);
      const rr = r * scale;
      off.set(0, 0, 0).addScaledVector(nrm, Math.cos(ang) * rr).addScaledVector(bin, Math.sin(ang) * rr * flat);
      pos[p++] = c.x + off.x; pos[p++] = c.y + off.y; pos[p++] = c.z + off.z;
      uvs[q++] = t; uvs[q++] = v;
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ── Die Umgebung, die das Metall spiegelt ─────────────────────────────────
   Bis hierher eine PMREM-Textur aus einer kleinen Szene: warmer Schein von
   oben, Glanzfleck des Führungslichts, kühles Kantenlicht hinten links, Rest
   vom Funkenboden. Dieselbe Funktion wird jetzt im Shader gerechnet; die
   Rauheit weitet die Keulen (Exponent n → n / (1 + n·r⁴/2), Spitze mit
   (n'+1)/(n+1) — die Energie bleibt). Das spart die Würfeltextur samt acht
   Abrufen je Bildpunkt und ihre Erzeugung beim Start. Gemessen im Vergleich
   PMREM gegen gerechnet: README, „Die Umgebung“. */
const UMGEBUNG = /* glsl */`
  uniform float uUmgebung;
  uniform float uNaht;
  float keule(vec3 d, vec3 l, float n, float r) {
    float n2 = n / (1.0 + n * r * r * r * r * 0.5);
    return (n2 + 1.0) / (n + 1.0) * pow(max(0.0, dot(d, l)), n2);
  }
  vec3 umgebung(vec3 d, float r) {
    const vec3 warm = vec3(0.95, 0.56, 0.24);
    const vec3 kuehl = vec3(0.40, 0.60, 0.95);
    float w = 0.35 * r;
    vec3 c = vec3(0.012, 0.007, 0.004);
    c = mix(c, warm * 0.55, smoothstep(0.05 - w, 0.9 + w, d.y));
    c += warm * 1.6 * keule(d, vec3(0.5898, 0.7373, 0.3441), 24.0, r);
    c += kuehl * 0.45 * keule(d, vec3(-0.6674, 0.3814, -0.5721), 6.0, r);
    c += warm * 0.12 * (1.0 - smoothstep(-0.8 - w, 0.0 + w, d.y));
    return c;
  }`;
const UMGEBUNG_EINSATZ = /* glsl */`
  #if defined( RE_IndirectSpecular )
  {
    vec3 rv = reflect( - geometryViewDir, geometryNormal );
    rv = normalize( mix( rv, geometryNormal, material.roughness * material.roughness ) );
    radiance += umgebung( inverseTransformDirection( rv, viewMatrix ), material.roughness ) * uUmgebung;
    iblIrradiance += PI * umgebung( inverseTransformDirection( geometryNormal, viewMatrix ), 1.0 ) * uUmgebung;
  }
  #endif`;
const NAHT_EINSATZ = `gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), uNaht * ${NAHT.grau.toFixed(2)});`;

function bronze(material, staerke, uNaht) {
  const uUmgebung = { value: staerke };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uUmgebung = uUmgebung;
    shader.uniforms.uNaht = uNaht;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + UMGEBUNG)
      .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n' + UMGEBUNG_EINSATZ)
      .replace('#include <premultiplied_alpha_fragment>', NAHT_EINSATZ + '\n#include <premultiplied_alpha_fragment>');
  };
  material.customProgramCacheKey = () => 'bronze';
}
function naehtFest(material, uNaht) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNaht = uNaht;
    shader.fragmentShader = 'uniform float uNaht;\n' + shader.fragmentShader.replace('#include <premultiplied_alpha_fragment>', NAHT_EINSATZ + '\n#include <premultiplied_alpha_fragment>');
  };
}

/* ── Der Flüssigbronze-Grund ───────────────────────────────────────────── */
const WELLEN = /* glsl */`
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uScroll;
  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
    float aspect = uResolution.x / uResolution.y;
    float time = uTime * 0.08;
    float scroll = uScroll;
    vec2 warpedUv = uv;
    float scrollDeform = scroll * 5.0;
    warpedUv.x += sin(uv.y * 2.5 + time * 0.2 + scrollDeform) * 0.35;
    warpedUv.y += cos(uv.x * 2.5 - time * 0.15 - scrollDeform * 0.8) * 0.35;
    warpedUv.x += sin(uv.y * 1.2 - time * 0.1 - scrollDeform * 1.5) * 0.25;
    warpedUv.y += cos(uv.x * 1.2 + time * 0.18 + scrollDeform * 1.2) * 0.25;
    warpedUv += vec2(scroll * 0.04, -scroll * 0.02) + vec2(uMouse.x * aspect * 0.05, uMouse.y * 0.05);
    const vec2 dir1 = vec2(0.825336, 0.564642);
    const vec2 dir2 = vec2(0.764842, -0.644218);
    const vec2 dir3 = vec2(0.362358, 0.932039);
    float w1 = sin(dot(warpedUv, dir1) * 2.4 + time * 1.0);
    float w2 = cos(dot(warpedUv, dir2) * 3.2 - time * 1.4 + w1 * 0.4);
    float w3 = sin(dot(warpedUv, dir3) * 4.0 + time * 1.8 + w2 * 0.5);
    float waveField = w1 * 0.50 + w2 * 0.35 + w3 * 0.15;
    float wideSheen     = pow(max(0.0, 1.0 - abs(waveField - 0.1)), 2.5);
    float crispSpecular = pow(max(0.0, 1.0 - abs(waveField - 0.15)), 8.0);
    float crest = wideSheen * 0.5 + crispSpecular * 0.9;
    float t = smoothstep(0.0, 1.0, scroll);
    vec3 colShadow = mix(vec3(0.0010, 0.0006, 0.0004), vec3(0.0004, 0.0006, 0.0012), t);
    vec3 colWave1  = mix(vec3(0.085, 0.040, 0.015),   vec3(0.015, 0.035, 0.065),   t);
    vec3 colWave2  = mix(vec3(0.050, 0.022, 0.008),   vec3(0.008, 0.020, 0.045),   t);
    vec3 colCrest  = mix(vec3(0.45, 0.30, 0.18),      vec3(0.18, 0.35, 0.55),      t);
    vec3 color = colShadow;
    color = mix(color, colWave2, smoothstep(-0.6, 0.2, waveField));
    color = mix(color, colWave1, smoothstep(0.0, 0.8, waveField));
    color += colCrest * crest * 0.7;
    color *= 1.0 - dot(uv, uv) * 0.12;
    gl_FragColor = vec4(color, 1.0);
  }`;
const HINTERGRUND = {
  vertex: /* glsl */`varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragment: /* glsl */`
    uniform sampler2D tGrund; uniform float uNaht; uniform float uDunkel; uniform float uGrau;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tGrund, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, vec3(l), uNaht * uGrau) * (1.0 - uDunkel * uNaht);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

function funkenTextur() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 16, 16);
  return new THREE.CanvasTexture(c);
}

/* Warten, bis der Browser Luft hat — die Einrichtung in Häppchen */
const luft = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 16)));

async function start() {
  if (!B) return;
  const canvas = document.getElementById('webgl');
  if (!canvas) return;
  await B.gebraucht;               // Tiefer Einstieg (/#kontakt): erst rechnen, wenn die Bühne ins Bild kommt

  /* ?guete=0…5 hält eine Stufe fest (Standbilder, Messungen); sonst regelt die Bühne selbst.
     ?webgl=erzwingen rechnet auch auf Software-WebGL — nur zum Messen. */
  const q = new URLSearchParams(location.search);
  const fest = q.get('guete');
  const erzwungen = q.get('webgl') === 'erzwingen';
  let stufe = fest !== null && GUETE[Number(fest)] ? Number(fest) : START;
  const pixel = () => {
    const g = GUETE[stufe];
    const basis = Math.min(DPR, DPR_DECKEL) * g.skala;
    return g.ueber ? Math.max(basis, Math.min(1.5, DPR_DECKEL)) : basis;
  };

  /* Software-WebGL (SwiftShader, llvmpipe — etwa bei gesperrtem Grafiktreiber)
     schafft die Bühne nur mit fünf bis zehn Bildern je Sekunde und nimmt dabei
     der ganzen Seite den Takt. Dafür gibt es das Standard-Attribut
     failIfMajorPerformanceCaveat: dann steht das Standbild, und Schrift und
     Scroll laufen flüssig. */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: !erzwungen });
  } catch (e) {
    B.webglFehlt(erzwungen ? 'WebGL nicht verfügbar' : 'kein Hardware-WebGL');
    return;
  }
  renderer.debug.checkShaderErrors = false;       // keine synchrone Rückfrage nach jedem Shader
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = NAHT.belichtung;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); B.webglFehlt('WebGL-Kontext verloren'); }, { once: true });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  scene.add(camera);

  /* Grund: eigene Szene, eigenes Ziel in Teilauflösung */
  const uNaht = { value: 0 };
  const shaderUniforms = { uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2() }, uScroll: { value: 0 } };
  const dreieck = new THREE.BufferGeometry();
  dreieck.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const grundZiel = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, stencilBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const grundSzene = new THREE.Scene();
  const grundKamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const grund = new THREE.Mesh(dreieck, new THREE.ShaderMaterial({ vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: WELLEN, uniforms: shaderUniforms, depthTest: false, depthWrite: false }));
  grund.frustumCulled = false;
  grundSzene.add(grund);
  const hinter = new THREE.Mesh(dreieck, new THREE.ShaderMaterial({
    vertexShader: HINTERGRUND.vertex, fragmentShader: HINTERGRUND.fragment, depthTest: false, depthWrite: false,
    uniforms: { tGrund: { value: grundZiel.texture }, uNaht, uDunkel: { value: NAHT.dunkel }, uGrau: { value: NAHT.grau } },
  }));
  hinter.frustumCulled = false;
  hinter.renderOrder = -10;
  scene.add(hinter);

  /* Licht, wie gemessen: Führung 18, Kante 10, Aufhellung 0.8 — ohne Schattenkarte
     (der Ring wirft auf sich selbst kaum sichtbaren Schatten; die Karte kostete
     einen ganzen zweiten Durchgang je Bild). */
  scene.add(new THREE.AmbientLight('#ffffff', 0.1));
  const key = new THREE.SpotLight('#ffffff', 18.0);
  key.position.set(4, 6, 3); key.angle = Math.PI / 4; key.penumbra = 0.9;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#e3f2ff', 10.0); rim.position.set(-5, 3, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight('#fff3e6', 0.8); fill.position.set(-2, -4, 2); scene.add(fill);

  /* Der Oroboros */
  const modelPivot = new THREE.Group();
  scene.add(modelPivot);
  const gltfModel = new THREE.Group();
  modelPivot.add(gltfModel);
  const mat = new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.42, metalness: 0.92 });
  bronze(mat, 0.7, uNaht);
  gltfModel.add(new THREE.Mesh(createOuroborosGeometry(), mat));
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#1a1210', roughness: 0.15, metalness: 1.0 });
  bronze(eyeMat, 1.0, uNaht);
  eyeMat.customProgramCacheKey = () => 'bronze';
  const eyeT = -0.012;
  const kopf = ringFrame(eyeT);
  const rHead = ringRadius(eyeT);
  const augeGeo = new THREE.SphereGeometry(0.05, 14, 14);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(augeGeo, eyeMat);
    e.position.copy(kopf.c).addScaledVector(kopf.bin, s * rHead * 0.82 * 0.88).addScaledVector(kopf.nrm, rHead * 0.30);
    gltfModel.add(e);
  }
  const box = new THREE.Box3().setFromObject(gltfModel);
  const size = box.getSize(new THREE.Vector3());
  gltfModel.scale.setScalar(2.15 / Math.max(size.x, size.y, size.z, 0.0001));
  gltfModel.updateMatrixWorld(true);
  gltfModel.position.sub(new THREE.Box3().setFromObject(gltfModel).getCenter(new THREE.Vector3()));
  gltfModel.rotation.set(-0.40, 0.55, 0.10);
  modelPivot.position.y = -0.4;

  /* Funken */
  const FUNKEN_MAX = GUETE[0].funken;
  const fPos = new Float32Array(FUNKEN_MAX * 3), fFarbe = new Float32Array(FUNKEN_MAX * 3), fDaten = [];
  for (let i = 0; i < FUNKEN_MAX; i++) {
    fPos[i * 3] = (Math.random() - 0.5) * 6.5; fPos[i * 3 + 1] = (Math.random() - 0.5) * 5.0 - 0.5; fPos[i * 3 + 2] = (Math.random() - 0.5) * 6.5;
    if (Math.random() < 0.6) { fFarbe[i * 3] = 1.0; fFarbe[i * 3 + 1] = 0.4 + Math.random() * 0.15; fFarbe[i * 3 + 2] = 0.05 + Math.random() * 0.1; }
    else { fFarbe[i * 3] = 0.55 + Math.random() * 0.15; fFarbe[i * 3 + 1] = 0.82 + Math.random() * 0.12; fFarbe[i * 3 + 2] = 1.0; }
    fDaten.push({ vx: (Math.random() - 0.5) * 0.4, vy: 0.15 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.4, sway: 0.5 + Math.random() * 1.5, radius: 0.05 + Math.random() * 0.15, phase: Math.random() * Math.PI * 2 });
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fFarbe, 3));
  const fMat = new THREE.PointsMaterial({ size: 0.025, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, map: funkenTextur() });
  naehtFest(fMat, uNaht);
  const funken = new THREE.Points(fGeo, fMat);
  scene.add(funken);
  performance.mark('buehne:szene');

  /* Shader parallel übersetzen lassen, wo der Browser es kann (KHR_parallel_shader_compile):
     dann blockiert das erste Bild nicht den Hauptfaden. */
  await luft();
  if (renderer.extensions.has('KHR_parallel_shader_compile')) {
    try {
      await renderer.compileAsync(grundSzene, grundKamera);
      await luft();
      await renderer.compileAsync(scene, camera);
    } catch (_) { /* dann übersetzt das erste Bild */ }
  }
  performance.mark('buehne:shader');
  await luft();

  /* Größe: nur wenn sich die CSS-Größe der Leinwand wirklich ändert. Die Leinwand
     misst 100lvh — die Adressleiste am Telefon ändert daran nichts. */
  let breite = 0, hoehe = 0, offen = true;
  function wendeGroesseAn() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    breite = w; hoehe = h;
    const pr = pixel();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const gw = Math.max(2, Math.round(w * pr * GUETE[stufe].grund)), gh = Math.max(2, Math.round(h * pr * GUETE[stufe].grund));
    grundZiel.setSize(gw, gh);
    shaderUniforms.uResolution.value.set(gw, gh);
    fGeo.setDrawRange(0, GUETE[stufe].funken);
    offen = false;
  }
  new ResizeObserver(() => { offen = true; B.wecke(); }).observe(canvas);

  /* Kameraziel: Herleitung im README („Warum das Objekt mitdreht“) */
  const targetPos = new THREE.Vector3(), targetLookAt = new THREE.Vector3();
  function pivotSpin(s) { return FOLLOW.c + FOLLOW.k * s * Math.PI * 2 + FOLLOW.a * Math.sin(s * Math.PI * 2 + FOLLOW.p); }
  function cameraTarget(s) {
    const aspect = camera.aspect;
    const phi = s * Math.PI * 2.0;
    const y = 0.35 + Math.sin(s * Math.PI) * 1.05;
    let radius = 5.0 - Math.sin(s * Math.PI) * 0.35;
    let lookY = -0.15;
    if (aspect < 1) {
      const top = 74 / hoehe, ui = Math.min(0.7, 400 / hoehe);
      const band = Math.max(0.2, 1 - ui - top);
      radius = Math.max(radius, RING_BOUND / (0.80 * aspect), RING_BOUND / (0.95 * band));
      const centre = (top + 1 - ui) / 2;
      lookY = -0.4 - (0.5 - centre) * 2 * Math.tan(25 * Math.PI / 180) * radius;
    }
    targetPos.set(radius * Math.sin(phi), y, radius * Math.cos(phi));
    const tp = Math.min(1.0, s / 0.28);
    const ease = (Math.cos(tp * Math.PI) + 1.0) * 0.5;
    const wide = Math.max(0, Math.min(1, aspect - 0.6));
    targetLookAt.set(-0.9 * ease * wide, lookY, 0);
  }

  /* Gütesteuerung: gemessen an der Zeit zwischen zwei Bildern. Entschieden wird
     nach 45 Bildern oder nach einer Sekunde, was zuerst kommt — ein Gerät, das nur
     sechs Bilder in der Sekunde schafft, soll nicht zehn Sekunden auf Hilfe warten.
     Aus demselben Grund endet das Aufwärmen nach 8 Bildern oder 0,35 s, und ein
     Median über 90 ms entscheidet schon nach vier Bildern — direkt in den Halbtakt. */
  const zeiten = [];
  let aufwaermen = GRENZE.aufwaermen, aufwaermZeit = 0, hinaufGeprueft = false, fensterZeit = 0;
  const wechsle = (neu) => { stufe = neu; offen = true; aufwaermen = 6; aufwaermZeit = 0; zeiten.length = 0; fensterZeit = 0; };
  function beobachte(dt) {
    if (fest !== null) return;
    if (aufwaermen > 0 && aufwaermZeit < 0.35) { aufwaermen--; aufwaermZeit += dt; return; }
    zeiten.push(dt * 1000);
    fensterZeit += dt;
    // Median schon nach vier Bildern über 90 ms: nicht erst eine Sekunde zusehen
    const eilig = zeiten.length >= 4 && zeiten.slice().sort((x, y) => x - y)[zeiten.length >> 1] > 90;
    if (zeiten.length < GRENZE.fenster && !(fensterZeit >= 1 && zeiten.length >= 6) && !eilig) return;
    const s = zeiten.slice().sort((a, b) => a - b);
    const p90 = s[Math.floor(s.length * 0.9)], p50 = s[Math.floor(s.length * 0.5)];
    zeiten.length = 0; fensterZeit = 0;
    if (!hinaufGeprueft && stufe === START) {
      hinaufGeprueft = true;
      if (p90 < GRENZE.hinauf && DPR < 1.5 && !MOBIL) { wechsle(0); return; }
    }
    if (p90 > GRENZE.runter && stufe < GUETE.length - 1) {
      // Weit daneben: Median über 45 ms zwei Stufen, über 90 ms gleich in den Halbtakt
      const sprung = p50 > 90 ? GUETE.length - 1 - stufe : p50 > 45 ? 2 : 1;
      wechsle(Math.min(GUETE.length - 1, stufe + sprung));
    } else if (stufe === GUETE.length - 1 && (p50 > GRENZE.aufgeben || p90 > GRENZE.aufgeben * 1.2) && !erzwungen) {
      // Auch im Halbtakt zu langsam: das Standbild ist dann die bessere Bühne
      B.zeichnen = null;
      B.webglFehlt('zu langsam auch im Halbtakt');
    }
  }

  let frames = 0, gezeichnet = 0, erstes = true, dtSumme = 0;
  B.zeichnen = (dt, zeit, zustand) => {
    if (offen) wendeGroesseAn();
    frames++;
    if (!erstes) beobachte(dt);
    dtSumme += dt;
    const takt = GUETE[stufe].takt;
    if (takt > 1 && frames % takt !== 0 && !erstes) return;
    const schritt = dtSumme;
    dtSumme = 0;
    gezeichnet++;
    const s = zustand.s;
    modelPivot.rotation.y = zustand.mausX * 0.25 + pivotSpin(s);
    modelPivot.rotation.x = zustand.mausY * 0.15;

    const n = GUETE[stufe].funken;
    const tempo = 1.0 + zustand.tempo * 9.0, wirbel = zustand.tempo * 0.8;
    for (let i = 0; i < n; i++) {
      const k = i * 3, d = fDaten[i];
      fPos[k] += d.vx * schritt * tempo; fPos[k + 1] += d.vy * schritt * tempo; fPos[k + 2] += d.vz * schritt * tempo;
      const sw = d.radius * (1.0 + wirbel * 4.0);
      fPos[k] += Math.sin(zeit * d.sway + d.phase) * sw * schritt;
      fPos[k + 2] += Math.cos(zeit * d.sway + d.phase) * sw * schritt;
      if (fPos[k + 1] > 3.0 || Math.abs(fPos[k]) > 3.5 || Math.abs(fPos[k + 2]) > 3.5) {
        fPos[k + 1] = -2.5; fPos[k] = (Math.random() - 0.5) * 3.0; fPos[k + 2] = (Math.random() - 0.5) * 3.0;
      }
    }
    fGeo.attributes.position.needsUpdate = true;

    cameraTarget(s);
    camera.position.copy(targetPos);
    camera.lookAt(targetLookAt);

    shaderUniforms.uTime.value = zeit;
    shaderUniforms.uMouse.value.set(zustand.mausX, -zustand.mausY);
    shaderUniforms.uScroll.value = s;
    uNaht.value = zustand.naht;
    renderer.toneMappingExposure = NAHT.belichtung * (1 - 0.55 * zustand.naht);
    fMat.opacity = 0.85 * (1 - zustand.naht);

    renderer.setRenderTarget(grundZiel);
    renderer.render(grundSzene, grundKamera);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    if (erstes) {
      erstes = false;
      requestAnimationFrame(() => { performance.mark('buehne:erstes-bild'); B.bereit(); });
    }
  };

  /* Messschnittstelle: nur lesen — außer jump(), das den Zustand für s herstellt */
  Object.assign(window.__bronze, {
    work: () => gezeichnet,
    guete: () => ({ stufe, ...GUETE[stufe], pixel: pixel(), dpr: DPR, mobil: MOBIL, erzwungen }),
    camera: () => camera.position.toArray(),
    project: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * breite, (1 - v.y) / 2 * hoehe]; },
    jump: (s) => {
      B.setzeSofort(s);
      cameraTarget(s);
      camera.position.copy(targetPos); camera.lookAt(targetLookAt); camera.updateMatrixWorld(true);
      modelPivot.rotation.y = pivotSpin(s); modelPivot.updateMatrixWorld(true);
    },
    ring: () => {
      gltfModel.updateMatrixWorld(true);
      const p = ringCentreline.map((v) => gltfModel.localToWorld(v.clone()));
      let near = Infinity;
      for (const w of p) near = Math.min(near, camera.position.distanceTo(w));
      const q = p.map((w) => { const v = w.clone().project(camera); return [v.x * breite / 2, v.y * hoehe / 2]; });
      let a = 0, d = 0;
      for (let i = 0; i < q.length; i++) {
        const j = (i + 1) % q.length;
        a += q[i][0] * q[j][1] - q[j][0] * q[i][1];
        if (i % 4) continue;
        for (let k = i + 4; k < q.length; k += 4) d = Math.max(d, Math.hypot(q[i][0] - q[k][0], q[i][1] - q[k][1]));
      }
      return { ringness: d > 0 ? 4 * (Math.abs(a) / 2) / (Math.PI * d * d) : 0, span: d, near };
    },
  });

  B.wecke();
}

start().catch((e) => {
  if (B) B.webglFehlt(String(e && e.message ? e.message : e));
});
