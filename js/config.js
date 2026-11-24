// ============================================================
// js/config.js — CONFIGURAZIONE DELL'APP (SPEC 6, 10.2)
// ============================================================
// A cosa serve:
//   Raccoglie TUTTO ciò che può cambiare senza toccare la logica: sorgente
//   dei dati, percorsi, versione, colori, soglie degli avvisi, testi e
//   composizione delle pagine.
//
// Usato da: tutti gli altri file JavaScript (e dal service worker per la versione).
//
// Costrutti JavaScript usati qui:
//   const NOME = valore;   costante: il nome non può essere riassegnato
//   { chiave: valore }     "oggetto": insieme di coppie nome -> valore
//                          (come una struct in C# o un dizionario)
//   [ a, b, c ]            "array": elenco ordinato
//   window.OT_CONFIG       variabile globale, visibile da tutti i file
//                          caricati nella pagina
// ============================================================

window.OT_CONFIG = {

  // ------------------------------------------------------------
  // VERSIONE (SPEC 6.2)
  // ------------------------------------------------------------
  // Da incrementare a ogni rilascio, INSIEME a VERSION in service-worker.js:
  // è il cambio di quel file che fa scoprire all'app la nuova versione.
  version: "0.1.0",

  // Se true, la nuova versione si installa da sola alla successiva apertura;
  // se false (default) compare l'avviso "Nuova versione disponibile — Aggiorna".
  autoUpdate: false,

  // Sul PC in locale (localhost) il service worker è disattivato: altrimenti
  // il browser mostrerebbe la copia salvata dell'interfaccia e non le
  // modifiche appena fatte ai file. Su GitHub Pages è sempre attivo.
  serviceWorkerOnLocalhost: false,

  // ------------------------------------------------------------
  // SORGENTE DEI DATI (SPEC 6)
  // ------------------------------------------------------------
  // "local"  = cartella output/ di orangetide-core sullo stesso PC, servita
  //            dal server web locale (vedi README);
  // "github" = API di GitHub con token (repository privato);
  // "auto"   = "local" se l'app è aperta da localhost, altrimenti "github"
  //            (così la stessa versione funziona sul PC e su GitHub Pages).
  dataSource: "auto",

  local: {
    // Percorso della cartella output/ relativo alla pagina dell'app:
    // il server locale parte dalla cartella OrangeTide, che contiene
    // sia orangetide-app sia orangetide-core.
    basePath: "../orangetide-core/output/",
  },

  github: {
    apiBase: "https://api.github.com",
    owner: "devsCtrlAltCanc",
    repo: "orangeTide-core",
    branch: "main",
    path: "output",
  },

  // Nomi dei 4 file JSON prodotti dal core (SPEC 9.1).
  files: {
    latest: "latest.json",
    history: "history.json",
    backtest: "backtest.json",
    meta: "meta.json",
  },

  // Versione dello schema dei JSON che l'app sa leggere (core: export.schema_version).
  schemaVersion: 1,

  // ------------------------------------------------------------
  // AVVISI (SPEC 11.6)
  // ------------------------------------------------------------
  alerts: {
    tokenExpiryWarningDays: 15,   // avviso "token in scadenza" N giorni prima
    staleDataHours: 48,           // dati "vecchi" se l'ultimo aggiornamento supera N ore
  },

  // ------------------------------------------------------------
  // PAGINE E WIDGET
  // ------------------------------------------------------------
  // Ogni pagina è un elenco di WIDGET (riquadri indipendenti). Per spostare
  // un elemento da una pagina all'altra basta spostarne il nome qui:
  // il widget funziona uguale ovunque venga messo.
  //
  //   id:      nome della pagina nell'indirizzo (es. #dashboard)
  //   title:   titolo mostrato
  //   icon:    icona Bootstrap Icons (https://icons.getbootstrap.com)
  //   nav:     "main" = sempre nella barra; "more" = nel menu "Altro" su
  //            schermi piccoli (sui PC sono tutte visibili)
  //   widgets: elenco dei widget, dall'alto in basso. Un widget non ancora
  //            scritto compare come riquadro "in arrivo".
  pages: [
    {
      id: "dashboard", title: "Dashboard", icon: "bi-grid-1x2", nav: "main",
      widgets: ["priceHero", "riskGauge", "fearGreed", "combinedReading", "horizonCards", "cycleSummary"],
    },
    {
      id: "storico", title: "Storico", icon: "bi-clock-history", nav: "main",
      widgets: ["priceChart", "drawdownChart", "backtestTables"],
    },
    {
      id: "cicli", title: "Cicli", icon: "bi-arrow-repeat", nav: "main",
      widgets: ["halvingRoiChart", "peakRoiChart"],
    },
    {
      id: "grafici", title: "Grafici", icon: "bi-bar-chart-line", nav: "main",
      widgets: ["riskChart", "fearGreedChart", "mvrvChart", "cvddChart", "etfFlowsChart", "fundingChart"],
    },
    {
      id: "info", title: "Info", icon: "bi-info-circle", nav: "more",
      widgets: ["sourcesStatus", "methodInfo", "credits", "disclaimer"],
    },
    {
      id: "impostazioni", title: "Impostazioni", icon: "bi-gear", nav: "more",
      widgets: ["tokenSettings", "preferences", "tokenGuide"],
    },
  ],

  // Pagina aperta all'avvio.
  homePage: "dashboard",

  // ------------------------------------------------------------
  // COLORI (anche in css/style.css per l'interfaccia; qui quelli usati
  // dal JavaScript, es. nei grafici)
  // ------------------------------------------------------------
  colors: {
    brand: "#F7841A",     // arancione OrangeTide
    brandLight: "#FBB062", // arancione chiaro (sfumature)
    buy: "#22A06B",       // verde
    hold: "#8A8F98",      // grigio
    sell: "#E5484D",      // rosso
    na: "#C9CDD3",        // n/d
    // Fasce dell'indice di rischio 0–1 (tachimetro): [fino a, colore].
    // Stesse fasce delle etichette del core (risk_index.labels).
    riskBands: [
      [0.2, "#22A06B"],   // Molto basso
      [0.4, "#8CC152"],   // Basso
      [0.6, "#F2C14E"],   // Medio
      [0.8, "#F7841A"],   // Alto
      [1.0, "#E5484D"],   // Molto alto
    ],
  },

  // Ordine in cui mostrare gli orizzonti (il lungo è il segnale guida).
  horizonOrder: ["long", "medium", "short"],

  // Fasce del Fear & Greed Index (stesse di alternative.me): fino a "to"
  // (escluso), etichetta e colore.
  fearGreedBands: [
    { to: 25, label: "Paura estrema", color: "#E5484D" },
    { to: 47, label: "Paura", color: "#F7841A" },
    { to: 55, label: "Neutrale", color: "#F2C14E" },
    { to: 76, label: "Avidità", color: "#8CC152" },
    { to: 101, label: "Avidità estrema", color: "#22A06B" },
  ],

  // Grafici della pagina Grafici.
  charts: {
    sparklineDays: 30,             // giorni delle barre sotto rischio e Fear & Greed (dashboard)
    // Periodi selezionabili nel grafico del prezzo in dashboard (days: null = tutto).
    priceRanges: [
      { label: "3M", days: 90 },
      { label: "1A", days: 365 },
      { label: "4A", days: 1460 },
      { label: "Tutto", days: null },
    ],
    priceRangeDefault: "1A",
    // Zone di riferimento dell'MVRV Z-Score (le stesse usate da molti siti di
    // analisi): sotto 0 = sottovalutato, sopra 7 = sopravvalutato.
    mvrvZones: { low: 0, high: 7 },
    defaultZoomYears: 4,           // periodo mostrato all'apertura (poi si zooma liberamente)
    // Spazio sopra e sotto il prezzo nella scala adattata allo zoom
    // (0.15 = 15% oltre il massimo e sotto il minimo visibili).
    priceAxisMargin: 0.15,
  },

  // ------------------------------------------------------------
  // PAGINA STORICO (SPEC 11.2)
  // ------------------------------------------------------------
  history: {
    defaultHorizon: "long",        // orizzonte che colora il prezzo all'apertura
    defaultFrequency: "daily",     // "daily" = un punto al giorno; "weekly" = segnale di fine settimana
    // Giorno di fine settimana per la vista settimanale (giorno UTC):
    // 0 = domenica, 1 = lunedì, ... 6 = sabato.
    weekEndDay: 0,
  },

  // Nomi brevi degli indicatori, per il riquadro che segue il cursore
  // (chiave = id dell'indicatore nei JSON del core).
  indicatorShortNames: {
    B1_etf_flow_5d: "ETF 5g",
    B2_funding_7d: "Funding",
    B3_fear_greed: "F&G",
    B4_rsi_14: "RSI",
    M1_etf_flow_30d: "ETF 30g",
    M2_price_vs_ma50: "MA50",
    M3_stablecoin_30d: "Stablecoin",
    M4_dollar_trend: "Dollaro",
    L1_mvrv_zscore: "MVRV Z",
    L2_mayer_multiple: "Mayer",
    L3_ma200w_distance: "MA 200 sett.",
    L4_days_since_halving: "Halving",
  },

  // Tabelle del backtest (SPEC 5.2, 5.4, 16.1).
  backtest: {
    defaultPeriod: "validation",   // periodo mostrato all'apertura
    defaultView: "horizon",        // "horizon", "indicator" o "risk"
    // Sotto questo numero di episodi indipendenti una riga è mostrata
    // attenuata: la statistica si basa su troppi pochi casi.
    fewEpisodes: 5,
  },

  // ------------------------------------------------------------
  // FORMATI
  // ------------------------------------------------------------
  locale: "it-IT",        // numeri e date all'italiana (1.234,5 · 23/11/2026)

  // ------------------------------------------------------------
  // TESTI
  // ------------------------------------------------------------
  texts: {
    appName: "OrangeTide",
    loading: "Caricamento…",
    widgetComingSoon: "In arrivo",
    widgetError: "Errore nel riquadro",
    dataUnavailable: "Dati non disponibili",
    fromCache: "Dati dalla memoria del dispositivo (non aggiornati)",
    more: "Altro",
    themeAuto: "Automatico",
    themeLight: "Chiaro",
    themeDark: "Scuro",

    dataAsOf: "Dati al",
    updatedAt: "aggiornati",
    lastUpdate: "Ultimo aggiornamento dei dati",
    showDetails: "Dettaglio indicatori",
    convenience: "Convenienza",
    agreement: "Accordo",
    combinedLong: "Lungo",
    combinedShort: "Breve",

    // Testi del contesto ciclico (widget cycleSummary).
    cycle: {
      drawdown: "Dal massimo storico",
      athOn: "massimo",
      epoch: "Epoca di halving",
      epochDay: "giorno",
      sinceHalving: "dall'halving",
      peak: "Dal massimo di ciclo",
      peakDays: "giorni",
      provisional: "provvisorio",
    },

    // Nomi degli orizzonti nel report (chiave = "horizon" nelle righe del report).
    horizonNames: { short: "Breve", medium: "Medio", long: "Lungo" },

    // Periodo di validità di ogni orizzonte (SPEC 2.1).
    horizonPeriods: {
      short: "da qualche giorno a 1–2 settimane",
      medium: "da qualche settimana a 2–3 mesi",
      long: "da qualche mese a 1–2 anni",
    },
    // Frase semplice per ogni segnale.
    signalSentences: {
      BUY: "Contesto favorevole all'acquisto",
      HOLD: "Nessuna indicazione netta",
      SELL: "Contesto sfavorevole all'acquisto",
      "n/d": "Dati insufficienti",
    },
    // Lettura combinata: titoli delle tre parti.
    readingMarket: "Mercato",
    readingBuy: "Se compri",
    readingHold: "Se possiedi BTC",
    fearGreedTitle: "Fear & Greed",
    lastDays: "ultimi giorni",

    // Token GitHub (auth.js, settings.js) e avvisi globali (app.js).
    token: {
      missing: "Token GitHub non inserito: aggiungilo in Impostazioni",
      verifyOk: "Token valido: dati letti correttamente",
      networkError: "Rete non disponibile o GitHub non raggiungibile",
      rateLimited: "Troppe richieste a GitHub: riprova tra qualche minuto",
      error401: "Token non valido o scaduto",
      error403: "Token senza permesso di lettura su orangetide-core",
      error404: "Dati non trovati: il token non ha accesso al repository orangetide-core, o il file manca",
      errorOther: "Errore di GitHub",
      saved: "Token salvato su questo dispositivo",
      removed: "Token rimosso da questo dispositivo",
      notNeededLocal: "Stai usando l'app sul PC in locale: i dati si leggono dalla cartella output/ e il token non serve. Serve sull'app pubblicata (GitHub Pages), su ogni dispositivo.",
      stateNames: {
        missing: "Non inserito", rejected: "Rifiutato da GitHub", expired: "Scaduto",
        expiring: "In scadenza", ok: "Valido",
      },
      createUrl: "https://github.com/settings/personal-access-tokens/new",
      listUrl: "https://github.com/settings/personal-access-tokens",
    },
    banners: {
      tokenMissing: "Per leggere i dati serve il token GitHub.",
      tokenRejected: "Token scaduto o non valido: aggiornalo in Impostazioni.",
      tokenExpired: "Il token è scaduto: rigeneralo su GitHub e aggiornalo in Impostazioni.",
      tokenExpiring: "Il token scade il {date}: rigeneralo su GitHub e aggiornalo in Impostazioni.",
      goToSettings: "Vai a Impostazioni",
      staleData: "Dati vecchi: ultimo aggiornamento {date}.",
      newVersion: "Nuova versione dell'app disponibile.",
      update: "Aggiorna",
    },

    // Pagina Storico (storico.js).
    storico: {
      daily: "Giornaliero",
      weekly: "Settimanale",
      price: "Prezzo",
      convenienceShort: "conv.",
      agreementShort: "accordo",
      chartNote: "Il colore del prezzo segue il segnale dell'orizzonte scelto: verde = BUY, grigio = HOLD, rosso = SELL. Le tre strisce sotto mostrano i segnali di tutti gli orizzonti. Tocca o passa sul grafico per il dettaglio del giorno; zoom con due dita, con la rotellina o con la barra in basso.",
      weeklyNote: "Vista settimanale: un punto per settimana, con il segnale di fine settimana.",
      drawdownNote: "Quanto il prezzo è sotto il massimo storico raggiunto fino a quel giorno (SPEC 16.3). 0% = nuovo massimo.",
    },

    // Tabelle del backtest (storico.js, widget backtestTables).
    backtest: {
      periods: { calibration: "Taratura", validation: "Verifica", full: "Tutto" },
      views: { horizon: "Orizzonti", indicator: "Indicatori", risk: "Indice di rischio" },
      // Testo del periodo: "dal 01/01/2023 a oggi", "dall'inizio dei dati al 31/12/2022".
      rangeFrom: "dal {date}",
      rangeFromStart: "dall'inizio dei dati",
      rangeTo: "al {date}",
      rangeToToday: "a oggi",
      forwardTitle: "Rendimenti a {days} giorni",
      columns: {
        group: "Segnale", level: "Livello", band: "Fascia",
        days: "Giorni", episodes: "episodi",
        geo: "Media geom.", median: "Mediana", mean: "Media",
        drop: "Ribasso max", hit: "Direzione giusta",
      },
      allDays: "Tutti i giorni",
      // Criteri di SPEC 5.2 (chiavi = campi di backtest.json "criteria").
      criteria: {
        order: "BUY > HOLD > SELL",
        buy_vs_all: "BUY batte il riferimento",
        buy_hit: "BUY nella direzione giusta > 50%",
        sell_hit: "SELL nella direzione giusta > 50%",
      },
      indicatorLabel: "Indicatore",
      notes: [
        "Media geom. = rendimento medio composto, la metrica usata per giudicare l'ordine BUY > HOLD > SELL (SPEC 5.2). Ribasso max = mediana del calo massimo prima della fine della finestra (SPEC 16.2).",
        "Direzione giusta = % di giorni con rendimento > 0 dopo un BUY (o livello positivo) e < 0 dopo un SELL (o livello negativo).",
        "I giorni consecutivi condividono quasi lo stesso futuro: conta il numero di episodi, non quello dei giorni. Le righe attenuate hanno meno di {n} episodi.",
      ],
      riskNote: "Fasce dell'indice di rischio (SPEC 16.1): se l'indice funziona, le fasce basse rendono più di quelle alte.",
    },

    // Nomi leggibili delle fonti (chiave = "source" in meta.json).
    sourceNames: {
      price: "Prezzo (Bitstamp)",
      sentiment: "Fear & Greed (alternative.me)",
      etf_flows: "Flussi ETF (Farside)",
      onchain: "On-chain (bitview.space)",
      derivatives: "Funding (Deribit)",
      macro: "Dollaro USA (FRED)",
      stablecoins: "Stablecoin (Coin Metrics)",
    },
    // Stati delle fonti (meta.json): testo e colore del badge
    // (buy = verde, brand = arancione, sell = rosso; vedi css/style.css).
    sourceStatus: {
      ok: { text: "ok", badge: "buy" },
      stale: { text: "dati vecchi", badge: "brand" },
      error: { text: "errore", badge: "sell" },
    },
  },
};
