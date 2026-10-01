// Start des Spiels.
(function (SHS) {
  'use strict';
  function starten() {
    SHS.ui.app.root = document.getElementById('app');
    SHS.ui.start();
  }
  // Auch starten, wenn das Dokument beim Laden der Skripte schon fertig ist (z. B. eingebettet).
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', starten);
  else starten();
})(globalThis.SHS = globalThis.SHS || {});
