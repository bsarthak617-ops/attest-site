/* =========================================================================
   Attest.Solutions — The Signature
   A single tasteful WebGL object: the homepage's heart.

   An abstract architectural form — stacked stone slabs tapering skyward
   like the floor plates of a tower — catching warm morning light. It is the
   institution made tangible: calm, precise, premium, never nerdy. It carries
   no data; the hero words carry meaning. It rotates slowly, leans toward the
   pointer, and drifts with scroll. Reduced motion → a single static render.
   Performance-capped (DPR ≤ 2, soft shadows, pause on hidden), transparent
   background so the living environment shows through.

   Loaded as a classic script after three.min.js (UMD global), so the
   prototype works from file:// as well as a local server.
   ========================================================================= */

(() => {
  const canvas = document.getElementById("signature-canvas");
  if (!canvas || !window.THREE) { /* rings fallback remains visible */ return; }
  const THREE = window.THREE;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.7, 7.4);

  /* ---- Morning light: warm key upper-left, cool fill right, soft ambient -- */
  const key = new THREE.DirectionalLight(0xfff1dd, 2.4);
  key.position.set(-3.6, 4.2, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -5; key.shadow.camera.right = 5;
  key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
  key.shadow.radius = 7;
  key.shadow.bias = -0.0002;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdfeaf2, 0.95);
  fill.position.set(4.2, 1.2, 2.4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(0, -2.5, -4);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0xffffff, 0.34));

  /* ---- Warm stone materials — architectural, matte, a single accent slab - */
  const stone     = new THREE.MeshStandardMaterial({ color: 0xEEE7DC, roughness: 0.62, metalness: 0.06 });
  const stoneDeep = new THREE.MeshStandardMaterial({ color: 0xE2D8C9, roughness: 0.66, metalness: 0.05 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x3D5A73, roughness: 0.48, metalness: 0.14 });

  /* ---- Stacked slabs — floor plates tapering toward the sky -------------- */
  const group = new THREE.Group();
  const COUNT = 7;
  for (let i = 0; i < COUNT; i++) {
    const t = i / (COUNT - 1);
    const w = 2.7 - t * 1.0;
    const h = 0.22;
    const geo = new THREE.BoxGeometry(w, h, w, 1, 1, 1);
    const mat = (i === Math.floor(COUNT / 2)) ? accentMat : (i % 2 ? stone : stoneDeep);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = (i - (COUNT - 1) / 2) * 0.44;
    m.position.x = (i % 2 ? 0.06 : -0.06) * (1 - t * 0.4);
    m.rotation.y = (i % 2 ? 0.12 : -0.10) * (1 - t * 0.5);
    m.castShadow = true;
    group.add(m);
  }
  scene.add(group);

  /* ---- Soft contact shadow beneath, on an invisible plane --------------- */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.1;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---- Sizing --------------------------------------------------------- */
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ---- Reduced motion: one calm, static render ------------------------ */
  if (reduce) {
    resize();
    group.rotation.set(0.12, 0.5, 0);
    canvas.style.opacity = "1";
    canvas.parentElement.classList.add("is-loaded");
    renderer.render(scene, camera);
    window.addEventListener("resize", () => { resize(); renderer.render(scene, camera); });
    return;
  }

  /* ---- Pointer parallax + scroll drift -------------------------------- */
  const ptr = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
    ptr.y = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
  }, { passive: true });

  let scrollY = 0;
  window.addEventListener("scroll", () => { scrollY = window.scrollY || 0; }, { passive: true });

  /* ---- Entrance -------------------------------------------------------- */
  let entry = 0;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  let raf = null;
  let spin = 0;
  let loaded = false;
  function frame(now) {
    const t = now * 0.001;

    if (!loaded) { loaded = true; canvas.parentElement.classList.add("is-loaded"); }
    entry = Math.min(1, entry + 0.014);
    const e = easeOut(entry);
    canvas.style.opacity = String(e);
    group.scale.setScalar(0.94 + 0.06 * e);

    spin += 0.0024;
    const scrollInf = Math.min(scrollY / Math.max(1, window.innerHeight), 1);
    const targetY = spin + scrollInf * 1.3 + ptr.x * 0.6;
    const targetX = 0.12 - ptr.y * 0.26 - scrollInf * 0.14;

    group.rotation.y += (targetY - group.rotation.y) * 0.06;
    group.rotation.x += (targetX - group.rotation.x) * 0.06;
    camera.position.x += (ptr.x * 0.45 - camera.position.x) * 0.03;
    camera.position.y += (0.7 - ptr.y * 0.3 - camera.position.y) * 0.03;
    camera.lookAt(0, 0.25, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  // Re-measure after fonts/reveal settle layout.
  setTimeout(resize, 300);
  setTimeout(resize, 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
    else if (raf === null) { raf = requestAnimationFrame(frame); }
  });

  raf = requestAnimationFrame(frame);
})();