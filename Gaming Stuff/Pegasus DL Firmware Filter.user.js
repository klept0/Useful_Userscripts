// ==UserScript==
// @name        Pegasus DL Firmware Filter
// @namespace   klept0
// @description Adds a console firmware picker and firmware sort to the Pegasus DL (github.com/pegasus-ps5/pegasus-dl) store and to pegasus-catalog.fly.dev, shows each package's minimum firmware on its card, and adds a "Send to PS5" button on the catalog site that opens the package in your PS5's Pegasus DL.
// @include     /^https?:\/\/[^/]+:6970\/.*$/
// @match       https://pegasus-catalog.fly.dev/*
// @version     1.2.0
// @grant       none
// @inject-into page
// @run-at      document-start
// @homepageURL https://github.com/klept0/Useful_Userscripts
// @downloadURL https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Gaming%20Stuff/Pegasus%20DL%20Firmware%20Filter.user.js
// @updateURL   https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Gaming%20Stuff/Pegasus%20DL%20Firmware%20Filter.user.js
// ==/UserScript==

/* global state, renderLibraryResults, renderPackageDetail, resetLibraryVisibleCount */
(function () {
  'use strict';

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
  // The catalog site's "Send to PS5" button opens Pegasus DL with this hash.
  const OPEN_HASH = '#pegasus-open=';

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

  function prefsActive() {
    return !!(prefs.maxFw || prefs.sort);
  }

  // Unknown firmware always sorts last; Array.prototype.sort is stable, so the
  // catalog order is kept within each firmware.
  function applyPrefs(packages) {
    let result = prefs.maxFw ? packages.filter((pkg) => minFirmware(pkg) <= prefs.maxFw) : packages.slice();
    if (prefs.sort) {
      const direction = prefs.sort === 'asc' ? 1 : -1;
      result = result.sort((left, right) => {
        const a = minFirmware(left);
        const b = minFirmware(right);
        if (a === b) return 0;
        if (a === UNKNOWN) return 1;
        if (b === UNKNOWN) return -1;
        return (a - b) * direction;
      });
    }
    return result;
  }

  function badgeText(pkg) {
    const fw = minFirmware(pkg);
    return fw === UNKNOWN ? '' : `FW ${fw}.xx+`;
  }

  function createControls(onChange) {
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
      onChange();
    });
    return wrap;
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

  function addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Pegasus DL web UI on the PS5 (port 6970)
  // ---------------------------------------------------------------------------

  function initPegasusDl() {
    // Pegasus DL keeps its store state and render functions as page globals.
    // Bail out quietly on any other page served from port 6970.
    if (typeof state === 'undefined' || typeof window.filteredPackages !== 'function') return;

    // filteredPackages() is the single source for the result list, count label
    // and "load more" paging, so filtering and sorting here covers all of them.
    // The renderer compares array identity, so the same array is returned until
    // the underlying list or the firmware settings change.
    const originalFilteredPackages = window.filteredPackages;
    let cached = null;
    window.filteredPackages = function () {
      const base = originalFilteredPackages.apply(this, arguments);
      if (!prefsActive()) return base;
      if (cached && cached.base === base && cached.maxFw === prefs.maxFw && cached.sort === prefs.sort) {
        return cached.packages;
      }
      cached = { base, maxFw: prefs.maxFw, sort: prefs.sort, packages: applyPrefs(base) };
      return cached.packages;
    };

    const originalPackageCards = window.packageCards;
    window.packageCards = function (packages) {
      const cards = originalPackageCards.apply(this, arguments);
      return cards.map((html, index) => {
        const text = badgeText(packages[index]);
        if (!text) return html;
        // The title ID line has spare width; the source line truncates.
        return html.replace(
          /(<div class="package-card-id mono">[^<]*)<\/div>/,
          `$1<span class="pegasus-fw-badge">${text}</span></div>`
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
      actions.prepend(createControls(rerender));
    }

    function rerender() {
      resetLibraryVisibleCount();
      const library = document.querySelector('#homeLibrary');
      if (library) library.scrollTop = 0;
      renderLibraryResults('homeLibrary', true);
      renderPackageDetail('homeDetail');
    }

    addStyle(`
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
    `);

    // Opens a package sent from the catalog site: shows it in the Store tab
    // with its download links, so the normal Pegasus DL download flow
    // (provider resolving, debrid, PS5 browser capture) runs from here.
    async function openFromHash() {
      if (!location.hash.startsWith(OPEN_HASH)) return;
      let request;
      try {
        request = JSON.parse(decodeURIComponent(location.hash.slice(OPEN_HASH.length)));
      } catch (error) {
        return;
      }
      history.replaceState(null, '', location.pathname + location.search);
      if (!request || typeof request !== 'object') return;
      const deadline = Date.now() + 30000;
      while ((state.libraryLoading || !state.packages.length) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const title = String(request.title || '');
      const titleId = String(request.titleId || '');
      const source = state.sources.find((item) => item.url === request.catalog);
      const candidates = source
        ? state.packages.filter((pkg) => Number(pkg.sourceId) === Number(source.id))
        : state.packages;
      const pkg = candidates.find((item) => item.titleId === titleId && item.title === title) ||
        candidates.find((item) => titleId && item.titleId === titleId) ||
        candidates.find((item) => item.title === title);
      if (!pkg) {
        setMessage(source
          ? `${title || 'Package'} is not in ${source.name} yet. Refresh the source and try again.`
          : `${title || 'Package'} was not found. Add its catalog as a source first.`);
        return;
      }
      switchView('store');
      state.search = pkg.titleId || pkg.title || '';
      state.librarySearchQuery = state.search.trim().toLowerCase();
      state.sourceFilter = Number(pkg.sourceId);
      state.selectedPackageId = pkg.id;
      state.detailExpanded = true;
      resetLibraryVisibleCount();
      renderLibraryPanel('homeLibrary', true);
      renderPackageDetail('homeDetail');
      setMessage(`Opened ${pkg.title}. Pick a download link.`);
    }
    window.addEventListener('hashchange', openFromHash);

    // The store may already be rendered by the time this runs.
    injectControls();
    if (prefsActive()) rerender();
    openFromHash();
  }

  // ---------------------------------------------------------------------------
  // pegasus-catalog.fly.dev
  // ---------------------------------------------------------------------------

  // The catalog site is a React app that pages packages from the server
  // (/api/catalogs/<slug>/packages?query=&page=N, 48 per page) into an
  // infinite list. While a firmware filter or sort is set, page requests are
  // answered from the full catalog (fetched once and cached briefly), filtered
  // and sorted, so the app's own paging, search and infinite scroll keep
  // working over the whole catalog.
  function initCatalogSite() {
    const PAGE_PATH = /^\/api\/catalogs\/([^/]+)\/packages$/;
    const FULL_LIST_TTL_MS = 60000;
    const FETCH_CONCURRENCY = 6;
    const PS5_HOST_KEY = 'pegasusFwPs5Host';
    const DEFAULT_PORT = 6970;
    const nativeFetch = window.fetch.bind(window);
    const fullLists = new Map();
    // Packages as last served for the current catalog and search, by page,
    // used to put badges on the rendered cards in the same order.
    let view = { key: '', slug: '', pages: [], total: 0 };
    // The package last clicked in the grid, for the detail pane's Send button.
    let selected = null;

    window.fetch = function (input, init) {
      const method = (init && init.method) || (input instanceof Request ? input.method : 'GET');
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
      const match = url.origin === location.origin && method.toUpperCase() === 'GET' && PAGE_PATH.exec(url.pathname);
      if (!match) return nativeFetch(input, init);
      // Any failure falls back to the site's normal request.
      return servePage(decodeURIComponent(match[1]), url).catch(() => nativeFetch(input, init));
    };

    async function servePage(slug, url) {
      const query = url.searchParams.get('query') || '';
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      if (!prefsActive()) {
        const response = await nativeFetch(url.href);
        if (response.ok) {
          const data = await response.clone().json();
          record(slug, query, page, data.packages || [], data.total);
        }
        return response;
      }
      const all = await fullList(slug, query);
      const packages = applyPrefs(all.packages);
      const start = (page - 1) * all.pageSize;
      const slice = packages.slice(start, start + all.pageSize);
      record(slug, query, page, slice, packages.length);
      const body = { total: packages.length, page, pageSize: all.pageSize, packages: slice };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    function fullList(slug, query) {
      const key = `${slug}\n${query}`;
      const entry = fullLists.get(key);
      if (entry && Date.now() - entry.at < FULL_LIST_TTL_MS) return entry.promise;
      const promise = loadFullList(slug, query);
      fullLists.set(key, { at: Date.now(), promise });
      promise.catch(() => fullLists.delete(key));
      return promise;
    }

    async function loadFullList(slug, query) {
      const fetchPage = async (page) => {
        const url = `/api/catalogs/${encodeURIComponent(slug)}/packages?query=${encodeURIComponent(query)}&page=${page}`;
        const response = await nativeFetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      };
      const first = await fetchPage(1);
      const pageSize = first.pageSize || first.packages.length || 48;
      const pageCount = Math.ceil((first.total || 0) / pageSize);
      const pages = [first.packages];
      let next = 2;
      const worker = async () => {
        while (next <= pageCount) {
          const page = next++;
          pages[page - 1] = (await fetchPage(page)).packages;
        }
      };
      await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));
      return { pageSize, packages: pages.flat() };
    }

    function record(slug, query, page, packages, total) {
      const key = `${slug}\n${query}\n${prefs.maxFw}\n${prefs.sort}`;
      if (view.key !== key) view = { key, slug, pages: [], total: 0 };
      view.pages[page - 1] = packages;
      view.total = Number(total) || 0;
      scheduleSync();
    }

    function refetch() {
      view = { key: '', slug: view.slug, pages: [], total: 0 };
      // The app uses TanStack Query with its default refetch-on-focus, so a
      // visibilitychange makes it reload the visible list through the hook above.
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('visibilitychange'));
      const grid = document.querySelector('.package-grid');
      if (grid && grid.parentElement) grid.parentElement.scrollTop = 0;
    }

    let syncQueued = false;
    function scheduleSync() {
      if (syncQueued) return;
      syncQueued = true;
      requestAnimationFrame(() => {
        syncQueued = false;
        sync();
      });
    }

    // Re-applies controls, count and badges after React renders. Only writes
    // when something differs, so its own changes do not loop.
    function sync() {
      // Own full-width row at the end of the header, so the Copy Source URL
      // button keeps its place at narrow widths.
      const header = document.querySelector('.catalog-header');
      if (header && !header.querySelector('.pegasus-fw-controls')) {
        const controls = createControls(refetch);
        controls.insertAdjacentHTML('beforeend', `
          <span class="pegasus-fw-count" role="status"></span>
          <input class="pegasus-fw-ps5" type="text" inputmode="url" spellcheck="false" autocomplete="off"
            placeholder="PS5 IP for Send to PS5" aria-label="PS5 IP address for Send to PS5" title="PS5 IP address (port ${DEFAULT_PORT} is assumed)">
        `);
        const hostInput = controls.querySelector('.pegasus-fw-ps5');
        hostInput.value = loadPs5Host();
        hostInput.addEventListener('change', () => {
          hostInput.value = hostInput.value.trim();
          hostInput.toggleAttribute('aria-invalid', !!hostInput.value && !ps5Origin(hostInput.value));
          savePs5Host(hostInput.value);
        });
        header.appendChild(controls);
      }
      const count = document.querySelector('.pegasus-fw-count');
      if (count) {
        const text = prefsActive() && view.key ? `${view.total.toLocaleString()} match` : '';
        if (count.textContent !== text) count.textContent = text;
      }
      const served = view.pages.flat();
      syncSendButton();
      document.querySelectorAll('.package-grid .package-card').forEach((card, index) => {
        const pkg = served[index];
        const id = card.querySelector('.package-card-id');
        // Only badge a card whose title ID matches what was served at its slot.
        const text = pkg && id && id.textContent === (pkg.titleId || '') ? badgeText(pkg) : '';
        let badge = card.querySelector('.pegasus-fw-badge');
        if (!text) {
          if (badge) badge.remove();
          return;
        }
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'pegasus-fw-badge';
          card.appendChild(badge);
        }
        if (badge.textContent !== text) badge.textContent = text;
      });
    }

    function syncSendButton() {
      const pane = document.querySelector('.detail-pane');
      const title = pane && pane.querySelector('.detail-title');
      const shownId = title && title.querySelector('span');
      const shownTitle = title && title.querySelector('h2');
      const matches = selected && shownTitle && shownTitle.textContent === (selected.title || '') &&
        (!shownId || shownId.textContent === (selected.titleId || ''));
      let button = pane && pane.querySelector('.pegasus-send');
      if (!matches) {
        if (button) button.remove();
        return;
      }
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'pegasus-send primary-button';
        button.textContent = 'Send to PS5';
        button.title = 'Open this package in Pegasus DL on your PS5';
        button.addEventListener('click', () => sendToPs5(selected));
        title.after(button);
      }
    }

    function sendToPs5(pkg) {
      const origin = ps5Origin(loadPs5Host());
      if (!origin) {
        const input = document.querySelector('.pegasus-fw-ps5');
        if (input) {
          input.setAttribute('aria-invalid', '');
          input.focus();
        }
        return;
      }
      const request = {
        catalog: `${location.origin}/catalogs/${view.slug}.json`,
        titleId: pkg.titleId || '',
        title: pkg.title || ''
      };
      // A named window is reused, so later sends go to the same Pegasus DL tab.
      window.open(`${origin}/${OPEN_HASH}${encodeURIComponent(JSON.stringify(request))}`, 'pegasus-dl');
    }

    // Accepts "192.168.0.12", "192.168.0.12:6970" or a hostname; returns an
    // http origin, or '' when the value is not a plain host.
    function ps5Origin(value) {
      const match = /^(?:https?:\/\/)?([a-z0-9.-]+)(?::(\d{1,5}))?\/?$/i.exec(String(value || '').trim());
      return match ? `http://${match[1]}:${match[2] || DEFAULT_PORT}` : '';
    }

    function loadPs5Host() {
      try {
        return localStorage.getItem(PS5_HOST_KEY) || '';
      } catch (error) {
        return '';
      }
    }

    function savePs5Host(value) {
      try {
        localStorage.setItem(PS5_HOST_KEY, value);
      } catch (error) {
        // Storage unavailable: the address lasts for this page only.
      }
    }

    // Records which served package a grid click selected. Capture phase, so it
    // runs before React re-renders the detail pane.
    document.addEventListener('click', (event) => {
      const card = event.target.closest && event.target.closest('.package-grid .package-card');
      if (!card) return;
      const index = [...document.querySelectorAll('.package-grid .package-card')].indexOf(card);
      const pkg = view.pages.flat()[index];
      const id = card.querySelector('.package-card-id');
      selected = pkg && (!id || id.textContent === (pkg.titleId || '')) ? pkg : null;
      scheduleSync();
    }, true);

    addStyle(`
      .catalog-header { flex-wrap: wrap; row-gap: 12px; }
      .catalog-header .pegasus-fw-controls { flex-basis: 100%; }
      .pegasus-fw-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .pegasus-fw-select {
        appearance: none;
        background: var(--surface-low);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text);
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        height: 36px;
        padding: 0 12px;
      }
      .pegasus-fw-select:hover, .pegasus-fw-select:focus-visible { border-color: var(--border-strong); }
      .pegasus-fw-count { color: var(--text-muted); font-size: 13px; white-space: nowrap; }
      .pegasus-fw-ps5 {
        background: var(--surface-low);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text);
        font: inherit;
        font-size: 13px;
        height: 36px;
        margin-left: auto;
        padding: 0 12px;
        width: 200px;
      }
      .pegasus-fw-ps5[aria-invalid] { border-color: var(--error); }
      .detail-pane .pegasus-send { margin: 12px 0; }
      .package-card .pegasus-fw-badge {
        align-self: flex-start;
        justify-self: start;
        width: fit-content;
        border: 1px solid var(--border-strong);
        border-radius: 4px;
        color: var(--text-muted);
        font-size: 11px;
        margin-top: 4px;
        padding: 0 6px;
        white-space: nowrap;
      }
    `);

    const start = () => {
      new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
      scheduleSync();
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  if (location.hostname === 'pegasus-catalog.fly.dev') {
    // Runs at document-start so fetch is wrapped before the app's first request.
    initCatalogSite();
  } else if (document.readyState === 'loading') {
    // Pegasus DL defines its globals in inline scripts at the end of the page.
    document.addEventListener('DOMContentLoaded', initPegasusDl, { once: true });
  } else {
    initPegasusDl();
  }
})();
