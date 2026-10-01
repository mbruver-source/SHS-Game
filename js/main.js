// Start des Spiels.
(function (SHS) {
  'use strict';
  window.addEventListener('DOMContentLoaded', () => {
    SHS.ui.app.root = document.getElementById('app');
    SHS.ui.start();
  });
})(globalThis.SHS = globalThis.SHS || {});
