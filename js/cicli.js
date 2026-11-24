// ============================================================
// js/cicli.js — WIDGET DELLA PAGINA CICLI (SPEC 16.4)
// ============================================================
// A cosa serve:
//   Confronta i cicli di Bitcoin tra loro, come contesto descrittivo
//   (non sono segnali):
//
// Widget definiti qui:
//   halvingRoiChart  rendimento dal giorno dell'halving, una curva per epoca
//   peakRoiChart     rendimento dal massimo di ciclo fino al massimo
//                    successivo, una curva per ciclo
//   cycleTable       tabella di confronto: massimo di ogni epoca e minimo
//                    raggiunto dopo
//
// Avvertenza sui pochi cicli (SPEC 16.4): non mostrata, per decisione
// dell'utente del 2026-11-24 (è un limite noto e intrinseco del confronto).
//
// Legge: history.json, parte "cycles":
//   halvings     date degli halving
//   peaks        massimo di ciclo di ogni epoca {halving, peak, price, day, provisional}
//   epoch_day    giorni dall'ultimo halving (0 = giorno dell'halving)
//   roi_halving  rendimento dal prezzo del giorno dell'halving (0,5 = +50%)
//   peak_day     giorni dall'ultimo massimo di ciclo (0 = giorno del massimo)
//   roi_peak     rendimento dal prezzo del massimo (−0,5 = −50%)
// Usa: OT.ui (app.js) per i pulsanti di scelta, OT.charts (charts.js).
// ============================================================

// ============================================================
// SEZIONE 1 — STATO E FUNZIONI DI SUPPORTO
// ============================================================
// Scala verticale scelta (vale per entrambi i grafici e resta finché
// l'app è aperta, anche se la pagina viene ridisegnata).
const cicliState = {
  scale: OT_CONFIG.cycles.defaultScale,
};

/**
 * Divide una colonna "giorni da..." in curve separate: una curva nuova
 * comincia ogni volta che il contatore torna a 0 (nuovo halving o nuovo
 * massimo di ciclo).
 * @param {object} h          history.json
 * @param {Array} dayColumn   es. h.cycles.epoch_day
 * @param {Array} roiColumn   es. h.cycles.roi_halving
 * @returns {Array<{start: number, points: Array}>}
 *          start  = posizione in history.json del giorno 0
 *          points = [[giorni, rendimento, posizione], ...]
 */
function splitCurves(h, dayColumn, roiColumn) {
  const curves = [];
  let current = null;
  for (let i = 0; i < h.dates.length; i++) {
    const day = dayColumn[i];
    if (day === null || day === undefined) continue;
    if (day === 0 || current === null) {
      current = { start: i, points: [] };
      curves.push(current);
    }
    if (roiColumn[i] !== null && roiColumn[i] !== undefined) {
      current.points.push([day, roiColumn[i], i]);
    }
  }
  return curves;
}

/**
 * Colore di ogni curva: l'ultima (in corso) arancione, le altre dai colori
 * delle epoche passate, nell'ordine (se le curve sono più dei colori, si
 * ricomincia dal primo: "%" = resto della divisione).
 * @param {number} index  posizione della curva (0 = la più vecchia)
 * @param {number} count  numero di curve
 */
function curveColor(index, count) {
  if (index === count - 1) return OT_CONFIG.colors.brand;
  const past = OT_CONFIG.cycles.pastColors;
  return past[index % past.length];
}

/**
 * Valore da disegnare secondo la scala:
 *   logaritmica -> moltiplicatore del prezzo (1 + rendimento: +100% = 2×),
 *                  perché la scala log non accetta valori ≤ 0;
 *   lineare     -> rendimento così com'è.
 */
function plotValue(roi) {
  return cicliState.scale === "log" ? 1 + roi : roi;
}

/** Mese e anno in italiano: "2017-12-16" -> "dic 2017". */
function monthYear(isoDate) {
  return new Date(isoDate + "T00:00:00Z").toLocaleDateString(OT_CONFIG.locale,
    { month: "short", year: "numeric", timeZone: "UTC" });
}

