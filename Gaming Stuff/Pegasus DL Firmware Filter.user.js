// ==UserScript==
// @name        Pegasus DL Firmware Filter
// @namespace   klept0
// @description Adds a console firmware picker and firmware sort to the Pegasus DL (github.com/pegasus-ps5/pegasus-dl) store, and shows each package's minimum firmware on its card.
// @include     /^https?:\/\/[^/]+:6970\/.*$/
// @version     1.0.0
// @grant       none
// @inject-into page
// @run-at      document-idle
// @homepageURL https://github.com/klept0/Useful_Userscripts
// @downloadURL https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Gaming%20Stuff/Pegasus%20DL%20Firmware%20Filter.user.js
// @updateURL   https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Gaming%20Stuff/Pegasus%20DL%20Firmware%20Filter.user.js
// ==/UserScript==

/* global state, renderLibraryResults, renderPackageDetail, resetLibraryVisibleCount */
(function () {
  'use strict';

  // Pegasus DL keeps its store state and render functions as page globals.
  // Bail out quietly on any other page served from port 6970.
  if (typeof state === 'undefined' || typeof window.filteredPackages !== 'function') return;

  const STORAGE_KEY = 'pegasusFwFilter';
  const MAX_FW = 13;
  // The user picks the major firmware their console is on; packages whose
  // minimum firmware is at or below it should work. Options are grouped by
  // the ranges the scene uses for public jailbreaks (UMTX up to 5.50,
  // Y2JB + Lapse up to 10.01, Y2JB + P2JB up to 12.70, Relapse up to 13.60).
  const FW_RANGES = [
    { min: 1, max: 5, label: '1.xx–5.xx (UMTX)' },
    { min: 6, max: 10, label: '6.xx–10.xx (Lapse)' },
    { min: 11, max: 12, label: '11.xx–12.xx (P2JB)' },
    { min: 13, max: 13, label: '13.xx (Relapse)' }
  ];
  const UNKNOWN = Infinity;

  const prefs = loadPrefs();
  const fwCache = new WeakMap();

  // Catalogs have no firmware field, so the minimum firmware is read from the
  // description and link names. Seen formats:
  //   DLPS:  "Works on 6.xx and higher", "Works on 13.60 and higher", "EUR 6.xx Base"
  //   PFS:   "Firmware: 10.xx+, 11.xx+, 12.xx+"
  //   Pippo: "Base FPKG & Dump are 12.xx, separated BackPort for 4.xx+ included"
  //   ZER0:  "Firmware: 4.xx BackPort"
  // The lowest firmware mentioned is the lowest any offered build runs on.
  // "FPKG ... up to 11.60" is an upper bound, so it is removed first.
  function minFirmware(pkg) {
    if (fwCache.has(pkg)) return fwCache.get(pkg);
    const links = (pkg.downloadLinks || []).map((link) => link.name || '').join('\n');
    const text = `${pkg.description || ''}\n${links}`.replace(/up to \d{1,2}\.\d+/gi, '');
    const found = [];
    const patterns = [
      /(?<![\d.])(\d{1,2})\.xx/gi,
      /(?:works on|firmware:?)\s*(\d{1,2})\.\d{2}\b/gi,
      /\b(?:USA|EUR|JPN|JP|ASIA)\s+(\d{1,2})\.\d{2}\b/g
    ];
    patterns.forEach((pattern) => {
      for (const match of text.matchAll(pattern)) {
        const major = Number(match[1]);
        if (major >= 1 && major <= MAX_FW) found.push(major);
      }
    });
    const fw = found.length ? Math.min(...found) : UNKNOWN;
    fwCache.set(pkg, fw);
    return fw;
  }

  // filteredPackages() is the single source for the result list, count label
  // and "load more" paging, so filtering and sorting here covers all of them.
  // The renderer compares array identity, so the same array is returned until
  // the underlying list or the firmware settings change.
  const originalFilteredPackages = window.filteredPackages;
  let cached = null;
  window.filteredPackages = function () {
    const base = originalFilteredPackages.apply(this, arguments);
    if (!prefs.maxFw && !prefs.sort) return base;
    if (cached && cached.base === base && cached.maxFw === prefs.maxFw && cached.sort === prefs.sort) {
      return cached.packages;
    }
    let packages = prefs.maxFw ? base.filter((pkg) => minFirmware(pkg) <= prefs.maxFw) : base.slice();
    if (prefs.sort) {
      const direction = prefs.sort === 'asc' ? 1 : -1;
      // Unknown firmware always sorts last; Array.prototype.sort is stable, so
      // the catalog order is kept within each firmware.
      packages = packages.sort((left, right) => {
        const a = minFirmware(left);
        const b = minFirmware(right);
        if (a === b) return 0;
        if (a === UNKNOWN) return 1;
        if (b === UNKNOWN) return -1;
        return (a - b) * direction;
      });
    }
    cached = { base, maxFw: prefs.maxFw, sort: prefs.sort, packages };
    return packages;
  };

  const originalPackageCards = window.packageCards;
  window.packageCards = function (packages) {
    const cards = originalPackageCards.apply(this, arguments);
    return cards.map((html, index) => {
      const fw = minFirmware(packages[index]);
      if (fw === UNKNOWN) return html;
      // The title ID line has spare width; the source line truncates.
      return html.replace(
        /(<div class="package-card-id mono">[^<]*)<\/div>/,
        `$1<span class="pegasus-fw-badge">FW ${fw}.xx+</span></div>`
      );
    });
  };

  const originalRenderLibraryPanel = window.renderLibraryPanel;
  window.renderLibraryPanel = function () {
    const result = originalRenderLibraryPanel.apply(this, arguments);
    injectControls();
    return result;
  };

  function injectControls() {
    const actions = document.querySelector('#homeLibrary .library-toolbar-actions');
    if (!actions || actions.querySelector('.pegasus-fw-controls')) return;
    const fwOptions = [
      '<option value="0">Any FW</option>',
      ...FW_RANGES.map((range) => {
        const options = [];
        for (let fw = range.min; fw <= range.max; fw += 1) {
          options.push(`<option value="${fw}">I'm on ${fw}.xx</option>`);
        }
        return `<optgroup label="${range.label}">${options.join('')}</optgroup>`;
      })
    ];
    const wrap = document.createElement('div');
    wrap.className = 'pegasus-fw-controls';
    wrap.innerHTML = `
      <select class="pegasus-fw-select" data-fw="maxFw" aria-label="Your console firmware: show packages that should work on it" title="Your console firmware: show packages that should work on it">${fwOptions.join('')}</select>
      <select class="pegasus-fw-select" data-fw="sort" aria-label="Sort packages by firmware" title="Sort packages by firmware">
        <option value="">Default order</option>
        <option value="asc">FW low to high</option>
        <option value="desc">FW high to low</option>
      </select>
    `;
    wrap.querySelector('[data-fw="maxFw"]').value = String(prefs.maxFw);
    wrap.querySelector('[data-fw="sort"]').value = prefs.sort;
    wrap.addEventListener('change', (event) => {
      const select = event.target.closest('[data-fw]');
      if (!select) return;
      prefs[select.dataset.fw] = select.dataset.fw === 'maxFw' ? Number(select.value) : select.value;
      savePrefs();
      rerender();
    });
    actions.prepend(wrap);
  }

  function rerender() {
    resetLibraryVisibleCount();
    const library = document.querySelector('#homeLibrary');
    if (library) library.scrollTop = 0;
    renderLibraryResults('homeLibrary', true);
    renderPackageDetail('homeDetail');
  }

  function loadPrefs() {
    const defaults = { maxFw: 0, sort: '' };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const maxFw = Number(saved.maxFw);
      return {
        maxFw: Number.isInteger(maxFw) && maxFw >= 0 && maxFw <= MAX_FW ? maxFw : defaults.maxFw,
        sort: saved.sort === 'asc' || saved.sort === 'desc' ? saved.sort : defaults.sort
      };
    } catch (error) {
      return defaults;
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      // Storage unavailable (private window): settings last for this page only.
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .pegasus-fw-controls { display: flex; gap: 8px; align-items: center; }
    .pegasus-fw-select {
      appearance: none;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      min-height: 30px;
      padding: 4px 12px;
    }
    .pegasus-fw-select:hover, .pegasus-fw-select:focus-visible { border-color: var(--primary-container); }
    .pegasus-fw-badge {
      border: 1px solid var(--primary-container);
      border-radius: 999px;
      color: var(--primary);
      font-family: inherit;
      font-size: 11px;
      margin-left: 6px;
      padding: 0 6px;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);

  // The store may already be rendered by the time this runs.
  injectControls();
  if (prefs.maxFw || prefs.sort) rerender();
})();
