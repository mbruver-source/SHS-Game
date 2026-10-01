// Töne (WebAudio, synthetisch – keine Tondateien, läuft offline): Hörzeichen-Pfiffe, Glocke des WR,
// Bellen, Außenreize sowie Hecheln und Wind als leise Dauergeräusche. Stumm schalten mit M.
(function (SHS) {
  'use strict';
  const KEY = 'shs-game-ton';
  let ctx = null; let master = null;
  let an = true;
  try { an = localStorage.getItem(KEY) !== '0'; } catch (e) { /* ignorieren */ }
  let rausch = null;
  const dauer = { hecheln: null, wind: null };

  function bereit() {
    if (!an) return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function rauschPuffer() {
    if (rausch) return rausch;
    rausch = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = rausch.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return rausch;
  }

  function ton(freq, start, laenge, typ, lautstaerke, freqEnde) {
    const o = ctx.createOscillator(); const gn = ctx.createGain();
    o.type = typ || 'sine';
    o.frequency.setValueAtTime(freq, start);
    if (freqEnde) o.frequency.exponentialRampToValueAtTime(freqEnde, start + laenge);
    gn.gain.setValueAtTime(0.0001, start);
    gn.gain.exponentialRampToValueAtTime(lautstaerke || 0.3, start + 0.015);
    gn.gain.exponentialRampToValueAtTime(0.0001, start + laenge);
    o.connect(gn); gn.connect(master);
    o.start(start); o.stop(start + laenge + 0.05);
  }

  function rauschStoss(start, laenge, freq, q, lautstaerke) {
    const src = ctx.createBufferSource(); src.buffer = rauschPuffer();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, start);
    gn.gain.exponentialRampToValueAtTime(lautstaerke, start + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, start + laenge);
    src.connect(f); f.connect(gn); gn.connect(master);
    src.start(start, Math.random()); src.stop(start + laenge + 0.05);
  }

  const KLAENGE = {
    such: (t) => { ton(1500, t, 0.09, 'sine', 0.25, 2300); ton(1700, t + 0.12, 0.12, 'sine', 0.25, 2600); },
    hier: (t) => { ton(2200, t, 0.12, 'sine', 0.25, 1500); ton(2200, t + 0.16, 0.12, 'sine', 0.25, 1500); },
    bleib: (t) => { ton(520, t, 0.18, 'triangle', 0.25); },
    arm: (t) => { rauschStoss(t, 0.06, 2500, 1.5, 0.15); },
    erwidert: (t) => { ton(880, t, 0.9, 'sine', 0.28); ton(1320, t, 0.6, 'sine', 0.12); },
    fund: (t) => { ton(660, t, 0.18, 'triangle', 0.25); ton(880, t + 0.16, 0.18, 'triangle', 0.25); ton(1320, t + 0.32, 0.45, 'triangle', 0.25); },
    fehler: (t) => { ton(160, t, 0.35, 'sawtooth', 0.15, 120); },
    bellen: (t) => {
      for (const v of [0, 0.22]) { rauschStoss(t + v, 0.13, 650, 2.5, 0.5); ton(330, t + v, 0.1, 'sawtooth', 0.12, 220); }
    },
    vogel: (t) => { for (let i = 0; i < 4; i++) ton(3200 + Math.random() * 800, t + i * 0.09, 0.06, 'sine', 0.12, 4200); },
    fernbellen: (t) => { rauschStoss(t, 0.12, 500, 2, 0.12); rauschStoss(t + 0.3, 0.12, 500, 2, 0.1); },
    klingel: (t) => { ton(2600, t, 0.25, 'sine', 0.12); ton(2600, t + 0.28, 0.25, 'sine', 0.12); },
    knacken: (t) => { rauschStoss(t, 0.04, 1800, 0.8, 0.3); },
    klatschen: (t) => { for (let i = 0; i < 5; i++) rauschStoss(t + i * 0.11, 0.05, 1500, 0.7, 0.18); },
  };

  function spiele(name) {
    if (!bereit() || !KLAENGE[name]) return;
    KLAENGE[name](ctx.currentTime + 0.01);
  }

  // Dauergeräusch (Hecheln, Wind): Pegel 0..1, wird je Bild angepasst.
  function dauerton(name, pegel) {
    if (!an || !ctx) { if (dauer[name]) dauer[name].gain.gain.value = 0; return; }
    let d = dauer[name];
    if (!d) {
      const src = ctx.createBufferSource(); src.buffer = rauschPuffer(); src.loop = true;
      const f = ctx.createBiquadFilter();
      const gain = ctx.createGain(); gain.gain.value = 0;
      if (name === 'hecheln') {
        f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.2;
        // Hecheln: Lautstärke pulsiert ca. 3-mal pro Sekunde
        const lfo = ctx.createOscillator(); const tiefe = ctx.createGain();
        lfo.frequency.value = 3.2; tiefe.gain.value = 0.5;
        const puls = ctx.createGain(); puls.gain.value = 0.5;
        lfo.connect(tiefe); tiefe.connect(puls.gain); lfo.start();
        src.connect(f); f.connect(puls); puls.connect(gain);
      } else {
        f.type = 'lowpass'; f.frequency.value = 400;
        src.connect(f); f.connect(gain);
      }
      gain.connect(master);
      src.start();
      d = dauer[name] = { gain, src };
    }
    const ziel = name === 'hecheln' ? pegel * 0.12 : pegel * 0.1;
    d.gain.gain.setTargetAtTime(ziel, ctx.currentTime, 0.2);
  }

  function stilleDauer() {
    if (!ctx) return;
    for (const d of Object.values(dauer)) if (d) d.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }

  function setzeAn(wert) {
    an = !!wert;
    try { localStorage.setItem(KEY, an ? '1' : '0'); } catch (e) { /* ignorieren */ }
    if (!an && ctx) stilleDauer();
    if (an) bereit();
  }

  SHS.ton = { spiele, dauerton, stilleDauer, setzeAn, istAn: () => an, bereit };
})(globalThis.SHS = globalThis.SHS || {});
