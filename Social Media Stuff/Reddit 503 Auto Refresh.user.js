// ==UserScript==
// @name        Reddit 503 Auto Refresh
// @namespace   flarn2006
// @include     http://www.reddit.com/*
// @include     http://reddit.com/*
// @include     https://www.reddit.com/*
// @include     https://reddit.com/*
// @version     2
// @grant       none
// ==/UserScript==

var headers = document.getElementsByTagName("h2");

if (headers.length >= 1) {
  if (document.title == "Ow! -- reddit.com") {
    if (headers[0].innerHTML == "all of our servers are busy right now" || headers[0].innerHTML == "we took too long to make this page for you") {
      setTimeout(refreshNow, 2000);
    }
  }
}

function refreshNow()
{
  location.reload();
}