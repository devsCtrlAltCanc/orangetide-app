// ============================================================
// js/storico.js — WIDGET DELLA PAGINA STORICO (SPEC 11.2, 16.3)
// ============================================================
// A cosa serve:
//   Mostra come sono andati i segnali nel passato. Le tabelle del backtest
//   sono nella pagina Backtest (backtest.js).
//
// Widget definiti qui:
//   priceChart      prezzo colorato secondo il segnale dell'orizzonte scelto,
//                   tre "strisce" dei segnali (una per orizzonte), cursore
//                   con il dettaglio del giorno, vista giornaliera/settimanale
//   drawdownChart   distanza dal massimo storico (SPEC 16.3)
//
// Legge: history.json (storico giornaliero), latest.json (nomi e orizzonte
//        degli indicatori).
// Usa: OT.ui (app.js) per i pulsanti di scelta e i numeri con segno.
//
// Costrutti JavaScript usati qui (oltre a quelli già spiegati negli altri file):
//   array.filter(f)   nuovo elenco con i soli elementi per cui f(...) è vero
//   array.map(f)      nuovo elenco con f applicata a ogni elemento
//   `testo ${x}`      "template string": testo in cui ${x} viene sostituito
//                     dal valore di x
// ============================================================

// ============================================================
// SEZIONE 1 — STATO DELLE SCELTE DELL'UTENTE
// ============================================================
// Le scelte fatte con i pulsanti (orizzonte, giornaliero/settimanale)
// restano finché l'app è aperta: se la pagina
// viene ridisegnata (es. cambio di tema) non si torna ai valori iniziali.
const storicoState = {
  horizon: OT_CONFIG.history.defaultHorizon,
  frequency: OT_CONFIG.history.defaultFrequency,
};

// Valore numerico di ogni segnale, usato per le strisce colorate.
const SIGNALS = ["BUY", "HOLD", "SELL", "n/d"];

/** Colore di un segnale (config.js: colors). */
function signalColor(signal) {
  const c = OT_CONFIG.colors;
  return { BUY: c.buy, HOLD: c.hold, SELL: c.sell }[signal] || c.na;
}

// ============================================================
// SEZIONE 2 — PREPARAZIONE DEI DATI DEL GRAFICO
// ============================================================
/**
 * Posizioni (indici) di history.json da mostrare:
 *   - "daily":  tutti i giorni con un prezzo;
 *   - "weekly": solo il giorno di fine settimana (config: history.weekEndDay)
 *               più l'ultimo giorno disponibile, così si vede sempre l'oggi.
 * @param {object} h          contenuto di history.json
 * @param {string} frequency  "daily" o "weekly"
 * @returns {number[]}
 */
function selectIndices(h, frequency) {
  const indices = [];
  const last = h.dates.length - 1;
  for (let i = 0; i <= last; i++) {
    if (h.price[i] === null) continue;
    if (frequency === "weekly") {
      const day = new Date(h.dates[i] + "T00:00:00Z").getUTCDay();   // 0 = domenica
      if (day !== OT_CONFIG.history.weekEndDay && i !== last) continue;
    }
    indices.push(i);
  }
  return indices;
}

/**
 * Una serie del prezzo per ogni segnale: ogni serie ha il prezzo solo nei
 * giorni con quel segnale e "-" (vuoto) negli altri. Le quattro serie
 * affiancate formano un'unica linea colorata a tratti.
 *
 * Perché così: una linea di ECharts ha un solo colore (o una sfumatura legata
 * agli assi); con quattro serie ogni tratto prende il colore del suo segnale.
 * Il punto in cui il segnale cambia appartiene a entrambi i tratti, così la
 * linea non ha buchi.
 *
 * @param {object} h          history.json
 * @param {number[]} indices  posizioni da mostrare (selectIndices)
 * @param {string} horizon    "short", "medium" o "long"
 * @returns {object} segnale -> elenco [data, prezzo | "-"]
 */
function priceBySignal(h, indices, horizon) {
  const signals = h.horizons[horizon].signal;
  const result = {};
  for (const s of SIGNALS) result[s] = [];
  indices.forEach(function (i, k) {
    const today = signals[i];
    const before = k > 0 ? signals[indices[k - 1]] : null;
    for (const s of SIGNALS) {
      const inSegment = today === s || before === s;
      result[s].push([h.dates[i], inSegment ? h.price[i] : "-"]);
    }
  });
  return result;
}

