/* =========================================================================
   Attest.Solutions — The World (cinematic volumetric atmosphere)
   A continuously evolving warm volumetric environment — fog, god rays,
   drifting dust, sanctioned dark-energy accents, breathing camera, organic
   random events, color evolution, and a restrained post-FX chain. No central
   object; the world exists beyond the viewport. Every motion is noise-driven
   (simplex / FBM / curl) — never a linear sin() loop, never repeating.

   Two renderers, one experience:
     · WebGL (three.js r136 UMD) when the browser can — full volumetric scene
       + EffectComposer post pipeline (bloom, god rays, halation, CA, vignette,
       grain, filmic). GPU dust + energy accents via custom ShaderMaterials.
     · CSS-3D when it cannot — layered warm washes + contour lines, the same
       gestures, cross-fading per chapter. First-class, not a still image.

   Integration contract preserved from the prior tower scene:
     · <canvas id="world"> at z1, alpha:true; #bg-gradient shows at edges.
     · data-theme on <html> per chapter (sky→intelligence→precision→research
       →confidence→authority) drives the CSS overlay theming.
     · [data-go] nav + window.Attest.goChapter; .panel scroll spine (0..5);
       drag orbit + pointer/gyro parallax; engine chapter auto-play + scrub.
     · DPR cap 2; pause on visibilitychange; prefers-reduced-motion → one
       still frame; body.webgl-mode / css-mode / is-static.
   ========================================================================= */