// ============================================================
// SEZIONE 2 — GRAFICO DELLE CURVE (comune ai due widget)
// ============================================================
/**
 * Opzioni ECharts di un grafico "una curva per ciclo".
 * @param {object} o
 *   curves     curve di splitCurves, con in più { name }
 *   markers    [{ curve: indice, point: [giorni, rendimento] }] pallini (massimo o minimo)
 *   xName      titolo dell'asse orizzontale
 *   axisLabel  funzione: valore disegnato -> etichetta dell'asse verticale
 */
function cycleChartOption(o) {
  const colors = OT.charts.themeColors();
  const cfg = OT_CONFIG.cycles;
  const tc = OT_CONFIG.texts.cicli;
  const count = o.curves.length;
  const series = [];

  o.curves.forEach(function (curve, index) {
    const isCurrent = index === count - 1;
    const color = curveColor(index, count);
    const line = {
      name: curve.name, type: "line", showSymbol: false,
      data: curve.points.map(function (p) { return [p[0], plotValue(p[1])]; }),
      lineStyle: { width: isCurrent ? cfg.currentLineWidth : cfg.lineWidth, color: color },
      itemStyle: { color: color },
      z: isCurrent ? 3 : 2,                     // la curva in corso sopra le altre
    };
    // Curva in corso: linea verticale tratteggiata sul giorno di oggi.
    if (isCurrent && curve.points.length) {
      const today = curve.points[curve.points.length - 1][0];
      line.markLine = {
        silent: true, symbol: "none",
        lineStyle: { color: color, type: "dashed", width: 1 },
        label: { formatter: tc.today, color: color, fontWeight: 700 },
        data: [{ xAxis: today }],
      };
    }
    series.push(line);
  });

  // Pallini (massimo o minimo di ogni ciclo): stessa "name" della curva, così
  // nascondendo una curva dalla legenda si nasconde anche il suo pallino.
  for (const m of o.markers) {
    const color = curveColor(m.curve, count);
    series.push({
      name: o.curves[m.curve].name, type: "scatter", symbolSize: 9,
      data: [[m.point[0], plotValue(m.point[1])]],
      itemStyle: { color: color, borderColor: colors.panel, borderWidth: 2 },
      z: 4,
    });
  }

  const isLog = cicliState.scale === "log";
  return {
    animation: false,
    legend: {
      top: 0, left: 0, icon: "roundRect", itemWidth: 12, itemHeight: 4,
      textStyle: { color: colors.muted, fontSize: 11 },
    },
    tooltip: {
      trigger: "axis", confine: true,
      backgroundColor: colors.panel, borderColor: colors.border,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: function (items) {
        // Solo le curve (i pallini ripeterebbero lo stesso valore).
        const lines = items.filter(function (it) { return it.seriesType === "line"; });
        if (!lines.length) return "";
        const header = `<div class="small">${tc.day} ${lines[0].value[0]}</div>`;
        return header + lines.map(function (it) {
          const roi = isLog ? it.value[1] - 1 : it.value[1];
          return `${it.marker} ${OT.escape(it.seriesName)}: <b>${OT.fmt.pct(roi, 0)}</b>`;
        }).join("<br>");
      },
    },
    // top 60: spazio per la legenda (su telefono va su due righe) e per la
    // scritta "oggi" sopra la linea tratteggiata.
    grid: { left: 8, right: 64, top: 60, bottom: 64 },
    xAxis: {
      type: "value", min: 0, name: o.xName, nameLocation: "middle", nameGap: 26,
      nameTextStyle: { color: colors.muted, fontSize: 11 },
      axisLine: { lineStyle: { color: colors.border } },
      // Etichette all'italiana (ECharts scriverebbe "1,200").
      axisLabel: { color: colors.muted, fontSize: 11, formatter: function (v) { return OT.fmt.number(v, 0); } },
      splitLine: { show: false },
    },
    yAxis: {
      // logBase 2: righe a 0,25× 0,5× 1× 2× 4× 8×... (più fitte che in base 10).
      type: isLog ? "log" : "value", logBase: 2, position: "right", scale: true,
      axisLabel: { color: colors.muted, fontSize: 11, formatter: o.axisLabel },
      splitLine: { lineStyle: { color: colors.border } },
    },
    dataZoom: [
      { type: "inside", filterMode: "none" },
      { type: "slider", filterMode: "none", bottom: 4, height: 18,
        borderColor: colors.border, textStyle: { color: colors.muted, fontSize: 10 },
        fillerColor: "rgba(247,132,26,0.15)", handleStyle: { color: OT_CONFIG.colors.brand } },
    ],
    series: series,
  };
}

