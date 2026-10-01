// Rassen: Spielwerte (Abweichung vom Grundwert 30), Körperbau für die Grafik und Farbvarianten.
// Auswahl: die ca. 30 in Deutschland verbreitetsten Rassen (Näherung aus Welpenstatistik/
// Registrierungen, Reihenfolge nicht exakt) plus Mischling.
//
// form:
//   groesse  Körpergröße relativ zum Labrador (1.0 ≈ 75 cm Nase bis Rutenansatz)
//   lang     Rumpflänge (Dackel > 1), breit = Rumpfbreite, beine = Beinlänge (Seitenansicht)
//   fang     Fanglänge (Mops/Bulldogge kurz), ohr: steh | kipp | haenge, ohrGr = Ohrgröße
//   rute     normal | otter | buschig | ringel | kurz, fell: kurz | lang | draht | locken | doppel
//
// Fellvariante: grund, kopf, sattel, maske, kragen, blesse, pfoten, flecken, ohren, rute,
//   rutenspitze, ruecken (Overlay), schattierung, nase – siehe grafik.js.
(function (SHS) {
  'use strict';

  const W = '#f4f1ea'; // Weiß (Fell)
  const S = '#1e1d1c'; // Schwarz (Fell)

  const RASSEN = {
    'Mischling': {
      werte: { nase: 2, impuls: 2, anzeige: 2, differenzierung: 2 },
      form: { groesse: 0.9, ohr: 'kipp', rute: 'normal', fell: 'kurz' },
      farben: {
        braungefleckt: { name: 'Braun gefleckt', grund: '#8c6b4f', flecken: '#5e4532', ohren: '#5e4532', maske: '#6e523c' },
        schwarz: { name: 'Schwarz mit Brustfleck', grund: '#222120', kragen: '#ece8e0', ohren: '#1a1918' },
        weissbraun: { name: 'Weiß-Braun', grund: '#efe9df', kopf: '#9a6a43', flecken: '#9a6a43', ohren: '#86593a' },
        grau: { name: 'Grau gestromt', grund: '#7d7a74', ruecken: 'rgba(40,38,35,0.35)', ohren: '#4b4945', maske: '#4b4945' },
      },
    },
    'Labrador Retriever': {
      werte: { nase: 6, impuls: -6, anzeige: 3, konzentration: 2 },
      form: { groesse: 1.0, breit: 1.08, ohr: 'haenge', rute: 'otter', fell: 'kurz' },
      farben: {
        gelb: { name: 'Gelb', grund: '#e3c27a', ohren: '#cfa862', nase: '#3b2b20', schattierung: '#c9a35d' },
        schwarz: { name: 'Schwarz', grund: '#1f1e1d', ohren: '#171615', nase: '#050505', schattierung: '#3a3836' },
        braun: { name: 'Braun (Schoko)', grund: '#5b3a24', ohren: '#4a2f1d', nase: '#2e1c12', schattierung: '#734b30' },
      },
    },
    'Deutscher Schäferhund': {
      werte: { konzentration: 6, anzeige: 4, nase: 2, selbststaendig: -2, differenzierung: 2 },
      form: { groesse: 1.08, fang: 1.1, ohr: 'steh', rute: 'buschig', fell: 'doppel' },
      farben: {
        schwarzbraun: { name: 'Schwarz-Braun', grund: '#b67d3e', sattel: '#1d1916', maske: '#1d1916', ohren: '#1d1916', rute: '#2a2420' },
        grau: { name: 'Grau (wildfarben)', grund: '#9c8d74', ruecken: 'rgba(30,28,25,0.55)', maske: '#2b2824', ohren: '#2b2824', rute: '#5e564b' },
        schwarz: { name: 'Schwarz', grund: '#1c1b1a', ohren: '#141312', schattierung: '#363432' },
      },
    },
    'Chihuahua': {
      werte: { konzentration: -4, ausdauer: -8, selbststaendig: 2, praezision: 4 },
      form: { groesse: 0.42, fang: 0.6, ohr: 'steh', ohrGr: 1.7, rute: 'ringel', fell: 'kurz', beine: 1.05 },
      farben: {
        creme: { name: 'Creme', grund: '#e8cfa2', ohren: '#dcbc88' },
        schwarzloh: { name: 'Schwarz-Loh', grund: '#2a2420', kopf: '#2a2420', maske: '#b77a3e', pfoten: '#b77a3e', ohren: '#2a2420' },
        schoko: { name: 'Schoko', grund: '#6a4128', ohren: '#5a3622' },
      },
    },
    'Jack Russell Terrier': {
      werte: { nase: 6, ausdauer: 6, impuls: -10, selbststaendig: 8, anzeige: -4 },
      form: { groesse: 0.58, beine: 0.85, ohr: 'kipp', rute: 'normal', fell: 'kurz' },
      farben: {
        weissbraun: { name: 'Weiß mit braunen Abzeichen', grund: W, kopf: '#b27434', ohren: '#9a632c', blesse: W, flecken: '#b27434' },
        dreifarbig: { name: 'Dreifarbig', grund: W, kopf: '#b27434', sattel: S, ohren: S, blesse: W },
      },
    },
    'Französische Bulldogge': {
      werte: { nase: -8, ausdauer: -8, anzeige: 4, impuls: 2 },
      form: { groesse: 0.62, lang: 0.88, breit: 1.3, beine: 0.75, fang: 0.25, ohr: 'steh', ohrGr: 1.3, rute: 'kurz', fell: 'kurz' },
      farben: {
        falb: { name: 'Falb', grund: '#c9a072', maske: '#3a2c22' },
        gestromt: { name: 'Gestromt', grund: '#3b3129', ruecken: 'rgba(120,90,60,0.35)', kragen: '#ece6dc' },
        weissgescheckt: { name: 'Gescheckt', grund: W, flecken: '#2b2724', kopf: W, ohren: '#2b2724' },
      },
    },
    'Golden Retriever': {
      werte: { nase: 5, impuls: -3, anzeige: 3, konzentration: 4 },
      form: { groesse: 1.0, ohr: 'haenge', rute: 'buschig', fell: 'lang' },
      farben: {
        gold: { name: 'Gold', grund: '#d7a253', ohren: '#c38b40' },
        hell: { name: 'Hellgold/Creme', grund: '#ead2a0', ohren: '#dcbf86' },
        dunkel: { name: 'Dunkelgold', grund: '#b8772f', ohren: '#a86a28' },
      },
    },
    'Yorkshire Terrier': {
      werte: { nase: 2, selbststaendig: 4, impuls: -4, ausdauer: -6 },
      form: { groesse: 0.42, beine: 0.85, fang: 0.75, ohr: 'steh', rute: 'normal', fell: 'lang' },
      farben: {
        stahlblau: { name: 'Stahlblau-Loh', grund: '#5d6670', kopf: '#c6904a', pfoten: '#c6904a', ohren: '#c6904a' },
      },
    },
    'Australian Shepherd': {
      werte: { ausdauer: 6, konzentration: 3, impuls: -4, praezision: 2 },
      form: { groesse: 0.95, ohr: 'kipp', rute: 'buschig', fell: 'doppel' },
      farben: {
        bluemerle: { name: 'Blue Merle', grund: '#8e98a5', flecken: '#2a2e35', kragen: W, blesse: W, ohren: '#2a2e35', pfoten: W },
        redmerle: { name: 'Red Merle', grund: '#c49a7a', flecken: '#7a3f22', kragen: W, blesse: W, ohren: '#7a3f22', pfoten: W },
        schwarztri: { name: 'Schwarz-Tricolor', grund: S, kragen: W, blesse: W, maske: '#b27434', pfoten: W },
      },
    },
    'Border Collie': {
      werte: { konzentration: 4, praezision: 5, selbststaendig: -4, ausdauer: 4, differenzierung: 4 },
      form: { groesse: 0.92, ohr: 'kipp', rute: 'buschig', fell: 'doppel' },
      farben: {
        schwarzweiss: { name: 'Schwarz-Weiß', grund: '#1d1d1f', kragen: W, blesse: W, rutenspitze: W, pfoten: W },
        rotweiss: { name: 'Rot-Weiß', grund: '#7a4326', kragen: W, blesse: W, ohren: '#6a3a21', rutenspitze: W, pfoten: W },
        merle: { name: 'Blue Merle', grund: '#8e98a5', flecken: '#2a2e35', kragen: W, blesse: W, ohren: '#2a2e35', rutenspitze: W, pfoten: W },
      },
    },
    'Malteser': {
      werte: { anzeige: 4, ausdauer: -6, konzentration: 2 },
      form: { groesse: 0.45, beine: 0.85, fang: 0.6, ohr: 'haenge', rute: 'ringel', fell: 'lang' },
      farben: { weiss: { name: 'Weiß', grund: '#f7f5f0', nase: '#111' } },
    },
    'Dackel': {
      werte: { nase: 10, impuls: -6, selbststaendig: 8, ausdauer: -4 },
      form: { groesse: 0.68, lang: 1.4, breit: 0.95, beine: 0.42, fang: 1.15, ohr: 'haenge', ohrGr: 1.3, rute: 'normal', fell: 'kurz' },
      farben: {
        rot: { name: 'Rot', grund: '#a8582a', ohren: '#934c24' },
        schwarzrot: { name: 'Schwarz-Rot', grund: '#211d1a', maske: '#a8582a', pfoten: '#a8582a', ohren: '#211d1a' },
        rauhaar: { name: 'Rauhaar (saufarben)', grund: '#7b6e60', ruecken: 'rgba(30,25,20,0.35)', maske: '#5b5046' },
      },
    },
    'Havaneser': {
      werte: { anzeige: 4, konzentration: 3, ausdauer: -4 },
      form: { groesse: 0.5, fang: 0.7, ohr: 'haenge', rute: 'ringel', fell: 'locken' },
      farben: {
        creme: { name: 'Creme', grund: '#eadcc2' },
        schwarzweiss: { name: 'Schwarz-Weiß', grund: W, flecken: S, kopf: S, blesse: W, ohren: S },
        havanna: { name: 'Havanna', grund: '#8a6447' },
      },
    },
    'Mops': {
      werte: { nase: -8, ausdauer: -10, anzeige: 6, impuls: 2 },
      form: { groesse: 0.55, lang: 0.9, breit: 1.25, beine: 0.8, fang: 0.2, ohr: 'kipp', rute: 'ringel', fell: 'kurz' },
      farben: {
        beige: { name: 'Beige mit Maske', grund: '#d9bf92', maske: '#2a2420', ohren: '#2a2420', ruecken: 'rgba(60,45,30,0.18)' },
        schwarz: { name: 'Schwarz', grund: '#1e1d1c' },
      },
    },
    'Beagle': {
      werte: { nase: 12, impuls: -10, konzentration: -6, selbststaendig: 4 },
      form: { groesse: 0.72, beine: 0.9, ohr: 'haenge', ohrGr: 1.4, rute: 'normal', fell: 'kurz' },
      farben: {
        dreifarbig: { name: 'Dreifarbig', grund: '#f3eee4', kopf: '#b9773d', sattel: '#221c18', ohren: '#a86a33', rute: '#221c18', rutenspitze: W, blesse: W },
        zitrone: { name: 'Zitronen-Weiß', grund: '#f5f0e4', kopf: '#e2c47e', sattel: '#e5c983', ohren: '#d8b66b', rute: '#e5c983', rutenspitze: W, blesse: W },
        rotweiss: { name: 'Rot-Weiß', grund: '#f3eee4', kopf: '#b2622c', sattel: '#b2622c', ohren: '#a0582a', rute: '#b2622c', rutenspitze: W, blesse: W },
      },
    },
    'Shih Tzu': {
      werte: { nase: -4, ausdauer: -8, anzeige: 4 },
      form: { groesse: 0.5, beine: 0.75, fang: 0.35, ohr: 'haenge', rute: 'ringel', fell: 'lang' },
      farben: {
        goldweiss: { name: 'Gold-Weiß', grund: W, flecken: '#c99a5a', kopf: '#c99a5a', blesse: W, ohren: '#b98a4a' },
        schwarzweiss: { name: 'Schwarz-Weiß', grund: W, flecken: S, kopf: S, blesse: W, ohren: S },
      },
    },
    'Boxer': {
      werte: { ausdauer: 2, impuls: -6, konzentration: -3, anzeige: 2 },
      form: { groesse: 1.0, breit: 1.1, fang: 0.45, ohr: 'kipp', rute: 'normal', fell: 'kurz' },
      farben: {
        gelb: { name: 'Gelb mit Maske', grund: '#c4874a', maske: S, kragen: W, pfoten: W },
        gestromt: { name: 'Gestromt', grund: '#7a4f2c', ruecken: 'rgba(20,15,10,0.35)', maske: S, kragen: W },
      },
    },
    'Pudel': {
      werte: { konzentration: 6, praezision: 6, differenzierung: 6, nase: 2 },
      form: { groesse: 0.8, fang: 1.1, ohr: 'haenge', ohrGr: 1.3, rute: 'normal', fell: 'locken' },
      farben: {
        schwarz: { name: 'Schwarz', grund: '#1c1c1d' },
        weiss: { name: 'Weiß', grund: '#f3f1ec' },
        apricot: { name: 'Apricot', grund: '#e0ad78' },
        braun: { name: 'Braun', grund: '#5a3a25' },
      },
    },
    'Rottweiler': {
      werte: { konzentration: 4, anzeige: 4, impuls: 2, ausdauer: -2 },
      form: { groesse: 1.08, breit: 1.18, fang: 0.85, ohr: 'kipp', rute: 'normal', fell: 'kurz' },
      farben: { schwarzbraun: { name: 'Schwarz mit Brand', grund: '#1c1a19', maske: '#9a5a2a', pfoten: '#9a5a2a', ohren: '#1c1a19' } },
    },
    'Englischer Cocker Spaniel': {
      werte: { nase: 8, impuls: -4, anzeige: 2, ausdauer: 2 },
      form: { groesse: 0.7, ohr: 'haenge', ohrGr: 1.5, rute: 'normal', fell: 'lang' },
      farben: {
        rot: { name: 'Rot', grund: '#b5652c', ohren: '#a35a27' },
        schwarz: { name: 'Schwarz', grund: '#1e1d1c' },
        blauschimmel: { name: 'Blauschimmel', grund: '#8b9097', flecken: '#2a2c30', kopf: '#2a2c30', ohren: '#2a2c30' },
      },
    },
    'West Highland White Terrier': {
      werte: { nase: 4, selbststaendig: 6, impuls: -6, anzeige: -2 },
      form: { groesse: 0.58, beine: 0.75, fang: 0.8, ohr: 'steh', rute: 'normal', fell: 'draht' },
      farben: { weiss: { name: 'Weiß', grund: '#f4f2ec', nase: '#111' } },
    },
    'Berner Sennenhund': {
      werte: { anzeige: 6, ausdauer: -6, impuls: 4, konzentration: 2 },
      form: { groesse: 1.12, breit: 1.15, ohr: 'haenge', rute: 'buschig', fell: 'lang' },
      farben: { dreifarbig: { name: 'Dreifarbig', grund: '#1d1b1a', kragen: W, blesse: W, maske: '#a85a2a', pfoten: W, rutenspitze: W } },
    },
    'Hovawart': {
      werte: { nase: 3, selbststaendig: 6, konzentration: 2, anzeige: 2 },
      form: { groesse: 1.08, ohr: 'haenge', rute: 'buschig', fell: 'lang' },
      farben: {
        blond: { name: 'Blond', grund: '#d9b27a' },
        schwarzmarken: { name: 'Schwarzmarken', grund: '#1c1a19', maske: '#c58a45', pfoten: '#c58a45' },
        schwarz: { name: 'Schwarz', grund: '#1c1a19' },
      },
    },
    'Malinois': {
      werte: { ausdauer: 8, impuls: -8, selbststaendig: 6, konzentration: 2 },
      form: { groesse: 1.0, breit: 0.92, fang: 1.1, ohr: 'steh', rute: 'normal', fell: 'kurz' },
      farben: {
        falb: { name: 'Falb mit Maske', grund: '#c99250', maske: '#241911', ohren: '#241911', rute: '#c08848', rutenspitze: '#241911', ruecken: 'rgba(36,25,17,0.28)' },
        mahagoni: { name: 'Mahagoni', grund: '#9a5a2c', maske: '#1e140e', ohren: '#1e140e', rute: '#8e5329', rutenspitze: '#1e140e', ruecken: 'rgba(30,20,14,0.35)' },
      },
    },
    'Dobermann': {
      werte: { konzentration: 4, ausdauer: 4, impuls: -4, praezision: 2 },
      form: { groesse: 1.08, breit: 0.88, fang: 1.2, ohr: 'kipp', rute: 'normal', fell: 'kurz' },
      farben: {
        schwarzrot: { name: 'Schwarz mit Rost', grund: '#1b1918', maske: '#9a4f22', pfoten: '#9a4f22' },
        braunrot: { name: 'Braun mit Rost', grund: '#4e2f1f', maske: '#b06a35', pfoten: '#b06a35' },
      },
    },
    'Rhodesian Ridgeback': {
      werte: { nase: 4, selbststaendig: 6, impuls: -2, ausdauer: 2 },
      form: { groesse: 1.1, breit: 0.95, ohr: 'haenge', rute: 'normal', fell: 'kurz' },
      farben: {
        weizen: { name: 'Weizenfarben', grund: '#c58a4f', maske: '#6a4528', ruecken: 'rgba(120,70,30,0.35)' },
        rot: { name: 'Rotweizen', grund: '#a8602f', maske: '#5a3420', ruecken: 'rgba(90,50,25,0.35)' },
      },
    },
    'Zwergspitz': {
      werte: { konzentration: -4, ausdauer: -4, selbststaendig: 4 },
      form: { groesse: 0.42, fang: 0.6, ohr: 'steh', rute: 'ringel', fell: 'doppel' },
      farben: {
        orange: { name: 'Orange', grund: '#e09a4c' },
        weiss: { name: 'Weiß', grund: '#f6f4ef' },
        schwarz: { name: 'Schwarz', grund: '#1d1c1b' },
      },
    },
    'Siberian Husky': {
      werte: { ausdauer: 12, selbststaendig: 8, konzentration: -8, impuls: -6 },
      form: { groesse: 1.0, ohr: 'steh', rute: 'buschig', fell: 'doppel' },
      farben: {
        grauweiss: { name: 'Grau-Weiß', grund: '#8a8d92', kragen: W, blesse: W, maske: W, pfoten: W },
        schwarzweiss: { name: 'Schwarz-Weiß', grund: '#262626', kragen: W, blesse: W, maske: W, pfoten: W },
        rotweiss: { name: 'Rot-Weiß', grund: '#b06a3a', kragen: W, blesse: W, maske: W, pfoten: W },
      },
    },
    'Weimaraner': {
      werte: { nase: 8, ausdauer: 6, impuls: -4 },
      form: { groesse: 1.08, breit: 0.92, fang: 1.15, ohr: 'haenge', rute: 'normal', fell: 'kurz' },
      farben: { silbergrau: { name: 'Silbergrau', grund: '#9a9a96', ohren: '#8a8a86', nase: '#6b5a55' } },
    },
    'Magyar Vizsla': {
      werte: { nase: 8, ausdauer: 6, konzentration: 2 },
      form: { groesse: 1.0, breit: 0.9, fang: 1.1, ohr: 'haenge', rute: 'normal', fell: 'kurz' },
      farben: { semmelgelb: { name: 'Semmelgelb', grund: '#b8763d', ohren: '#a86a35', nase: '#7a4a32' } },
    },
    'Deutsch Kurzhaar': {
      werte: { nase: 10, ausdauer: 8, impuls: -6 },
      form: { groesse: 1.02, breit: 0.95, fang: 1.15, ohr: 'haenge', rute: 'normal', fell: 'kurz' },
      farben: {
        braunschimmel: { name: 'Braunschimmel', grund: '#a99a8c', flecken: '#5a3a26', kopf: '#5a3a26', ohren: '#5a3a26' },
        braun: { name: 'Braun', grund: '#5a3a26' },
        schwarzschimmel: { name: 'Schwarzschimmel', grund: '#8e8e8c', flecken: '#1e1e1e', kopf: '#1e1e1e', ohren: '#1e1e1e' },
      },
    },
  };

  const FORM_STANDARD = { groesse: 1, lang: 1, breit: 1, beine: 1, fang: 1, ohr: 'kipp', ohrGr: 1, rute: 'normal', fell: 'kurz' };

  function rasse(name) {
    return RASSEN[name] || RASSEN.Mischling;
  }

  function form(name) {
    return Object.assign({}, FORM_STANDARD, rasse(name).form);
  }

  function farben(name) {
    return rasse(name).farben;
  }

  // Fellvariante mit Standardwerten (kopf/ohren/rute fallen auf grund zurück).
  function fell(name, variante) {
    const v = farben(name);
    const f = v[variante] || v[Object.keys(v)[0]];
    return Object.assign({ kopf: f.grund, ohren: f.grund, rute: f.grund }, f);
  }

  SHS.rassen = { RASSEN, liste: Object.keys(RASSEN), rasse, form, farben, fell };
})(globalThis.SHS = globalThis.SHS || {});
