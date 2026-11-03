// ==UserScript==
// @name        GitHub Active Forks
// @namespace   https://github.com/klept0/Useful_Userscripts
// @description Adds an "Active Forks" button to GitHub repository pages that opens the repo in techgaun's Active Forks tool, to find the most active forks of abandoned projects.
// @match       https://github.com/*
// @run-at      document-end
// @version     1.0.0
// @grant       GM_registerMenuCommand
// @grant       GM_openInTab
// @homepageURL https://github.com/klept0/Useful_Userscripts
// @downloadURL https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Developer%20Stuff/GitHub%20Active%20Forks.user.js
// @updateURL   https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Developer%20Stuff/GitHub%20Active%20Forks.user.js
// ==/UserScript==

/**
 * Userscript version of the Active Forks bookmarklet:
 *   https://techgaun.github.io/active-forks/
 *
 * The bookmarklet parsed document.title. This script reads the repository
 * from GitHub's page metadata instead, so it works on every page of a repo
 * (issues, PRs, files), not only the repo home page.
 *
 * Two ways to open Active Forks:
 * 1. An "Active Forks" button next to the Fork button in the repo header.
 * 2. "Open Active Forks" in the userscript manager menu.
 *
 * GitHub navigates without full page loads (Turbo), so the button is
 * re-added after each navigation.
 */

(function () {
  'use strict';

  const ACTIVE_FORKS_URL = 'https://techgaun.github.io/active-forks/index.html#';
  const BUTTON_ID = 'uus-active-forks-button';

  // First path segments on github.com that are never a repository owner.
  const RESERVED = new Set([
    'about', 'apps', 'codespaces', 'collections', 'contact', 'customer-stories',
    'dashboard', 'enterprise', 'explore', 'features', 'issues', 'login',
    'marketplace', 'new', 'notifications', 'orgs', 'organizations', 'pricing',
    'pulls', 'search', 'security', 'settings', 'signup', 'sponsors', 'topics',
    'trending',
  ]);

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

  function openActiveForks() {
    const repo = getRepo();
    if (!repo) {
      alert('Not a GitHub repository page.');
      return;
    }
    const url = ACTIVE_FORKS_URL + repo;
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active: true });
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

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
    const a = document.createElement('a');
    a.id = BUTTON_ID;
    if (forkButton) {
      // Copy the Fork button's look so ours matches GitHub's styling.
      a.className = forkButton.className;
      ['data-component', 'data-size', 'data-variant'].forEach((attr) => {
        const value = forkButton.getAttribute(attr);
        if (value) a.setAttribute(attr, value);
      });
    } else {
      a.className = 'btn-sm btn';
    }
    a.href = ACTIVE_FORKS_URL + getRepo();
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Find the most active forks of this repository';
    a.textContent = 'Active Forks';
    li.appendChild(a);
    actions.appendChild(li);
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Open Active Forks', openActiveForks);
  }

  addButton();
  document.addEventListener('turbo:load', addButton);
  document.addEventListener('turbo:render', addButton);

  // The header can render late or be re-rendered by GitHub; re-add on DOM
  // changes. addButton returns early once the button exists.
  const observer = new MutationObserver(addButton);
  observer.observe(document.body, { childList: true, subtree: true });
})();
