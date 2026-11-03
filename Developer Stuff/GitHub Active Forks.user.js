// ==UserScript==
// @name        GitHub Active Forks
// @namespace   https://github.com/klept0/Useful_Userscripts
// @description Adds an "Active Forks" button to GitHub repository pages that lists the repo's forks by stars and recent activity, right on the page, to find a maintained fork of an abandoned project.
// @match       https://github.com/*
// @run-at      document-end
// @version     2.1.0
// @grant       GM_registerMenuCommand
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @connect     api.github.com
// @homepageURL https://github.com/klept0/Useful_Userscripts
// @downloadURL https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Developer%20Stuff/GitHub%20Active%20Forks.user.js
// @updateURL   https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Developer%20Stuff/GitHub%20Active%20Forks.user.js
// ==/UserScript==

/**
 * Self-contained take on techgaun's Active Forks tool
 * (https://techgaun.github.io/active-forks/): the forks are fetched from the
 * GitHub REST API by this script and shown in a popup on the GitHub page.
 * No third-party site is involved.
 *
 * Two ways to open it:
 * 1. The "Active Forks" button next to the Fork button in the repo header.
 * 2. "Show active forks" in the userscript manager menu.
 *
 * The popup lists the upstream repo first, then its forks with stars, forks,
 * open issues, size and last push. Click a column header to sort. Forks with
 * no pushes since they were created are hidden by default, since they hold
 * nothing the upstream lacks. Forks pushed more recently than the upstream
 * get a "newer" badge.
 *
 * Forks load in blocks, newest fork first: pick 10, 20, 50 or 100 per block
 * in the popup (remembered), then use "Load more" for the next block. The
 * table sorts whatever is loaded (by stars unless you pick another column).
 *
 * Rate limits: without a token the GitHub API allows 60 requests per hour per
 * IP (one request per block, plus one for the repo). Set a personal access token with
 * "Set GitHub token" in the userscript manager menu to raise that to 5,000.
 * A fine-grained token with no extra permissions is enough for public repos.
 * The token is kept in the userscript manager's storage and is only sent to
 * api.github.com.
 *
 * GitHub navigates without full page loads (Turbo), so the button is
 * re-added after each navigation.
 */