(() => {
  const canvas = document.getElementById("world");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const THREE = window.THREE;
  const NOISE = window.NOISE_GLSL || "";     // GLSL noise lib (snoise/fbm/curl)
  const NJ = window.NOISE_JS || { fbm2: () => 0, vnoise2: () => 0 };

  /* ---- The chapter spine --------------------------------------------- */
  const CHAPTERS = [
    { id: "hero",     theme: "sky",          label: "Equity research" },
    { id: "engine",   theme: "intelligence", label: "The engine" },
    { id: "method",   theme: "precision",    label: "The method" },
    { id: "evidence", theme: "research",     label: "TATAPOWER  ₹376.95", mono: true },
    { id: "status",   theme: "confidence",   label: "Build status" },
    { id: "closing",  theme: "authority",    label: "Attest" },
  ];
  const N = CHAPTERS.length;

  /* ---- Engine data + DOM driver (real, from the original schematic) --- */
  const chipsShown = [0, 0, 3, 5, 6, 7, 8];
  const confPct    = [0, 0, 22, 42, 58, 74, 88];
  const confLabel  = ["—", "—", "Low", "Medium", "Medium", "High", "High"];
  const engineViz = document.getElementById("engine-viz");
  const narrative = document.getElementById("engine-narrative");
  const evChips = engineViz ? engineViz.querySelectorAll(".ev-chip") : [];
  const evNodes = engineViz ? engineViz.querySelectorAll(".ev-node") : [];
  const confFill = document.getElementById("ev-conf-fill");
  const confVal = document.getElementById("ev-conf-val");
  const evItems = narrative ? narrative.querySelectorAll("li") : [];
  let curStage = 0;
  function applyEngine(s) {
    if (s === curStage || !engineViz) return;
    curStage = s;
    engineViz.dataset.stage = String(s);
    evItems.forEach((li) => li.classList.toggle("is-active", +li.dataset.stage === s));
    evNodes.forEach((n) => n.classList.toggle("is-active", s >= (+n.dataset.n) + 1));
    const shown = chipsShown[s];
    evChips.forEach((c, i) => c.classList.toggle("is-on", i < shown));
    if (confFill) confFill.style.width = confPct[s] + "%";
    if (confVal) confVal.textContent = confLabel[s];
  }

  /* =====================================================================
     RENDERER SELECTION · WebGL if possible, else CSS-3D
     ===================================================================== */
  let mode = "css";                       // "webgl" | "css"
  let renderer = null;

  function webglAvailable() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) { return false; }
  }

  if (THREE && webglAvailable()) {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
      mode = "webgl";
    } catch (e) {
      renderer = null; mode = "css";
      console.error("[Attest] WebGLRenderer threw — falling back to CSS-3D.", e);
    }
  } else {
    console.error("[Attest] WebGL/three.js unavailable — using the CSS-3D atmosphere.",
                  THREE ? "(WebGL disabled in browser)" : "(three.js did not load)");
  }
  document.body.classList.add(mode === "webgl" ? "webgl-mode" : "css-mode");

  /* =====================================================================
     QUALITY TIERS · adaptive scaling (Phase 7)
     ===================================================================== */
  const TIERS = {
    high: { fog: 5, dust: 4000, accent: 240, ribbons: 14, dof: true, godrays: true,
            bloom: true, ca: true, grain: true, halation: true, dpr: 2,    ceiling: 1/55 },
    mid:  { fog: 4, dust: 2000, accent: 120, ribbons: 6,  dof: false, godrays: true,
            bloom: true, ca: true, grain: true, halation: false, dpr: 1.5, ceiling: 1/28 },
    low:  { fog: 3, dust: 900,  accent: 40,  ribbons: 0,  dof: false, godrays: false,
            bloom: true, ca: false, grain: false, halation: false, dpr: 1.0, ceiling: 1/20 },
  };
  function guessTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const dpr = window.devicePixelRatio || 1;
    if (cores >= 8 && dpr <= 2 && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return "high";
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return cores >= 6 ? "mid" : "low";
    return "mid";
  }
  let tierName = guessTier();
  let tier = TIERS[tierName];

  /* =====================================================================
     CHAPTER PALETTE · per-chapter atmosphere keyframes (Phase 6)
     Interpolated by the smoothed chapter float `pos` each frame.
     All values within the locked warm morning-light palette; the slate /
     emerald accents are the only cooler moments and only intensify.
     ===================================================================== */
  // Color holder: real THREE.Color when three.js is present, else a no-op stub
  // so the CSS-3D fallback still works if three.min.js fails to load. The stub
  // only needs copy/lerp (used by lerpPal); css mode reads just the numeric fields.
  const hasTHREE = !!THREE;
  const stubColor = () => ({ r: 0, g: 0, b: 0, copy(o) { if (o) { this.r = o.r; this.g = o.g; this.b = o.b; } return this; }, lerp() { return this; } });
  const C = (hex) => hasTHREE ? new THREE.Color(hex) : stubColor();
  const PAL = [
    // fogTint,  skyTop,  skyBot,  light(godray), accent,   hot,     accentInt, dust, fogOp
    { fog: C("#F4EFE6"), top: C("#FCFBF8"), bot: C("#E8E2D8"), light: C("#FFF1DD"), acc: C("#3D5A73"), hot: C("#9FC3E6"), ai: 0.10, dust: 0.7, op: 0.55 },
    { fog: C("#ECE7DF"), top: C("#FAFAF7"), bot: C("#E0D9CC"), light: C("#FFEED2"), acc: C("#3D5A73"), hot: C("#9FC3E6"), ai: 0.45, dust: 0.9, op: 0.60 },
    { fog: C("#F6F2EA"), top: C("#FBFAF6"), bot: C("#E6E0D4"), light: C("#FFF6E6"), acc: C("#2C445A"), hot: C("#8FB6DC"), ai: 0.20, dust: 0.8, op: 0.50 },
    { fog: C("#F2EDE5"), top: C("#F8F6F1"), bot: C("#E2DBCE"), light: C("#FFE8C8"), acc: C("#2C445A"), hot: C("#8FB6DC"), ai: 0.15, dust: 0.7, op: 0.55 },
    { fog: C("#ECE7DF"), top: C("#FAFAF7"), bot: C("#E0D9CC"), light: C("#FFF1DD"), acc: C("#4F7A6A"), hot: C("#A8D9C6"), ai: 0.55, dust: 0.9, op: 0.60 },
    { fog: C("#F4EFE6"), top: C("#FCFBF8"), bot: C("#E8E2D8"), light: C("#FFF1DD"), acc: C("#3D5A73"), hot: C("#9FC3E6"), ai: 0.30, dust: 0.7, op: 0.55 },
  ];
  const _a = { fog: C("#000000"), top: C("#000000"), bot: C("#000000"),
               light: C("#000000"), acc: C("#000000"), hot: C("#000000"),
               ai: 0, dust: 0, op: 0 };
  // Warm reference extremes for visible volumetric structure (created once).
  // Lit wisps lighten toward WHITE; shadow pockets deepen toward STONE; dust
  // reads bright toward DUSTBRIGHT. All stay inside the locked warm palette.
  const WHITE = C("#FFFDF7"), STONE = C("#D6CCBA"), DUSTBRIGHT = C("#FBF3E2");
  function lerpPal(pos) {
    const i = Math.min(N - 1, Math.max(0, Math.floor(pos)));
    const f = Math.min(1, Math.max(0, pos - i));
    const j = Math.min(N - 1, i + 1);
    const s = f * f * (3 - 2 * f);            // smoothstep
    _a.fog.copy(PAL[i].fog).lerp(PAL[j].fog, s);
    _a.top.copy(PAL[i].top).lerp(PAL[j].top, s);
    _a.bot.copy(PAL[i].bot).lerp(PAL[j].bot, s);
    _a.light.copy(PAL[i].light).lerp(PAL[j].light, s);
    _a.acc.copy(PAL[i].acc).lerp(PAL[j].acc, s);
    _a.hot.copy(PAL[i].hot).lerp(PAL[j].hot, s);
    _a.ai = PAL[i].ai + (PAL[j].ai - PAL[i].ai) * s;
    _a.dust = PAL[i].dust + (PAL[j].dust - PAL[i].dust) * s;
    _a.op = PAL[i].op + (PAL[j].op - PAL[i].op) * s;
    return _a;
  }

  /* =====================================================================
     WEBGL SCENE · layered volumetric atmosphere (only built in webgl mode)
     ===================================================================== */
  let scene, camera;
  let skyMat, fogMats = [], fogMeshes = [];
  let dustMat, dustGeo, dustPoints;
  let accMat, accGeo, accPoints;
  let ribMat, ribGeo, ribLines;
  let composer = null, renderPass, bloomPass, bokehPass;
  let godrayPass, halationPass, caPass, vignettePass, grainPass, filmicPass;
  let depthSupport = true;

  // Fog layer depth bands (back → front). Negative Z, world units.
  const FOG_Z = [-28, -18, -11, -6, -2.5];

  if (mode === "webgl") {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
    renderer.outputEncoding = THREE.sRGBEncoding;     // r136: outputEncoding (not outputColorSpace)
    renderer.toneMapping = THREE.NoToneMapping;       // tonemap done in final filmic pass

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    camera.position.set(0, 0, 8);

    /* ---------- Sky far plane (opaque, depth-writing) ---------- */
    skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop:    { value: new THREE.Color("#FCFBF8") },
        uUpper:  { value: new THREE.Color("#F8F6F1") },
        uMid:    { value: new THREE.Color("#F4EFE6") },
        uBottom: { value: new THREE.Color("#E8E2D8") },
        uTime:   { value: 0 }, uWash: { value: 0.04 },
        uSunColor:    { value: new THREE.Color("#FFF3D6") },
        uSunPos:      { value: new THREE.Vector2(0.35, 0.62) },
        uSunIntensity:{ value: 1.35 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: NOISE + `
        uniform vec3 uTop, uUpper, uMid, uBottom, uSunColor; uniform vec2 uSunPos;
        uniform float uTime, uWash, uSunIntensity; varying vec2 vUv;
        void main(){
          float y = vUv.y;
          vec3 col = mix(uBottom, uMid, smoothstep(0.0, 0.4, y));
          col = mix(col, uUpper, smoothstep(0.35, 0.75, y));
          col = mix(col, uTop, smoothstep(0.7, 1.0, y));
          float w = fbm2(vec2(vUv.x * 3.0 + uTime * 0.01, vUv.y * 2.0)) * 0.5 + 0.5;
          col += (w - 0.5) * uWash;
          // Warm sun — a bright disc + soft halo. This is the light source the
          // god-ray pass smears into shafts and bloom catches as glow.
          vec2 sd = (vUv - uSunPos) * vec2(1.0, 1.25);
          float sl2 = dot(sd, sd);
          float core = exp(-sl2 * 26.0) * uSunIntensity;
          float halo = exp(-sl2 * 4.5) * uSunIntensity * 0.42;
          col += uSunColor * (core + halo);
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthWrite: true, side: THREE.DoubleSide,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(160, 100), skyMat);
    sky.position.set(0, 0, -70);
    sky.renderOrder = -10;
    scene.add(sky);

    /* ---------- Fog slab layers (transparent, depth-tested) ---------- */
    const fogVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
    const fogFrag = NOISE + `
      uniform float uTime, uOpacity, uScale, uSeed, uPulse; uniform vec2 uWind;
      uniform vec3 uTint, uTintLit, uTintShadow; varying vec2 vUv;
      void main(){
        vec2 p = vUv * uScale + uWind + vec2(uSeed);
        float n1 = fbm2(p) * 0.5 + 0.5;
        float n2 = fbm2(p * 2.3 - uWind * 0.5 + 19.0) * 0.5 + 0.5;
        float dens = n1 * 0.65 + n2 * 0.35;
        float band = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.42, vUv.y);
        dens *= mix(0.45, 1.15, band);
        float ex = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
        float ey = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        float edge = ex * ey;
        // Volumetric structure: lit wisps (champagne) vs shadow pockets (stone),
        // both warm — this is what makes fog READ against a warm sky.
        vec3 col = mix(uTintShadow, uTintLit, dens);
        float a = dens * uOpacity * edge * (1.0 + uPulse * 0.5);
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }`;
    FOG_Z.forEach((z, i) => {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0, 0) },
          uTint: { value: new THREE.Color("#F4EFE6") },
          uTintLit: { value: new THREE.Color("#FFF6E6") },
          uTintShadow: { value: new THREE.Color("#D6CCBA") },
          uOpacity: { value: 0.85 },
          uScale: { value: 2.4 + i * 0.6 }, uSeed: { value: i * 13.7 + 4.1 },
          uPulse: { value: 0 },
        },
        vertexShader: fogVert, fragmentShader: fogFrag,
        transparent: true, depthWrite: false, depthTest: true,
        blending: THREE.NormalBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 42), m);
      mesh.position.set(0, 0, z);
      mesh.renderOrder = i;                  // far (i=0) draws first
      scene.add(mesh);
      fogMats.push(m); fogMeshes.push(mesh);
    });

    /* ---------- GPU dust (THREE.Points, curl-noise motion) ---------- */
    const MAX_DUST = TIERS.high.dust;
    dustGeo = new THREE.BufferGeometry();
    {
      const pos = new Float32Array(MAX_DUST * 3);
      const seed = new Float32Array(MAX_DUST);
      const layer = new Float32Array(MAX_DUST);
      const size = new Float32Array(MAX_DUST);
      for (let i = 0; i < MAX_DUST; i++) {
        pos[i * 3]     = (Math.random() * 2 - 1) * 22;
        pos[i * 3 + 1] = (Math.random() * 2 - 1) * 14;
        pos[i * 3 + 2] = -2 - Math.random() * 26;
        // vertical density bias: more motes in mid altitudes
        pos[i * 3 + 1] *= 0.6 + 0.4 * Math.sin((pos[i * 3 + 1] / 14) * Math.PI);
        seed[i]  = Math.random();
        layer[i] = Math.random();
        size[i]  = 0.6 + Math.random() * 1.8;
      }
      dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      dustGeo.setAttribute("aSeed",  new THREE.BufferAttribute(seed, 1));
      dustGeo.setAttribute("aLayer", new THREE.BufferAttribute(layer, 1));
      dustGeo.setAttribute("aSize",  new THREE.BufferAttribute(size, 1));
      dustGeo.setDrawRange(0, tier.dust);
    }
    dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uWindStrength: { value: 1.0 }, uSize: { value: 1.35 },
        uDustDensity: { value: 0.7 }, uOpacity: { value: 0.85 }, uSwirl: { value: 0 },
        uDustColor: { value: new THREE.Color("#FBF3E2") },
      },
      vertexShader: NOISE + `
        attribute float aSeed, aLayer, aSize; uniform float uTime, uWindStrength, uSize, uDustDensity, uSwirl;
        varying float vDepth, vSeed;
        void main(){
          vec3 disp = curl3(position * 0.15 + vec3(uTime * 0.06) + aSeed * 10.0) * uWindStrength * (0.4 + aLayer * 0.5);
          vec3 sw = vec3(sin(uTime * 0.3 + aSeed * 6.28), cos(uTime * 0.27 + aSeed * 3.14), 0.0) * uSwirl * 0.7;
          vec4 mv = modelViewMatrix * vec4(position + disp + sw, 1.0);
          vDepth = -mv.z; vSeed = aSeed;
          gl_PointSize = clamp(aSize * uSize * (300.0 / max(0.1, -mv.z)) * uDustDensity, 0.5, 6.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uDustColor; uniform float uOpacity; varying float vDepth, vSeed;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float soft = smoothstep(0.5, 0.0, d);
          float fade = 1.0 - smoothstep(2.0, 28.0, vDepth);
          float a = soft * uOpacity * fade;
          if (a < 0.003) discard;
          gl_FragColor = vec4(uDustColor, a);
        }`,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending,
    });
    dustPoints = new THREE.Points(dustGeo, dustMat);
    dustPoints.frustumCulled = false;
    dustPoints.renderOrder = 5;
    scene.add(dustPoints);

    /* ---------- Energy accents (additive Points, noise-threshold emission) ---------- */
    const MAX_ACC = TIERS.high.accent;
    accGeo = new THREE.BufferGeometry();
    {
      const pos = new Float32Array(MAX_ACC * 3);
      const seed = new Float32Array(MAX_ACC);
      const size = new Float32Array(MAX_ACC);
      for (let i = 0; i < MAX_ACC; i++) {
        pos[i * 3]     = (Math.random() * 2 - 1) * 16;
        pos[i * 3 + 1] = (Math.random() * 2 - 1) * 10;
        pos[i * 3 + 2] = -4 - Math.random() * 20;
        seed[i] = Math.random();
        size[i] = 0.8 + Math.random() * 2.0;
      }
      accGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      accGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      accGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
      accGeo.setDrawRange(0, tier.accent);
    }
    accMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uAccentIntensity: { value: 0 }, uThreshold: { value: 0.78 },
        uSize: { value: 1.0 }, uAccentColor: { value: new THREE.Color("#3D5A73") },
        uHotColor: { value: new THREE.Color("#9FC3E6") },
      },
      vertexShader: NOISE + `
        attribute float aSeed, aSize; uniform float uTime, uAccentIntensity, uThreshold, uSize;
        varying float vLife, vSeed;
        void main(){
          float field = fbm3(vec3(aSeed * 3.0, uTime * 0.08, aSeed * 7.0)) * 0.5 + 0.5;
          float emit = smoothstep(uThreshold - 0.03, uThreshold + 0.03, field);
          float env = emit * uAccentIntensity;
          vLife = env; vSeed = aSeed;
          vec3 disp = curl3(position * 0.2 + vec3(uTime * 0.1) + aSeed * 8.0) * 0.9;
          vec4 mv = modelViewMatrix * vec4(position + disp, 1.0);
          gl_PointSize = clamp(aSize * uSize * (320.0 / max(0.1, -mv.z)) * env, 0.0, 9.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uAccentColor, uHotColor; varying float vLife, vSeed;
        void main(){
          if (vLife <= 0.001) discard;
          float d = length(gl_PointCoord - 0.5);
          float core = smoothstep(0.5, 0.0, d);
          float hot = smoothstep(0.22, 0.0, d);
          vec3 col = mix(uAccentColor, uHotColor, hot);
          float a = (core * 0.45 + hot * 0.85) * vLife;
          gl_FragColor = vec4(col, a);
        }`,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    });
    accPoints = new THREE.Points(accGeo, accMat);
    accPoints.frustumCulled = false;
    accPoints.renderOrder = 6;
    scene.add(accPoints);

    /* ---------- Light-streak ribbons (additive LineSegments) ---------- */
    const MAX_RIB = TIERS.high.ribbons;
    if (MAX_RIB > 0) {
      const segsPerRibbon = 8, vertsPerRibbon = segsPerRibbon * 2;
      const total = MAX_RIB * vertsPerRibbon;
      const rpos = new Float32Array(total * 3);
      const rseed = new Float32Array(total);
      for (let r = 0; r < MAX_RIB; r++) {
        const ox = (Math.random() * 2 - 1) * 14, oy = (Math.random() * 2 - 1) * 8, oz = -6 - Math.random() * 16;
        for (let s = 0; s < segsPerRibbon; s++) {
          const t0 = s / segsPerRibbon, t1 = (s + 1) / segsPerRibbon;
          const i0 = (r * vertsPerRibbon + s * 2) * 3, i1 = i0 + 3;
          rpos[i0] = ox + t0 * 6; rpos[i0 + 1] = oy + Math.sin(t0 * 3.0 + r) * 2; rpos[i0 + 2] = oz;
          rpos[i1] = ox + t1 * 6; rpos[i1 + 1] = oy + Math.sin(t1 * 3.0 + r) * 2; rpos[i1 + 2] = oz;
          rseed[r * vertsPerRibbon + s * 2] = r * 0.137 + t0;
          rseed[r * vertsPerRibbon + s * 2 + 1] = r * 0.137 + t1;
        }
      }
      ribGeo = new THREE.BufferGeometry();
      ribGeo.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
      ribGeo.setAttribute("aSeed", new THREE.BufferAttribute(rseed, 1));
      ribGeo.setDrawRange(0, tier.ribbons * vertsPerRibbon);
      ribMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uStreak: { value: 0 }, uAccentColor: { value: new THREE.Color("#3D5A73") },
        },
        vertexShader: NOISE + `
          attribute float aSeed; uniform float uTime, uStreak; varying float vA;
          void main(){
            vec3 p = position + curl3(position * 0.1 + vec3(uTime * 0.08) + aSeed) * 0.6;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float ph = sin(aSeed * 20.0 + uTime * 1.2) * 0.5 + 0.5;
            vA = uStreak * ph;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uAccentColor; varying float vA;
          void main(){ if (vA <= 0.001) discard; gl_FragColor = vec4(uAccentColor * vA, vA); }`,
        transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
      });
      ribLines = new THREE.LineSegments(ribGeo, ribMat);
      ribLines.frustumCulled = false;
      ribLines.renderOrder = 6;
      scene.add(ribLines);
    }

    /* ---------- Post-processing pipeline (Phases 3, 4, 7) ---------- */
    buildComposer();
    applyTierToScene();
  }

  /* ---- Post-FX shader definitions + composer assembly ---- */
  function fullscreenVert() {
    return `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  }
  function buildComposer() {
    const w = window.innerWidth, h = window.innerHeight;
    composer = new THREE.EffectComposer(renderer);
    composer.setSize(w, h);

    renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Depth-of-field (BokehPass self-generates depth). HIGH only.
    bokehPass = new THREE.BokehPass(scene, camera, {
      focus: 8.0, aperture: 0.0025, maxblur: 0.5, width: w, height: h,
    });
    // BokehPass ships with needsSwap=false (it's the final pass in the official
    // DOF example). Mid-chain that drops its output — flip so the bokeh result
    // propagates to the god-ray / bloom passes that follow.
    bokehPass.needsSwap = true;
    bokehPass.enabled = tier.dof;
    composer.addPass(bokehPass);

    // God rays — screen-space radial accumulation that smears the sky's sun glow
    // into visible warm shafts. Exposure/strength tuned so shafts clearly read
    // against the warm base (the prior 0.22/0.6 settings were invisible).
    godrayPass = new THREE.ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uLightPos: { value: new THREE.Vector2(0.35, 0.62) },
        uExposure: { value: 1.0 }, uDecay: { value: 0.965 }, uDensity: { value: 0.92 },
        uWeight: { value: 1.0 }, uStrength: { value: 1.0 },
        uTint: { value: new THREE.Color("#FFE9C8") },
      },
      vertexShader: fullscreenVert(),
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform vec2 uLightPos; uniform float uExposure, uDecay, uDensity, uWeight, uStrength;
        uniform vec3 uTint; varying vec2 vUv;
        #define NSAMPLES 40
        void main(){
          vec4 base = texture2D(tDiffuse, vUv);
          vec2 delta = (vUv - uLightPos) * uDensity;
          float illum = 1.0; vec3 acc = vec3(0.0); vec2 pos = vUv;
          for (int i = 0; i < NSAMPLES; i++){
            pos -= delta;
            acc += texture2D(tDiffuse, pos).rgb * illum * uWeight;
            illum *= uDecay;
          }
          vec3 rays = acc * uTint * (uExposure * uStrength) / float(NSAMPLES);
          gl_FragColor = vec4(base.rgb + rays, 1.0);
        }`,
    });
    godrayPass.enabled = tier.godrays;
    composer.addPass(godrayPass);

    // Bloom — composer RT is RGBA8 (values clamp to 1.0), so the threshold must
    // stay HIGH: only the sun core (clamped to 1.0), the god-ray shafts near it,
    // and the brightest sky-top band exceed 0.97 and bloom into a luminous glow.
    // A low threshold would bloom the whole warm base into a white wash.
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.6, 0.97);
    bloomPass.enabled = tier.bloom;
    composer.addPass(bloomPass);

    // Halation — warm glow bleeding from highlights.
    halationPass = new THREE.ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, uIntensity: { value: 0.28 },
        uTint: { value: new THREE.Color("#FFE9C8") },
      },
      vertexShader: fullscreenVert(),
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uIntensity; uniform vec3 uTint; varying vec2 vUv;
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
          float bright = smoothstep(0.85, 1.15, lum);
          vec2 px = vec2(0.0028);
          vec3 blur = (texture2D(tDiffuse, vUv + px).rgb + texture2D(tDiffuse, vUv - px).rgb
            + texture2D(tDiffuse, vUv + vec2(-px.x, px.y)).rgb + texture2D(tDiffuse, vUv + vec2(px.x, -px.y)).rgb) * 0.25;
          gl_FragColor = vec4(c.rgb + blur * bright * uTint * uIntensity, 1.0);
        }`,
    });
    halationPass.enabled = tier.halation;
    composer.addPass(halationPass);

    // Chromatic aberration — radial, nudged by pointer parallax.
    caPass = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.0018 }, uPar: { value: new THREE.Vector2(0, 0) } },
      vertexShader: fullscreenVert(),
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uAmount; uniform vec2 uPar; varying vec2 vUv;
        void main(){
          vec2 dir = vUv - 0.5; float d = length(dir);
          vec2 off = dir * uAmount * d + uPar * 0.0015;
          float r = texture2D(tDiffuse, vUv - off).r;
          float g = texture2D(tDiffuse, vUv).g;
          float b = texture2D(tDiffuse, vUv + off).b;
          gl_FragColor = vec4(r, g, b, 1.0);
        }`,
    });
    caPass.enabled = tier.ca;
    composer.addPass(caPass);

    // Vignette — warm, tinted toward warm ink (never pure black).
    vignettePass = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uDarkness: { value: 0.62 }, uTint: { value: new THREE.Color("#2A2722") } },
      vertexShader: fullscreenVert(),
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uDarkness; uniform vec3 uTint; varying vec2 vUv;
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          float d = length(vUv - 0.5);
          float vig = smoothstep(0.75, 0.25, d);
          c.rgb = mix(c.rgb * uTint, c.rgb, vig);
          c.rgb *= mix(1.0 - uDarkness * 0.5, 1.0, vig);
          gl_FragColor = c;
        }`,
    });
    composer.addPass(vignettePass);

    // Film grain — animated fractal, extremely restrained.
    grainPass = new THREE.ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uIntensity: { value: 0.045 },
        uRes: { value: new THREE.Vector2(w, h) },
      },
      vertexShader: fullscreenVert(),
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime, uIntensity; uniform vec2 uRes; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          float g = hash(vUv * uRes * 1.5 + fract(uTime) * vec2(123.4, 567.8));
          g = (g - 0.5) * 2.0;
          gl_FragColor = vec4(c.rgb + g * uIntensity, c.a);
        }`,
    });
    grainPass.enabled = tier.grain;
    composer.addPass(grainPass);

    // Filmic final — gentle ACES on display-space values, exposure breathing.
    filmicPass = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uExposure: { value: 1.0 } },
      vertexShader: fullscreenVert(),
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uExposure; varying vec2 vUv;
        vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
          return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0); }
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
          gl_FragColor = vec4(aces(c), 1.0);
        }`,
    });
    filmicPass.renderToScreen = true;
    composer.addPass(filmicPass);
  }

  function applyTierToScene() {
    if (mode !== "webgl") return;
    // Fog layer visibility
    fogMeshes.forEach((m, i) => { m.visible = i < tier.fog; });
    // Particle draw ranges (built at MAX; draw subset per tier)
    if (dustGeo) dustGeo.setDrawRange(0, tier.dust);
    if (accGeo) accGeo.setDrawRange(0, tier.accent);
    if (ribGeo && ribLines) {
      const vpr = 16; // vertsPerRibbon (segsPerRibbon*2)
      ribGeo.setDrawRange(0, tier.ribbons * vpr);
      ribLines.visible = tier.ribbons > 0;
    }
    // Pass toggles
    if (bokehPass) bokehPass.enabled = tier.dof;
    if (godrayPass) godrayPass.enabled = tier.godrays;
    if (bloomPass) bloomPass.enabled = tier.bloom;
    if (halationPass) halationPass.enabled = tier.halation;
    if (caPass) caPass.enabled = tier.ca;
    if (grainPass) grainPass.enabled = tier.grain;
    // DPR
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
    if (composer) composer.setPixelRatio(renderer.getPixelRatio());
  }

  /* =====================================================================
     CSS-3D SCENE · layered warm washes + contour lines (no tower)
     ===================================================================== */
  const cssTower = document.getElementById("css-tower");
  let cssWashes = [];
  const WASH_COLORS = ["#FFF9EC", "#F4EFE6", "#DFEAF2", "#ECE7DF", "#F2EDE5"];
  const WASH_Z = [-260, -180, -120, -60, -20];

  function buildCSS() {
    if (!cssTower) return;
    cssTower.innerHTML = "";
    cssWashes = [];
    WASH_Z.forEach((z, i) => {
      const w = document.createElement("div");
      w.className = "css-wash css-wash--" + i;
      w.style.background = `radial-gradient(ellipse at ${(30 + i * 12) % 80}% ${(20 + i * 18) % 80}%, ${WASH_COLORS[i]} 0%, transparent 65%)`;
      w.style.transform = `translate(-50%, -50%) translate3d(0,0,${z}px)`;
      cssTower.appendChild(w);
      cssWashes.push(w);
    });
    const contour = document.createElement("div");
    contour.className = "css-contour";
    cssTower.appendChild(contour);
  }
  if (mode === "css") buildCSS();

  /* ---- Sizing -------------------------------------------------------- */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (mode === "webgl" && renderer) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (composer) composer.setSize(w, h);
      if (bokehPass) { bokehPass.uniforms.aspect.value = camera.aspect; }
      if (grainPass) grainPass.uniforms.uRes.value.set(w, h);
    }
  }

  /* =====================================================================
     INPUT · scroll (1D progress) + drag orbit + pointer/gyro parallax
     (shared by both renderers — listeners live on window so they fire
      whether the gesture target is the canvas or the CSS scene)
     ===================================================================== */
  const isDesktop = window.matchMedia("(pointer: fine)").matches ||
                    !window.matchMedia("(pointer: coarse)").matches;

  let target = 0, pos = 0;
  const TC = 0.12;
  const damp = (dt) => 1 - Math.exp(-dt / TC);
  const sections = Array.from(document.querySelectorAll(".panel"));
  let sectionMids = [];
  function measureSections() {
    sectionMids = sections.map((s) => {
      const r = s.getBoundingClientRect();
      return (r.top + window.scrollY) + r.height / 2;
    });
  }
  function scrollProgress() {
    if (!sectionMids.length) return 0;
    const center = window.scrollY + window.innerHeight / 2;
    if (center <= sectionMids[0]) return 0;
    if (center >= sectionMids[N - 1]) return N - 1;
    for (let i = 0; i < N - 1; i++) {
      if (center >= sectionMids[i] && center < sectionMids[i + 1])
        return i + (center - sectionMids[i]) / (sectionMids[i + 1] - sectionMids[i]);
    }
    return N - 1;
  }
  measureSections();
  window.addEventListener("scroll", () => { target = scrollProgress(); lastInteract = performance.now(); }, { passive: true });
  window.addEventListener("resize", measureSections, { passive: true });
  setTimeout(measureSections, 300); setTimeout(measureSections, 1200);
  target = scrollProgress(); pos = target;

  let dragging = false, lastX = 0, lastY = 0, dragStartX = 0;
  let orbitX = 0, orbitY = 0;
  let idleSpin = 0;
  const hint = document.getElementById("gesture-hint");
  let hintGone = false;
  function dismissHint() { if (!hintGone && hint) { hintGone = true; hint.classList.add("is-hidden"); } }

  function isContentTarget(t) {
    return !!(t && t.closest && t.closest(".panel-inner, .nav, .drawer, .footer"));
  }

  window.addEventListener("pointerdown", (e) => {
    if (isContentTarget(e.target)) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY; dragStartX = e.clientX;
    lastInteract = performance.now();
    dismissHint();
  }, { passive: true });
  window.addEventListener("pointermove", (e) => {
    lastInteract = performance.now();
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (!isDesktop && Math.abs(dy) > Math.abs(dx)) return;
      orbitX = Math.max(-1.15, Math.min(1.15, orbitX + dx * 0.005));
      orbitY = Math.max(-0.40, Math.min(0.40, orbitY + dy * 0.004));
      if (activeChapter === 1) {
        engineTarget = Math.max(0, Math.min(1, 0.5 + (e.clientX - dragStartX) / 420));
        enginePauseUntil = performance.now() + 3000;
      }
    } else if (isDesktop) {
      ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.y = -((e.clientY / window.innerHeight) * 2 - 1);
    }
  }, { passive: true });
  function endDrag() { dragging = false; }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  const ptr = { x: 0, y: 0 };
  const par = { x: 0, y: 0 };
  const MAX_OFFSET = 0.22;

  let gyro = { active: false, ref: { b: 0, g: 0 } };
  const GYRO_RANGE = 20;
  function onDeviceOrient(e) {
    if (e.beta == null && e.gamma == null) return;
    if (!gyro.active) gyro.active = true;
    gyro.ref.b += (((e.beta || 0) - gyro.ref.b) * 0.008);
    gyro.ref.g += (((e.gamma || 0) - gyro.ref.g) * 0.008);
    let gx = (((e.gamma || 0) - gyro.ref.g) / GYRO_RANGE);
    let gy = -(((e.beta || 0) - gyro.ref.b) / GYRO_RANGE);
    const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    if (ang === 90) { const t = gx; gx = -gy; gy = t; }
    else if (ang === 270) { const t = gx; gx = gy; gy = -t; }
    ptr.x = Math.max(-1, Math.min(1, gx));
    ptr.y = Math.max(-1, Math.min(1, gy));
    dismissHint();
  }
  function enableGyro() {
    if (gyro.active) return;
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then((r) => {
        if (r === "granted") { window.addEventListener("deviceorientation", onDeviceOrient); }
      }).catch(() => {});
    } else if (typeof DeviceOrientationEvent !== "undefined") {
      window.addEventListener("deviceorientation", onDeviceOrient);
    }
  }
  if (!isDesktop) {
    const once = () => { enableGyro(); window.removeEventListener("pointerdown", once); window.removeEventListener("touchstart", once); };
    window.addEventListener("pointerdown", once);
    window.addEventListener("touchstart", once, { passive: true });
  }

  /* =====================================================================
     ENGINE · auto-play + drag-scrub
     ===================================================================== */
  let enginePos = 0, engineTarget = 0, enginePauseUntil = 0;
  function updateEngine(dt, active) {
    if (!active) { enginePos = 0; engineTarget = 0; if (curStage) applyEngine(1); return; }
    if (enginePos < 1 && performance.now() > enginePauseUntil) {
      enginePos = Math.min(1, enginePos + dt / 4.5);
      engineTarget = enginePos;
    } else {
      enginePos += (engineTarget - enginePos) * damp(dt);
    }
    const stage = Math.min(6, Math.max(1, Math.floor(enginePos * 6) + 1));
    applyEngine(stage);
  }

  /* =====================================================================
     UI · active panel + theme + footer
     ===================================================================== */
  let activeChapter = 0;
  function setActive(idx) {
    if (idx === activeChapter) return;
    activeChapter = idx;
    document.documentElement.setAttribute("data-theme", CHAPTERS[idx].theme);
  }
  setActive(0);

  function goChapter(id) {
    const idx = CHAPTERS.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const el = sections[idx];
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
    dismissHint();
  }
  document.querySelectorAll("[data-go]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("data-go");
      if (id) { e.preventDefault(); goChapter(id); }
    });
  });
  window.Attest = window.Attest || {};
  window.Attest.goChapter = goChapter;

  /* =====================================================================
     ORGANIC EVENTS · noise-threshold triggers, no timers (Phase 5)
     ===================================================================== */
  let lastInteract = performance.now();
  const events = [
    { name: "swirl",  seed: 1.3,  freq: 0.05, thr: 0.74, decay: 2.6, last: 0, active: 0 },
    { name: "pulse",  seed: 7.1,  freq: 0.04, thr: 0.66, decay: 3.2, last: 0, active: 0 },
    { name: "streak", seed: 13.7, freq: 0.07, thr: 0.82, decay: 1.8, last: 0, active: 0 },
    { name: "spark",  seed: 21.4, freq: 0.09, thr: 0.78, decay: 1.2, last: 0, active: 0 },
  ];
  function updateEvents(dt, t) {
    for (const f of events) {
      const v = NJ.fbm2(f.seed, t * f.freq, 4) * 0.5 + 0.5;
      if (v > f.thr && f.last <= f.thr) f.active = 1.0;     // upward crossing
      f.last = v;
      f.active = Math.max(0, f.active - dt * f.decay);
    }
  }
  const ev = (n) => events.find((f) => f.name === n).active;

  /* =====================================================================
     COLOR EVOLUTION + CAMERA · applied each frame (Phase 6)
     ===================================================================== */
  const n1 = (seed, t) => NJ.fbm2(seed, t, 4);              // ~ -1..1 smooth
  const baseY = (p) => (p - (N - 1) / 2) * 0.35;
  const baseZ = (p) => 8.0 - (p / (N - 1)) * 0.6;

  function applyPaletteAndCamera(t) {
    const P = lerpPal(pos);
    const idle = Math.min(1, Math.max(0, (performance.now() - lastInteract - 2000) / 3000));
    const sparkEnv = ev("spark");
    const accentInt = P.ai * (0.45 + 0.55 * idle) * (1.0 + sparkEnv * 0.6);

    if (mode === "webgl") {
      // Sun screen position (shared by sky glow + god-ray source) — drifts slowly
      const sunX = 0.35 + n1(9.1, t * 0.02) * 0.05;
      const sunY = 0.62 + n1(2.2, t * 0.018) * 0.04;
      // Sky
      skyMat.uniforms.uTop.value.copy(P.top);
      skyMat.uniforms.uMid.value.copy(P.fog);
      skyMat.uniforms.uBottom.value.copy(P.bot);
      skyMat.uniforms.uUpper.value.copy(P.top).lerp(P.fog, 0.5);
      skyMat.uniforms.uWash.value = 0.04 + 0.03 * (n1(3.1, t * 0.02) * 0.5 + 0.5);
      skyMat.uniforms.uSunColor.value.copy(P.light);
      skyMat.uniforms.uSunPos.value.set(sunX, sunY);
      skyMat.uniforms.uSunIntensity.value = 1.25 + 0.25 * (n1(11.5, t * 0.015) * 0.5 + 0.5);
      // Fog layers — lit/shadow structure within the warm range, opacity boosted
      const windAmp = 0.6 + ev("pulse") * 0.4;
      for (let i = 0; i < fogMats.length; i++) {
        const m = fogMats[i];
        m.uniforms.uTime.value = t;
        m.uniforms.uTint.value.copy(P.fog);
        m.uniforms.uTintLit.value.copy(P.fog).lerp(WHITE, 0.5);
        m.uniforms.uTintShadow.value.copy(P.fog).lerp(STONE, 0.6);
        m.uniforms.uOpacity.value = P.op * (0.85 + 0.35 * (1 - i / fogMats.length));
        m.uniforms.uPulse.value = ev("pulse") * (0.6 + i * 0.1);
        // wind per layer (different drag → parallax depth), curl-ish via fbm
        const s = m.uniforms.uSeed.value;
        m.uniforms.uWind.value.set(
          n1(s, t * 0.05) * windAmp * (0.4 + i * 0.15),
          n1(s + 10.3, t * 0.04) * windAmp * (0.3 + i * 0.12)
        );
      }
      // Dust — bright motes catching the light
      dustMat.uniforms.uTime.value = t;
      dustMat.uniforms.uDustDensity.value = P.dust * (0.8 + 0.2 * (n1(5.7, t * 0.03) * 0.5 + 0.5));
      dustMat.uniforms.uDustColor.value.copy(P.fog).lerp(DUSTBRIGHT, 0.5);
      dustMat.uniforms.uOpacity.value = 0.7 + 0.2 * (n1(8.2, t * 0.02) * 0.5 + 0.5);
      dustMat.uniforms.uWindStrength.value = 1.0 + ev("swirl") * 1.6;
      dustMat.uniforms.uSwirl.value = ev("swirl");
      // Accents
      accMat.uniforms.uTime.value = t;
      accMat.uniforms.uAccentIntensity.value = accentInt;
      accMat.uniforms.uAccentColor.value.copy(P.acc);
      accMat.uniforms.uHotColor.value.copy(P.hot);
      accMat.uniforms.uThreshold.value = 0.78 - accentInt * 0.12;  // more intensity → easier emit
      // Ribbons
      if (ribMat) {
        ribMat.uniforms.uTime.value = t;
        ribMat.uniforms.uStreak.value = ev("streak") * accentInt * 0.5;
        ribMat.uniforms.uAccentColor.value.copy(P.acc);
      }
      // God rays — synced to the sky sun position so shafts radiate from the glow
      if (godrayPass && godrayPass.enabled) {
        godrayPass.uniforms.uLightPos.value.set(sunX, sunY);
        godrayPass.uniforms.uTint.value.copy(P.light);
        godrayPass.uniforms.uStrength.value = 0.85 + 0.3 * (n1(4.4, t * 0.015) * 0.5 + 0.5);
      }
      if (caPass && caPass.enabled) caPass.uniforms.uPar.value.set(par.x, par.y);
      if (grainPass && grainPass.enabled) grainPass.uniforms.uTime.value = t;
      // Filmic exposure — brighter base + slow breathing
      filmicPass.uniforms.uExposure.value = 1.08 + 0.05 * n1(6.6, t * 0.03);

      // Camera · never still, never repeating (nested eased noise + parallax + orbit)
      const pY = baseY(pos), pZ = baseZ(pos);
      camera.position.x += (par.x * MAX_OFFSET + n1(1.3, t * 0.10) * 0.18 + orbitX * 0.8 - camera.position.x) * damp(dt2) * 0.9;
      camera.position.y += (pY + par.y * MAX_OFFSET * 0.6 + n1(7.1, t * 0.13) * 0.14 + orbitY * 0.4 - camera.position.y) * damp(dt2);
      camera.position.z += (pZ + n1(3.7, t * 0.07) * 0.10 - camera.position.z) * damp(dt2);
      camera.lookAt(par.x * 0.4, pY + par.y * 0.3 + n1(5.2, t * 0.05) * 0.06, 0);
    }
  }

  /* =====================================================================
     RENDER · per-mode frame paint
     ===================================================================== */
  function renderCSS(c) {
    if (!cssTower) return;
    const yaw = orbitX * 0.25 + par.x * 0.18;
    const pitch = 0.06 - par.y * 0.08 + orbitY * 0.2;
    const fit = Math.min(1, window.innerWidth / 720, window.innerHeight / 880);
    cssTower.style.transform =
      `translate3d(${par.x * 26}px, ${par.y * 18}px, 0) rotateX(${pitch}rad) rotateY(${yaw}rad) scale(${fit})`;
    // per-chapter accent wash opacity
    const P = lerpPal(c);
    cssTower.style.setProperty("--accent-wash", String(P.ai));
  }

  /* =====================================================================
     LOOP
     ===================================================================== */
  let lastTime = performance.now();
  let raf = null;
  let dt2 = 0.016;                 // shared dt for camera easing
  let ema = 1 / 60, overCeiling = 0;

  function frame() {
    const now = performance.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.2) dt = 0.2;
    dt2 = dt;
    const t = now / 1000;

    // 1) smoothed scroll progress (chapter index, 0..N-1)
    pos += (target - pos) * damp(dt);
    const c = pos;
    const idx = Math.min(N - 1, Math.max(0, Math.round(c)));

    // 2) parallax smoothing (mouse or gyro)
    par.x += (ptr.x - par.x) * damp(dt);
    par.y += (ptr.y - par.y) * damp(dt);

    // 3) orbit decay when released + idle drift
    if (!dragging) { orbitX *= (1 - Math.min(1, dt * 0.6)); orbitY *= (1 - Math.min(1, dt * 0.6)); }
    idleSpin += dt * 0.02;

    // 4) engine chapter logic
    updateEngine(dt, idx === 1);

    // 5) UI swap
    setActive(idx);

    // 6) organic events
    updateEvents(dt, t);

    // 7) palette + camera + uniforms
    applyPaletteAndCamera(t);

    // 8) paint
    if (mode === "webgl") {
      composer.render();
      // adaptive quality: downgrade on sustained slow frames (sticks, no flap-up)
      ema = ema * 0.92 + dt * 0.08;
      if (ema > tier.ceiling) overCeiling++; else overCeiling = 0;
      if (overCeiling > 40 && tierName !== "low") {
        tierName = tierName === "high" ? "mid" : "low";
        tier = TIERS[tierName]; applyTierToScene(); resize();
        overCeiling = 0;
        console.warn("[Attest] quality downgrade →", tierName);
      }
    } else {
      renderCSS(c);
    }

    raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  setTimeout(resize, 300); setTimeout(resize, 1000);

  function onVis() {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (raf === null) { lastTime = performance.now(); raf = requestAnimationFrame(frame); }
  }
  document.addEventListener("visibilitychange", onVis);

  /* ---- Reduced motion · one calm still atmosphere frame -------------- */
  if (reduce) {
    document.body.classList.add("is-static");
    if (mode === "webgl") {
      applyPaletteAndCamera(performance.now() / 1000);
      composer.render();
      window.addEventListener("resize", () => { resize(); composer.render(); });
    } else {
      renderCSS(0);
    }
    return;
  }

  raf = requestAnimationFrame(frame);

  /* =====================================================================
     DISPOSE · full cleanup (new — the prior scene had none). Hot-reload safe.
     ===================================================================== */
  function dispose() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    disposed = true;
    window.removeEventListener("scroll", measureSections);
    window.removeEventListener("resize", resize);
    window.removeEventListener("resize", measureSections);
    document.removeEventListener("visibilitychange", onVis);
    if (mode === "webgl" && renderer) {
      [skyMat, dustMat, accMat, ribMat, ...fogMats].forEach((m) => m && m.dispose());
      [dustGeo, accGeo, ribGeo].forEach((g) => g && g.dispose());
      fogMeshes.forEach((m) => m.geometry.dispose());
      if (composer) {
        composer.passes.forEach((p) => p.material && p.material.dispose && p.material.dispose());
        composer.renderTarget1 && composer.renderTarget1.dispose();
        composer.renderTarget2 && composer.renderTarget2.dispose();
      }
      renderer.dispose();
    }
  }
  let disposed = false;
  window.Attest = window.Attest || {};
  window.Attest.dispose = dispose;
})();