/* =========================================================================
   Attest.Solutions — The Environment
   Not a background. The building surrounding the product.

   One fixed canvas paints a living environment that evolves continuously
   as the visitor walks through six atmospheric "rooms" of the institution:
     Hero        — warm morning light, breathing space, faint valuation curves
     Engine      — depth: drafting grid, precision dots, a whisper of contour
     Method      — architectural planes, paper sheets, blueprint geometry
     Evidence    — cooler research desk, charts become the focus
     Build status— architecture fades, transparency, whitespace
     Closing     — everything dissolves, only light remains

   A continuous zone value (float) is computed from scroll position across
   the section tops, so every layer cross-fades between zones with no hard
   break. Light drifts slowly (it breathes); geometry is static (it is the
   architecture). No per-frame blur — softness comes from gradients. Reduced
   motion → a static morning gradient; nothing animates.
   ========================================================================= */

(() => {
  const canvas = document.getElementById("atmosphere-canvas");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;

  /* ---- Zones (scroll order) ------------------------------------------ */
  const THEME_ZONE = { sky: 0, intelligence: 1, precision: 2, research: 3, confidence: 4, authority: 5, air: 0 };

  // Base gradient stops per zone: top · mid · bottom. The morning evolves
  // warm → deeper/drafted → paper → cool desk → open white → warm dissolve.
  const BASE = [
    ["#FCFBF8", "#F8F6F1", "#F4EFE6"], // sky         — arrival
    ["#F8F6F1", "#F4EFE6", "#EFE9DF"], // intelligence— drafting depth
    ["#F6F2EA", "#F2EDE5", "#ECE7DF"], // precision   — paper / blueprint
    ["#F4F6F7", "#EDF1F3", "#E8EDEF"], // research    — cool desk
    ["#ECEEF0", "#F2F4F5", "#F6F7F5"], // confidence  — open whitespace
    ["#F4EFE6", "#F8F6F1", "#FCFBF8"], // authority   — dissolve to light
  ];

  // Per-zone opacity curves (0..1) for each layer. Interpolated by the
  // continuous zone value so layers ramp in and out across boundaries.
  // Geometry layers (grid/dots/contour) are kept faint — the architecture
  // you barely notice. Light layers (warm/curve/beam/planes/wash) carry it.
  const L = {
    warmLight: [0.55, 0.40, 0.34, 0.30, 0.34, 0.50],
    curve:     [0.50, 0.18, 0.26, 0.18, 0.14, 0.45],
    lightBeam: [0.34, 0.12, 0.30, 0.12, 0.12, 0.34],
    draftGrid: [0.00, 0.60, 0.45, 0.12, 0.00, 0.00],
    dots:      [0.00, 0.50, 0.18, 0.40, 0.00, 0.00],
    planes:    [0.00, 0.12, 0.58, 0.30, 0.45, 0.12],
    coolWash:  [0.00, 0.00, 0.10, 0.50, 0.32, 0.08],
    contour:   [0.00, 0.22, 0.30, 0.00, 0.00, 0.00],
  };

  // Output alpha scales — geometry stays well under 3%; light is gentle.
  const SCALE = {
    warmLight: 0.34, curve: 0.5, lightBeam: 0.5,
    draftGrid: 0.028, dots: 0.03, planes: 0.085,
    coolWash: 0.5, contour: 0.03,
  };

  let sections = [];   // { top, zone } in document order, measured in doc coords

  function collect() {
    sections = Array.from(document.querySelectorAll("section[data-chapter]")).map((el) => ({
      top: 0,
      zone: THEME_ZONE[el.getAttribute("data-theme")] ?? 0,
    }));
  }
  collect();

  function measure() {
    const els = document.querySelectorAll("section[data-chapter]");
    const sy = window.scrollY || window.pageYOffset || 0;
    els.forEach((el, i) => {
      if (!sections[i]) return;
      const r = el.getBoundingClientRect();
      sections[i].top = r.top + sy;
    });
  }

  /* ---- Continuous zone from scroll ---------------------------------- */
  let zone = 0;
  function computeZone() {
    const vc = (window.innerHeight / 2) + (window.scrollY || 0);
    if (!sections.length) { zone = 0; return; }
    let i = 0;
    while (i < sections.length - 1 && sections[i + 1].top <= vc) i++;
    let z = sections[i].zone;
    if (i < sections.length - 1) {
      const boundary = sections[i + 1].top;
      const band = Math.max(120, 0.35 * window.innerHeight);
      const d = boundary - vc;                       // >0: before the boundary
      if (d < band) {
        const blend = Math.max(0, Math.min(1, 1 - d / band));
        z = z + blend * (sections[i + 1].zone - z);
      }
    }
    zone = z;
  }

  /* ---- Color helpers ------------------------------------------------- */
  function hexToRgb(h) {
    const s = h.replace("#", "");
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  function mix(c1, c2, t) {
    const a = hexToRgb(c1), b = hexToRgb(c2);
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  const lerp = (a, b, t) => a + (b - a) * t;

  function baseStops(z) {
    const i = Math.floor(z), f = z - i;
    const a = BASE[i], b = BASE[Math.min(BASE.length - 1, i + 1)];
    return [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)];
  }
  function op(name, z) {
    const arr = L[name];
    const i = Math.floor(z), f = z - i;
    return lerp(arr[i], arr[Math.min(arr.length - 1, i + 1)], f);
  }

  /* ---- Layers -------------------------------------------------------- */
  function drawBase(colors) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.5, colors[1]);
    g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawWarmLight(t, a) {
    if (a <= 0.002) return;
    const blobs = [
      { x: 0.28, y: 0.30, r: 0.62, ph: 0.0 },
      { x: 0.74, y: 0.46, r: 0.55, ph: 2.1 },
    ];
    for (const b of blobs) {
      const cx = (b.x + Math.sin(t * 0.018 + b.ph) * 0.025) * W;
      const cy = (b.y + Math.cos(t * 0.014 + b.ph) * 0.02) * H;
      const rr = b.r * Math.max(W, H);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, `rgba(255,249,236,${a})`);
      g.addColorStop(0.55, `rgba(255,248,232,${a * 0.35})`);
      g.addColorStop(1, "rgba(255,248,232,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
  }

  function drawCurve(t, a) {
    if (a <= 0.002) return;
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 2; k++) {
      const phase = t * 0.05 + k * 1.7;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const u = x / W;
        const y = H * (0.86 - 0.72 * Math.pow(u, 1.6 + Math.sin(phase) * 0.12)) + Math.sin(u * 7 + phase) * 5;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(61,90,115,${a * 0.5})`;
      ctx.stroke();
    }
  }

  function drawLightBeam(t, a) {
    if (a <= 0.002) return;
    const ang = -Math.PI / 3.1 + Math.sin(t * 0.02) * 0.05;
    const cx = (0.5 + Math.sin(t * 0.016) * 0.10) * W;
    const cy = (0.18 + Math.cos(t * 0.019) * 0.05) * H;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const band = ctx.createLinearGradient(-W * 0.34, 0, W * 0.34, 0);
    band.addColorStop(0, "rgba(255,250,238,0)");
    band.addColorStop(0.5, `rgba(255,250,238,${a})`);
    band.addColorStop(1, "rgba(255,250,238,0)");
    ctx.fillStyle = band;
    ctx.fillRect(-W, -H * 1.6, W * 2, H * 3.2);
    ctx.restore();
  }

  // Static drafting grid — invisible editorial geometry.
  function drawDraftGrid(a) {
    if (a <= 0.002) return;
    ctx.strokeStyle = `rgba(42,39,34,${a})`;
    ctx.lineWidth = 1;
    const step = 124;
    for (let x = 0; x <= W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  // Tiny precision dots at grid intersections — the research desk.
  function drawDots(a) {
    if (a <= 0.002) return;
    ctx.fillStyle = `rgba(42,39,34,${a * 1.4})`;
    const step = 124, every = 3;
    for (let i = 0; i * step <= W; i++) {
      for (let j = 0; j * step <= H; j++) {
        if (((i + j) % every) === 0) { ctx.beginPath(); ctx.arc(i * step, j * step, 1.1, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }

  // Large translucent planes — paper sheets / architectural surfaces catching light.
  function drawPlanes(t, a) {
    if (a <= 0.002) return;
    const planes = [
      { x: 0.22, y: 0.34, r: 0.58, ph: 0.0 },
      { x: 0.76, y: 0.52, r: 0.52, ph: 1.9 },
      { x: 0.50, y: 0.78, r: 0.60, ph: 3.4 },
    ];
    for (const p of planes) {
      const cx = (p.x + Math.sin(t * 0.03 + p.ph) * 0.03) * W;
      const cy = (p.y + Math.cos(t * 0.025 + p.ph) * 0.025) * H;
      const rr = p.r * Math.max(W, H);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, `rgba(255,253,247,${a * 0.95})`);
      g.addColorStop(0.65, `rgba(255,253,247,${a * 0.28})`);
      g.addColorStop(1, "rgba(255,253,247,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
  }

  // Cool slate wash — the research-desk shift.
  function drawCoolWash(a) {
    if (a <= 0.002) return;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(178,200,216,0)");
    g.addColorStop(0.5, `rgba(178,200,216,${a * 0.6})`);
    g.addColorStop(1, "rgba(178,200,216,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Faint architectural contour — only in the drafting/blueprint zones.
  function drawContour(a) {
    if (a <= 0.002) return;
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(42,39,34,${a})`;
    for (let k = 0; k < 3; k++) {
      const y0 = H * (0.18 + 0.30 * k);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 14) {
        const u = x / W;
        const y = y0 + Math.sin(u * Math.PI * 2 + k) * H * 0.055;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /* ---- Resize -------------------------------------------------------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measure();
  }

  /* ---- Loop --------------------------------------------------------- */
  let raf = null;
  let lastZoneAt = 0;

  function frame(now) {
    const t = now * 0.001;
    if (now - lastZoneAt > 64) { computeZone(); lastZoneAt = now; }

    const colors = baseStops(zone);
    ctx.clearRect(0, 0, W, H);
    drawBase(colors);
    drawWarmLight(t, op("warmLight", zone) * SCALE.warmLight);
    drawCurve(t, op("curve", zone) * SCALE.curve);
    drawLightBeam(t, op("lightBeam", zone) * SCALE.lightBeam);
    drawDraftGrid(op("draftGrid", zone) * SCALE.draftGrid);
    drawDots(op("dots", zone) * SCALE.dots);
    drawPlanes(t, op("planes", zone) * SCALE.planes);
    drawCoolWash(op("coolWash", zone) * SCALE.coolWash);
    drawContour(op("contour", zone) * SCALE.contour);

    raf = requestAnimationFrame(frame);
  }

  // Periodically re-measure tops (content reflow, images loading).
  setInterval(measure, 1200);

  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("scroll", measure, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (raf === null) { lastZoneAt = 0; raf = requestAnimationFrame(frame); }
  });

  raf = requestAnimationFrame(frame);
})();