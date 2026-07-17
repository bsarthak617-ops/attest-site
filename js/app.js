/* =========================================================================
   Attest.Solutions — App (overlay)
   The immersive engine (world.js) owns travel, theming and the research
   engine. This file owns the honest interactive details that live in the
   HTML overlay: the mobile drawer, nav scroll state (for the static
   fallback), the explorable-evidence chart lenses, and metric provenance.
   Nothing here fabricates; it only wires up real copy.
   ========================================================================= */

(() => {
  /* ---- Mobile drawer ------------------------------------------------ */
  const toggle = document.querySelector(".nav-toggle");
  const drawer = document.querySelector(".drawer");
  const setDrawer = (open) => {
    if (!drawer || !toggle) return;
    drawer.setAttribute("data-open", String(open));
    toggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };
  if (toggle && drawer) {
    toggle.addEventListener("click", () => setDrawer(drawer.getAttribute("data-open") !== "true"));
    drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setDrawer(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setDrawer(false); });
  }

  /* ---- Nav scroll state · for the reduced-motion / no-WebGL fallback --- */
  const nav = document.querySelector(".nav");
  const onScrollNav = () => {
    if (!nav) return;
    if ((window.scrollY || 0) > 24) nav.classList.add("nav--scrolled");
    else nav.classList.remove("nav--scrolled");
  };
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* ---- Explorable evidence · chart lenses --------------------------- */
  const figNote = document.getElementById("fig-note");
  if (figNote) {
    const notes = {
      pivot: "Pivot-extrema mining — local highs and lows are identified at three horizons, then ranked by swing magnitude. Deterministic; no model in the path.",
      trend: "Multi-horizon trendlines — OLS fits across swing horizons; lines that fail a goodness-of-fit rejection are discarded, not kept to flatter a narrative.",
      vsa: "VSA accumulation audit — volume at each pivot is read for absorption, distribution and effort-vs-result. A deterministic audit of who is buying the weakness."
    };
    const lenses = document.querySelectorAll(".fig-lens");
    const setLens = (lens) => {
      lenses.forEach((l) => {
        const on = l.dataset.lens === lens;
        l.classList.toggle("is-active", on);
        l.setAttribute("aria-selected", String(on));
      });
      if (notes[lens]) figNote.textContent = notes[lens];
      figNote.dataset.lens = lens;
    };
    lenses.forEach((l) => {
      l.addEventListener("click", () => setLens(l.dataset.lens));
      l.addEventListener("mouseenter", () => setLens(l.dataset.lens));
      l.addEventListener("focus", () => setLens(l.dataset.lens));
    });
  }

  /* ---- Metric provenance · hover/focus reveals the source ----------- */
  document.querySelectorAll(".brief-line[data-prov]").forEach((line) => {
    const prov = document.createElement("span");
    prov.className = "prov";
    prov.textContent = line.getAttribute("data-prov");
    line.appendChild(prov);
  });
})();