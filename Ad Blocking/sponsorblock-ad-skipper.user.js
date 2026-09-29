// ==UserScript==
// @name         SponsorBlock + Ad Skipper Enhanced
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @description  Skips YouTube sponsor segments (via the SponsorBlock API) and video ads, with an on/off toggle and per-category toggles.
// @author       klept0 (based on 74th's Simple Sponsor Skipper)
// @license      MIT
// @match        https://www.youtube.com/*
// @grant        none
// @homepageURL  https://github.com/klept0/Useful_Userscripts
// @downloadURL  https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Ad%20Blocking/sponsorblock-ad-skipper.user.js
// @updateURL    https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Ad%20Blocking/sponsorblock-ad-skipper.user.js
// ==/UserScript==

(() => {
  'use strict';

  const CATEGORIES = [
    'sponsor', 'intro', 'outro', 'interaction', 'selfpromo', 'music_offtopic'
  ];

  const API_URL = 'https://sponsor.ajay.app/api/skipSegments';
  const RETRY_AFTER_ERROR_MS = 30000;

  // Global on/off and every category default to enabled.
  const PREFS_KEY = 'sb_prefs';
  const prefs = (() => {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch {
      return {};
    }
  })();

  const getPref = key => prefs[key] ?? true;
  const setPref = (key, val) => {
    prefs[key] = val;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  };

  const getVideoId = () =>
    location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null;

  const sha256Hex = async text => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // videoId -> Promise<segments>. Caching the promise, not the result, keeps
  // the 500ms loop from firing duplicate requests while one is in flight.
  const segmentCache = new Map();

  // Looks segments up by a 4-character hash prefix, so the SponsorBlock
  // server never learns which video is being watched (the official
  // extension does the same).
  const fetchSegments = videoId => {
    if (!segmentCache.has(videoId)) {
      segmentCache.set(videoId, (async () => {
        try {
          const prefix = (await sha256Hex(videoId)).slice(0, 4);
          const params = new URLSearchParams({ categories: JSON.stringify(CATEGORIES) });
          const response = await fetch(`${API_URL}/${prefix}?${params}`);

          // 404 means no segments for any video with this prefix.
          if (!response.ok) return [];

          const videos = await response.json();
          const match = videos.find(v => v.videoID === videoId);
          return match ? match.segments.filter(s => s.actionType === 'skip') : [];
        } catch {
          setTimeout(() => segmentCache.delete(videoId), RETRY_AFTER_ERROR_MS);
          return [];
        }
      })());
    }

    return segmentCache.get(videoId);
  };

  const skipAd = (player, video) => {
    player.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern')?.click();

    if (Number.isFinite(video.duration)) {
      video.currentTime = video.duration;
    }
  };

  const skipSegment = async video => {
    const videoId = getVideoId();
    if (!videoId) return;

    const segments = await fetchSegments(videoId);
    if (getVideoId() !== videoId) return; // navigated away while fetching

    const currentTime = video.currentTime;
    const segment = segments.find(s =>
      getPref(s.category) && currentTime >= s.segment[0] && currentTime < s.segment[1]
    );

    if (segment) {
      const [start, end] = segment.segment;
      video.currentTime = end;
      console.log(`Skipped ${segment.category} segment: ${start} → ${end}`);
    }
  };

  setInterval(() => {
    if (!getPref('enabled')) return;

    const player = document.getElementById('movie_player');
    const video = player?.querySelector('video');
    if (!video) return;

    // The ad-showing class sits on the player, not on <body>.
    if (player.classList.contains('ad-showing')) {
      skipAd(player, video);
    } else {
      skipSegment(video);
    }
  }, 500);

  // Category toggles
  const categoryPanel = document.createElement('div');
  categoryPanel.style = 'position:fixed;bottom:50px;right:10px;background:#111;color:#fff;padding:8px;border-radius:6px;z-index:99999;font-size:12px;';
  categoryPanel.textContent = 'Skip categories: ';

  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    const render = () => {
      btn.textContent = getPref(cat) ? `✓ ${cat}` : `✗ ${cat}`;
      btn.style.color = getPref(cat) ? '#0f0' : '#f00';
    };

    btn.style.cssText = 'margin:2px;padding:2px 6px;background:#222;border:none;cursor:pointer;';
    btn.onclick = () => {
      setPref(cat, !getPref(cat));
      render();
    };

    render();
    categoryPanel.appendChild(btn);
  });

  // Global on/off toggle
  const toggleUI = document.createElement('div');
  toggleUI.style = 'position:fixed;bottom:10px;right:10px;background:#222;padding:6px 10px;border-radius:6px;z-index:99999;cursor:pointer;font-size:14px;';

  const renderToggle = () => {
    toggleUI.textContent = getPref('enabled') ? '⏩ Skipping ON' : '⏸️ Skipping OFF';
    toggleUI.style.color = getPref('enabled') ? '#0f0' : '#f00';
  };

  const toggleEnabled = () => {
    setPref('enabled', !getPref('enabled'));
    renderToggle();
  };

  toggleUI.onclick = toggleEnabled;
  renderToggle();

  // Shift+S toggles skipping, except while typing (search box, comments).
  document.addEventListener('keydown', e => {
    if (!e.shiftKey || e.code !== 'KeyS' || e.ctrlKey || e.metaKey || e.altKey) return;

    const target = e.target;
    if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    toggleEnabled();
  });

  document.body.append(categoryPanel, toggleUI);
})();
