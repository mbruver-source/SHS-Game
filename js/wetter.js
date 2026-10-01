// Wetter einer Suchlage: Temperatur, Niederschlag und Wind (mit Drehen während der Suche).
// Wirkt auf die Geruchsausbreitung und die Ermüdung des Hundes. DOM-frei.
(function (SHS) {
  'use strict';

  // Mittlere Tagestemperatur (°C) je Monat in Deutschland (gerundet).
  const MONATS_TEMPERATUR = [2, 3, 7, 11, 15, 18, 20, 20, 16, 11, 6, 3];
  const REGEN_WAHRSCHEINLICHKEIT = [0.35, 0.3, 0.3, 0.3, 0.32, 0.33, 0.33, 0.32, 0.28, 0.3, 0.35, 0.38];

  // ANNAHME (Spielbalance): Einfluss des Wetters auf den Geruch.
  //  - Kälte: weniger Verdunstung -> schwächere Quelle
  //  - Hitze: Thermik zerstreut den Geruch -> schwächer und kürzere Fahne, Hund ermüdet schneller
  //  - Nieselregen/feucht: Geruch bleibt am Boden -> etwas stärker und kompakter
  //  - Starkregen: wäscht aus -> deutlich schwächer
  function erzeuge(seed, monat) {
    const r = SHS.rng(((seed >>> 0) ^ 0x2545f491) >>> 0);
    const m = monat && monat >= 1 && monat <= 12 ? monat : r.int(1, 12);
    const temp = Math.round(MONATS_TEMPERATUR[m - 1] + r.gauss() * 4);
    let regen = 0;
    if (r() < REGEN_WAHRSCHEINLICHKEIT[m - 1]) regen = r() < 0.7 ? 1 : 2;
    const bewoelkt = regen > 0 || r() < 0.45;
    const wind = Math.max(0.1, Math.min(0.9, r.range(0.12, 0.75) + (regen === 2 ? 0.1 : 0)));
    const drift = r.range(0.1, 0.6) * (0.5 + wind); // wie stark der Wind während der Suche dreht (rad)

    let staerke = 1; let reichweite = 1;
    if (temp < 5) staerke *= 0.85;
    if (temp > 25) { staerke *= 0.85 - (temp - 25) * 0.02; reichweite *= 0.85; }
    if (regen === 1) { staerke *= 1.1; reichweite *= 0.9; }
    if (regen === 2) staerke *= 0.8;
    const schnee = regen > 0 && temp <= 0;
    if (schnee) staerke = Math.min(staerke, 0.8) * (regen === 2 ? 0.9 : 1); // Schnee deckt Geruch ab
    const ermuedung = 1 + Math.max(0, temp - 20) * 0.06;

    const symbol = schnee ? '❄' : regen === 2 ? '🌧' : regen === 1 ? '🌦' : temp > 25 ? '☀' : bewoelkt ? '☁' : '🌤';
    const regenText = schnee ? (regen === 2 ? 'Schneefall' : 'leichter Schneefall') : regen === 2 ? 'Regen' : regen === 1 ? 'Nieselregen' : bewoelkt ? 'bewölkt' : 'sonnig';
    return {
      monat: m, temp, regen, schnee, bewoelkt, wind, drift,
      staerkeFaktor: Math.max(0.5, staerke), reichweiteFaktor: reichweite, ermuedung,
      symbol, text: `${regenText}, ${temp} °C`,
      hinweis: (schnee ? 'Schnee deckt den Geruch teilweise ab. ' : '') + hinweisText(temp, schnee ? 0 : regen, wind, drift),
    };
  }

  function hinweisText(temp, regen, wind, drift) {
    const teile = [];
    if (temp > 25) teile.push('Hitze: Der Geruch steigt auf und verfliegt, der Hund ermüdet schneller.');
    else if (temp < 5) teile.push('Kälte: Wenig Verdunstung, der Geruch ist schwach.');
    if (regen === 1) teile.push('Feuchte Luft: Der Geruch bleibt gut am Boden.');
    if (regen === 2) teile.push('Regen wäscht den Geruch teilweise aus.');
    if (drift > 0.45) teile.push('Der Wind dreht immer wieder.');
    else if (wind > 0.6) teile.push('Frischer Wind trägt den Geruch weit.');
    return teile.join(' ');
  }

  // Wind zum Zeitpunkt t: dreht langsam um die Grundrichtung, Böen verändern die Stärke.
  function windZu(wetter, basisRichtung, t) {
    const richtung = basisRichtung + Math.sin(t * 0.05) * wetter.drift * 57.3 + Math.sin(t * 0.17 + 1.3) * wetter.drift * 20;
    const staerke = Math.max(0.05, Math.min(1, wetter.wind * (1 + Math.sin(t * 0.41) * 0.18 + Math.sin(t * 1.3) * 0.08)));
    return { richtung, staerke };
  }

  SHS.wetter = { erzeuge, windZu, MONATS_TEMPERATUR };
})(globalThis.SHS = globalThis.SHS || {});