/**
 * Tratti continui con lo stesso segnale, per le strisce colorate:
 * [inizio (ms), fine (ms), riga, segnale]. Unendo i giorni consecutivi si
 * disegnano poche centinaia di rettangoli invece di migliaia.
 * @param {object} h
 * @param {number[]} indices
 * @param {string} horizon
 * @param {number} row         riga della striscia (0 = in basso)
 */
function signalSegments(h, indices, horizon, row) {
  const signals = h.horizons[horizon].signal;
  const segments = [];
  const DAY_MS = 86400000;
  let start = 0;
  for (let k = 1; k <= indices.length; k++) {
    // Il tratto finisce quando il segnale cambia o i dati finiscono.
    if (k === indices.length || signals[indices[k]] !== signals[indices[start]]) {
      const from = Date.parse(h.dates[indices[start]]);
      // Fine del tratto: il primo giorno del tratto successivo (così le
      // strisce non hanno spazi); per l'ultimo, il giorno dopo l'ultimo dato.
      const to = k < indices.length ? Date.parse(h.dates[indices[k]]) : Date.parse(h.dates[indices[k - 1]]) + DAY_MS;
      segments.push([from, to, row, signals[indices[start]]]);
      start = k;
    }
  }
  return segments;
}

// ============================================================
// SEZIONE 3 — RIQUADRO DEL CURSORE (dettaglio del giorno)
// ============================================================
/**
 * Indicatori di ogni orizzonte, dai dati di oggi (latest.json):
 * { long: [{id, name}, ...], ... }.
 */
function indicatorsByHorizon(latest) {
  const result = {};
  for (const id of Object.keys(latest.horizons)) {
    result[id] = latest.horizons[id].indicators.map(function (ind) {
      return { id: ind.id, name: ind.name };
    });
  }
  return result;
}

/** Colore del testo di un livello: positivo verde, negativo rosso, 0/nd grigio. */
function levelColor(level) {
  const c = OT_CONFIG.colors;
  if (level === null || level === undefined || level === 0) return c.hold;
  return level > 0 ? c.buy : c.sell;
}

/**
 * HTML del riquadro che segue il cursore: data, prezzo e, per ogni
 * orizzonte, segnale, convenienza, accordo e livelli degli indicatori.
 * @param {object} h           history.json
 * @param {number} i           posizione del giorno in history.json
 * @param {object} indicators  indicatorsByHorizon(latest)
 */
function dayTooltip(h, i, indicators) {
  const t = OT_CONFIG.texts;
  const short = OT_CONFIG.indicatorShortNames;
  const blocks = OT_CONFIG.horizonOrder.map(function (hz) {
    const data = h.horizons[hz];
    const signal = data.signal[i];
    const conv = data.convenience[i];
    const agree = data.agreement[i];
    const numbers = conv === null ? ""
      : ` <span style="opacity:.75">${t.storico.convenienceShort} ${OT.ui.signed(conv)} · ${t.storico.agreementShort} ${agree}%</span>`;
    const levels = (indicators[hz] || []).map(function (ind) {
      const level = (h.indicators[ind.id] || [])[i];
      return `${OT.escape(short[ind.id] || ind.name)} <b style="color:${levelColor(level)}">${OT.ui.signed(level)}</b>`;
    }).join(" · ");
    return `<div style="margin-top:6px">
        <b>${t.horizonNames[hz]}</b>
        <span style="color:${signalColor(signal)};font-weight:800;margin-left:4px">${signal}</span>${numbers}
        <div style="font-size:11px;opacity:.85">${levels}</div>
      </div>`;
  }).join("");
  return `<div style="font-size:12px;line-height:1.35;white-space:normal">
      <div style="opacity:.75">${OT.fmt.date(h.dates[i])}</div>
      <div><b>${OT.fmt.usd(h.price[i])}</b></div>
      ${blocks}
    </div>`;
}

// ============================================================
// SEZIONE 4 — OPZIONI DEL GRAFICO (ECharts)
// ============================================================
/**
 * Opzioni ECharts del grafico prezzo + strisce.
 * @param {object} h          history.json
 * @param {object} latest     latest.json
 * @param {object} zoom       { start, end } periodo visibile (ms) o null
 * @returns {object} opzioni ECharts
 */
