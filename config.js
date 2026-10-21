/* ------------------------------------------------------------
   MENU SETTINGS – the only file you normally need to edit.
   Keep the quotes, commas and braces exactly as they are.
   ------------------------------------------------------------ */
window.MENU_CONFIG = {

  /* How a PDF fits the screen:
     "page"  = the whole page is always visible (swipe / arrows for next page)
     "width" = page fills the screen width, scroll down for the rest      */
  fit: "page",

  /* Languages shown to guests. Only Turkish for now.
     To switch English back on, change this to ["tr", "en"]. */
  languages: ["tr"],

  /* PDF file for each section and language (paths inside the menus folder).
     Use lowercase names, no spaces, no Turkish characters.               */
  pdf: {
    /* "" = no PDF yet. A missing language falls back to the other one. */
    promo: { tr: "",                    en: "" },
    food:  { tr: "menus/foods-tr.pdf",  en: "" },
    drink: { tr: "menus/drinks-tr.pdf", en: "" }
  }
};
