// ==UserScript==
// @name        Cleanup/Hide Categories on Mint
// @namespace   Cleanup Mint
// @description Cleans up categories on Mint.com
// @author      klept0
// @include     https://wwws.mint.com/*
// @include     https://mint.intuit.com/*
// @homepage    https://github.com/klept0/useful_userscripts/
// @version     1.2
// @grant       none
// ==/UserScript==
console.log('Greasemonkey Start');
var Greasemonkey = function () {
  console.log('running Greasemonkey Script');
  var toBlock = [
    'div.AdviceView',
    'div.AlertsView',
    'div.CreditScoreView',
    'div.BillRemindersView',
    'div.w2sView',
    'div.TaxesView',
    'div.GoalsView',
    'div.InvestmentsView'
  ];
  function removeElems() {
    if (typeof jQuery === 'undefined') {
      return;
    }
    jqObjs = jQuery(toBlock.join(','));
    jqObjs.each(function(i, x) {
      var idx = toBlock.indexOf('div.'+jQuery(this).attr('class'));
      if (idx == -1) { return; }
      toBlock.splice(idx, 1);
    });
    jqObjs.remove();
    if(toBlock.length == 0) {
      console.log('Done.');
      clearInterval(interval);
    }
  }
  var interval = setInterval(removeElems, 100);
}();
