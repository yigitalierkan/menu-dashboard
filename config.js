/* ------------------------------------------------------------
   MENU SETTINGS – the only file you normally need to edit.
   Keep the quotes, commas and braces exactly as they are.
   ------------------------------------------------------------ */
window.MENU_CONFIG = {

  /* How a PDF fits the screen:
     "page"  = the whole page is always visible (swipe / arrows for next page)
     "width" = page fills the screen width, scroll down for the rest      */
  fit: "page",

  /* PDF file for each section and language (paths inside the menus folder).
     Use lowercase names, no spaces, no Turkish characters.               */
  pdf: {
    promo: { tr: "menus/promo-tr.pdf",  en: "menus/promo-en.pdf"  },
    food:  { tr: "menus/food-tr.pdf",   en: "menus/food-en.pdf"   },
    drink: { tr: "menus/drinks-tr.pdf", en: "menus/drinks-en.pdf" }
  }
};
