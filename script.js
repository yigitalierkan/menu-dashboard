(() => {
  "use strict";

  /* ---------- 1. TRANSLATIONS ---------- */
  const I18N = {
    tr: {
      "promo.title": "Kampanyalar",
      "food.title": "Yiyecekler",
      "drink.title": "İçecekler",
      cta: "Menüyü keşfet",
      back: "Ana sayfa",
      loading: "Menü yükleniyor…",
      error: "Menü açılamadı",
      soon: "Çok yakında",
      page: "Sayfa",
    },
    en: {
      "promo.title": "Promotions & Offers",
      "food.title": "Food Menu",
      "drink.title": "Beverages",
      cta: "Explore menu",
      back: "Back to home",
      loading: "Loading menu…",
      error: "Menu could not be opened",
      soon: "Coming soon",
      page: "Page",
    },
  };

  const CFG = window.MENU_CONFIG || { fit: "page", pdf: {} };
  const SECTIONS = {
    promo: { accent: "var(--card-promo)", ink: "var(--card-promo-ink)", titleKey: "promo.title" },
    food:  { accent: "var(--card-food)",  ink: "var(--card-food-ink)",  titleKey: "food.title" },
    drink: { accent: "var(--card-drink)", ink: "var(--card-drink-ink)", titleKey: "drink.title" },
  };

  /* ---------- 2. HELPERS & STATE ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const viewer = $("#viewer"), viewerBody = $("#viewerBody"), viewerTitle = $("#viewerTitle");

  let lang = "tr";
  try { lang = localStorage.getItem("menu-lang") || "tr"; } catch (_) {}
  if (!I18N[lang]) lang = "tr";

  // Languages offered to guests (see config.js). With one language the TR/EN switch is hidden.
  const LANGS = (CFG.languages && CFG.languages.length ? CFG.languages : ["tr", "en"]).filter((l) => I18N[l]);
  if (!LANGS.includes(lang)) lang = LANGS[0] || "tr";
  document.documentElement.classList.toggle("single-lang", LANGS.length < 2);

  let openSection = null;
  let pdfDoc = null;          // current PDF.js document
  let pageNo = 1;             // current page (fit = "page")
  let renderToken = 0;        // cancels stale renders
  let pdfjsPromise = null;
  let pageCache = new Map();  // page number -> Promise<canvas>
  let cacheKey = "";          // screen size the cached pages were drawn for

  /* ---------- 3. LANGUAGE ---------- */
  function applyLang(next) {
    lang = next;
    try { localStorage.setItem("menu-lang", lang); } catch (_) {}
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach((el) => (el.textContent = I18N[lang][el.dataset.i18n]));
    $$(".lang").forEach((g) => {
      g.dataset.active = lang;
      $$(".lang-btn", g).forEach((b) => {
        const on = b.dataset.lang === lang;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on);
      });
    });
    if (openSection) loadMenu();
  }

  /* ---------- 4. PDF VIEWER (PDF.js, drawn on canvas: no browser PDF viewer, no download prompt) ---------- */
  function getPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import("./vendor/pdfjs/pdf.min.mjs").then((m) => {
        m.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.min.mjs";
        return m;
      });
    }
    return pdfjsPromise;
  }

  function status(msg, isError) {
    viewerBody.innerHTML = `<div class="pdf-status${isError ? " is-error" : ""}">${msg}</div>`;
  }

  async function loadMenu() {
    const token = ++renderToken;
    const s = SECTIONS[openSection];
    viewer.style.setProperty("--accent", s.accent);
    viewer.style.setProperty("--accent-ink", s.ink);
    viewerTitle.textContent = I18N[lang][s.titleKey];

    destroyDoc();
    const files = CFG.pdf[openSection] || {};
    const url = files[lang] || files.tr || files.en;   // fall back to the other language
    if (!url) { status(I18N[lang].soon); return; }

    status(I18N[lang].loading);
    try {
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({
        url,
        disableRangeRequests: true,   // load the whole file: works with the offline cache
        disableStream: true,
        disableAutoFetch: false,
      }).promise;
      if (token !== renderToken) { doc.destroy(); return; }
      pdfDoc = doc;
      pageNo = 1;
      buildViewer();
      await renderCurrent();
    } catch (err) {
      console.error(err);
      if (token === renderToken) status(`${I18N[lang].error}<small>${url}</small>`, true);
    }
  }

  function destroyDoc() {
    pageCache.clear(); cacheKey = "";
    if (pdfDoc) { try { pdfDoc.destroy(); } catch (_) {} pdfDoc = null; }
  }

  function buildViewer() {
    const mode = CFG.fit === "width" ? "width" : "page";
    const multi = pdfDoc.numPages > 1;
    viewerBody.innerHTML = `
      <div class="pdf${mode === "page" && multi ? " has-nav" : ""}" data-mode="${mode}">
        <div class="pdf-stage" id="pdfStage"></div>
        ${mode === "page" && multi ? `
          <button class="pdf-nav pdf-prev" type="button" aria-label="Previous page"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="pdf-nav pdf-next" type="button" aria-label="Next page"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div class="pdf-count" id="pdfCount"></div>` : ""}
      </div>`;
    const prev = $(".pdf-prev"), next = $(".pdf-next");
    if (prev) prev.addEventListener("click", () => goTo(pageNo - 1));
    if (next) next.addEventListener("click", () => goTo(pageNo + 1));
    if (mode === "page" && multi) attachSwipe($("#pdfStage"));
  }

  function goTo(n) {
    if (!pdfDoc || n < 1 || n > pdfDoc.numPages || n === pageNo) return;
    pageNo = n;
    renderCurrent();
  }

  function attachSwipe(el) {
    let x0 = null, y0 = 0;
    el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goTo(pageNo + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* Draw one page into a canvas that fits `box` (contain) or the box width. */
  async function drawPage(page, canvas, boxW, boxH, mode) {
    const base = page.getViewport({ scale: 1 });
    const scale = mode === "width" ? boxW / base.width : Math.min(boxW / base.width, boxH / base.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale: scale * dpr });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = Math.floor(vp.width / dpr) + "px";
    canvas.style.height = Math.floor(vp.height / dpr) + "px";
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  }

  /* Pages are drawn off-screen and kept in a small cache, so turning a page is instant
     when the neighbouring pages have already been prepared. */
  function getPageCanvas(doc, n, boxW, boxH) {
    if (!pageCache.has(n)) {
      const p = doc.getPage(n).then(async (page) => {
        const canvas = document.createElement("canvas");
        await drawPage(page, canvas, boxW, boxH, "page");
        return canvas;
      });
      p.catch(() => pageCache.delete(n));
      pageCache.set(n, p);
    }
    return pageCache.get(n);
  }

  async function prefetchAround(doc, n, boxW, boxH, token) {
    for (const k of [n + 1, n - 1, n + 2]) {
      if (k < 1 || k > doc.numPages) continue;
      if (token !== renderToken || doc !== pdfDoc) return;
      try { await getPageCanvas(doc, k, boxW, boxH); } catch (_) { return; }
    }
    for (const k of [...pageCache.keys()]) if (Math.abs(k - n) > 3) pageCache.delete(k);   // keep memory small
  }

  async function renderCurrent() {
    if (!pdfDoc) return;
    const token = ++renderToken;
    const doc = pdfDoc;
    const pdfEl = $(".pdf");
    const stage = $("#pdfStage");
    if (!pdfEl || !stage) return;
    const mode = pdfEl.dataset.mode;
    const boxW = stage.clientWidth, boxH = stage.clientHeight;

    try {
      if (mode === "page") {
        const wanted = pageNo;
        const key = `${boxW}x${boxH}`;
        if (key !== cacheKey) { pageCache.clear(); cacheKey = key; }
        const count = $("#pdfCount");
        const prev = $(".pdf-prev"), next = $(".pdf-next");
        if (count) count.textContent = `${wanted} / ${doc.numPages}`;
        if (prev) prev.disabled = wanted <= 1;
        if (next) next.disabled = wanted >= doc.numPages;

        // Keep showing the previous page (never a blank one) until the new one is ready.
        pdfEl.classList.add("is-loading");
        const canvas = await getPageCanvas(doc, wanted, boxW, boxH);
        if (token !== renderToken || doc !== pdfDoc) return;
        stage.replaceChildren(canvas);
        pdfEl.classList.remove("is-loading");
        prefetchAround(doc, wanted, boxW, boxH, token);
      } else {
        stage.innerHTML = "";
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (token !== renderToken) return;
          const canvas = document.createElement("canvas");
          stage.appendChild(canvas);
          await drawPage(page, canvas, boxW, boxH, "width");
        }
      }
    } catch (err) {
      if (token === renderToken) console.error(err);
    }
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (openSection && pdfDoc) renderCurrent(); }, 150);
  });

  /* ---------- 5. OPEN / CLOSE ---------- */
  function openMenu(key) {
    openSection = key;
    viewer.hidden = false;
    viewer.setAttribute("aria-hidden", "false");
    loadMenu();
    $("#backBtn").focus({ preventScroll: true });
  }

  function closeMenu() {
    openSection = null;
    renderToken++;
    destroyDoc();
    viewer.hidden = true;
    viewer.setAttribute("aria-hidden", "true");
    viewerBody.innerHTML = "";
  }

  /* ---------- 6. EVENTS ---------- */
  $$(".lang-btn").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));
  $$(".card").forEach((c) => c.addEventListener("click", () => openMenu(c.dataset.section)));
  $("#backBtn").addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => {
    if (!openSection) return;
    if (e.key === "Escape") closeMenu();
    if (e.key === "ArrowRight") goTo(pageNo + 1);
    if (e.key === "ArrowLeft") goTo(pageNo - 1);
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());

  applyLang(lang);

  /* ---------- 7. OFFLINE (service worker) ---------- */
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then((reg) => {
        // Tell the worker which PDFs to keep for offline use.
        const urls = [];
        Object.values(CFG.pdf || {}).forEach((o) => Object.values(o).forEach((u) => u && urls.push(u)));
        if (reg.active && urls.length) reg.active.postMessage({ type: "CACHE_URLS", urls });
      }).catch((e) => console.warn("Service worker not registered:", e));
    });
  }
})();
