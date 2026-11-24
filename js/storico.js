// ============================================================
// js/storico.js — WIDGET DELLA PAGINA STORICO (SPEC 11.2, 5, 16.3)
// ============================================================
// A cosa serve:
//   Mostra come sono andati i segnali nel passato e cosa dice il backtest.
//
// Widget definiti qui:
//   priceChart      prezzo colorato secondo il segnale dell'orizzonte scelto,
//                   tre "strisce" dei segnali (una per orizzonte), cursore
//                   con il dettaglio del giorno, vista giornaliera/settimanale
//   drawdownChart   distanza dal massimo storico (SPEC 16.3)
//   backtestTables  tabelle del backtest per orizzonte, per indicatore e per
//                   fascia dell'indice di rischio; taratura / verifica / tutto
//
// Legge: history.json (storico giornaliero), latest.json (nomi e orizzonte
//        degli indicatori), backtest.json (tabelle).
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
// Le scelte fatte con i pulsanti (orizzonte, giornaliero/settimanale,
// periodo del backtest...) restano finché l'app è aperta: se la pagina
// viene ridisegnata (es. cambio di tema) non si torna ai valori iniziali.
const storicoState = {
  horizon: OT_CONFIG.history.defaultHorizon,
  frequency: OT_CONFIG.history.defaultFrequency,
  period: OT_CONFIG.backtest.defaultPeriod,
  view: OT_CONFIG.backtest.defaultView,
  indicator: null,          // indicatore scelto nella vista "Indicatori" (null = il primo)
};

// Valore numerico di ogni segnale, usato per le strisce colorate.
const SIGNALS = ["BUY", "HOLD", "SELL", "n/d"];

/** Colore di un segnale (config.js: colors). */
function signalColor(signal) {
  const c = OT_CONFIG.colors;
  return { BUY: c.buy, HOLD: c.hold, SELL: c.sell }[signal] || c.na;
}

/**
 * Gruppo di pulsanti a scelta singola (stile dei pulsanti 3M / 1A della dashboard).
 * @param {string} group      nome del gruppo (attributo data-group)
 * @param {Array} options     [[valore, testo], ...]
 * @param {string} selected   valore attivo
 * @returns {string} HTML
 */
function choiceButtons(group, options, selected) {
  const buttons = options.map(function (o) {
    const active = o[0] === selected ? " active" : "";
    return `<button type="button" class="ot-range${active}" data-group="${group}" data-value="${o[0]}">${OT.escape(o[1])}</button>`;
  }).join("");
  return `<div class="ot-ranges ot-choice">${buttons}</div>`;
}

/**
 * Collega i pulsanti di un gruppo: al clic salva la scelta e chiama onChange.
 * @param {HTMLElement} body
 * @param {string} group
 * @param {function} onChange  riceve il valore scelto
 */