function signalChartOption(h, latest, zoom) {
  const colors = OT.charts.themeColors();
  const t = OT_CONFIG.texts;
  const indices = selectIndices(h, storicoState.frequency);
  const bySignal = priceBySignal(h, indices, storicoState.horizon);
  const indicators = indicatorsByHorizon(latest);

  // Strisce: dall'alto in basso nell'ordine di config (lungo, medio, breve).
  // Sull'asse a categorie la riga 0 è in basso, quindi l'ordine va invertito.
  const rows = OT_CONFIG.horizonOrder.slice().reverse();
  let segments = [];
  rows.forEach(function (hz, row) {
    segments = segments.concat(signalSegments(h, indices, hz, row));
  });

  // Serie del prezzo: una per segnale (vedi priceBySignal).
  const series = SIGNALS.map(function (s) {
    return {
      name: s, type: "line", xAxisIndex: 0, yAxisIndex: 0,
      data: bySignal[s], showSymbol: false, connectNulls: false,
      lineStyle: { width: 1.8, color: signalColor(s) }, itemStyle: { color: signalColor(s) },
    };
  });

  // Strisce: serie "custom", cioè disegnata da noi: un rettangolo per tratto.
  // api.coord([x, y]) converte data e riga nella posizione in pixel;
  // api.size([0, 1]) dà l'altezza di una riga; clipRectByRect taglia il
  // rettangolo ai bordi del riquadro (quando si zooma).
  series.push({
    name: "strisce", type: "custom", xAxisIndex: 1, yAxisIndex: 1,
    data: segments, encode: { x: [0, 1], y: 2 }, silent: true,
    renderItem: function (params, api) {
      const start = api.coord([api.value(0), api.value(2)]);
      const end = api.coord([api.value(1), api.value(2)]);
      const height = api.size([0, 1])[1] * 0.72;
      const rect = echarts.graphic.clipRectByRect(
        { x: start[0], y: start[1] - height / 2, width: Math.max(end[0] - start[0], 1), height: height },
        { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height });
      if (!rect) return null;
      return { type: "rect", shape: rect, style: { fill: signalColor(segments[params.dataIndex][3]) } };
    },
  });

  // Serie invisibile sulle strisce: serve solo a far comparire il riquadro
  // del cursore anche quando si tocca la zona delle strisce.
  series.push({
    name: "cursore", type: "line", xAxisIndex: 1, yAxisIndex: 1,
    data: indices.map(function (i) { return [h.dates[i], 0]; }),
    showSymbol: false, lineStyle: { opacity: 0 }, silent: true,
  });

  // Zoom: si mantiene il periodo visibile; all'apertura gli ultimi N anni.
  let zoomStart = zoom ? zoom.start : null;
  const zoomEnd = zoom ? zoom.end : null;
  if (zoomStart === null) {
    const last = new Date(h.dates[h.dates.length - 1]);
    last.setFullYear(last.getFullYear() - OT_CONFIG.charts.defaultZoomYears);
    zoomStart = last.getTime();
  }
  const dateMin = h.dates[indices[0]];
  const dateMax = h.dates[indices[indices.length - 1]];
  const selectedName = t.horizonNames[storicoState.horizon];

  return {
    animation: false,
    hoverLayerThreshold: Infinity,   // vedi charts.js (evita copie "sporche" zoomando)
    legend: {
      data: ["BUY", "HOLD", "SELL"], selectedMode: false,
      top: 0, left: 0, icon: "roundRect", itemWidth: 12, itemHeight: 4,
      textStyle: { color: colors.muted, fontSize: 11 },
    },
    axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: colors.muted } },
    tooltip: {
      trigger: "axis", confine: true,
      backgroundColor: colors.panel, borderColor: colors.border,
      textStyle: { color: colors.text },
      extraCssText: "max-width:320px",
      // params[0].dataIndex = posizione nel nostro elenco "indices": tutte le
      // serie del prezzo e la serie del cursore hanno un punto per ogni indice.
      formatter: function (params) {
        const item = params.find(function (p) { return p.seriesType === "line"; });
        if (!item) return "";
        return dayTooltip(h, indices[item.dataIndex], indicators);
      },
    },
    grid: [
      { left: 8, right: 64, top: 28, bottom: "34%" },
      { left: 8, right: 64, height: "15%", bottom: 64 },
    ],
    xAxis: [
      { type: "time", gridIndex: 0, min: dateMin, max: dateMax, axisLabel: { show: false },
        axisLine: { lineStyle: { color: colors.border } }, splitLine: { show: false } },
      { type: "time", gridIndex: 1, min: dateMin, max: dateMax,
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: colors.muted, fontSize: 11, hideOverlap: true, formatter: OT.charts.timeLabel } },
    ],
    yAxis: [
      { type: "log", gridIndex: 0, position: "right", scale: true,
        axisLabel: { color: colors.muted, fontSize: 11, formatter: OT.charts.shortUsd },
        splitLine: { lineStyle: { color: colors.border } } },
      { type: "category", gridIndex: 1, position: "right",
        data: rows.map(function (hz) { return t.horizonNames[hz]; }),
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: {
          fontSize: 11,
          // L'orizzonte scelto (quello che colora il prezzo) è in grassetto.
          formatter: function (name) { return name === selectedName ? `{sel|${name}}` : name; },
          color: colors.muted,
          rich: { sel: { color: colors.text, fontWeight: 800, fontSize: 11 } },
        } },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], startValue: zoomStart, endValue: zoomEnd, filterMode: "none" },
      { type: "slider", xAxisIndex: [0, 1], startValue: zoomStart, endValue: zoomEnd, filterMode: "none",
        bottom: 4, height: 22, borderColor: colors.border, textStyle: { color: colors.muted, fontSize: 10 },
        fillerColor: "rgba(247,132,26,0.15)", handleStyle: { color: OT_CONFIG.colors.brand },
        labelFormatter: function (value) { return OT.fmt.date(new Date(value).toISOString().slice(0, 10)); } },
    ],
    series: series,
  };
}

