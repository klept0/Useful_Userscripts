// ==UserScript==
// @name        Amazon Links
// @namespace   https://greasyfork.org/users/115271
// @description Adds a clean direct product link, eBay search by title, and ThePriceGeek search by the first 10 words of the title to Amazon product pages. Hover over the price to see the minimum eBay price to profit $2 by dropshipping with Prime.
// @include     https://www.amazon.*/*
// @include     https://smile.amazon.*/*
// @run-at      document-end
// @version     2.0
// @grant       none
// @homepageURL https://github.com/klept0/Useful_Userscripts
// @downloadURL https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Shopping%20Stuff/Amazon%20Links.user.js
// @updateURL   https://raw.githubusercontent.com/klept0/Useful_Userscripts/master/Shopping%20Stuff/Amazon%20Links.user.js
// ==/UserScript==

/**
 * Adds a row of links below the product title:
 * 1. A direct (clean) link to the product page, without session or tracking
 *    parameters, for sharing: https://www.amazon.[TLD]/dp/[ASIN]
 * 2. The product on eBay: Buy It Now, free shipping, lowest price first,
 *    starting at the Amazon price.
 * 3. The product on ThePriceGeek, searched by the first ten words of the title.
 **/

(function () {
  'use strict';

  const SHOW_LINK_ICONS = true;
  const LINK_STYLE = 'font-weight: bold; font-style: italic; margin-right: 0.75em;';

  // Minimum eBay sale price for ~$2 profit after fees when dropshipping with Prime.
  const ebayMinimumPrice = price => (price * 1.09 * 1.0319 + 3.70).toFixed(2);

  // "1,299.99" uses a decimal point; "1.299,99" and "12,99" (EU stores) a decimal comma.
  function parsePrice(text) {
    const raw = text.replace(/[^\d.,]/g, '');
    const normalized = /,\d{2}$/.test(raw)
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
    return parseFloat(normalized);
  }

  const asin = document.querySelector('input#ASIN')?.value
    || location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1];
  const titleEl = document.getElementById('productTitle');

  if (!asin || !titleEl) return; // not a product page

  const title = titleEl.textContent.replace(/"/g, '').trim();

  // Current layouts use an .a-price element whose screen-reader span is
  // sometimes left empty, so fall back to the visible digits. The priceblock
  // ids are from older layouts still served on some stores.
  const priceEl = document.querySelector([
    '.priceToPay',
    '#corePrice_feature_div .a-price',
    '#corePriceDisplay_desktop_feature_div .a-price',
    '#corePrice_desktop .a-price',
    '#priceblock_ourprice',
    '#priceblock_saleprice',
    '#priceblock_dealprice'
  ].join(', '));
  const priceText = priceEl
    && (priceEl.querySelector('.a-offscreen')?.textContent.trim()
      || priceEl.querySelector('[aria-hidden="true"]')?.textContent
      || priceEl.textContent);
  const price = priceText ? parsePrice(priceText) : NaN;

  if (Number.isFinite(price)) {
    priceEl.title = `Sell on eBay above $${ebayMinimumPrice(price)}`;
  }

  const ebayParams = new URLSearchParams({
    _sacat: '0',
    _nkw: title,
    LH_BIN: '1',
    LH_FS: '1',
    _sop: '15'
  });
  if (Number.isFinite(price)) ebayParams.set('_udlo', String(price));

  const links = [
    {
      text: 'Direct link',
      href: `${location.origin}/dp/${asin}`,
      color: '#e47911',
      icon: `${location.origin}/favicon.ico`,
      tooltip: 'Direct and clean product link.'
    },
    {
      text: 'eBay',
      href: `https://www.ebay.com/sch/i.html?${ebayParams}`,
      color: '#039',
      icon: 'https://i.imgur.com/1TYirv3.png'
    },
    {
      text: 'ThePriceGeek',
      href: `https://www.thepricegeek.com/results/${encodeURIComponent(title.split(/\s+/).slice(0, 10).join(' '))}/?country=us`,
      color: '#106bcc'
    }
  ];

  const bar = document.createElement('div');
  bar.style.margin = '4px 0';

  for (const { text, href, color, icon, tooltip } of links) {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.cssText = `color: ${color}; ${LINK_STYLE}`;
    if (tooltip) a.title = tooltip;

    if (SHOW_LINK_ICONS && icon) {
      const img = document.createElement('img');
      img.src = icon;
      img.width = 16;
      img.height = 16;
      img.style.cssText = 'vertical-align: middle; margin-right: 3px;';
      a.append(img);
    }

    a.append(text);
    bar.append(a);
  }

  (document.getElementById('titleSection') || titleEl).after(bar);
})();