/**
 * Disegna il riquadro di un grafico dei cicli: pulsanti della scala,
 * grafico, nota. Al cambio di scala ridisegna il grafico.
 * @param {HTMLElement} body
 * @param {function} buildOption  restituisce le opzioni ECharts per la scala corrente
 * @param {string} note           spiegazione del grafico
 */
function renderCycleChart(body, buildOption, note) {
  const tc = OT_CONFIG.texts.cicli;
  const scales = [["log", tc.scaleLog], ["linear", tc.scaleLinear]];
  body.innerHTML = `
    <div class="ot-toolbar">${OT.ui.choiceButtons("scale", scales, cicliState.scale)}</div>
    <div class="ot-chart ot-chart-tall"></div>
    <div class="ot-chart-note">${note}</div>`;
  const chart = OT.charts.create(body.querySelector(".ot-chart"), buildOption());
  OT.ui.bindChoice(body, "scale", function (value) {
    cicliState.scale = value;
    // notMerge: true = sostituisce le opzioni (cambia il tipo di asse).
    chart.setOption(buildOption(), { notMerge: true });
  });
}

// ============================================================
// WIDGET halvingRoiChart — ROI DA HALVING A HALVING (SPEC 16.4)
// ============================================================
OT.registerWidget("halvingRoiChart", {
  title: "Rendimento dall'halving",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    const c = h.cycles;
    const tc = OT_CONFIG.texts.cicli;

    const curves = splitCurves(h, c.epoch_day, c.roi_halving);
    curves.forEach(function (curve) {
      curve.name = `${tc.epoch} ${h.dates[curve.start].slice(0, 4)}`;
    });

    // Pallino sul massimo di ciclo di ogni epoca (cycles.peaks).
    const markers = [];
    for (const peak of c.peaks) {
      const index = h.dates.indexOf(peak.peak);
      const curve = curves.findIndex(function (cv) { return h.dates[cv.start] === peak.halving; });
      if (index >= 0 && curve >= 0 && c.roi_halving[index] !== null) {
        markers.push({ curve: curve, point: [peak.day, c.roi_halving[index]] });
      }
    }

    renderCycleChart(body, function () {
      return cycleChartOption({
        curves: curves, markers: markers, xName: tc.daysFromHalving,
        // Scala log: moltiplicatore "4×"; lineare: percentuale.
        axisLabel: function (v) {
          return cicliState.scale === "log" ? OT.fmt.number(v, v < 1 ? 2 : 0) + "×" : OT.fmt.pct(v, 0);
        },
      });
    }, tc.halvingNote);
  },
});

