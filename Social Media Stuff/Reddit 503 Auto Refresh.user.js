// ==UserScript==
// @name        Reddit 503 Auto Refresh
// @namespace   flarn2006
// @description Reloads Reddit automatically when it serves a server error (5xx) page, backing off between retries.
// @match       https://*.reddit.com/*
// @version     3
// @grant       none
// @run-at      document-end
// @homepageURL https://github.com/klept0/Useful_Userscripts
// @downloadURL https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Social%20Media%20Stuff/Reddit%20503%20Auto%20Refresh.user.js
// @updateURL   https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Social%20Media%20Stuff/Reddit%20503%20Auto%20Refresh.user.js
// ==/UserScript==

(function () {
  'use strict';

  const RETRY_KEY = 'reddit503RetryCount';
  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 2000;
  const MAX_DELAY_MS = 60000;

  // HTTP status of this page load (Chrome 109+, Firefox 119+).
  const status = performance.getEntriesByType('navigation')[0]?.responseStatus;
  // Old Reddit's "Ow!" error page, for browsers without responseStatus.
  const isLegacyErrorPage = document.title === 'Ow! -- reddit.com';

  if (!(status >= 500 || isLegacyErrorPage)) {
    sessionStorage.removeItem(RETRY_KEY);
    return;
  }

  const retries = Number(sessionStorage.getItem(RETRY_KEY)) || 0;
  if (retries >= MAX_RETRIES) return;

  sessionStorage.setItem(RETRY_KEY, String(retries + 1));
  setTimeout(() => location.reload(), Math.min(BASE_DELAY_MS * 2 ** retries, MAX_DELAY_MS));
})();