/**
 * Periodo visibile del grafico (dopo uno zoom), per ridisegnarlo uguale.
 * @returns {{start: number, end: number}|null}
 */
function currentZoom(chart) {
  // getOption restituisce le opzioni attuali, compreso lo zoom scelto dall'utente.
  const zoom = chart.getOption().dataZoom;
  if (!zoom || !zoom.length) return null;
  return { start: zoom[0].startValue, end: zoom[0].endValue };
}

// ============================================================
// WIDGET priceChart — PREZZO E SEGNALI NEL TEMPO (SPEC 11.2)
// ============================================================
OT.registerWidget("priceChart", {
  title: "Prezzo e segnali",
  size: "full",
  needs: ["history", "latest"],

  render: function (body, files) {
    const h = files.history.data;
    const latest = files.latest.data;
    const t = OT_CONFIG.texts;

    const horizonOptions = OT_CONFIG.horizonOrder.map(function (hz) { return [hz, t.horizonNames[hz]]; });
    const frequencyOptions = [["daily", t.storico.daily], ["weekly", t.storico.weekly]];
    body.innerHTML = `
      <div class="ot-toolbar">
        ${OT.ui.choiceButtons("horizon", horizonOptions, storicoState.horizon)}
        ${OT.ui.choiceButtons("frequency", frequencyOptions, storicoState.frequency)}
      </div>
      <div class="ot-chart ot-chart-signals"></div>
      <div class="ot-chart-note">${t.storico.chartNote}</div>`;

    const box = body.querySelector(".ot-chart-signals");
    const chart = OT.charts.create(box, signalChartOption(h, latest, null));
    // Scala del prezzo adattata al periodo visibile (vedi charts.js).
    const fitPrice = OT.charts.fitPriceAxis(chart, h.dates, [h.price]);

    // Al cambio di una scelta si ridisegna tutto (notMerge: true = sostituisci
    // le opzioni invece di unirle a quelle vecchie), mantenendo lo zoom.
    // Poi si riadatta la scala: le opzioni nuove non hanno min/max del prezzo.
    function redraw() {
      chart.setOption(signalChartOption(h, latest, currentZoom(chart)), { notMerge: true });
      fitPrice();
    }
    OT.ui.bindChoice(body, "horizon", function (value) { storicoState.horizon = value; redraw(); });
    OT.ui.bindChoice(body, "frequency", function (value) { storicoState.frequency = value; redraw(); });
  },
});

// ============================================================
// WIDGET drawdownChart — DISTANZA DAL MASSIMO STORICO (SPEC 16.3)
// ============================================================
OT.registerWidget("drawdownChart", {
  title: "Distanza dal massimo storico",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    body.innerHTML = `<div class="ot-chart ot-chart-tall"></div>
      <div class="ot-chart-note">${OT_CONFIG.texts.storico.drawdownNote}</div>`;
    OT.charts.priceWithPane(body.querySelector(".ot-chart"), {
      dates: h.dates, price: h.price,
      pane: {
        name: "Drawdown", kind: "line", data: h.drawdown, max: 0,
        color: OT_CONFIG.colors.sell, area: true,
        format: function (v) { return OT.fmt.pct(v, 0); },
      },
    });
  },
});
