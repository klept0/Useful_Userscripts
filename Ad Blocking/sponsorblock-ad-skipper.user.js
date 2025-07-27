// ==UserScript==
// @name         SponsorBlock + Ad Skipper Enhanced
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Skips YouTube sponsor segments (via SponsorBlock API) and video ads (via DOM detection), with on/off toggle.
// @author       klept0 (based on work by 74th)
// @match        *://www.youtube.com/*
// @grant        none
// @license      MIT
// @homepageURL  https://klept0.com
// @supportURL   https://klept0.com/contact
// @downloadURL  https://greasyfork.org/en/scripts/453320-simple-sponsor-skipper
// ==/UserScript==

(function () {
    'use strict';

    const categoriesToSkip = [
        "sponsor", "intro", "outro", "interaction", "selfpromo", "music_offtopic"
    ];

    const skipKey = 'sponsorBlockSkipEnabled';
    let skipEnabled = JSON.parse(localStorage.getItem(skipKey) ?? 'true');

    const toggleUI = document.createElement('div');
    toggleUI.textContent = skipEnabled ? '⏭️ ON' : '⏸️ OFF';
    Object.assign(toggleUI.style, {
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        zIndex: '10000',
        background: '#222',
        color: '#0f0',
        padding: '4px 8px',
        borderRadius: '6px',
        fontFamily: 'monospace',
        cursor: 'pointer',
        fontSize: '14px',
        opacity: '0.7'
    });
    toggleUI.addEventListener('click', () => {
        skipEnabled = !skipEnabled;
        localStorage.setItem(skipKey, JSON.stringify(skipEnabled));
        toggleUI.textContent = skipEnabled ? '⏭️ ON' : '⏸️ OFF';
        toggleUI.style.color = skipEnabled ? '#0f0' : '#f00';
    });
    document.body.appendChild(toggleUI);

    document.addEventListener('keydown', e => {
        if (e.shiftKey && e.key.toLowerCase() === 's') {
            skipEnabled = !skipEnabled;
            localStorage.setItem(skipKey, JSON.stringify(skipEnabled));
            toggleUI.textContent = skipEnabled ? '⏭️ ON' : '⏸️ OFF';
            toggleUI.style.color = skipEnabled ? '#0f0' : '#f00';
        }
    });

    const fetchSegments = async videoID => {
        const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoID}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.filter(d => categoriesToSkip.includes(d.category[0]));
    };

    const skipSegments = async () => {
        if (!skipEnabled) return;
        const player = document.querySelector('video');
        if (!player || player.duration === 0) return;

        const videoID = new URLSearchParams(location.search).get('v');
        if (!videoID) return;

        const segments = await fetchSegments(videoID);
        const check = () => {
            if (!skipEnabled) return;
            const currentTime = player.currentTime;
            for (const segment of segments) {
                const [start, end] = segment.segment;
                if (currentTime >= start && currentTime < end) {
                    player.currentTime = end;
                    break;
                }
            }
        };
        setInterval(check, 500);
    };

    const waitForPlayer = () => {
        const player = document.querySelector('video');
        if (player) skipSegments();
        else setTimeout(waitForPlayer, 500);
    };

    const observer = new MutationObserver(() => {
        waitForPlayer();
        skipYTAds();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function skipYTAds() {
        const video = document.querySelector('video');
        const adContainer = document.querySelector('.ad-showing');
        if (video && adContainer) {
            video.currentTime = video.duration;
        }
    }
})();
