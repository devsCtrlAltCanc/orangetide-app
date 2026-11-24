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
  version: "0.4.0",

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
      widgets: ["priceChart", "drawdownChart"],
    },
    {
      id: "backtest", title: "Backtest", icon: "bi-clipboard-data", nav: "more",
      widgets: ["backtestTables"],
    },
    {
      id: "cicli", title: "Cicli", icon: "bi-arrow-repeat", nav: "main",
      widgets: ["halvingRoiChart", "peakRoiChart", "cycleTable"],
    },
    {
      id: "grafici", title: "Grafici", icon: "bi-bar-chart-line", nav: "main",
      widgets: ["riskChart", "fearGreedChart", "mvrvChart", "cvddChart", "etfFlowsChart", "fundingChart"],
    },
    {
      id: "info", title: "Info", icon: "bi-info-circle", nav: "more",
      widgets: ["sourcesStatus", "appInfo", "methodInfo", "credits"],
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

  // Pagina Cicli (SPEC 16.4).
  cycles: {
    defaultScale: "log",           // "log" o "linear": scala verticale all'apertura
    // Colori delle epoche passate, dalla più vecchia alla più recente;
    // l'epoca in corso usa sempre colors.brand (arancione).
    pastColors: ["#9B6BDF", "#5B8DEF", "#2BB3A3", "#8A8F98"],
    lineWidth: 1.6,                // spessore delle curve passate
    currentLineWidth: 2.8,         // spessore della curva in corso
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

    // Pagina Cicli (cicli.js).
    cicli: {
      scaleLog: "Logaritmica",
      scaleLinear: "Lineare",
      daysFromHalving: "giorni dall'halving",
      daysFromPeak: "giorni dal massimo",
      day: "Giorno",
      epoch: "Epoca",          // "Epoca 2020"
      cycle: "Ciclo",          // "Ciclo dic 2017"
      today: "oggi",
      peakMarker: "massimo",
      bottomMarker: "minimo",
      halvingNote: "Rendimento dal giorno dell'halving, per ogni epoca (l'arancione è quella in corso). Il punto segna il massimo di ciclo: la chiusura più alta nei primi 730 giorni dall'halving (SPEC 16.4). In scala logaritmica 2× = +100%, 4× = +300%.",
      peakNote: "Rendimento dal massimo di ciclo fino al massimo successivo. Il punto segna il minimo raggiunto dopo il massimo.",
      table: {
        epoch: "Epoca",
        peak: "Massimo di ciclo",
        peakRoi: "Dall'halving",
        bottom: "Minimo successivo",
        bottomDrop: "Calo",
        dayAfterHalving: "giorno {n}",
        daysAfterPeak: "{n} giorni dopo",
        soFar: "finora",
        ongoing: "in corso",
      },
    },

    // Tabelle del backtest (backtest.js, widget backtestTables).
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

    // ------------------------------------------------------------
    // PAGINA INFO (info.js, SPEC 11.4)
    // ------------------------------------------------------------
    info: {
      lastUpdate: "Ultimo aggiornamento",
      appVersion: "Versione dell'app",
      schema: "Versione dei dati",
      schemaMismatch: "l'app si aspetta la {expected}: aggiornare l'app o il core",
      dataSource: "Sorgente dei dati",
      dataSourceNames: { local: "cartella locale (PC)", github: "GitHub (repository privato)" },
      dataDate: "Dati al",
      overall: "Stato complessivo",
    },

    // Spiegazione del metodo (SPEC 4). ATTENZIONE: i numeri (soglie e
    // finestre) sono quelli di config/config.yaml del core: se lì cambiano,
    // vanno aggiornati anche qui (i JSON non li contengono).
    method: {
      intro: "OrangeTide sintetizza il contesto di mercato di Bitcoin su tre orizzonti e dice per ciascuno se il momento è favorevole all'acquisto (BUY), neutro (HOLD) o sfavorevole (SELL). Tutta la logica è a regole fisse, trasparente e verificata sullo storico (backtest): nessuna intelligenza artificiale e nessuna previsione.",
      horizonsTitle: "Orizzonti",
      roleNote: "Guida = confermato dal backtest anche nel periodo di verifica; informativo = da confermare su dati futuri.",
      stepsTitle: "Come si calcola il segnale",
      steps: [
        { title: "Percentile", text: "Per ogni indicatore si guarda dove si trova il valore di oggi rispetto agli ultimi anni: 1 anno per il breve, 2 per il medio, 4 per il lungo. Percentile 90 = più alto del 90% dei valori del periodo. Il percentile si adatta ai cicli che cambiano, a differenza di una soglia fissa." },
        { title: "Livello da −2 a +2", text: "Il percentile diventa un livello su cinque gradini. Per un indicatore contrarian (gli eccessi tendono a invertirsi) valori bassi sono favorevoli: percentile sotto 10 → +2, 10–30 → +1, 30–70 → 0, 70–90 → −1, sopra 90 → −2. Per un indicatore momentum (il trend tende a continuare) è il contrario: sopra 90 → +2, sotto 10 → −2. Mayer Multiple e giorni dall'halving usano invece fasce fisse." },
        { title: "Convenienza (−100…+100)", text: "Media dei livelli degli indicatori disponibili, divisa per 2 e moltiplicata per 100. Esempio: livelli +2, +1, +1, 0 → media 1 → +50." },
        { title: "Accordo (0–100%)", text: "Tra gli indicatori con un'opinione netta (livello diverso da 0), la percentuale che va nella stessa direzione della convenienza. È la confidenza del segnale." },
        { title: "Segnale", text: "BUY se convenienza ≥ +40 e accordo ≥ 60%; SELL se convenienza ≤ −40 e accordo ≥ 60%; altrimenti HOLD. Con meno di 3 indicatori disponibili il segnale è n/d." },
      ],
      riskTitle: "Indice di rischio (0–1)",
      riskText: "Versione continua della convenienza del lungo: 0 = zone storiche di accumulo, 1 = euforia. Si calcola dai percentili (o dalle fasce fisse) degli indicatori del lungo.",
      backtestTitle: "Verifica sullo storico",
      backtestText: "Ogni giorno usa solo i dati pubblicati fino a quel giorno, con il ritardo reale di pubblicazione di ogni fonte. Le soglie si regolano sui dati fino al 2022 (taratura); dal 2023 i dati servono solo a confermare (verifica). Lo stesso codice calcola i segnali di oggi e quelli del backtest.",
      indicatorsTitle: "Indicatori",
      typeNames: {
        momentum: "Momentum", contrarian: "Contrarian",
        inverted_momentum: "Momentum invertito", fixed: "Fasce fisse",
      },
      // Cosa misura ogni indicatore (chiave = id nei JSON del core).
      descriptions: {
        B1_etf_flow_5d: "Entrate/uscite nette degli ETF spot USA negli ultimi 5 giorni di borsa.",
        B2_funding_7d: "Costo medio della leva sui perpetual negli ultimi 7 giorni: alto = troppo ottimismo.",
        B3_fear_greed: "Sentiment del mercato (alternative.me), da paura estrema ad avidità estrema.",
        B4_rsi_14: "Forza del movimento recente del prezzo (RSI a 14 giorni).",
        M1_etf_flow_30d: "Entrate/uscite nette degli ETF negli ultimi 30 giorni di borsa.",
        M2_price_vs_ma50: "Distanza del prezzo dalla media degli ultimi 50 giorni.",
        M3_stablecoin_30d: "Variazione a 30 giorni dell'offerta di USDT + USDC: liquidità pronta a entrare nel mercato crypto.",
        M4_dollar_trend: "Variazione a 20 giorni dell'indice del dollaro: un dollaro in salita frena Bitcoin.",
        L1_mvrv_zscore: "Quanto il valore di mercato supera il prezzo medio di acquisto delle monete.",
        L2_mayer_multiple: "Prezzo diviso la media degli ultimi 200 giorni.",
        L3_ma200w_distance: "Distanza del prezzo dalla media delle ultime 200 settimane.",
        L4_days_since_halving: "Posizione nel ciclo di 4 anni legato all'halving.",
      },
    },

    // Fonti dei dati e librerie (SPEC 9.3: citare Bitview e Coin Metrics).
    credits: {
      dataTitle: "Dati",
      libsTitle: "Librerie",
      sources: [
        { name: "Bitstamp", url: "https://www.bitstamp.net", use: "prezzo giornaliero (dal 2011)" },
        { name: "alternative.me", url: "https://alternative.me/crypto/fear-and-greed-index/", use: "Fear & Greed Index" },
        { name: "Farside Investors", url: "https://farside.co.uk/btc/", use: "flussi degli ETF spot USA" },
        { name: "Deribit", url: "https://www.deribit.com", use: "funding rate dei perpetual" },
        { name: "Bitview (bitview.space)", url: "https://bitview.space", use: "dati on-chain (MVRV, CVDD)", license: "CC BY 4.0" },
        { name: "Coin Metrics", url: "https://coinmetrics.io", use: "offerta di USDT e USDC", license: "CC BY-NC 4.0" },
        { name: "FRED, St. Louis Fed", url: "https://fred.stlouisfed.org/series/DTWEXBGS", use: "indice del dollaro (DTWEXBGS)" },
      ],
      libraries: [
        { name: "Bootstrap 5", url: "https://getbootstrap.com", license: "MIT" },
        { name: "Bootstrap Icons", url: "https://icons.getbootstrap.com", license: "MIT" },
        { name: "Apache ECharts", url: "https://echarts.apache.org", license: "Apache 2.0" },
        { name: "Manrope (font)", url: "https://fonts.google.com/specimen/Manrope", license: "OFL" },
      ],
    },
  },
};
