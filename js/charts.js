// ============================================================
// js/charts.js — FUNZIONI COMUNI PER I GRAFICI (Apache ECharts, SPEC 10.2)
// ============================================================
// A cosa serve:
//   - crea i grafici con colori coerenti con il tema (chiaro/scuro) e li
//     ridimensiona quando cambia la finestra;
//   - "priceWithPane": il grafico tipo charts.bitbo.io usato nella pagina
//     Grafici: prezzo in scala logaritmica in alto (eventualmente colorato
//     da un valore, es. il rischio) e sotto un riquadro con la metrica.
//     I due riquadri hanno lo stesso asse delle date, lo stesso cursore e
//     lo stesso zoom (dita su iPhone, rotellina o barra in basso su PC).
//
// ECharts in breve: si crea un grafico dentro un elemento HTML con
//   echarts.init(elemento) e lo si disegna con grafico.setOption(opzioni),
//   dove "opzioni" è un oggetto che descrive assi, serie, colori, ecc.
//   Documentazione: https://echarts.apache.org/en/option.html
// ============================================================

window.OT = window.OT || {};

OT.charts = (function () {
  // Grafici attivi: servono per ridimensionarli tutti insieme.
  let active = [];

  // ============================================================
  // SEZIONE 1 — COLORI DEL TEMA E CREAZIONE
  // ============================================================
  /**
   * Legge un colore dalle variabili CSS del tema corrente (css/style.css),
   * così i grafici usano gli stessi colori dell'interfaccia.
   * @param {string} name  nome della variabile, es. "--ot-text"
   */
  function cssColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** Colori del tema corrente, pronti per le opzioni di ECharts. */
  function themeColors() {
    return {
      text: cssColor("--ot-text"),
      muted: cssColor("--ot-muted"),
      border: cssColor("--ot-border"),
      tile: cssColor("--ot-tile"),
      panel: cssColor("--ot-panel"),
    };
  }

  /**
   * Crea un grafico dentro un contenitore.
   * @param {HTMLElement} container  elemento in cui disegnare
   * @param {object} option          opzioni di ECharts
   * @returns {object} il grafico ECharts
   */
  function create(container, option) {
    // Si tolgono dall'elenco i grafici il cui elemento non è più nella pagina
    // (cambio pagina) e si liberano le loro risorse.
    active = active.filter(function (chart) {
      if (document.body.contains(chart.getDom())) return true;
      chart.dispose();
      return false;
    });
    const chart = echarts.init(container, null, { renderer: "canvas" });
    chart.setOption(option);
    active.push(chart);
    return chart;
  }

  // Quando la finestra cambia dimensione (o si ruota il telefono) si
  // adattano tutti i grafici.
  window.addEventListener("resize", function () {
    for (const chart of active) chart.resize();
  });

  // ============================================================
  // SEZIONE 2 — SEMICERCHIO A BARRA (rischio, Fear & Greed)
  // ============================================================
  /**
   * Semicerchio con un arco di fondo grigio e un arco colorato fino al valore.
   * @param {HTMLElement} container
   * @param {object} o  { value, min, max, color, decimals }
   */
  function semicircle(container, o) {
    const colors = themeColors();
    return create(container, {
      series: [{
        type: "gauge",
        min: o.min, max: o.max,
        startAngle: 180, endAngle: 0,          // mezzo cerchio, aperto in basso
        // Il raggio in % è riferito a metà del lato minore del riquadro:
        // con un riquadro basso e largo serve più del 100% per riempirlo.
        radius: "155%",
        center: ["50%", "88%"],
        pointer: { show: false },
        progress: {                            // arco colorato dal minimo al valore
          show: true, width: 22, roundCap: true,
          itemStyle: { color: o.color },
        },
        axisLine: { roundCap: true, lineStyle: { width: 22, color: [[1, colors.tile]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          offsetCenter: [0, "-18%"],
          fontSize: 34, fontWeight: 800, color: colors.text,
          formatter: function (v) { return OT.fmt.number(v, o.decimals); },
        },
        data: [{ value: o.value }],
      }],
    });
  }

  // ============================================================
  // SEZIONE 2b — MINI-GRAFICI DELLA DASHBOARD
  // ============================================================
  /**
   * Barre degli ultimi giorni (es. Fear & Greed, indice di rischio).
   * @param {HTMLElement} container
   * @param {Array} points       [[data "AAAA-MM-GG", valore], ...]
   * @param {function} colorOf   valore -> colore della barra
   * @param {object} o           { max, decimals }
   */
  function recentBars(container, points, colorOf, o) {
    const colors = themeColors();
    return create(container, {
      animation: false,
      grid: { left: 0, right: 0, top: 8, bottom: 18 },
      xAxis: { type: "category", data: points.map(function (p) { return OT.fmt.date(p[0]).slice(0, 5); }),
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: colors.muted, fontSize: 10, interval: Math.floor(points.length / 5) } },
      yAxis: { type: "value", min: 0, max: o.max, show: false },
      tooltip: { trigger: "axis", backgroundColor: colors.panel, borderColor: colors.border,
        textStyle: { color: colors.text },
        valueFormatter: function (v) { return OT.fmt.number(v, o.decimals); } },
      series: [{
        type: "bar", barCategoryGap: "25%",
        data: points.map(function (p) {
          return { value: p[1], itemStyle: { color: colorOf(p[1]), borderRadius: [3, 3, 0, 0] } };
        }),
      }],
    });
  }

  /**
   * Grafico ad area del prezzo (riquadro del prezzo in dashboard).
   * @param {HTMLElement} container
   * @param {Array} points  [[data, prezzo], ...] già limitati al periodo scelto
   */
  function priceArea(container, points) {
    const colors = themeColors();
    const brand = OT_CONFIG.colors.brand;
    return create(container, {
      animation: false,
      grid: { left: 0, right: 52, top: 10, bottom: 22 },
      xAxis: { type: "time", axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: colors.muted, fontSize: 10, hideOverlap: true, formatter: timeLabel }, splitLine: { show: false } },
      yAxis: { type: "value", position: "right", scale: true,
        axisLabel: { color: colors.muted, fontSize: 10, formatter: shortUsd },
        splitLine: { lineStyle: { color: colors.border } } },
      tooltip: { trigger: "axis", backgroundColor: colors.panel, borderColor: colors.border,
        textStyle: { color: colors.text },
        formatter: function (items) {
          const p = items[0].value;
          return `<div class="small">${OT.fmt.date(String(p[0]).slice(0, 10))}</div><b>${OT.fmt.usd(p[1])}</b>`;
        } },
      series: [{
        type: "line", data: points, showSymbol: false,
        lineStyle: { width: 2, color: brand }, itemStyle: { color: brand },
        // Area sotto la linea: arancione che sfuma verso il trasparente.
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(247,132,26,0.35)" }, { offset: 1, color: "rgba(247,132,26,0)" },
        ]) },
      }],
    });
  }

  // ============================================================
  // SEZIONE 3 — PREZZO + RIQUADRO DELLA METRICA (stile bitbo)
  // ============================================================
  /**
   * Coppie [data, valore] per un asse del tempo, saltando i valori mancanti.
   * @param {string[]} dates
   * @param {Array<number|null>} values
   */
  function pairs(dates, values) {
    const result = [];
    for (let i = 0; i < dates.length; i++) {
      if (values[i] !== null && values[i] !== undefined) result.push([dates[i], values[i]]);
    }
    return result;
  }

  /** Prima data con un valore (per lo zoom iniziale delle serie recenti). */
  function firstDate(dates, values) {
    for (let i = 0; i < dates.length; i++) {
      if (values[i] !== null && values[i] !== undefined) return dates[i];
    }
    return dates[0];
  }

  /**
   * Grafico doppio: prezzo (log) in alto, metrica sotto.
   * @param {HTMLElement} container
   * @param {object} o  opzioni:
   *   dates, price              elenchi da history.json
   *   priceColorBy              (facoltativo) valori 0–1 che colorano il prezzo
   *   colorStops                colori per priceColorBy / pane.colorByValue
   *   overlays                  (facoltativo) [{ name, data, color }] linee sul prezzo
   *   pane: { name, kind ("line" | "bar"), data, format(v),
   *           min, max, zones [{from, to, color}], barColor(v),
   *           colorByValue (true = linea colorata come il prezzo),
   *           line2 { name, data, color } seconda serie (asse destro) }
   *   zoomFrom                  (facoltativo) data di inizio dello zoom iniziale
   */
  function priceWithPane(container, o) {
    const colors = themeColors();
    const pane = o.pane;
    const priceData = o.priceColorBy
      ? o.dates.map(function (d, i) { return [d, o.price[i], o.priceColorBy[i]]; })
          .filter(function (p) { return p[1] !== null; })
      : pairs(o.dates, o.price);

    // Zoom iniziale: dalla data indicata, oppure gli ultimi N anni.
    let zoomFrom = o.zoomFrom;
    if (!zoomFrom) {
      const last = new Date(o.dates[o.dates.length - 1]);
      last.setFullYear(last.getFullYear() - OT_CONFIG.charts.defaultZoomYears);
      zoomFrom = last.toISOString().slice(0, 10);
    }

    // Prezzo: linea semplice, oppure (con priceColorBy) PALLINI colorati
    // uno per giorno. Una linea ECharts non può cambiare colore secondo un
    // valore che non sia sugli assi; i pallini sì, uno per uno.
    const series = [o.priceColorBy
      ? { name: "Prezzo", type: "scatter", xAxisIndex: 0, yAxisIndex: 0,
          data: priceData, symbolSize: 3, progressive: 0 }   // progressive 0 = disegna tutto in una volta
      : { name: "Prezzo", type: "line", xAxisIndex: 0, yAxisIndex: 0,
          data: priceData, showSymbol: false,
          lineStyle: { width: 1.6, color: colors.text }, itemStyle: { color: colors.text } }];
    for (const overlay of (o.overlays || [])) {
      series.push({
        name: overlay.name, type: "line", xAxisIndex: 0, yAxisIndex: 0,
        data: pairs(o.dates, overlay.data), showSymbol: false,
        lineStyle: { width: 2, color: overlay.color }, itemStyle: { color: overlay.color },
      });
    }

    // Serie del riquadro sotto.
    const paneData = pane.kind === "bar"
      ? pairs(o.dates, pane.data).map(function (p) {
          return { value: p, itemStyle: { color: pane.barColor ? pane.barColor(p[1]) : OT_CONFIG.colors.brand } };
        })
      : pairs(o.dates, pane.data);
    const paneSeries = {
      name: pane.name, type: pane.kind, xAxisIndex: 1, yAxisIndex: 1,
      data: paneData, showSymbol: false, barMaxWidth: 6,
    };
    if (pane.kind === "line" && !pane.colorByValue) {
      paneSeries.lineStyle = { width: 1.6, color: OT_CONFIG.colors.brand };
      paneSeries.itemStyle = { color: OT_CONFIG.colors.brand };
    }
    // Fasce colorate di sfondo (es. zone dell'MVRV Z-Score)
    if (pane.zones) {
      paneSeries.markArea = {
        silent: true,
        data: pane.zones.map(function (z) {
          return [{ yAxis: z.from, itemStyle: { color: z.color } }, { yAxis: z.to }];
        }),
      };
    }
    series.push(paneSeries);
    if (pane.line2) {
      series.push({
        name: pane.line2.name, type: "line", xAxisIndex: 1, yAxisIndex: 2,
        data: pairs(o.dates, pane.line2.data), showSymbol: false,
        lineStyle: { width: 2, color: pane.line2.color }, itemStyle: { color: pane.line2.color },
      });
    }

    // visualMap = colora le serie secondo un valore:
    //   - pallini del prezzo: secondo la terza colonna dei dati (dimension 2);
    //   - linea della metrica: secondo il proprio valore (dimension 1, asse
    //     verticale): ECharts la disegna con una sfumatura di colori.
    const visualMap = [];
    const range = {
      show: false, type: "continuous",
      min: o.colorMin === undefined ? 0 : o.colorMin,
      max: o.colorMax === undefined ? 1 : o.colorMax,
      inRange: { color: o.colorStops },
    };
    if (o.priceColorBy) visualMap.push(Object.assign({ dimension: 2, seriesIndex: 0 }, range));
    if (pane.colorByValue) {
      visualMap.push(Object.assign({ dimension: 1, seriesIndex: series.indexOf(paneSeries) }, range));
    }

    const axisCommon = {
      axisLine: { lineStyle: { color: colors.border } },
      axisLabel: { color: colors.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: colors.border } },
    };
    const yAxes = [
      Object.assign({ type: "log", gridIndex: 0, position: "right", scale: true,
        axisLabel: { color: colors.muted, fontSize: 11, formatter: shortUsd } }, { splitLine: axisCommon.splitLine }),
      Object.assign({ type: "value", gridIndex: 1, position: "right", min: pane.min, max: pane.max,
        axisLabel: { color: colors.muted, fontSize: 11, formatter: pane.format } }, { splitLine: axisCommon.splitLine }),
    ];
    if (pane.line2) {
      yAxes.push({ type: "value", gridIndex: 1, position: "left", splitLine: { show: false },
        axisLabel: { color: pane.line2.color, fontSize: 11, formatter: pane.line2.format || pane.format } });
    }

    // Stesso inizio e fine per i due assi delle date: lo zoom lavora in
    // percentuale, e con assi di lunghezza diversa (es. prezzo dal 2011,
    // rischio dal 2013) i due riquadri mostrerebbero periodi diversi.
    const dateMin = o.dates[0];
    const dateMax = o.dates[o.dates.length - 1];

    return create(container, {
      animation: false,
      // Con molti punti ECharts disegna le evidenziazioni del mouse su un livello
      // separato che, zoomando o trascinando, restava "sporco" (copie sovrapposte
      // del grafico): Infinity = usa sempre il livello normale.
      hoverLayerThreshold: Infinity,
      legend: {
        show: !o.priceColorBy,   // con i colori variabili la legenda non avrebbe un colore sensato
        top: 0, left: 0, icon: "roundRect", itemWidth: 12, itemHeight: 4,
        textStyle: { color: colors.muted, fontSize: 11 },
      },
      // axisPointer.link: il cursore verticale è condiviso dai due riquadri.
      axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: colors.muted } },
      tooltip: {
        trigger: "axis",
        backgroundColor: colors.panel, borderColor: colors.border,
        textStyle: { color: colors.text, fontSize: 12 },
        formatter: function (items) { return tooltipText(items, pane); },
      },
      grid: [
        { left: 8, right: 64, top: 28, height: "52%" },
        { left: 8, right: 64, top: "66%", height: "20%" },
      ],
      xAxis: [
        Object.assign({ type: "time", gridIndex: 0, min: dateMin, max: dateMax, axisLabel: { show: false } }, { axisLine: axisCommon.axisLine, splitLine: { show: false } }),
        Object.assign({ type: "time", gridIndex: 1, min: dateMin, max: dateMax }, { axisLine: axisCommon.axisLine, splitLine: { show: false },
          axisLabel: Object.assign({ formatter: timeLabel, hideOverlap: true }, axisCommon.axisLabel) }),
      ],
      yAxis: yAxes,
      // Zoom: "inside" = con dita/rotellina sul grafico; "slider" = barra in basso.
      // filterMode "none": lo zoom ritaglia solo la vista e non toglie dati
      // dalle serie (con "filter", il predefinito, trascinando il grafico le
      // linee e i pallini venivano ridisegnati sovrapposti).
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1], startValue: zoomFrom, filterMode: "none" },
        { type: "slider", xAxisIndex: [0, 1], startValue: zoomFrom, filterMode: "none", bottom: 4, height: 22,
          borderColor: colors.border, textStyle: { color: colors.muted, fontSize: 10 },
          fillerColor: "rgba(247,132,26,0.15)", handleStyle: { color: OT_CONFIG.colors.brand } },
      ],
      visualMap: visualMap,
      series: series,
    });
  }

  /**
   * Etichetta delle date sugli assi, in italiano: a gennaio l'anno
   * ("2026"), negli altri mesi il mese abbreviato ("mar", "set").
   * (Le etichette predefinite di ECharts sono in inglese.)
   * @param {number} value  data in millisecondi
   */
  function timeLabel(value) {
    const d = new Date(value);
    if (d.getMonth() === 0) return String(d.getFullYear());
    return d.toLocaleDateString(OT_CONFIG.locale, { month: "short" });
  }

  /** Prezzo abbreviato per l'asse: 61170 -> "61k", 1200000 -> "1,2M". */
  function shortUsd(value) {
    if (value >= 1e6) return OT.fmt.number(value / 1e6, 1) + "M";
    if (value >= 1e3) return OT.fmt.number(value / 1e3, 0) + "k";
    return OT.fmt.number(value, value < 10 ? 2 : 0);
  }

  /** Testo del riquadro che segue il cursore: data e valore di ogni serie. */
  function tooltipText(items, pane) {
    if (!items.length) return "";
    const date = OT.fmt.date(String(items[0].value[0]).slice(0, 10));
    const lines = items.map(function (item) {
      const value = item.value[1];
      let text;
      if (item.seriesName === "Prezzo" || item.seriesName === "CVDD") text = OT.fmt.usd(value);
      else if (pane.line2 && item.seriesName === pane.line2.name) text = (pane.line2.format || pane.format)(value);
      else text = pane.format(value);
      return `${item.marker} ${OT.escape(item.seriesName)}: <b>${text}</b>`;
    });
    return `<div class="small">${date}</div>` + lines.join("<br>");
  }

  return {
    create: create, themeColors: themeColors, cssColor: cssColor,
    semicircle: semicircle, priceWithPane: priceWithPane, firstDate: firstDate,
    recentBars: recentBars, priceArea: priceArea,
  };
})();