// ============================================================
// WIDGET peakRoiChart — ROI DOPO IL MASSIMO DI CICLO (SPEC 16.4)
// ============================================================
OT.registerWidget("peakRoiChart", {
  title: "Rendimento dopo il massimo di ciclo",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    const c = h.cycles;
    const tc = OT_CONFIG.texts.cicli;

    const curves = splitCurves(h, c.peak_day, c.roi_peak);
    const markers = [];
    curves.forEach(function (curve, index) {
      curve.name = `${tc.cycle} ${monthYear(h.dates[curve.start])}`;
      // Pallino sul minimo dopo il massimo (il punto più basso della curva).
      let lowest = null;
      for (const p of curve.points) {
        if (lowest === null || p[1] < lowest[1]) lowest = p;
      }
      if (lowest) markers.push({ curve: index, point: [lowest[0], lowest[1]] });
    });

    renderCycleChart(body, function () {
      return cycleChartOption({
        curves: curves, markers: markers, xName: tc.daysFromPeak,
        // In entrambe le scale l'etichetta è la variazione dal massimo (−50%).
        axisLabel: function (v) { return OT.fmt.pct(cicliState.scale === "log" ? v - 1 : v, 0); },
      });
    }, tc.peakNote);
  },
});

// ============================================================
// WIDGET cycleTable — CONFRONTO DEI CICLI
// ============================================================
/**
 * Una riga per ogni epoca con un massimo di ciclo: massimo (data, prezzo,
 * giorno dall'halving, rendimento dall'halving) e minimo successivo (calo e
 * giorni dal massimo, fino al massimo successivo o a oggi).
 * @param {object} h  history.json
 * @returns {object[]}
 */
function cycleRows(h) {
  const c = h.cycles;
  const peaks = c.peaks;
  return peaks.map(function (peak, k) {
    const start = h.dates.indexOf(peak.peak);
    // Fine del ciclo: il giorno prima del massimo successivo, o l'ultimo dato.
    const next = k + 1 < peaks.length ? h.dates.indexOf(peaks[k + 1].peak) : h.dates.length;
    let bottom = null;
    for (let i = start; i < next; i++) {
      if (c.roi_peak[i] === null) continue;
      if (bottom === null || c.roi_peak[i] < c.roi_peak[bottom]) bottom = i;
    }
    return {
      peak: peak,
      peakRoi: start >= 0 ? c.roi_halving[start] : null,
      bottom: bottom,
      isLast: k === peaks.length - 1,
    };
  });
}

OT.registerWidget("cycleTable", {
  title: "Confronto dei cicli",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    const c = h.cycles;
    const t = OT_CONFIG.texts.cicli.table;
    const provisional = OT_CONFIG.texts.cycle.provisional;

    const rows = cycleRows(h).map(function (r) {
      const p = r.peak;
      const prov = p.provisional ? ` <span class="ot-badge ot-badge-brand">${provisional}</span>` : "";
      const ongoing = r.isLast ? ` <span class="ot-badge ot-badge-brand">${t.ongoing}</span>` : "";
      let bottomCell = "n/d";
      let dropCell = "n/d";
      if (r.bottom !== null) {
        const soFar = r.isLast ? ` <span class="ot-sub">${t.soFar}</span>` : "";
        bottomCell = `${OT.fmt.date(h.dates[r.bottom])} · ${OT.fmt.usd(h.price[r.bottom])}
          <div class="ot-sub">${t.daysAfterPeak.replace("{n}", c.peak_day[r.bottom])}</div>`;
        dropCell = `<span class="ot-neg">${OT.fmt.pct(c.roi_peak[r.bottom], 0)}</span>${soFar}`;
      }
      return `<tr>
          <td><b>${p.halving.slice(0, 4)}</b>${ongoing}</td>
          <td>${OT.fmt.date(p.peak)} · ${OT.fmt.usd(p.price)}${prov}
            <div class="ot-sub">${t.dayAfterHalving.replace("{n}", p.day)}</div></td>
          <td class="ot-pos">${OT.fmt.pct(r.peakRoi, 0)}</td>
          <td>${bottomCell}</td>
          <td>${dropCell}</td>
        </tr>`;
    }).join("");

    body.innerHTML = `
      <div class="ot-table-wrap"><table class="ot-table">
        <thead><tr>
          <th>${t.epoch}</th><th>${t.peak}</th><th>${t.peakRoi}</th>
          <th>${t.bottom}</th><th>${t.bottomDrop}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  },
});