(function () {
  'use strict';

  const API = 'https://api.github.com';
  const BLOCK_SIZES = [10, 20, 50, 100]; // Forks fetched per "Load more".
  const DEFAULT_BLOCK = 20;
  const BUTTON_ID = 'uus-active-forks-button';
  const STYLE_ID = 'uus-active-forks-style';
  const OVERLAY_ID = 'uus-active-forks-overlay';

  // First path segments on github.com that are never a repository owner.
  const RESERVED = new Set([
    'about', 'apps', 'codespaces', 'collections', 'contact', 'customer-stories',
    'dashboard', 'enterprise', 'explore', 'features', 'issues', 'login',
    'marketplace', 'new', 'notifications', 'orgs', 'organizations', 'pricing',
    'pulls', 'search', 'security', 'settings', 'signup', 'sponsors', 'topics',
    'trending',
  ]);

  // Fetched results, per repo, for this page session.
  const cache = new Map();

  /* ------------------------------------------------------------------ */
  /* Repo detection                                                      */
  /* ------------------------------------------------------------------ */

  /** Returns "owner/repo" for the current page, or null if not a repo page. */
  function getRepo() {
    // GitHub sets this meta tag on every repository page.
    const meta = document.querySelector('meta[name="octolytics-dimension-repository_nwo"]');
    if (meta && meta.content) return meta.content;

    // Fallback: the first two path segments.
    const [owner, repo] = location.pathname.split('/').filter(Boolean);
    if (!owner || !repo || RESERVED.has(owner.toLowerCase())) return null;
    return `${owner}/${repo}`;
  }

  /* ------------------------------------------------------------------ */
  /* GitHub API                                                          */
  /* ------------------------------------------------------------------ */

  /** GET an API path. Resolves with parsed JSON, rejects with a readable Error. */
  function apiGet(path) {
    return new Promise((resolve, reject) => {
      const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      const token = GM_getValue('token', '');
      if (token) headers.Authorization = `Bearer ${token}`;

      GM_xmlhttpRequest({
        method: 'GET',
        url: API + path,
        headers,
        onload(res) {
          if (res.status === 200) {
            try {
              resolve(JSON.parse(res.responseText));
            } catch (e) {
              reject(new Error('GitHub returned an unreadable response.'));
            }
            return;
          }
          const remaining = /x-ratelimit-remaining:\s*(\d+)/i.exec(res.responseHeaders || '');
          if ((res.status === 403 || res.status === 429) && remaining && remaining[1] === '0') {
            const reset = /x-ratelimit-reset:\s*(\d+)/i.exec(res.responseHeaders || '');
            const when = reset ? ` It resets at ${new Date(reset[1] * 1000).toLocaleTimeString()}.` : '';
            reject(new Error(`GitHub API rate limit reached.${when}` +
              (token ? '' : ' Set a GitHub token in the userscript menu to raise the limit.')));
          } else if (res.status === 401) {
            reject(new Error('GitHub rejected the saved token. Update it with "Set GitHub token".'));
          } else if (res.status === 404) {
            reject(new Error('Repository not found. Private repositories need a token with access.'));
          } else {
            reject(new Error(`GitHub API error ${res.status}.`));
          }
        },
        onerror() {
          reject(new Error('Network error while contacting the GitHub API.'));
        },
      });
    });
  }

  /** The saved block size, or the default if none or invalid. */
  function getBlockSize() {
    const size = Number(GM_getValue('blockSize', DEFAULT_BLOCK));
    return BLOCK_SIZES.includes(size) ? size : DEFAULT_BLOCK;
  }

  /**
   * Fetches the repo itself (cached). Forks are loaded separately, one block
   * at a time, by loadMore().
   */
  async function loadUpstream(repo) {
    if (cache.has(repo)) return cache.get(repo);
    const upstream = await apiGet(`/repos/${repo}`);
    const data = {
      upstream,
      forks: [],
      perPage: getBlockSize(),
      page: 0, // Last API page loaded, in units of perPage.
      done: upstream.forks_count === 0,
      loading: false,
    };
    cache.set(repo, data);
    return data;
  }

  /**
   * Fetches the next block of forks, newest first. sort=stargazers is not
   * used: forks with equal stars come back in a different order on each
   * request, so its pages overlap and skip forks (on a repo with 317 forks,
   * only 266 distinct ones came back). sort=newest pages are stable.
   */
  async function loadMore(data) {
    if (data.done) return;
    const page = data.page + 1;
    const batch = await apiGet(
      `/repos/${data.upstream.full_name}/forks?sort=newest&per_page=${data.perPage}&page=${page}`
    );
    // After a block size change the new page can overlap forks already loaded.
    const seen = new Set(data.forks.map((fork) => fork.id));
    data.forks.push(...batch.filter((fork) => !seen.has(fork.id)));
    data.page = page;
    if (batch.length < data.perPage) data.done = true;
  }

  /**
   * Switches the block size without discarding loaded forks: the next page
   * is the one, in the new size, that holds the first fork not yet loaded.
   */
  function setBlockSize(data, size) {
    data.perPage = size;
    data.page = Math.floor(data.forks.length / size);
  }

  /* ------------------------------------------------------------------ */
  /* Formatting                                                          */
  /* ------------------------------------------------------------------ */

  const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const UNITS = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['week', 7 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
  ];

  function timeAgo(iso) {
    if (!iso) return 'never';
    const seconds = (new Date(iso) - Date.now()) / 1000;
    for (const [unit, size] of UNITS) {
      if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  }

  /** Repo size from the API is in KB. */
  function formatSize(kb) {
    if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${kb} KB`;
  }

  /** True when the fork has had a push since it was created. */
  function hasOwnPushes(fork) {
    return new Date(fork.pushed_at) > new Date(fork.created_at);
  }

  /* ------------------------------------------------------------------ */
  /* Popup                                                               */
  /* ------------------------------------------------------------------ */

  const COLUMNS = [
    { key: 'full_name', label: 'Repository', numeric: false },
    { key: 'stargazers_count', label: 'Stars', numeric: true },
    { key: 'forks_count', label: 'Forks', numeric: true },
    { key: 'open_issues_count', label: 'Open issues', numeric: true },
    { key: 'size', label: 'Size', numeric: true },
    { key: 'pushed_at', label: 'Last push', numeric: false },
  ];

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed; inset: 0; z-index: 2000;
        display: flex; align-items: center; justify-content: center;
        padding: 16px; background: rgba(0, 0, 0, 0.5);
      }
      #${OVERLAY_ID} .uaf-panel {
        display: flex; flex-direction: column;
        width: 100%; max-width: 1100px; max-height: 85vh;
        color: var(--fgColor-default, #1f2328);
        background: var(--bgColor-default, #fff);
        border: 1px solid var(--borderColor-default, #d1d9e0);
        border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        font-size: 14px;
      }
      #${OVERLAY_ID} .uaf-head {
        display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        padding: 12px 16px;
        border-bottom: 1px solid var(--borderColor-default, #d1d9e0);
      }
      #${OVERLAY_ID} .uaf-title { margin: 0; font-size: 16px; font-weight: 600; flex: 1 1 auto; }
      #${OVERLAY_ID} .uaf-close {
        border: 0; background: none; cursor: pointer; font-size: 20px; line-height: 1;
        color: var(--fgColor-muted, #59636e);
      }
      #${OVERLAY_ID} .uaf-controls {
        display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
        padding: 8px 16px; color: var(--fgColor-muted, #59636e);
      }
      #${OVERLAY_ID} .uaf-controls input[type="search"],
      #${OVERLAY_ID} .uaf-controls select {
        padding: 4px 8px;
        color: inherit; background: var(--bgColor-default, #fff);
        border: 1px solid var(--borderColor-default, #d1d9e0); border-radius: 6px;
      }
      #${OVERLAY_ID} .uaf-controls input[type="search"] { min-width: 200px; }
      #${OVERLAY_ID} .uaf-foot {
        padding: 8px 16px; text-align: center;
        border-top: 1px solid var(--borderColor-default, #d1d9e0);
      }
      #${OVERLAY_ID} .uaf-more {
        padding: 5px 16px; cursor: pointer; font-weight: 500;
        color: inherit; background: var(--bgColor-muted, #f6f8fa);
        border: 1px solid var(--borderColor-default, #d1d9e0); border-radius: 6px;
      }
      #${OVERLAY_ID} .uaf-more:disabled { cursor: progress; opacity: 0.6; }
      #${OVERLAY_ID} .uaf-status { padding: 4px 16px 8px; color: var(--fgColor-muted, #59636e); }
      #${OVERLAY_ID} .uaf-status.uaf-error { color: var(--fgColor-danger, #d1242f); }
      #${OVERLAY_ID} .uaf-body { overflow: auto; }
      #${OVERLAY_ID} table { width: 100%; border-collapse: collapse; }
      #${OVERLAY_ID} th, #${OVERLAY_ID} td {
        padding: 6px 16px; text-align: left; white-space: nowrap;
        border-top: 1px solid var(--borderColor-muted, #d1d9e0b3);
      }
      #${OVERLAY_ID} th {
        position: sticky; top: 0; cursor: pointer; user-select: none;
        background: var(--bgColor-muted, #f6f8fa); font-weight: 600;
      }
      #${OVERLAY_ID} .uaf-num { text-align: right; }
      #${OVERLAY_ID} tr.uaf-upstream td { background: var(--bgColor-accent-muted, #ddf4ff); }
      #${OVERLAY_ID} .uaf-badge {
        margin-left: 6px; padding: 0 6px; border-radius: 10px; font-size: 12px;
        border: 1px solid currentColor;
      }
      #${OVERLAY_ID} .uaf-badge-new { color: var(--fgColor-success, #1a7f37); }
      #${OVERLAY_ID} .uaf-badge-up { color: var(--fgColor-accent, #0969da); }
    `;
    document.head.appendChild(style);
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    (children || []).forEach((child) => node.append(child));
    return node;
  }

  function closePopup() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', onKeydown, true);
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closePopup();
    }
  }

  async function showActiveForks() {
    const repo = getRepo();
    if (!repo) {
      alert('Not a GitHub repository page.');
      return;
    }

    closePopup();
    addStyles();

    const state = { sortKey: 'stargazers_count', sortDir: -1, hideUnchanged: true, filter: '' };

    const status = el('div', { className: 'uaf-status', textContent: 'Loading…' });
    const hideBox = el('input', { type: 'checkbox', checked: true });
    const filterBox = el('input', { type: 'search', placeholder: 'Filter by owner or name' });
    const blockSelect = el('select', {}, BLOCK_SIZES.map((size) =>
      el('option', { value: String(size), textContent: String(size) })));
    const moreButton = el('button', { type: 'button', className: 'uaf-more' });
    const footer = el('div', { className: 'uaf-foot', hidden: true }, [moreButton]);
    const table = el('table');
    const panel = el('div', { className: 'uaf-panel', role: 'dialog' }, [
      el('div', { className: 'uaf-head' }, [
        el('h2', { className: 'uaf-title', textContent: `Active forks of ${repo}` }),
        el('button', { className: 'uaf-close', type: 'button', title: 'Close (Esc)', textContent: '×', onclick: closePopup }),
      ]),
      el('div', { className: 'uaf-controls' }, [
        el('label', {}, [hideBox, ' Hide forks with no pushes of their own']),
        filterBox,
        el('label', {}, ['Load ', blockSelect, ' at a time']),
      ]),
      status,
      el('div', { className: 'uaf-body' }, [table]),
      footer,
    ]);
    const overlay = el('div', { id: OVERLAY_ID }, [panel]);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closePopup();
    });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeydown, true);

    let data;
    try {
      data = await loadUpstream(repo);
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('uaf-error');
      return;
    }
    if (!overlay.isConnected) return; // Closed while loading.

    const render = () => {
      status.classList.remove('uaf-error');
      renderTable(table, status, data, state);
      footer.hidden = data.done;
      moreButton.disabled = data.loading;
      moreButton.textContent = data.loading ? 'Loading…' : `Load ${data.perPage} more`;
      blockSelect.value = String(data.perPage);
    };

    const fetchBlock = async () => {
      if (data.loading || data.done) return;
      data.loading = true;
      render();
      let error = null;
      try {
        await loadMore(data);
      } catch (e) {
        error = e;
      }
      data.loading = false;
      if (!overlay.isConnected) return;
      render();
      if (error) {
        status.textContent = error.message;
        status.classList.add('uaf-error');
      }
    };

    moreButton.addEventListener('click', fetchBlock);
    blockSelect.addEventListener('change', () => {
      const size = Number(blockSelect.value);
      GM_setValue('blockSize', size);
      if (!data.loading) setBlockSize(data, size);
      render();
    });
    hideBox.addEventListener('change', () => { state.hideUnchanged = hideBox.checked; render(); });
    filterBox.addEventListener('input', () => { state.filter = filterBox.value.trim().toLowerCase(); render(); });
    table.addEventListener('click', (event) => {
      const th = event.target.closest('th');
      if (!th) return;
      const key = th.dataset.key;
      if (state.sortKey === key) {
        state.sortDir = -state.sortDir;
      } else {
        state.sortKey = key;
        state.sortDir = key === 'full_name' ? 1 : -1;
      }
      render();
    });

    if (!data.forks.length && !data.done) fetchBlock();
    else render();
  }

  function renderTable(table, status, data, state) {
    const { upstream, forks, done } = data;

    let rows = forks;
    if (state.hideUnchanged) rows = rows.filter(hasOwnPushes);
    if (state.filter) rows = rows.filter((f) => f.full_name.toLowerCase().includes(state.filter));

    const { sortKey, sortDir } = state;
    rows = rows.slice().sort((a, b) => {
      let x = a[sortKey];
      let y = b[sortKey];
      if (sortKey === 'pushed_at') {
        x = new Date(x || 0).getTime();
        y = new Date(y || 0).getTime();
      } else if (typeof x === 'string') {
        return x.localeCompare(y) * sortDir;
      }
      return (x - y) * sortDir || b.stargazers_count - a.stargazers_count;
    });

    const hidden = forks.length - rows.length;
    let text = `Showing ${rows.length} of ${forks.length} loaded forks`;
    if (hidden) text += ` (${hidden} hidden)`;
    // forks_count also counts forks the API does not list (private,
    // disabled), so "all loaded" comes from the API, not from this count.
    text += done
      ? '. All forks loaded.'
      : `. ${upstream.forks_count.toLocaleString()} forks on GitHub, newest loaded first.`;
    if (done && !forks.length) text = 'This repository has no forks.';
    if (data.loading && !forks.length) text = 'Loading forks…';
    status.textContent = text;

    const headRow = el('tr', {}, COLUMNS.map((col) => {
      const arrow = col.key === sortKey ? (sortDir < 0 ? ' ▼' : ' ▲') : '';
      const th = el('th', { className: col.numeric ? 'uaf-num' : '', textContent: col.label + arrow });
      th.dataset.key = col.key;
      return th;
    }));

    const upstreamPushed = new Date(upstream.pushed_at);
    const body = [makeRow(upstream, 'upstream', true)];
    rows.forEach((fork) => {
      const newer = new Date(fork.pushed_at) > upstreamPushed;
      body.push(makeRow(fork, newer ? 'newer' : '', false));
    });

    table.replaceChildren(el('thead', {}, [headRow]), el('tbody', {}, body));
  }

  function makeRow(repo, badge, isUpstream) {
    const link = el('a', { href: repo.html_url, target: '_blank', rel: 'noopener', textContent: repo.full_name });
    const nameCell = el('td', {}, [link]);
    if (badge) {
      nameCell.append(el('span', {
        className: `uaf-badge ${isUpstream ? 'uaf-badge-up' : 'uaf-badge-new'}`,
        textContent: badge,
        title: isUpstream ? 'The repository you are viewing' : 'Pushed more recently than the upstream repository',
      }));
    }
    const num = (value) => el('td', { className: 'uaf-num', textContent: Number(value).toLocaleString() });
    return el('tr', { className: isUpstream ? 'uaf-upstream' : '' }, [
      nameCell,
      num(repo.stargazers_count),
      num(repo.forks_count),
      num(repo.open_issues_count),
      el('td', { className: 'uaf-num', textContent: formatSize(repo.size) }),
      el('td', { textContent: timeAgo(repo.pushed_at), title: repo.pushed_at ? new Date(repo.pushed_at).toLocaleString() : '' }),
    ]);
  }

  /* ------------------------------------------------------------------ */
  /* Header button and menu                                              */
  /* ------------------------------------------------------------------ */

  /** Adds the button to the repo header actions (Watch / Fork / Star). */
  function addButton() {
    if (document.getElementById(BUTTON_ID) || !getRepo()) return;

    // Current header: a <ul> of <li> items, one holding the Fork button.
    // Older header: ul.pagehead-actions.
    const forkButton = document.querySelector('[data-testid="fork-button"]');
    const forkItem = forkButton && forkButton.closest('li');
    const actions = (forkItem && forkItem.parentElement) ||
      document.querySelector('ul.pagehead-actions');
    if (!actions) return;

    const li = document.createElement('li');
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    if (forkButton) {
      // Copy the Fork button's look so ours matches GitHub's styling.
      button.className = forkButton.className;
      ['data-component', 'data-size', 'data-variant'].forEach((attr) => {
        const value = forkButton.getAttribute(attr);
        if (value) button.setAttribute(attr, value);
      });
    } else {
      button.className = 'btn-sm btn';
    }
    button.title = 'List the most active forks of this repository';
    button.textContent = 'Active Forks';
    button.addEventListener('click', showActiveForks);
    li.appendChild(button);
    actions.appendChild(li);
  }

  function setToken() {
    const current = GM_getValue('token', '');
    const value = prompt(
      'GitHub personal access token for the Active Forks script.\n' +
      'Raises the API limit from 60 to 5,000 requests per hour.\n' +
      'Leave empty to remove the saved token.',
      current ? '(token saved: leave as is to keep it)' : ''
    );
    if (value === null || value.startsWith('(token saved')) return;
    GM_setValue('token', value.trim());
    cache.clear();
  }

  GM_registerMenuCommand('Show active forks', showActiveForks);
  GM_registerMenuCommand('Set GitHub token', setToken);

  addButton();
  document.addEventListener('turbo:load', addButton);
  document.addEventListener('turbo:render', addButton);

  // The header can render late or be re-rendered by GitHub; re-add on DOM
  // changes. addButton returns early once the button exists.
  const observer = new MutationObserver(addButton);
  observer.observe(document.body, { childList: true, subtree: true });
})();