function bindChoice(body, group, onChange) {
  for (const button of body.querySelectorAll(`[data-group="${group}"]`)) {
    button.addEventListener("click", function () {
      for (const b of body.querySelectorAll(`[data-group="${group}"]`)) {
        b.classList.toggle("active", b === button);
      }
      onChange(button.dataset.value);
    });
  }
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

/**
 * Numero intero con segno e meno tipografico: 2 -> "+2", −1 -> "−1", null -> "n/d".
 * Usato per i livelli (−2…+2) e per la convenienza (−100…+100).
 */
function storicoLevelText(level) {
  if (level === null || level === undefined) return "n/d";
  if (level > 0) return "+" + level;
  return level < 0 ? "−" + Math.abs(level) : "0";
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
      : ` <span style="opacity:.75">${t.storico.convenienceShort} ${storicoLevelText(conv)} · ${t.storico.agreementShort} ${agree}%</span>`;
    const levels = (indicators[hz] || []).map(function (ind) {
      const level = (h.indicators[ind.id] || [])[i];
      return `${OT.escape(short[ind.id] || ind.name)} <b style="color:${levelColor(level)}">${storicoLevelText(level)}</b>`;
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
        ${choiceButtons("horizon", horizonOptions, storicoState.horizon)}
        ${choiceButtons("frequency", frequencyOptions, storicoState.frequency)}
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
    bindChoice(body, "horizon", function (value) { storicoState.horizon = value; redraw(); });
    bindChoice(body, "frequency", function (value) { storicoState.frequency = value; redraw(); });
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

// ============================================================
// SEZIONE 5 — TABELLE DEL BACKTEST
// ============================================================
/**
 * Righe di backtest.json che corrispondono ai filtri.
 * @param {object} b        backtest.json
 * @param {object} filter   { period, scope, name, forward_days }
 */
function backtestRows(b, filter) {
  return b.rows.filter(function (r) {
    return r.period === filter.period && r.scope === filter.scope &&
      r.name === filter.name && r.forward_days === filter.forward_days;
  });
}

/** Finestre di rendimento (in giorni) presenti per uno scope/nome, in ordine. */
function forwardDaysOf(b, scope, name) {
  const days = [];
  for (const r of b.rows) {
    if (r.scope === scope && r.name === name && !days.includes(r.forward_days)) days.push(r.forward_days);
  }
  return days.sort(function (x, y) { return x - y; });
}

/** Percentuale già in % (es. 12.41) con segno: "+12,4%"; null -> "n/d". */
function pctValue(value) {
  return value === null || value === undefined ? "n/d" : OT.fmt.pct(value / 100, 1);
}

/** Classe colore di un rendimento: positivo verde, negativo rosso. */
function returnClass(value) {
  if (value === null || value === undefined || value === 0) return "";
  return value > 0 ? "ot-pos" : "ot-neg";
}

/**
 * Etichetta della prima colonna di una riga del backtest.
 * @param {string} scope   "horizon", "indicator" o "risk"
 * @param {string} group   "BUY", "+2", "0.3-0.4", "ALL"...
 */
function groupLabel(scope, group) {
  const tb = OT_CONFIG.texts.backtest;
  if (group === "ALL") return `<span class="ot-muted">${tb.allDays}</span>`;
  if (scope === "horizon") {
    const cls = { BUY: "buy", SELL: "sell" }[group] || "hold";
    return `<span class="ot-badge ot-badge-${cls}">${group}</span>`;
  }
  if (scope === "indicator") {
    const level = Number(group);
    const cls = level > 0 ? "buy" : (level < 0 ? "sell" : "hold");
    return `<span class="ot-badge ot-badge-${cls}">${storicoLevelText(level)}</span>`;
  }
  // Fascia di rischio "0.3-0.4": pallino del colore della fascia (centro della fascia).
  const parts = group.split("-").map(Number);
  const color = riskColor((parts[0] + parts[1]) / 2);
  return `<span class="ot-dot" style="background:${color}"></span> ${OT.fmt.number(parts[0], 1)}–${OT.fmt.number(parts[1], 1)}`;
}

/**
 * HTML di una tabella del backtest (SPEC 5.2).
 * @param {object[]} rows   righe di backtest.json (stesso periodo e finestra)
 * @param {string} scope
 * @param {string} metric   colonna usata per il criterio (es. "geo_mean_pct"), evidenziata
 */
function backtestTable(rows, scope, metric) {
  const c = OT_CONFIG.texts.backtest.columns;
  const few = OT_CONFIG.backtest.fewEpisodes;
  const firstHeader = { horizon: c.group, indicator: c.level, risk: c.band }[scope];
  const hl = function (key) { return key === metric ? " ot-hl" : ""; };
  const showHit = scope !== "risk";

  const body = rows.map(function (r) {
    // Riga attenuata se gli episodi indipendenti sono pochi (o nessuno).
    const faint = r.group !== "ALL" && (r.episodes === null || r.episodes < few) ? " class=\"ot-faint\"" : "";
    const episodes = r.episodes === null ? "" : `<div class="ot-sub">${r.episodes} ${c.episodes}</div>`;
    return `<tr${faint}>
        <td>${groupLabel(scope, r.group)}</td>
        <td>${OT.fmt.number(r.n_days, 0)}${episodes}</td>
        <td class="${returnClass(r.geo_mean_pct)}${hl("geo_mean_pct")}">${pctValue(r.geo_mean_pct)}</td>
        <td class="${returnClass(r.median_pct)}${hl("median_pct")}">${pctValue(r.median_pct)}</td>
        <td class="${returnClass(r.mean_pct)}${hl("mean_pct")}">${pctValue(r.mean_pct)}</td>
        <td>${pctValue(r.max_drop_median_pct)}</td>
        ${showHit ? `<td>${r.hit_rate_pct === null ? "—" : OT.fmt.number(r.hit_rate_pct, 0) + "%"}</td>` : ""}
      </tr>`;
  }).join("");

  return `<div class="ot-table-wrap"><table class="ot-table">
      <thead><tr>
        <th>${firstHeader}</th><th>${c.days}</th>
        <th class="${hl("geo_mean_pct")}">${c.geo}</th><th class="${hl("median_pct")}">${c.median}</th>
        <th class="${hl("mean_pct")}">${c.mean}</th><th>${c.drop}</th>
        ${showHit ? `<th>${c.hit}</th>` : ""}
      </tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

/**
 * Esito dei criteri di SPEC 5.2 per un orizzonte, periodo e finestra:
 * una pillola verde (✓) o rossa (✗) per criterio.
 */
function criteriaChips(b, period, horizon, days) {
  const names = OT_CONFIG.texts.backtest.criteria;
  const found = (b.criteria || []).find(function (x) {
    return x.period === period && x.horizon === horizon && x.forward_days === days;
  });
  if (!found) return "";
  return `<div class="ot-criteria">` + Object.keys(names).map(function (key) {
    const ok = found[key];
    return `<span class="ot-badge ot-badge-${ok ? "buy" : "sell"}"><i class="bi ${ok ? "bi-check-lg" : "bi-x-lg"}"></i> ${names[key]}</span>`;
  }).join("") + `</div>`;
}

/** Testo "dal 01/01/2023 a oggi" per un periodo del backtest (null = inizio dati / oggi). */
function periodRangeText(b, period) {
  const tb = OT_CONFIG.texts.backtest;
  const p = b.periods[period] || {};
  const start = p.start ? tb.rangeFrom.replace("{date}", OT.fmt.date(p.start)) : tb.rangeFromStart;
  const end = p.end ? tb.rangeTo.replace("{date}", OT.fmt.date(p.end)) : tb.rangeToToday;
  return `${start} ${end}`;
}

/**
 * Contenuto delle tabelle per la vista scelta.
 * @param {object} b        backtest.json
 * @param {object} latest   latest.json (nomi e ruolo degli orizzonti/indicatori)
 */
function backtestContent(b, latest) {
  const tb = OT_CONFIG.texts.backtest;
  const period = storicoState.period;
  const metric = b.order_metric;
  const title = function (days) { return tb.forwardTitle.replace("{days}", days); };

  if (storicoState.view === "horizon") {
    return OT_CONFIG.horizonOrder.map(function (hz) {
      const info = latest.horizons[hz] || {};
      const tables = forwardDaysOf(b, "horizon", hz).map(function (days) {
        const rows = backtestRows(b, { period: period, scope: "horizon", name: hz, forward_days: days });
        return `<div class="ot-bt-block">
            <div class="ot-bt-caption">${title(days)}</div>
            ${criteriaChips(b, period, hz, days)}
            ${backtestTable(rows, "horizon", metric)}
          </div>`;
      }).join("");
      const role = info.role ? `<span class="ot-badge ot-badge-brand">${OT.escape(info.role)}</span>` : "";
      return `<div class="ot-bt-section">
          <h3 class="ot-bt-title">${OT_CONFIG.texts.horizonNames[hz]} ${role}</h3>${tables}</div>`;
    }).join("");
  }

  if (storicoState.view === "indicator") {
    const id = storicoState.indicator;
    return forwardDaysOf(b, "indicator", id).map(function (days) {
      const rows = backtestRows(b, { period: period, scope: "indicator", name: id, forward_days: days });
      return `<div class="ot-bt-block">
          <div class="ot-bt-caption">${title(days)}</div>
          ${backtestTable(rows, "indicator", metric)}
        </div>`;
    }).join("");
  }

  // Vista "risk": fasce dell'indice di rischio (SPEC 16.1).
  const tables = forwardDaysOf(b, "risk", "risk_index").map(function (days) {
    const rows = backtestRows(b, { period: period, scope: "risk", name: "risk_index", forward_days: days });
    return `<div class="ot-bt-block">
        <div class="ot-bt-caption">${title(days)}</div>
        ${backtestTable(rows, "risk", metric)}
      </div>`;
  }).join("");
  return `<div class="ot-chart-note mb-2">${tb.riskNote}</div>${tables}`;
}

/**
 * Elenco a discesa degli indicatori, raggruppati per orizzonte.
 * <optgroup> = gruppo con titolo dentro un elenco a discesa.
 */
function indicatorSelect(latest) {
  const groups = OT_CONFIG.horizonOrder.filter(function (hz) { return hz in latest.horizons; }).map(function (hz) {
    const options = latest.horizons[hz].indicators.map(function (ind) {
      const selected = ind.id === storicoState.indicator ? " selected" : "";
      return `<option value="${ind.id}"${selected}>${OT.escape(ind.name)}</option>`;
    }).join("");
    return `<optgroup label="${OT_CONFIG.texts.horizonNames[hz]}">${options}</optgroup>`;
  }).join("");
  return `<select class="form-select form-select-sm ot-select" aria-label="${OT_CONFIG.texts.backtest.indicatorLabel}">${groups}</select>`;
}

// ============================================================
// WIDGET backtestTables — TABELLE DEL BACKTEST (SPEC 5.2, 5.4, 16.1)
// ============================================================
OT.registerWidget("backtestTables", {
  title: "Backtest",
  size: "full",
  needs: ["backtest", "latest"],

  render: function (body, files) {
    const b = files.backtest.data;
    const latest = files.latest.data;
    const tb = OT_CONFIG.texts.backtest;

    // Indicatore iniziale della vista "Indicatori": il primo del lungo.
    if (!storicoState.indicator) {
      const first = latest.horizons[OT_CONFIG.horizonOrder[0]];
      storicoState.indicator = first ? first.indicators[0].id : null;
    }

    const periodOptions = Object.keys(tb.periods).map(function (p) { return [p, tb.periods[p]]; });
    const viewOptions = Object.keys(tb.views).map(function (v) { return [v, tb.views[v]]; });
    const notes = tb.notes.map(function (n) {
      return `<li>${OT.escape(n.replace("{n}", OT_CONFIG.backtest.fewEpisodes))}</li>`;
    }).join("");

    body.innerHTML = `
      <div class="ot-toolbar">
        ${choiceButtons("view", viewOptions, storicoState.view)}
        ${choiceButtons("period", periodOptions, storicoState.period)}
      </div>
      <div class="ot-bt-period ot-muted small"></div>
      <div class="ot-bt-indicator"></div>
      <div class="ot-bt-content"></div>
      <ul class="ot-chart-note ot-bt-notes">${notes}</ul>`;

    // Ridisegna solo la parte che cambia con le scelte.
    function update() {
      body.querySelector(".ot-bt-period").textContent =
        `${tb.periods[storicoState.period]}: ${periodRangeText(b, storicoState.period)}`;
      const selectBox = body.querySelector(".ot-bt-indicator");
      selectBox.innerHTML = storicoState.view === "indicator" ? indicatorSelect(latest) : "";
      const select = selectBox.querySelector("select");
      if (select) {
        // "change" = l'utente ha scelto un'altra voce dell'elenco.
        select.addEventListener("change", function () { storicoState.indicator = select.value; update(); });
      }
      body.querySelector(".ot-bt-content").innerHTML = backtestContent(b, latest);
    }
    bindChoice(body, "view", function (value) { storicoState.view = value; update(); });
    bindChoice(body, "period", function (value) { storicoState.period = value; update(); });
    update();
  },
});
