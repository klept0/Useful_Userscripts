// ==UserScript==
// @name         Instagram Recipe → AnyList
// @namespace    https://klept0.local/userscripts
// @version      1.1.0
// @description  Scrape recipe captions from Instagram posts/reels and one-click copy Title/Ingredients/Steps for pasting into AnyList
// @author       klept0
// @match        https://www.instagram.com/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @run-at       document-idle
// @inject-into  content
// @updateURL    https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Shopping%20Stuff/instagram-recipe-to-anylist.user.js
// @downloadURL  https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Shopping%20Stuff/instagram-recipe-to-anylist.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Debug logging is quiet by default — flip it on from the console with
  // localStorage.setItem('irtl_debug', '1') and reload, no code edit needed.
  const DEBUG = (() => {
    try { return localStorage.getItem('irtl_debug') === '1'; } catch (e) { return false; }
  })();
  function log(...args) { if (DEBUG) console.log(...args); }

  log('[IRTL] script loaded, path=', location.pathname);

  try {

  // Reel/post URLs are usually "/<username>/reel/<code>/" (or "/reel/<code>/"
  // via short links) — match the tail rather than anchoring at the root so
  // the leading username segment doesn't break detection.
  const POST_PATH_RE = /\/(p|reel|reels)\/[^/]+\/?$/;
  const PANEL_ID = 'irtl-panel';
  const BUTTON_ID = 'irtl-trigger';

  // Not every userscript manager implements GM_addStyle (Userscripts.app on
  // Safari only provides GM_info/GM_xmlhttpRequest, for example) — use it
  // when available, otherwise fall back to a plain <style> tag. Instagram's
  // CSP allows 'unsafe-inline' for style-src (unlike script-src), so this
  // works everywhere without needing a nonce.
  function addStyle(css) {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css);
      return;
    }
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- styles ----------

  addStyle(`
    #${BUTTON_ID} {
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 999999;
      background: #ff5a5f;
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 10px 16px;
      font-size: 14px;
      font-family: -apple-system, sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,.3);
    }
    #${PANEL_ID} {
      --irtl-bg: #fff;
      --irtl-fg: #111;
      --irtl-border: #ccc;
      --irtl-muted: #666;
    }
    @media (prefers-color-scheme: dark) {
      #${PANEL_ID} {
        --irtl-bg: #242424;
        --irtl-fg: #f0f0f0;
        --irtl-border: #555;
        --irtl-muted: #aaa;
      }
    }
    #${PANEL_ID}, #${PANEL_ID} * {
      /* Instagram's own global h3/label/input rules otherwise win the
         cascade (they set very low-contrast colors), leaving our panel text
         unreadable even though the boxes render fine. Force it everywhere
         under the panel. */
      color: var(--irtl-fg) !important;
      box-sizing: border-box;
    }
    #${PANEL_ID} {
      position: fixed;
      top: 40px;
      right: 20px;
      width: 440px;
      max-width: calc(100vw - 40px);
      max-height: 90vh;
      overflow-y: auto;
      z-index: 999999;
      background: var(--irtl-bg);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,.4);
      padding: 14px;
      font-family: -apple-system, sans-serif;
      font-size: 13px;
    }
    #${PANEL_ID} h3 {
      margin: 0 0 10px;
      font-size: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #${PANEL_ID} .irtl-h3-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #${PANEL_ID} button.irtl-clear {
      background: none;
      border: 1px solid var(--irtl-border);
      border-radius: 6px;
      font-size: 11px;
      padding: 3px 8px;
      cursor: pointer;
    }
    #${PANEL_ID} label {
      display: block;
      font-weight: 600;
      margin: 10px 0 4px;
    }
    #${PANEL_ID} input[type=text],
    #${PANEL_ID} textarea {
      width: 100%;
      background: var(--irtl-bg) !important;
      border: 1px solid var(--irtl-border);
      border-radius: 6px;
      padding: 6px 8px;
      font-family: inherit;
      font-size: 13px;
      resize: vertical;
    }
    #${PANEL_ID} textarea {
      min-height: 32px;
      overflow-y: hidden; /* auto-grown to fit content in JS instead of scrolling internally */
    }
    #${PANEL_ID} .irtl-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    #${PANEL_ID} .irtl-row > *:first-child { flex: 1; }
    #${PANEL_ID} .irtl-grid3,
    #${PANEL_ID} .irtl-grid4 {
      display: grid;
      gap: 6px;
    }
    #${PANEL_ID} .irtl-grid3 { grid-template-columns: repeat(3, 1fr); }
    #${PANEL_ID} .irtl-grid4 { grid-template-columns: repeat(4, 1fr); }
    #${PANEL_ID} .irtl-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    #${PANEL_ID} .irtl-subl {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .02em;
      color: var(--irtl-muted);
    }
    #${PANEL_ID} .irtl-grid3 input,
    #${PANEL_ID} .irtl-grid4 input {
      width: 100%;
      min-width: 0;
      font-size: 11px;
      padding: 5px 4px;
    }
    #${PANEL_ID} .irtl-note {
      font-size: 11px;
      color: var(--irtl-muted);
      margin-top: 6px;
      line-height: 1.4;
    }
    #${PANEL_ID} button.irtl-copy {
      background: #1877f2;
      color: #fff !important;
      border: none;
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
    }
    #${PANEL_ID} button.irtl-convert-btn,
    #${PANEL_ID} button.irtl-anylist-btn {
      display: block;
      width: 100%;
      margin-top: 8px;
      border-radius: 6px;
      padding: 8px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    #${PANEL_ID} button.irtl-convert-btn {
      background: var(--irtl-bg) !important;
      border: 1px solid var(--irtl-border);
    }
    #${PANEL_ID} button.irtl-anylist-btn {
      background: #2e7d32 !important;
      color: #fff !important;
      border: none;
      font-weight: 600;
    }
    #${PANEL_ID} button.irtl-close {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
    }
    #${PANEL_ID} details {
      margin-top: 12px;
      border-top: 1px solid var(--irtl-border);
      padding-top: 8px;
    }
    #${PANEL_ID} summary {
      cursor: pointer;
      font-weight: 600;
    }
    #${PANEL_ID} button.irtl-reparse-btn,
    #${PANEL_ID} button.irtl-copyall-btn {
      display: block;
      width: 100%;
      margin-top: 8px;
      background: none;
      border: 1px solid var(--irtl-border);
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
    }
  `);

  // ---------- clipboard ----------

  function copyText(text, btn) {
    const ok = () => {
      if (!btn) return;
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1000);
    };
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(text, 'text');
      ok();
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(() => {});
    }
  }

  // ---------- caption extraction ----------

  function clickMoreIfPresent(article) {
    const candidates = article.querySelectorAll('[role="button"], button, span');
    for (const el of candidates) {
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'more' || t === '... more' || t === '…more') {
        el.click();
        return true;
      }
    }
    return false;
  }

  function extractFromDom() {
    const articles = document.querySelectorAll('article');
    log('[IRTL] article count:', articles.length);
    const article = articles[0];
    if (!article) return '';

    clickMoreIfPresent(article);

    const nodes = Array.from(article.querySelectorAll('div[dir="auto"], span[dir="auto"], li[dir="auto"]'));
    log('[IRTL] dir=auto nodes inside article:', nodes.length);
    // Comments live in <ul>/<li> lists further down; caption is typically the
    // first sizeable dir="auto" block that isn't inside a <ul>.
    let best = '';
    for (const node of nodes) {
      if (node.closest('ul')) continue;
      const text = (node.textContent || '').trim();
      if (text.length > best.length) best = text;
    }
    log('[IRTL] extractFromDom best length:', best.length);
    return best;
  }

  // Last-resort source: some posters put the actual recipe in the top
  // comment instead of the caption. Comments live inside <ul>/<li> — which
  // extractFromDom() explicitly skips — so scan those directly. This is
  // best-effort: unlike the caption path, this DOM shape hasn't been
  // verified against a live page, so it may need adjusting.
  function extractFromComments() {
    const article = document.querySelectorAll('article')[0] || document.body;
    const items = Array.from(article.querySelectorAll('ul li[dir="auto"], ul span[dir="auto"]'));
    let best = '';
    for (const node of items) {
      const text = (node.textContent || '').trim();
      if (text.length > best.length) best = text;
    }
    log('[IRTL] extractFromComments best length:', best.length);
    return best;
  }

  function extractFromMeta() {
    const meta = document.querySelector('meta[property="og:description"]');
    log('[IRTL] og:description meta present:', !!meta, meta ? meta.getAttribute('content') : null);
    if (!meta) return '';
    const content = meta.getAttribute('content') || '';
    // Format: '<N> likes, <N> comments - <user> on <date>: "<caption>".'
    // Note the trailing period AFTER the closing quote — slicing between the
    // first and last quote characters is more robust than anchoring on end-
    // of-string, which breaks the moment Instagram appends that period.
    const firstQuote = content.indexOf('"');
    const lastQuote = content.lastIndexOf('"');
    if (firstQuote === -1 || lastQuote <= firstQuote) return '';
    return content.slice(firstQuote + 1, lastQuote);
  }

  function extractCaption() {
    const domCaption = extractFromDom();
    let caption;
    if (domCaption.length >= 20) {
      caption = domCaption;
    } else {
      const metaCaption = extractFromMeta();
      if (metaCaption.length >= 20) {
        caption = metaCaption;
      } else {
        log('[IRTL] both extraction strategies came back short; domCaption=', JSON.stringify(domCaption), 'metaCaption=', JSON.stringify(metaCaption));
        caption = domCaption || metaCaption || '';
      }
    }

    // If the caption itself doesn't yield any recognizable ingredients/steps,
    // some posters put the actual recipe in the top comment instead — try
    // that as a last resort, but only switch to it if it actually parses
    // into something the caption didn't.
    const parsedFromCaption = parseCaption(caption);
    if (parsedFromCaption.ingredients.length === 0 && parsedFromCaption.steps.length === 0) {
      const commentText = extractFromComments();
      if (commentText.length >= 20) {
        const parsedFromComment = parseCaption(commentText);
        if (parsedFromComment.ingredients.length > 0 || parsedFromComment.steps.length > 0) {
          log('[IRTL] caption had no recipe; using top comment instead');
          return commentText;
        }
      }
    }
    return caption;
  }

  // ---------- parsing ----------

  // Header lines vary a lot in the wild ("Ingredients:", "Ingredients (Makes 6
  // Servings)", "👨‍🍳Cooking Instructions") so match the keyword anywhere in a
  // short line rather than requiring the line to be exactly that word.
  const INGREDIENTS_HEADER_RE = /\bingredients?\b/i;
  const STEPS_HEADER_RE = /\b(instructions?|directions?|method|steps?|prep(aration)?)\b/i;
  const HEADER_MAX_LEN = 40;
  // "-"/"*" (plus a few decorative food emoji) mark ingredient lines; "•" and
  // similar dot/arrow/checkmark bullets mark brief directions — captions
  // that bundle several mini sub-recipes back to back (ingredients, then a
  // couple of "•" steps, then the next component's ingredients...) use this
  // distinction consistently even with no "Instructions" header at all.
  const BULLET_RE = /^\s*[-*🥕🧂🍳]+\s*/;
  const STEP_BULLET_RE = /^\s*[•▪◦‣➡️✅✔️☑️]+\s*/;
  // (?!\d) keeps this from eating decimal quantities like "2.5 Tsp Salt" —
  // a real list marker is followed by whitespace/end, not another digit.
  const NUMBERED_RE = /^\s*\(?\d+[.)](?!\d)\s*/;
  const STEP_WORD_RE = /^\s*step\s*\d+\s*[:.\-]?\s*/i;
  // Requires a real unit word, not just a leading digit — otherwise numbered
  // steps ("1. Trim excess fat...") and macro lines ("637 Calories | ...")
  // both look like quantities.
  const QUANTITY_RE = /^\s*[\d½¼¾⅓⅔]+([\/.]\d+)?\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|g|grams?|kg|ml|l|liters?|lb|pounds?|cloves?|pinch(es)?|slices?|cans?|packs?|bunch(es)?)\b/i;
  const HASHTAG_DENSITY_RE = /#\S+/g;
  // A short colon-terminated line ("Honey BBQ Chicken:") inside an
  // ingredients block that isn't itself an ingredient/step line — a
  // sub-recipe group label, not an ingredient.
  const GROUP_LABEL_RE = /:\s*$/;

  function isHeaderLine(line, re) {
    return line.length <= HEADER_MAX_LEN && re.test(line);
  }

  // Strips decorative emoji from imported text (title/ingredients/steps) so
  // it reads cleanly once it's in AnyList — but not from the raw-caption
  // fallback, which stays verbatim on purpose. \p{Extended_Pictographic}
  // catches the emoji itself; the rest of the class mops up regional-
  // indicator flag halves, skin-tone modifiers, ZWJ and the variation
  // selector that are left orphaned once the base glyph is gone.
  const EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}]|\p{Extended_Pictographic}/gu;
  function cleanLine(line) {
    return line.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
  }

  function isGroupLabelLine(line) {
    return line.length <= HEADER_MAX_LEN && GROUP_LABEL_RE.test(line)
      && !BULLET_RE.test(line) && !STEP_BULLET_RE.test(line) && !QUANTITY_RE.test(line) && !NUMBERED_RE.test(line);
  }

  function stripMarker(line) {
    return line.replace(BULLET_RE, '').replace(STEP_BULLET_RE, '').replace(NUMBERED_RE, '').replace(STEP_WORD_RE, '').trim();
  }

  function isBoilerplate(line) {
    const l = line.trim();
    if (!l) return true;
    // Lines with no letters/digits at all — bare "." spacer lines before a
    // hashtag block, decorative emoji-only lines, etc.
    if (!/[a-zA-Z0-9]/.test(l)) return true;
    const tags = l.match(HASHTAG_DENSITY_RE) || [];
    const tagChars = tags.join('').length;
    if (tagChars > l.length * 0.5) return true;
    if (/follow (for|us)|link in bio|full recipe (in|on)|save (this|for later)/i.test(l)) return true;
    return false;
  }

  // ---------- servings / times / nutrition ----------
  // All optional — only populated when the caption actually states them, never
  // guessed, since these feed directly into the AnyList import data.

  const SERVINGS_PATTERNS = [
    /makes\s*(\d+)\s*servings?/i,
    /serves\s*:?\s*(\d+)/i,
    /(\d+)\s*servings?/i,
    /\(\s*(\d+)\s*total\s*\)/i,
    /yields?\s*:?\s*(\d+)/i,
  ];
  function extractServings(caption) {
    for (const re of SERVINGS_PATTERNS) {
      const m = caption.match(re);
      if (m) return m[1];
    }
    return null;
  }

  const PREP_TIME_RE = /prep(?:aration)?\s*time\s*:?\s*(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hrs?|hours?)/i;
  const COOK_TIME_RE = /cook(?:ing)?\s*time\s*:?\s*(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hrs?|hours?)/i;
  const TOTAL_TIME_RE = /total\s*time\s*:?\s*(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|hrs?|hours?)/i;

  function extractTimeMinutes(caption, re) {
    const m = caption.match(re);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return Math.round(/h/i.test(m[2]) ? n * 60 : n);
  }

  function extractNutrition(caption) {
    const cal = caption.match(/(\d+(?:\.\d+)?)\s*cal(?:ories)?\b/i);
    const protein = caption.match(/(\d+(?:\.\d+)?)\s*g?\s*protein/i);
    const carbs = caption.match(/(\d+(?:\.\d+)?)\s*g?\s*carb(?:ohydrate)?s?\b/i);
    const fat = caption.match(/(\d+(?:\.\d+)?)\s*g?\s*fat\b/i);
    if (!cal && !protein && !carbs && !fat) return null;
    return {
      calories: cal ? cal[1] : '',
      protein: protein ? protein[1] : '',
      carbs: carbs ? carbs[1] : '',
      fat: fat ? fat[1] : '',
    };
  }

  function parseCaption(caption) {
    const rawLines = caption.split('\n').map((l) => l.trim());
    const lines = rawLines.filter((l) => l.length > 0);

    const titleLineRaw = lines.find((l) => !isBoilerplate(l)) || '';
    const title = cleanLine(titleLineRaw).slice(0, 120);

    const ingredients = [];
    const steps = [];

    let section = null; // 'ingredients' | 'steps' | null
    // Some captions bundle several mini sub-recipes back to back — a group
    // label ("Honey BBQ Chicken:"), its ingredients, a couple of "•" steps,
    // then the next group label — with no top-level "Instructions" header
    // anywhere. Carry the most recent group label so it gets echoed once
    // into the steps list too, ahead of that group's own steps.
    let pendingGroupLabel = null;
    let groupLabelUsedForSteps = true;
    for (const line of lines) {
      if (isHeaderLine(line, INGREDIENTS_HEADER_RE)) { section = 'ingredients'; continue; }
      if (isHeaderLine(line, STEPS_HEADER_RE)) { section = 'steps'; continue; }
      if (isBoilerplate(line)) continue;

      // "•"-style bullets mean "this is a direction" regardless of which
      // section header we last saw — a caption can be inside an
      // "Ingredients" block and still be giving a couple of quick steps for
      // that sub-component.
      if (STEP_BULLET_RE.test(line)) {
        if (pendingGroupLabel && !groupLabelUsedForSteps) {
          steps.push(pendingGroupLabel);
          groupLabelUsedForSteps = true;
        }
        steps.push(cleanLine(stripMarker(line)));
        continue;
      }

      if (section === 'ingredients' && isGroupLabelLine(line)) {
        pendingGroupLabel = cleanLine(line.replace(GROUP_LABEL_RE, ''));
        groupLabelUsedForSteps = false;
        ingredients.push(cleanLine(line));
        continue;
      }

      if (section === 'ingredients') {
        ingredients.push(cleanLine(stripMarker(line)));
      } else if (section === 'steps') {
        steps.push(cleanLine(stripMarker(line)));
      }
    }

    // No explicit headers found anywhere — fall back to per-line heuristics.
    // Numbered/step markers are checked first: a bare leading digit ("1. Trim...")
    // also satisfies QUANTITY_RE, so step lines must win that race or they get
    // misfiled as ingredients.
    if (ingredients.length === 0 && steps.length === 0) {
      for (const line of lines) {
        if (isBoilerplate(line)) continue;
        if (line === titleLineRaw) continue;
        if (NUMBERED_RE.test(line) || STEP_WORD_RE.test(line) || STEP_BULLET_RE.test(line)) {
          steps.push(cleanLine(stripMarker(line)));
        } else if (BULLET_RE.test(line) || QUANTITY_RE.test(line)) {
          ingredients.push(cleanLine(stripMarker(line)));
        }
      }
    }

    return {
      title,
      ingredients,
      steps,
      servings: extractServings(caption),
      prepTimeMinutes: extractTimeMinutes(caption, PREP_TIME_RE),
      cookTimeMinutes: extractTimeMinutes(caption, COOK_TIME_RE),
      totalTimeMinutes: extractTimeMinutes(caption, TOTAL_TIME_RE),
      nutrition: extractNutrition(caption),
    };
  }

  // ---------- unit conversion ----------

  const G_PER_OZ = 28.3495;
  const G_PER_LB = 453.592;
  const ML_PER_CUP = 236.588;
  const ML_PER_TBSP = 14.7868;
  const ML_PER_TSP = 4.92892;

  function roundNum(n, decimals) {
    return parseFloat(n.toFixed(decimals));
  }

  // "80-100g" -> convert each side of the range separately but only append
  // the unit once ("2.8-3.5 oz"), not per side ("2.8 oz-3.5 oz").
  function convertRangeAware(numStr, convertOne) {
    if (numStr.includes('-')) {
      const results = numStr.split('-').map((part) => convertOne(parseFloat(part)));
      const unit = results[results.length - 1].unit;
      return `${results.map((r) => r.value).join('-')} ${unit}`;
    }
    const r = convertOne(parseFloat(numStr));
    return `${r.value} ${r.unit}`;
  }

  const NUM = '(\\d+(?:\\.\\d+)?(?:-\\d+(?:\\.\\d+)?)?)';
  const METRIC_UNIT_RE = new RegExp(NUM + '\\s*(kilograms?|kg|grams?|g|milliliters?|millilitres?|ml|liters?|litres?|centimeters?|centimetres?|cm)\\b', 'gi');
  const IMPERIAL_UNIT_RE = new RegExp(NUM + '\\s*(ounces?|oz|pounds?|lbs?|cups?|tablespoons?|tbsp|teaspoons?|tsp|inches?|in)\\b', 'gi');
  // Oven temps are written tight against the number ("200C/390F"), unlike
  // other units — requiring no/near-no whitespace avoids false positives on
  // a bare "C"/"F" appearing elsewhere.
  const TEMP_C_RE = /(\d+(?:\.\d+)?)\s?°?C\b/g;
  const TEMP_F_RE = /(\d+(?:\.\d+)?)\s?°?F\b/g;
  // If a caption already gives both units side by side ("200C/390F"), skip
  // converting — otherwise the two values stack into a confusing near-dup
  // ("392°F/390F"). These check a short window right after/before the match.
  const ALREADY_HAS_F_RE = /^\s*\/?\s*\d+(?:\.\d+)?\s?°?F\b/;
  const ALREADY_HAS_C_RE = /\d+(?:\.\d+)?\s?°?C\s*\/?\s*$/;

  function gToImperial(g) {
    return g >= 454 ? { value: roundNum(g / G_PER_LB, 2), unit: 'lb' } : { value: roundNum(g / G_PER_OZ, 1), unit: 'oz' };
  }
  function kgToImperial(kg) { return { value: roundNum((kg * 1000) / G_PER_LB, 2), unit: 'lb' }; }
  function mlToImperial(ml) {
    if (ml >= 240) return { value: roundNum(ml / ML_PER_CUP, 2), unit: 'cup' };
    if (ml >= 15) return { value: roundNum(ml / ML_PER_TBSP, 1), unit: 'tbsp' };
    return { value: roundNum(ml / ML_PER_TSP, 1), unit: 'tsp' };
  }
  function literToImperial(l) { return { value: roundNum((l * 1000) / ML_PER_CUP, 2), unit: 'cups' }; }
  function cmToImperial(cm) { return { value: roundNum(cm / 2.54, 2), unit: 'in' }; }

  function ozToMetric(oz) { return { value: Math.round(oz * G_PER_OZ), unit: 'g' }; }
  function lbToMetric(lb) {
    const g = lb * G_PER_LB;
    return g >= 1000 ? { value: roundNum(g / 1000, 2), unit: 'kg' } : { value: Math.round(g), unit: 'g' };
  }
  function cupToMetric(cups) { return { value: Math.round(cups * ML_PER_CUP), unit: 'ml' }; }
  function tbspToMetric(tbsp) { return { value: Math.round(tbsp * ML_PER_TBSP), unit: 'ml' }; }
  function tspToMetric(tsp) { return { value: roundNum(tsp * ML_PER_TSP, 1), unit: 'ml' }; }
  function inToMetric(inch) { return { value: roundNum(inch * 2.54, 1), unit: 'cm' }; }

  function convertMetricToImperial(text) {
    let out = text.replace(METRIC_UNIT_RE, (match, numStr, unit) => {
      const u = unit.toLowerCase();
      if (u === 'kg' || u.startsWith('kilo')) return convertRangeAware(numStr, kgToImperial);
      if (u === 'g' || u.startsWith('gram')) return convertRangeAware(numStr, gToImperial);
      if (u === 'ml' || u.startsWith('millilit')) return convertRangeAware(numStr, mlToImperial);
      if (u.startsWith('lit')) return convertRangeAware(numStr, literToImperial);
      if (u === 'cm' || u.startsWith('centimet')) return convertRangeAware(numStr, cmToImperial);
      return match;
    });
    out = out.replace(TEMP_C_RE, (match, numStr, offset, string) => {
      const after = string.slice(offset + match.length, offset + match.length + 12);
      if (ALREADY_HAS_F_RE.test(after)) return match; // e.g. "200C/390F" — F already given, leave as-is
      return `${Math.round((parseFloat(numStr) * 9) / 5 + 32)}°F`;
    });
    return out;
  }

  function convertImperialToMetric(text) {
    let out = text.replace(IMPERIAL_UNIT_RE, (match, numStr, unit) => {
      const u = unit.toLowerCase();
      if (u === 'oz' || u.startsWith('ounce')) return convertRangeAware(numStr, ozToMetric);
      if (u === 'lb' || u === 'lbs' || u.startsWith('pound')) return convertRangeAware(numStr, lbToMetric);
      if (u.startsWith('cup')) return convertRangeAware(numStr, cupToMetric);
      if (u === 'tbsp' || u.startsWith('tablespoon')) return convertRangeAware(numStr, tbspToMetric);
      if (u === 'tsp' || u.startsWith('teaspoon')) return convertRangeAware(numStr, tspToMetric);
      if (u === 'in' || u.startsWith('inch')) return convertRangeAware(numStr, inToMetric);
      return match;
    });
    out = out.replace(TEMP_F_RE, (match, numStr, offset, string) => {
      const before = string.slice(Math.max(0, offset - 12), offset);
      if (ALREADY_HAS_C_RE.test(before)) return match; // C already given right before this F
      return `${Math.round(((parseFloat(numStr) - 32) * 5) / 9)}°C`;
    });
    return out;
  }

  function detectPredominantSystem(text) {
    const metricCount = (text.match(METRIC_UNIT_RE) || []).length + (text.match(TEMP_C_RE) || []).length;
    const imperialCount = (text.match(IMPERIAL_UNIT_RE) || []).length + (text.match(TEMP_F_RE) || []).length;
    return imperialCount > metricCount ? 'imperial' : 'metric';
  }

  // ---------- panel ----------

  function removePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
  }

  function buildPanel(caption) {
    removePanel();

    const parsed = parseCaption(caption);

    // Remember whichever unit system the user last converted to (localStorage,
    // not a GM API — those vary too much by manager) and apply it up front to
    // freshly-extracted ingredients/steps, so a standing imperial/metric
    // preference carries across reels instead of resetting every extraction.
    const detectedSystem = detectPredominantSystem(`${parsed.ingredients.join('\n')}\n${parsed.steps.join('\n')}`);
    let unitSystem = detectedSystem;
    let ingredientsText = parsed.ingredients.join('\n');
    let stepsText = parsed.steps.join('\n');
    let preferredSystem = null;
    try { preferredSystem = localStorage.getItem('irtl_pref_unit_system'); } catch (e) { /* ignore */ }
    if (preferredSystem && preferredSystem !== detectedSystem && (ingredientsText || stepsText)) {
      const preConvert = detectedSystem === 'metric' ? convertMetricToImperial : convertImperialToMetric;
      ingredientsText = preConvert(ingredientsText);
      stepsText = preConvert(stepsText);
      unitSystem = preferredSystem;
    }

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <h3>Recipe → AnyList <span class="irtl-h3-actions"><button class="irtl-clear" title="Clear all fields and remove any injected AnyList data">Clear</button><button class="irtl-close" title="Close">✕</button></span></h3>

      <label>Title</label>
      <div class="irtl-row">
        <input type="text" class="irtl-title" value="${escapeAttr(parsed.title)}">
        <button class="irtl-copy" data-target="title">Copy</button>
      </div>

      <label>Servings / Prep / Cook time</label>
      <div class="irtl-grid3">
        <div class="irtl-field"><span class="irtl-subl">Servings</span><input type="text" class="irtl-servings" value="${escapeAttr(parsed.servings || '')}"></div>
        <div class="irtl-field"><span class="irtl-subl">Prep (min)</span><input type="text" class="irtl-prep" value="${escapeAttr(parsed.prepTimeMinutes != null ? String(parsed.prepTimeMinutes) : '')}"></div>
        <div class="irtl-field"><span class="irtl-subl">Cook (min)</span><input type="text" class="irtl-cook" value="${escapeAttr(parsed.cookTimeMinutes != null ? String(parsed.cookTimeMinutes) : '')}"></div>
      </div>

      <label>Nutrition (per serving)</label>
      <div class="irtl-grid4">
        <div class="irtl-field"><span class="irtl-subl">Calories</span><input type="text" class="irtl-cal" value="${escapeAttr(parsed.nutrition ? parsed.nutrition.calories : '')}"></div>
        <div class="irtl-field"><span class="irtl-subl">Protein (g)</span><input type="text" class="irtl-protein" value="${escapeAttr(parsed.nutrition ? parsed.nutrition.protein : '')}"></div>
        <div class="irtl-field"><span class="irtl-subl">Carbs (g)</span><input type="text" class="irtl-carbs" value="${escapeAttr(parsed.nutrition ? parsed.nutrition.carbs : '')}"></div>
        <div class="irtl-field"><span class="irtl-subl">Fat (g)</span><input type="text" class="irtl-fat" value="${escapeAttr(parsed.nutrition ? parsed.nutrition.fat : '')}"></div>
      </div>

      <label>Ingredients</label>
      <div class="irtl-row">
        <textarea class="irtl-ingredients">${escapeHtml(ingredientsText)}</textarea>
        <button class="irtl-copy" data-target="ingredients">Copy</button>
      </div>

      <label>Preparation Steps</label>
      <div class="irtl-row">
        <textarea class="irtl-steps">${escapeHtml(stepsText)}</textarea>
        <button class="irtl-copy" data-target="steps">Copy</button>
      </div>

      <button class="irtl-convert-btn"></button>
      <button class="irtl-copyall-btn">Copy full recipe (one block)</button>
      <button class="irtl-anylist-btn">Prep this page for AnyList import</button>
      <div class="irtl-note">Chrome/Brave only (bonus) — AnyList's Safari extension fetches the URL server-side instead of reading this page live, so it can't see Instagram's logged-in content or this injected data. On Safari, use the Copy buttons above and paste into AnyList directly.</div>

      <details>
        <summary>Raw caption (fallback / edit manually)</summary>
        <textarea class="irtl-raw" style="min-height:120px;">${escapeHtml(caption)}</textarea>
        <button class="irtl-reparse-btn">Re-parse from raw caption above</button>
      </details>
    `;

    panel.querySelector('.irtl-close').addEventListener('click', removePanel);

    panel.querySelector('.irtl-clear').addEventListener('click', () => {
      ['.irtl-title', '.irtl-servings', '.irtl-prep', '.irtl-cook', '.irtl-cal', '.irtl-protein', '.irtl-carbs', '.irtl-fat'].forEach((sel) => {
        panel.querySelector(sel).value = '';
      });
      ['.irtl-ingredients', '.irtl-steps', '.irtl-raw'].forEach((sel) => {
        const el = panel.querySelector(sel);
        el.value = '';
        autoGrow(el);
      });
      // Also remove any schema.org data injected by a previous "Prep this
      // page for AnyList import" click — otherwise a stale recipe from an
      // earlier reel can still sit in the page and get picked up.
      removeRecipeMarkup();
    });

    function currentRecipeData() {
      const title = panel.querySelector('.irtl-title').value;
      const ingredientLines = panel.querySelector('.irtl-ingredients').value.split('\n').map((l) => l.trim()).filter(Boolean);
      const stepLines = panel.querySelector('.irtl-steps').value.split('\n').map((l) => l.trim()).filter(Boolean);
      const servings = panel.querySelector('.irtl-servings').value.trim();
      const prepMinutes = panel.querySelector('.irtl-prep').value.trim();
      const cookMinutes = panel.querySelector('.irtl-cook').value.trim();
      const nutrition = {
        calories: panel.querySelector('.irtl-cal').value.trim(),
        protein: panel.querySelector('.irtl-protein').value.trim(),
        carbs: panel.querySelector('.irtl-carbs').value.trim(),
        fat: panel.querySelector('.irtl-fat').value.trim(),
      };
      return { title, ingredientLines, stepLines, servings, prepMinutes, cookMinutes, nutrition };
    }

    // One combined block for pasting into anything that isn't AnyList's
    // separate ingredients/steps fields. Skips any section with nothing in
    // it rather than printing an empty heading.
    function buildFullRecipeText(data) {
      const parts = [data.title];

      const metaBits = [];
      if (data.servings) metaBits.push(`Servings: ${data.servings}`);
      if (data.prepMinutes) metaBits.push(`Prep: ${data.prepMinutes} min`);
      if (data.cookMinutes) metaBits.push(`Cook: ${data.cookMinutes} min`);
      if (metaBits.length) parts.push(metaBits.join(' | '));

      const n = data.nutrition || {};
      const nutritionBits = [];
      if (n.calories) nutritionBits.push(`Calories: ${n.calories}`);
      if (n.protein) nutritionBits.push(`Protein: ${n.protein}g`);
      if (n.carbs) nutritionBits.push(`Carbs: ${n.carbs}g`);
      if (n.fat) nutritionBits.push(`Fat: ${n.fat}g`);
      if (nutritionBits.length) parts.push(nutritionBits.join(' | '));

      if (data.ingredientLines.length) parts.push(`Ingredients:\n${data.ingredientLines.join('\n')}`);
      if (data.stepLines.length) parts.push(`Instructions:\n${data.stepLines.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);

      return parts.join('\n\n');
    }

    // "45" -> "PT45M", "90" -> "PT1H30M" (ISO 8601 duration, what schema.org
    // prepTime/cookTime/totalTime expect).
    function minutesToIsoDuration(minutesStr) {
      const n = parseFloat(minutesStr);
      if (!n || n <= 0) return null;
      const h = Math.floor(n / 60);
      const m = Math.round(n % 60);
      return `PT${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}`;
    }

    function recipeJsonLd({ title, ingredientLines, stepLines, servings, prepMinutes, cookMinutes, nutrition }) {
      const jsonLd = {
        '@context': 'https://schema.org/',
        '@type': 'Recipe',
        name: title,
        recipeIngredient: ingredientLines,
        recipeInstructions: stepLines.map((text) => ({ '@type': 'HowToStep', text })),
      };
      if (servings) jsonLd.recipeYield = servings;
      const prepIso = minutesToIsoDuration(prepMinutes);
      const cookIso = minutesToIsoDuration(cookMinutes);
      if (prepIso) jsonLd.prepTime = prepIso;
      if (cookIso) jsonLd.cookTime = cookIso;
      if (prepMinutes && cookMinutes) {
        const totalIso = minutesToIsoDuration(String(parseFloat(prepMinutes) + parseFloat(cookMinutes)));
        if (totalIso) jsonLd.totalTime = totalIso;
      }
      if (nutrition && (nutrition.calories || nutrition.protein || nutrition.carbs || nutrition.fat)) {
        const n = { '@type': 'NutritionInformation' };
        if (nutrition.calories) n.calories = `${nutrition.calories} calories`;
        if (nutrition.protein) n.proteinContent = `${nutrition.protein} g`;
        if (nutrition.carbs) n.carbohydrateContent = `${nutrition.carbs} g`;
        if (nutrition.fat) n.fatContent = `${nutrition.fat} g`;
        jsonLd.nutrition = n;
      }
      return jsonLd;
    }

    // unitSystem/ingredientsText/stepsText were already established above
    // (pre-converted to the remembered preference, if any).
    const convertBtn = panel.querySelector('.irtl-convert-btn');
    function updateConvertLabel() {
      convertBtn.textContent = unitSystem === 'metric' ? 'Convert to Imperial' : 'Convert to Metric';
    }
    updateConvertLabel();
    convertBtn.addEventListener('click', () => {
      const ingredientsEl = panel.querySelector('.irtl-ingredients');
      const stepsEl = panel.querySelector('.irtl-steps');
      const convert = unitSystem === 'metric' ? convertMetricToImperial : convertImperialToMetric;
      ingredientsEl.value = convert(ingredientsEl.value);
      stepsEl.value = convert(stepsEl.value);
      unitSystem = unitSystem === 'metric' ? 'imperial' : 'metric';
      try { localStorage.setItem('irtl_pref_unit_system', unitSystem); } catch (e) { /* ignore */ }
      updateConvertLabel();
      autoGrow(ingredientsEl);
      autoGrow(stepsEl);
    });

    panel.querySelector('.irtl-copyall-btn').addEventListener('click', (e) => {
      copyText(buildFullRecipeText(currentRecipeData()), e.currentTarget);
    });

    panel.querySelector('.irtl-reparse-btn').addEventListener('click', (e) => {
      const rawText = panel.querySelector('.irtl-raw').value;
      const reparsed = parseCaption(rawText);
      panel.querySelector('.irtl-title').value = reparsed.title;
      panel.querySelector('.irtl-servings').value = reparsed.servings || '';
      panel.querySelector('.irtl-prep').value = reparsed.prepTimeMinutes != null ? String(reparsed.prepTimeMinutes) : '';
      panel.querySelector('.irtl-cook').value = reparsed.cookTimeMinutes != null ? String(reparsed.cookTimeMinutes) : '';
      panel.querySelector('.irtl-cal').value = reparsed.nutrition ? reparsed.nutrition.calories : '';
      panel.querySelector('.irtl-protein').value = reparsed.nutrition ? reparsed.nutrition.protein : '';
      panel.querySelector('.irtl-carbs').value = reparsed.nutrition ? reparsed.nutrition.carbs : '';
      panel.querySelector('.irtl-fat').value = reparsed.nutrition ? reparsed.nutrition.fat : '';
      const ingredientsEl2 = panel.querySelector('.irtl-ingredients');
      const stepsEl2 = panel.querySelector('.irtl-steps');
      ingredientsEl2.value = reparsed.ingredients.join('\n');
      stepsEl2.value = reparsed.steps.join('\n');
      autoGrow(ingredientsEl2);
      autoGrow(stepsEl2);
      unitSystem = detectPredominantSystem(`${reparsed.ingredients.join('\n')}\n${reparsed.steps.join('\n')}`);
      updateConvertLabel();
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.textContent = 'Re-parsed!';
      setTimeout(() => { btn.textContent = original; }, 1000);
    });

    panel.querySelector('.irtl-anylist-btn').addEventListener('click', (e) => {
      log('[IRTL] anylist-btn clicked');
      try {
        const data = currentRecipeData();
        log('[IRTL] currentRecipeData:', data);
        const jsonLd = recipeJsonLd(data);
        log('[IRTL] jsonLd:', jsonLd);
        // A blob:/data: URL page isn't fetchable by anylist.com's server side,
        // so it gets rejected even when the extension successfully captures
        // its HTML. Instead, embed the markup directly into the live
        // Instagram page (a real https:// URL) and let the user click the
        // real AnyList icon right here — it captures whatever's on the
        // current tab, hidden elements included.
        injectRecipeMarkup(data, jsonLd);
        log('[IRTL] injectRecipeMarkup done; ld-json element:', document.getElementById(LD_JSON_ID));
      } catch (err) {
        console.error('[IRTL] anylist-btn handler failed:', err);
      }
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.textContent = 'Ready — click the AnyList icon now';
      setTimeout(() => { btn.textContent = original; }, 4000);
    });

    panel.querySelectorAll('.irtl-copy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        let text = '';
        if (target === 'title') text = panel.querySelector('.irtl-title').value;
        if (target === 'ingredients') text = panel.querySelector('.irtl-ingredients').value;
        if (target === 'steps') text = panel.querySelector('.irtl-steps').value;
        copyText(text, btn);
      });
    });

    document.body.appendChild(panel);

    // Grow each textarea to fit its content instead of scrolling internally
    // (the outer panel itself scrolls once the whole thing exceeds max-height).
    function autoGrow(el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
    const growers = panel.querySelectorAll('.irtl-ingredients, .irtl-steps, .irtl-raw');
    growers.forEach((el) => {
      autoGrow(el);
      el.addEventListener('input', () => autoGrow(el));
    });
    // The raw-caption textarea is inside a collapsed <details> so it has zero
    // height at build time — (re)size it once the section is actually opened.
    const rawDetails = panel.querySelector('details');
    if (rawDetails) {
      rawDetails.addEventListener('toggle', () => {
        if (rawDetails.open) autoGrow(panel.querySelector('.irtl-raw'));
      });
    }
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  const LD_JSON_ID = 'irtl-ld-json';
  const MICRODATA_ID = 'irtl-microdata';

  // Embeds the recipe as schema.org JSON-LD + microdata directly into the
  // current (real https://) page, rather than opening a blob:/data: URL tab
  // that anylist.com's import backend can't fetch. AnyList's extension just
  // captures document.documentElement.outerHTML of whatever tab is active
  // when its icon is clicked — hidden elements are included in that capture,
  // so display:none doesn't visually disturb the Instagram page.
  function injectRecipeMarkup(data, jsonLd) {
    let ldScript = document.getElementById(LD_JSON_ID);
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.id = LD_JSON_ID;
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(jsonLd, null, 2);

    let microdata = document.getElementById(MICRODATA_ID);
    if (!microdata) {
      microdata = document.createElement('div');
      microdata.id = MICRODATA_ID;
      microdata.style.display = 'none';
      document.body.appendChild(microdata);
    }
    microdata.setAttribute('itemscope', '');
    microdata.setAttribute('itemtype', 'https://schema.org/Recipe');
    const n = data.nutrition || {};
    microdata.innerHTML = `
      <span itemprop="name">${escapeHtml(data.title)}</span>
      ${data.servings ? `<span itemprop="recipeYield">${escapeHtml(data.servings)}</span>` : ''}
      ${jsonLd.prepTime ? `<time itemprop="prepTime" datetime="${jsonLd.prepTime}">${escapeHtml(data.prepMinutes)} min</time>` : ''}
      ${jsonLd.cookTime ? `<time itemprop="cookTime" datetime="${jsonLd.cookTime}">${escapeHtml(data.cookMinutes)} min</time>` : ''}
      <ul>${data.ingredientLines.map((i) => `<li itemprop="recipeIngredient">${escapeHtml(i)}</li>`).join('')}</ul>
      <ol>${data.stepLines.map((s) => `<li itemprop="recipeInstructions">${escapeHtml(s)}</li>`).join('')}</ol>
      ${jsonLd.nutrition ? `<div itemprop="nutrition" itemscope itemtype="https://schema.org/NutritionInformation">
        ${n.calories ? `<span itemprop="calories">${escapeHtml(n.calories)} calories</span>` : ''}
        ${n.protein ? `<span itemprop="proteinContent">${escapeHtml(n.protein)} g</span>` : ''}
        ${n.carbs ? `<span itemprop="carbohydrateContent">${escapeHtml(n.carbs)} g</span>` : ''}
        ${n.fat ? `<span itemprop="fatContent">${escapeHtml(n.fat)} g</span>` : ''}
      </div>` : ''}
    `;
  }

  function removeRecipeMarkup() {
    const a = document.getElementById(LD_JSON_ID);
    if (a) a.remove();
    const b = document.getElementById(MICRODATA_ID);
    if (b) b.remove();
  }

  // ---------- trigger button ----------

  function injectTriggerButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.textContent = '🍳 Extract Recipe';
    btn.addEventListener('click', () => {
      const caption = extractCaption();
      buildPanel(caption);
    });
    document.body.appendChild(btn);
  }

  function removeTriggerButton() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.remove();
  }

  // ---------- SPA navigation watcher ----------

  let lastPath = '';
  function onNavigate() {
    const path = location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    removePanel();
    removeTriggerButton();
    removeRecipeMarkup();
    if (POST_PATH_RE.test(path)) {
      injectTriggerButton();
    }
  }

  setInterval(onNavigate, 500);
  onNavigate();

  log('[IRTL] init complete');

  } catch (err) {
    console.error('[IRTL] init failed:', err);
  }
})();
