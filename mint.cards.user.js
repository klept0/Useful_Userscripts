// ==UserScript==
// @name Mint Hide Promoted Credit Cards
// @namespace mint.cards.user.js
// @author klept0
// @description Hide promoted credit cards on mint.com
// @include https://*.mint.com/*
// @include https://mint.com/*
// @include https://mint.intuit.com/*
// @version 1.0
// @grant none
// @downloadURL
// @updateURL
// ==/UserScript==

document.getElementsByClassName('promotions-personalized-offers-ui-single-offer')[0].remove();
