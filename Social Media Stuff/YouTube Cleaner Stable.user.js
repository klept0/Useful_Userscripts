// ==UserScript==
// @name         YouTube Cleaner Stable
// @namespace    http://tampermonkey.net/
// @version      3.3.0
// @description  Stable YouTube cleanup: responsive grid (up to 5 per row by default), clamped titles, Shorts blocker, sidebar cleanup, menu toggles, and new-video highlighting.
// @author       Dean / enhanced
// @match        https://www.youtube.com/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @homepageURL  https://github.com/klept0/Useful_Userscripts
// @downloadURL  https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Social%20Media%20Stuff/YouTube%20Cleaner%20Stable.user.js
// @updateURL    https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Social%20Media%20Stuff/YouTube%20Cleaner%20Stable.user.js
// ==/UserScript==

(function () {
    'use strict';

    const DEFAULTS = {
        videosPerRow: 5,
        blockShorts: true,
        redirectShortsToWatch: true,
        hideShortsSidebarButton: true,
        hideExploreSidebar: true,
        hideMoreFromYouTubeSidebar: true,
        hideVideoMixes: true,
        hideExploreTopics: true,
        hideChipsBar: false,
        highlightNewVideos: true,
        newVideoMaxHours: 24,
        highlightBorderColor: '#00ff88',
        autoOpenSubscriptionsLatest: false,
        showAbsoluteDates: true,
        alwaysShowYear: false
    };

    const CFG = {};
    for (const key in DEFAULTS) {
        CFG[key] = GM_getValue(key, DEFAULTS[key]);
    }

    const isSubscriptionsPage = () => location.pathname === '/feed/subscriptions';

    function save(key, value) {
        GM_setValue(key, value);
        location.reload();
    }

    function toggle(key) {
        save(key, !CFG[key]);
    }

    function registerMenus() {
        GM_registerMenuCommand(`${CFG.blockShorts ? '✅' : '❌'} Block Shorts`, () => toggle('blockShorts'));
        GM_registerMenuCommand(`${CFG.redirectShortsToWatch ? '✅' : '❌'} Redirect Shorts to normal player`, () => toggle('redirectShortsToWatch'));
        GM_registerMenuCommand(`${CFG.hideShortsSidebarButton ? '✅' : '❌'} Hide Shorts sidebar button`, () => toggle('hideShortsSidebarButton'));
        GM_registerMenuCommand(`${CFG.hideExploreSidebar ? '✅' : '❌'} Hide Explore sidebar`, () => toggle('hideExploreSidebar'));
        GM_registerMenuCommand(`${CFG.hideMoreFromYouTubeSidebar ? '✅' : '❌'} Hide More from YouTube sidebar`, () => toggle('hideMoreFromYouTubeSidebar'));
        GM_registerMenuCommand(`${CFG.hideVideoMixes ? '✅' : '❌'} Hide YouTube Mixes`, () => toggle('hideVideoMixes'));
        GM_registerMenuCommand(`${CFG.hideExploreTopics ? '✅' : '❌'} Hide Explore more topics`, () => toggle('hideExploreTopics'));
        GM_registerMenuCommand(`${CFG.hideChipsBar ? '✅' : '❌'} Hide topic chips bar`, () => toggle('hideChipsBar'));
        GM_registerMenuCommand(`${CFG.highlightNewVideos ? '✅' : '❌'} Highlight new videos`, () => toggle('highlightNewVideos'));
        GM_registerMenuCommand(`${CFG.autoOpenSubscriptionsLatest ? '✅' : '❌'} Auto-force subscriptions latest`, () => toggle('autoOpenSubscriptionsLatest'));
        GM_registerMenuCommand(`${CFG.showAbsoluteDates ? '✅' : '❌'} Show upload date instead of "X ago"`, () => toggle('showAbsoluteDates'));
        GM_registerMenuCommand(`${CFG.alwaysShowYear ? '✅' : '❌'} Always show year in dates`, () => toggle('alwaysShowYear'));

        GM_registerMenuCommand(`Grid: up to ${CFG.videosPerRow} videos per row`, () => {
            const value = Number(prompt('Maximum videos per row, 3–7 (fewer are shown when the window is narrow):', CFG.videosPerRow));
            if (Number.isInteger(value) && value >= 3 && value <= 7) {
                save('videosPerRow', value);
            }
        });

        GM_registerMenuCommand(`New video window: ${CFG.newVideoMaxHours} hours`, () => {
            const value = Number(prompt('Highlight videos newer than how many hours?', CFG.newVideoMaxHours));
            if (Number.isFinite(value) && value >= 1 && value <= 168) {
                save('newVideoMaxHours', value);
            }
        });

        GM_registerMenuCommand('Highlight color', () => {
            const value = prompt('Highlight border color:', CFG.highlightBorderColor);
            if (value && /^#?[0-9a-fA-F]{6}$/.test(value.trim())) {
                save('highlightBorderColor', value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`);
            }
        });

        GM_registerMenuCommand('Open Subscriptions — latest view', () => {
            location.href = 'https://www.youtube.com/feed/subscriptions?flow=2';
        });

        GM_registerMenuCommand('Open Search — upload date sort', () => {
            const q = prompt('Search YouTube, newest first:');
            if (q?.trim()) {
                location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim())}&sp=CAI%253D`;
            }
        });

        GM_registerMenuCommand('Reset all script settings', () => {
            if (!confirm('Reset all YouTube Cleaner settings?')) return;

            for (const key in DEFAULTS) {
                GM_setValue(key, DEFAULTS[key]);
            }

            location.reload();
        });
    }

    const css = `
        ytd-rich-grid-renderer {
            --ytd-rich-grid-items-per-row: ${CFG.videosPerRow} !important;
            --ytd-rich-grid-posts-per-row: ${CFG.videosPerRow} !important;
            --ytd-rich-grid-slim-items-per-row: ${CFG.videosPerRow} !important;
        }

        ytd-rich-grid-row,
        #contents.ytd-rich-grid-row {
            display: contents !important;
        }

        ytd-rich-item-renderer {
            margin-left: calc(var(--ytd-rich-grid-item-margin) / 2) !important;
            margin-right: calc(var(--ytd-rich-grid-item-margin) / 2) !important;
        }

        #video-title.ytd-rich-grid-media,
        #video-title.ytd-rich-grid-slim-media {
            font-size: 1.4rem !important;
            line-height: 2rem !important;
        }

        /* Flex children default to min-width: auto, so a long unbroken
           title stretches the card past its column instead of wrapping. */
        ytd-rich-item-renderer,
        ytd-rich-grid-media #details,
        ytd-rich-grid-media #meta,
        yt-lockup-view-model,
        yt-lockup-metadata-view-model {
            min-width: 0 !important;
        }

        /* Two lines max, ellipsis after, and break long words/URLs. */
        #video-title.ytd-rich-grid-media,
        #video-title.ytd-rich-grid-slim-media,
        yt-lockup-metadata-view-model h3,
        yt-lockup-metadata-view-model h3 a {
            display: -webkit-box !important;
            -webkit-box-orient: vertical !important;
            -webkit-line-clamp: 2 !important;
            line-clamp: 2 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
        }

        #metadata-line.ytd-video-meta-block {
            font-size: 1.2rem !important;
            line-height: 1.8rem !important;
        }

        ${CFG.blockShorts ? `
        ytd-reel-shelf-renderer,
        ytd-rich-shelf-renderer[is-shorts],
        ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
        ytd-rich-section-renderer:has(ytd-reel-shelf-renderer),
        ytd-rich-item-renderer:has(a[href^="/shorts/"]),
        ytd-video-renderer:has(a[href^="/shorts/"]),
        ytd-grid-video-renderer:has(a[href^="/shorts/"]),
        ytd-compact-video-renderer:has(a[href^="/shorts/"]),
        ytd-playlist-video-renderer:has(a[href^="/shorts/"]),
        ytd-rich-item-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),
        ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),
        ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model),
        ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model),
        grid-shelf-view-model:has(ytm-shorts-lockup-view-model),
        yt-lockup-view-model:has(a[href^="/shorts/"]) {
            display: none !important;
        }
        ` : ''}

        ${CFG.hideShortsSidebarButton ? `
        ytd-guide-entry-renderer:has(a[title="Shorts"]),
        ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
        ytd-guide-entry-renderer:has(a[href="/shorts"]),
        ytd-mini-guide-entry-renderer:has(a[href="/shorts"]) {
            display: none !important;
        }
        ` : ''}

        ${CFG.hideExploreSidebar ? `
        ytd-guide-section-renderer:has(a[title="Shopping"]),
        ytd-guide-section-renderer:has(a[title="Music"]),
        ytd-guide-section-renderer:has(a[title="Movies & TV"]) {
            display: none !important;
        }
        ` : ''}

        ${CFG.hideMoreFromYouTubeSidebar ? `
        ytd-guide-section-renderer:has(a[title="YouTube TV"]),
        ytd-guide-section-renderer:has(a[title="YouTube Music"]),
        ytd-guide-section-renderer:has(a[title="YouTube Kids"]) {
            display: none !important;
        }
        ` : ''}

        ${CFG.hideChipsBar ? `
        ytd-feed-filter-chip-bar-renderer {
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
        }

        #chips-wrapper.ytd-feed-filter-chip-bar-renderer,
        #chips.ytd-feed-filter-chip-bar-renderer {
            height: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
        }
        ` : ''}

        ${CFG.hideVideoMixes ? `
        ytd-rich-item-renderer:has(a[href*="start_radio=1"]),
        ytd-video-renderer:has(a[href*="start_radio=1"]),
        yt-lockup-view-model:has(a[href*="start_radio=1"]) {
            display: none !important;
        }
        ` : ''}

        .ytgc-new-video {
            position: relative !important;
            border: 2px solid ${CFG.highlightBorderColor} !important;
            border-radius: 14px !important;
            box-shadow: 0 0 14px ${CFG.highlightBorderColor}66 !important;
            background: ${CFG.highlightBorderColor}11 !important;
            overflow: hidden !important;
        }

        .ytgc-new-video::before {
            content: "NEW";
            position: absolute;
            z-index: 999;
            top: 6px;
            left: 6px;
            padding: 2px 7px;
            font-size: 11px;
            font-weight: 800;
            border-radius: 999px;
            background: ${CFG.highlightBorderColor};
            color: #000;
            pointer-events: none;
        }
    `;

    function injectCSS() {
        GM_addStyle(css);
    }

    function redirectShorts() {
        if (!CFG.redirectShortsToWatch) return;

        const match = location.pathname.match(/^\/shorts\/([^/?#]+)/);
        if (match?.[1]) {
            location.replace(`https://www.youtube.com/watch?v=${match[1]}`);
        }
    }

    function maybeForceSubscriptionsLatest() {
        if (!CFG.autoOpenSubscriptionsLatest) return;
        if (!isSubscriptionsPage()) return;

        const params = new URLSearchParams(location.search);
        if (params.get('flow') !== '2') {
            location.replace('https://www.youtube.com/feed/subscriptions?flow=2');
        }
    }

    function hideBadRichSections() {
        if (!CFG.hideExploreTopics) return;

        document.querySelectorAll('ytd-rich-section-renderer').forEach(section => {
            // textContent, not innerText: innerText forces a layout per section.
            const text = section.textContent?.toLowerCase() || '';

            if (
                text.includes('explore more topics') ||
                text.includes('latest youtube posts') ||
                text.includes('popular on youtube')
            ) {
                section.style.setProperty('display', 'none', 'important');
            }
        });
    }

    // Optional "Streamed"/"Premiered" prefix is kept when the text is rewritten.
    const RELATIVE_TIME_RE = /^(?:(streamed|premiered)\s+)?(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i;

    const UNIT_HOURS = {
        second: 1 / 3600,
        minute: 1 / 60,
        hour: 1,
        day: 24,
        week: 168,
        month: 720,
        year: 8760
    };

    const CARD_SELECTOR = [
        'ytd-rich-item-renderer',
        'ytd-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-compact-video-renderer',
        'yt-lockup-view-model'
    ].join(', ');

    function formatAbsoluteDate(date) {
        const now = new Date();
        const includeYear = CFG.alwaysShowYear || date.getFullYear() !== now.getFullYear();

        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: includeYear ? 'numeric' : undefined
        });
    }

    // closest() stops at shadow boundaries, so hop to the host and keep going.
    function findCard(el) {
        while (el) {
            const card = el.closest(CARD_SELECTOR);
            if (card) return card;

            const root = el.getRootNode();
            el = root instanceof ShadowRoot ? root.host : null;
        }

        return null;
    }

    // Text value each node had when last processed. YouTube recycles card
    // elements for new videos on navigation, so a node is re-processed
    // whenever its text changes rather than being skipped forever.
    const processedTimeText = new WeakMap();

    // YouTube's feed/grid data only exposes a bucketed relative time
    // ("3 days ago", "2 months ago") — there's no exact upload timestamp
    // in this data without a separate request per video. So this converts
    // the relative text into an *approximate* calendar date instead. The
    // original relative text is kept as a tooltip for reference.
    //
    // Some layouts (e.g. a channel's "Videos" tab) render with real shadow
    // DOM rather than the classic Polymer "shady DOM", so a plain
    // querySelectorAll from document won't see the text at all. This walks
    // the light DOM and recurses into any open shadow roots it finds.
    function collectRelativeTimeTextNodes(root, out) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
        );

        let node = walker.nextNode();
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (
                    processedTimeText.get(node) !== node.nodeValue &&
                    RELATIVE_TIME_RE.test(node.nodeValue.trim())
                ) {
                    out.push(node);
                }
            } else if (node.shadowRoot) {
                collectRelativeTimeTextNodes(node.shadowRoot, out);
            }

            node = walker.nextNode();
        }
    }

    // Highlighting and date rewriting share one pass over the time labels:
    // the label is the only reliable age source, and once it's rewritten to
    // a date a later pass couldn't parse the age from it anymore.
    function processTimeLabels() {
        if (!CFG.showAbsoluteDates && !CFG.highlightNewVideos) return;

        const textNodes = [];
        collectRelativeTimeTextNodes(document.body, textNodes);

        textNodes.forEach(textNode => {
            const text = textNode.nodeValue.trim();
            const [, prefix, amount, unit] = text.match(RELATIVE_TIME_RE);
            const ageHours = Number(amount) * UNIT_HOURS[unit.toLowerCase()];
            const parent = textNode.parentElement;

            if (CFG.highlightNewVideos) {
                findCard(parent)?.classList.toggle('ytgc-new-video', ageHours <= CFG.newVideoMaxHours);
            }

            if (CFG.showAbsoluteDates) {
                const date = formatAbsoluteDate(new Date(Date.now() - ageHours * 3600 * 1000));
                textNode.nodeValue = prefix ? `${prefix} ${date}` : date;

                if (parent) {
                    parent.title = `Approximate — YouTube only shows relative time here ("${text}")`;
                }
            }

            processedTimeText.set(textNode, textNode.nodeValue);
        });
    }

    // Narrowest a card may get before the grid drops a column, so a half-
    // screen window shows fewer, readable cards instead of squeezing
    // videosPerRow (which becomes the maximum) into the space.
    const MIN_CARD_WIDTH_PX = 220;

    // Re-fit the grid when it changes width: window resize, sidebar toggle.
    const gridResizeObserver = new ResizeObserver(() => scheduleCleanup());
    const observedGrids = new WeakSet();

    // The stylesheet already forces rows to display: contents; YouTube also
    // writes these vars inline on the renderer, so override them there too.
    function applyGridFixes() {
        document.querySelectorAll('ytd-rich-grid-renderer').forEach(renderer => {
            if (!observedGrids.has(renderer)) {
                observedGrids.add(renderer);
                gridResizeObserver.observe(renderer);
            }

            const width = renderer.clientWidth;
            if (!width) return; // grid of an inactive (hidden) page

            const perRow = String(Math.max(1, Math.min(CFG.videosPerRow, Math.floor(width / MIN_CARD_WIDTH_PX))));
            if (renderer.style.getPropertyValue('--ytd-rich-grid-items-per-row') === perRow) return;

            renderer.style.setProperty('--ytd-rich-grid-items-per-row', perRow, 'important');
            renderer.style.setProperty('--ytd-rich-grid-posts-per-row', perRow, 'important');
            renderer.style.setProperty('--ytd-rich-grid-slim-items-per-row', perRow, 'important');
        });
    }

    function runCleanup() {
        redirectShorts();
        maybeForceSubscriptionsLatest();
        applyGridFixes();
        hideBadRichSections();
        processTimeLabels();
    }

    // Throttled, not per-frame: the cleanup walks the whole DOM, and YouTube
    // mutates it constantly.
    const CLEANUP_INTERVAL_MS = 250;
    let cleanupTimer = null;

    function scheduleCleanup() {
        if (cleanupTimer) return;

        cleanupTimer = setTimeout(() => {
            cleanupTimer = null;
            runCleanup();
        }, CLEANUP_INTERVAL_MS);
    }

    function hookNavigation() {
        window.addEventListener('yt-navigate-finish', () => {
            // Redirect immediately so the Shorts player never starts.
            redirectShorts();
            scheduleCleanup();
        });
        window.addEventListener('yt-page-data-updated', scheduleCleanup);
        window.addEventListener('popstate', scheduleCleanup);
    }

    function observeDOM() {
        new MutationObserver(mutations => {
            // The video player mutates many times a second during playback.
            const inPlayer = m => {
                const el = m.target.nodeType === Node.TEXT_NODE ? m.target.parentElement : m.target;
                return el?.closest('#movie_player');
            };

            if (mutations.every(inPlayer)) return;
            scheduleCleanup();
        }).observe(document.documentElement, {
            childList: true,
            // Recycled cards can swap their time text in place.
            characterData: true,
            subtree: true
        });
    }

    function start() {
        hookNavigation();
        runCleanup();
        observeDOM();
    }

    injectCSS();
    redirectShorts();
    registerMenus();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
