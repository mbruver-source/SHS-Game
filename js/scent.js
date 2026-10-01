// Geruchsmodell: jede Quelle bildet direkt um sich einen "Geruchspool" und mit dem Wind
// eine Fahne, die sich verbreitert und abschwächt. Leichte zeitliche Turbulenz.
(function (SHS) {
  'use strict';

  // Konzentration (0..~1) einer Quelle am Punkt (x, y) zur Zeit t.
  function konzentration(quelle, x, y, wind, t) {
    const rx = x - quelle.x;
    const ry = y - quelle.y;
    const dist = Math.hypot(rx, ry);
    const ws = wind.staerke;
    const reichweite = (quelle.reichweite || 1) * (1.6 + 4.5 * ws);

    const pool = Math.exp(-(dist * dist) / (2 * 0.35 * 0.35));
    const diffus = Math.exp(-dist / (0.9 * (quelle.reichweite || 1)));

    let fahne = 0;
    const par = rx * wind.x + ry * wind.y; // Abstand in Windrichtung (lee)
    if (par > 0) {
      const perp = Math.abs(rx * wind.y - ry * wind.x);
      const sigma = 0.25 + 0.35 * par * (1.1 - 0.5 * ws);
      fahne = Math.exp(-(perp * perp) / (2 * sigma * sigma)) * Math.exp(-par / reichweite);
    }

    const turbulenz = 0.8 + 0.2 * Math.sin(t * 1.7 + x * 2.3 + y * 1.9);
    const wert = Math.max(pool, ws * fahne + (1 - ws) * diffus * 0.8);
    return quelle.staerke * wert * turbulenz;
  }

  // Liefert die Konzentration aller Quellen an einem Punkt, aufgeschlüsselt.
  function messen(quellen, x, y, wind, t) {
    return quellen.map((q) => konzentration(q, x, y, wind, t));
  }

  // Wind aus Richtung (Grad, 0 = Wind weht nach +x) und Stärke 0..1.
  function wind(richtungGrad, staerke) {
    const r = (richtungGrad * Math.PI) / 180;
    return { x: Math.cos(r), y: Math.sin(r), staerke, richtung: richtungGrad };
  }

  SHS.scent = { konzentration, messen, wind };
})(globalThis.SHS = globalThis.SHS || {});
