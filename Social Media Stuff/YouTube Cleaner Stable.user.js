// ==UserScript==
// @name         YouTube Cleaner Stable
// @namespace    http://tampermonkey.net/
// @version      3.1.2
// @description  Stable YouTube cleanup: 5-row grid default, Shorts blocker, sidebar cleanup, menu toggles, and new-video highlighting.
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

        GM_registerMenuCommand(`Grid: ${CFG.videosPerRow} videos per row`, () => {
            const value = Number(prompt('Videos per row, 3–7:', CFG.videosPerRow));
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
        ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]) {
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
        ytd-video-renderer:has(a[href*="start_radio=1"]) {
            display: none !important;
        }
        ` : ''}

        .ytgc-new-video {
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

        ytd-rich-item-renderer.ytgc-new-video,
        ytd-video-renderer.ytgc-new-video,
        ytd-grid-video-renderer.ytgc-new-video {
            position: relative !important;
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
            const text = section.innerText?.toLowerCase() || '';

            if (
                text.includes('explore more topics') ||
                text.includes('latest youtube posts') ||
                text.includes('popular on youtube')
            ) {
                section.style.setProperty('display', 'none', 'important');
            }
        });
    }

    function parseAgeToHours(text) {
        const match = text.toLowerCase().match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/);
        if (!match) return null;

        const amount = Number(match[1]);
        const unit = match[2];

        if (unit === 'second') return amount / 3600;
        if (unit === 'minute') return amount / 60;
        if (unit === 'hour') return amount;
        if (unit === 'day') return amount * 24;
        if (unit === 'week') return amount * 168;
        if (unit === 'month') return amount * 720;
        if (unit === 'year') return amount * 8760;

        return null;
    }

    const RELATIVE_TIME_RE = /^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i;

    function formatAbsoluteDate(date) {
        const now = new Date();
        const includeYear = CFG.alwaysShowYear || date.getFullYear() !== now.getFullYear();

        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: includeYear ? 'numeric' : undefined
        });
    }

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
                const text = node.nodeValue.trim();

                if (RELATIVE_TIME_RE.test(text)) {
                    const parent = node.parentElement;
                    if (parent && parent.dataset.ytgcDateDone !== '1') {
                        out.push(node);
                    }
                }
            } else if (node.shadowRoot) {
                collectRelativeTimeTextNodes(node.shadowRoot, out);
            }

            node = walker.nextNode();
        }
    }

    function absolutizeVideoDates() {
        if (!CFG.showAbsoluteDates) return;

        const textNodes = [];
        collectRelativeTimeTextNodes(document.body, textNodes);

        textNodes.forEach(textNode => {
            const text = textNode.nodeValue.trim();
            const ageHours = parseAgeToHours(text);
            if (ageHours === null) return;

            const uploadDate = new Date(Date.now() - ageHours * 3600 * 1000);
            const parent = textNode.parentElement;

            if (parent) {
                parent.dataset.ytgcDateDone = '1';
                parent.title = `Approximate — YouTube only shows relative time here ("${text}")`;
            }

            textNode.nodeValue = formatAbsoluteDate(uploadDate);
        });
    }

    function highlightNewVideos() {
        if (!CFG.highlightNewVideos) return;

        document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer').forEach(card => {
            if (card.classList.contains('ytgc-checked-new')) return;

            const ageHours = parseAgeToHours(card.innerText || '');
            card.classList.add('ytgc-checked-new');

            if (ageHours !== null && ageHours <= CFG.newVideoMaxHours) {
                card.classList.add('ytgc-new-video');
            }
        });
    }

    function applyGridFixes() {
        document.querySelectorAll('ytd-rich-grid-renderer').forEach(renderer => {
            renderer.style.setProperty('--ytd-rich-grid-items-per-row', String(CFG.videosPerRow), 'important');
            renderer.style.setProperty('--ytd-rich-grid-posts-per-row', String(CFG.videosPerRow), 'important');
            renderer.style.setProperty('--ytd-rich-grid-slim-items-per-row', String(CFG.videosPerRow), 'important');
        });

        if (!isSubscriptionsPage()) {
            document.querySelectorAll('ytd-rich-grid-row, #contents.ytd-rich-grid-row').forEach(row => {
                row.style.setProperty('display', 'contents', 'important');
            });
        }
    }

    let scheduled = false;

    function scheduleCleanup() {
        if (scheduled) return;

        scheduled = true;

        requestAnimationFrame(() => {
            redirectShorts();
            maybeForceSubscriptionsLatest();
            applyGridFixes();
            hideBadRichSections();
            highlightNewVideos();
            absolutizeVideoDates();
            scheduled = false;
        });
    }

    function hookNavigation() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function () {
            originalPushState.apply(this, arguments);
            scheduleCleanup();
        };

        history.replaceState = function () {
            originalReplaceState.apply(this, arguments);
            scheduleCleanup();
        };

        window.addEventListener('yt-navigate-finish', scheduleCleanup);
        window.addEventListener('yt-page-data-updated', scheduleCleanup);
        window.addEventListener('popstate', scheduleCleanup);
    }

    function observeDOM() {
        new MutationObserver(scheduleCleanup).observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    injectCSS();
    redirectShorts();
    registerMenus();

    document.addEventListener('DOMContentLoaded', () => {
        hookNavigation();
        scheduleCleanup();
        observeDOM();
    });
})();
