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
      empty: "Menü yakında burada.",
    },
    en: {
      "promo.title": "Promotions & Offers",
      "food.title": "Food Menu",
      "drink.title": "Beverages",
      cta: "Explore menu",
      back: "Back to home",
      empty: "Menu coming soon.",
    },
  };

  /* ---------- 2. MENU SOURCES ----------
     Set `pdf` per language to a file path to show a PDF in full screen.
     Leave it as null to show the built-in HTML list in `items`.        */
  const SECTIONS = {
    promo: {
      accent: "var(--card-promo)", ink: "var(--card-promo-ink)", titleKey: "promo.title",
      pdf: { tr: null, en: null }, // e.g. "menus/promo-tr.pdf"
      items: {
        tr: [["Öğle Menüsü", "Çorba, ana yemek, içecek", "290 ₺"], ["İkinci içecek bizden", "Hafta içi 15:00–18:00", "—"]],
        en: [["Lunch set", "Soup, main course, drink", "290 ₺"], ["Second drink free", "Weekdays 3–6 pm", "—"]],
      },
    },
    food: {
      accent: "var(--card-food)", ink: "var(--card-food-ink)", titleKey: "food.title",
      pdf: { tr: menus/foods-tr.pdf, en: null }, // e.g. "menus/food-tr.pdf"
      items: {
        tr: [["Mercimek Çorbası", "Limon ve tereyağı ile", "120 ₺"], ["Adana Kebap", "Közlenmiş biber, lavaş", "420 ₺"], ["Mantı", "Yoğurt ve nane yağı", "310 ₺"], ["Künefe", "Antep fıstığı ile", "230 ₺"]],
        en: [["Lentil Soup", "With lemon and butter", "120 ₺"], ["Adana Kebab", "Roasted pepper, flatbread", "420 ₺"], ["Manti", "Yogurt and mint oil", "310 ₺"], ["Künefe", "With pistachio", "230 ₺"]],
      },
    },
    drink: {
      accent: "var(--card-drink)", ink: "var(--card-drink-ink)", titleKey: "drink.title",
      pdf: { tr: menus/drinks-tr.pdf, en: null }, // e.g. "menus/drinks-tr.pdf"
      items: {
        tr: [["Türk Kahvesi", "Lokum ile", "90 ₺"], ["Çay", "İnce belli bardak", "35 ₺"], ["Ayran", "Ev yapımı", "50 ₺"], ["Taze Limonata", "Nane ile", "110 ₺"]],
        en: [["Turkish Coffee", "With Turkish delight", "90 ₺"], ["Tea", "Tulip glass", "35 ₺"], ["Ayran", "House-made yogurt drink", "50 ₺"], ["Fresh Lemonade", "With mint", "110 ₺"]],
      },
    },
  };

  /* ---------- 3. STATE & ELEMENTS ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const viewer = $("#viewer"), viewerBody = $("#viewerBody"), viewerTitle = $("#viewerTitle");

  let lang = "tr";
  try { lang = localStorage.getItem("menu-lang") || "tr"; } catch (_) {}
  if (!I18N[lang]) lang = "tr";
  let openSection = null;

  /* ---------- 4. LANGUAGE ---------- */
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
    if (openSection) renderViewer(); // refresh the open menu in the new language
  }

  /* ---------- 5. VIEWER ---------- */
  function renderViewer() {
    const s = SECTIONS[openSection];
    viewer.style.setProperty("--accent", s.accent);
    viewer.style.setProperty("--accent-ink", s.ink);
    viewerTitle.textContent = I18N[lang][s.titleKey];

    const pdf = s.pdf[lang];
    if (pdf) {
      viewerBody.innerHTML = `<iframe src="${pdf}#toolbar=0&navpanes=0" title="${I18N[lang][s.titleKey]}"></iframe>`;
      return;
    }
    const rows = s.items[lang] || [];
    viewerBody.innerHTML = rows.length
      ? `<div class="menu-html">${rows.map(([n, d, p]) =>
          `<div class="menu-item"><span>${n}<small>${d}</small></span><b>${p}</b></div>`).join("")}</div>`
      : `<div class="menu-html">${I18N[lang].empty}</div>`;
  }

  function openMenu(key) {
    openSection = key;
    renderViewer();
    viewer.hidden = false;
    viewer.setAttribute("aria-hidden", "false");
    $("#backBtn").focus({ preventScroll: true });
  }

  function closeMenu() {
    openSection = null;
    viewer.hidden = true;
    viewer.setAttribute("aria-hidden", "true");
    viewerBody.innerHTML = "";
  }

  /* ---------- 6. EVENTS ---------- */
  $$(".lang-btn").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));
  $$(".card").forEach((c) => c.addEventListener("click", () => openMenu(c.dataset.section)));
  $("#backBtn").addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openSection) closeMenu(); });
  document.addEventListener("contextmenu", (e) => e.preventDefault()); // kiosk: no long-press menu

  applyLang(lang);
})();
