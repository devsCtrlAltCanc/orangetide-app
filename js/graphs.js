// ============================================================
// js/graphs.js — WIDGET DELLA PAGINA GRAFICI (SPEC 11.3)
// ============================================================
// A cosa serve:
//   Grafici storici sullo stile di charts.bitbo.io: prezzo in scala
//   logaritmica in alto e la metrica sotto, con cursore e zoom condivisi
//   (vedi OT.charts.priceWithPane in charts.js).
//
// Widget definiti qui:
//   riskChart       indice di rischio (prezzo colorato dal verde al rosso)
//   fearGreedChart  Fear & Greed Index
//   mvrvChart       MVRV Z-Score con le zone storiche
//   cvddChart       prezzo con la linea del CVDD
//   etfFlowsChart   flussi ETF giornalieri (barre) e cumulati (linea)
//   fundingChart    funding rate giornaliero
//
// Legge: history.json (dates, price, risk, values, series).
// ============================================================

// ============================================================
// SEZIONE 1 — FUNZIONI DI SUPPORTO
// ============================================================
/** Colori delle fasce di rischio (config.js: colors.riskBands), solo i colori. */
function riskColorStops() {
  return OT_CONFIG.colors.riskBands.map(function (band) { return band[1]; });
}

/**
 * Prepara il pannello di un grafico: il contenitore alto e la nota sotto.
 * @param {HTMLElement} body
 * @param {string} note  spiegazione breve del grafico
 * @returns {HTMLElement} il contenitore del grafico
 */
function chartFrame(body, note) {
  body.innerHTML = `<div class="ot-chart ot-chart-tall"></div><div class="ot-chart-note">${note}</div>`;
  return body.querySelector(".ot-chart");
}

/** Somma cumulata di una serie, saltando i valori mancanti (restano null). */
function cumulative(values) {
  let total = 0;
  return values.map(function (v) {
    if (v === null) return null;
    total += v;
    return total;
  });
}

// ============================================================
// WIDGET riskChart — INDICE DI RISCHIO (SPEC 16.1)
// ============================================================
OT.registerWidget("riskChart", {
  title: "Indice di rischio",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    OT.charts.priceWithPane(chartFrame(body,
      "Il colore del prezzo segue l'indice di rischio del giorno: verde = rischio basso (zone storiche di accumulo), rosso = rischio alto (euforia)."), {
      dates: h.dates, price: h.price,
      priceColorBy: h.risk, colorStops: riskColorStops(),
      pane: {
        name: "Rischio", kind: "line", data: h.risk, min: 0, max: 1, colorByValue: true,
        format: function (v) { return OT.fmt.number(v, 2); },
      },
      zoomFrom: OT.charts.firstDate(h.dates, h.risk),
    });
  },
});

// ============================================================
// WIDGET fearGreedChart — FEAR & GREED INDEX
// ============================================================
OT.registerWidget("fearGreedChart", {
  title: "Fear & Greed Index",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    const data = h.series.fear_greed;
    // Colori del valore: dalle fasce di config.js (paura = rosso, avidità = verde).
    const stops = OT_CONFIG.fearGreedBands.map(function (b) { return b.color; });
    OT.charts.priceWithPane(chartFrame(body,
      "Sentiment del mercato (alternative.me): 0 = paura estrema, 100 = avidità estrema. Il prezzo è colorato con lo stesso valore."), {
      dates: h.dates, price: h.price,
      priceColorBy: data, colorStops: stops, colorMin: 0, colorMax: 100,
      pane: {
        name: "Fear & Greed", kind: "line", data: data, min: 0, max: 100, colorByValue: true,
        format: function (v) { return OT.fmt.number(v, 0); },
      },
      zoomFrom: OT.charts.firstDate(h.dates, data),
    });
  },
});

// ============================================================
// WIDGET mvrvChart — MVRV Z-SCORE (indicatore L1)
// ============================================================
OT.registerWidget("mvrvChart", {
  title: "MVRV Z-Score",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    const data = h.values.L1_mvrv_zscore || [];
    const zones = OT_CONFIG.charts.mvrvZones;
    OT.charts.priceWithPane(chartFrame(body,
      `Quanto il valore di mercato supera il "valore realizzato" (prezzo medio di acquisto delle monete), in deviazioni standard. Sotto ${zones.low}: storicamente zona di minimo; sopra ${zones.high}: zona di massimo. È l'indicatore L1 del lungo.`), {
      dates: h.dates, price: h.price,
      pane: {
        name: "MVRV Z", kind: "line", data: data,
        format: function (v) { return OT.fmt.number(v, 1); },
        zones: [
          { from: -5, to: zones.low, color: "rgba(34,160,107,0.15)" },
          { from: zones.high, to: 20, color: "rgba(229,72,77,0.15)" },
        ],
      },
      zoomFrom: h.dates[0],
    });
  },
});

// ============================================================
// WIDGET cvddChart — CVDD
// ============================================================
/**
 * Zone del CVDD per il riquadro "Prezzo / CVDD" (SPEC 16.5): una fascia
 * colorata per ogni zona del core (latest.json, cycle.cvdd.zones), dalla
 * zona precedente (o da 0) fino al suo "max".
 * @param {object|null|undefined} cvdd  latest.json cycle.cvdd
 */
function cvddZones(cvdd) {
  if (!cvdd) return [];
  const fills = OT_CONFIG.cvdd.zoneFills;
  let from = 0;
  return cvdd.zones.map(function (z, i) {
    const zone = { from: from, to: z.max, color: fills[i] || fills[fills.length - 1] };
    from = z.max;
    return zone;
  });
}

/** Nota sulle zone: "Fasce verdi: sotto 1,25× (Zona storica di minimo), ...". */
function cvddZonesNote(cvdd) {
  if (!cvdd) return "";
  const t = OT_CONFIG.texts.cycle;
  const items = cvdd.zones.map(function (z) {
    return t.cvddZoneItem.replace("{max}", OT.fmt.number(z.max, 2)).replace("{label}", OT.escape(z.label));
  });
  return " " + t.cvddZonesNote.replace("{zones}", items.join(", "));
}

OT.registerWidget("cvddChart", {
  title: "CVDD",
  size: "full",
  needs: ["history", "latest"],
  render: function (body, files) {
    const h = files.history.data;
    const cvdd = h.series.cvdd || [];
    const cvddToday = files.latest.data.cycle.cvdd;   // zone di oggi (può mancare)
    // Riquadro sotto: quanto il prezzo è sopra il CVDD (prezzo / CVDD).
    const ratio = h.price.map(function (p, i) {
      return (p === null || !cvdd[i]) ? null : p / cvdd[i];
    });
    OT.charts.priceWithPane(chartFrame(body,
      "Cumulative Value-Days Destroyed: valore delle monete \"vecchie\" spostate, cumulato e diviso per l'età del mercato. Il prezzo l'ha toccato ai minimi del 2015, 2018 e 2022. Sotto: quante volte il prezzo è sopra il CVDD." + cvddZonesNote(cvddToday)), {
      dates: h.dates, price: h.price,
      overlays: [{ name: "CVDD", data: cvdd, color: OT_CONFIG.colors.brand }],
      pane: {
        name: "Prezzo / CVDD", kind: "line", data: ratio, zones: cvddZones(cvddToday),
        format: function (v) { return OT.fmt.number(v, 1) + "×"; },
      },
      zoomFrom: h.dates[0],
    });
  },
});

// ============================================================
// WIDGET etfFlowsChart — FLUSSI ETF
// ============================================================
OT.registerWidget("etfFlowsChart", {
  title: "Flussi netti ETF spot USA",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    const flows = h.series.etf_flow_daily || [];
    const colors = OT_CONFIG.colors;
    OT.charts.priceWithPane(chartFrame(body,
      "Barre: entrate (verde) e uscite (rosso) nette giornaliere di tutti gli ETF spot USA, in milioni di dollari (Farside). Linea: totale cumulato dal lancio (gennaio 2024)."), {
      dates: h.dates, price: h.price,
      pane: {
        name: "Flusso del giorno", kind: "bar", data: flows,
        barColor: function (v) { return v >= 0 ? colors.buy : colors.sell; },
        format: function (v) { return OT.fmt.number(v, 0) + " M$"; },
        line2: {
          name: "Cumulato", data: cumulative(flows), color: colors.brand,
          format: function (v) { return OT.fmt.number(v / 1000, 1) + " mld$"; },
        },
      },
      zoomFrom: OT.charts.firstDate(h.dates, flows),
    });
  },
});

// ============================================================
// WIDGET fundingChart — FUNDING RATE (indicatore B2)
// ============================================================
// ============================================================
// WIDGET etfFlowLine — FLUSSO NETTO ETF COME LINEA (SPEC 11.3)
// ============================================================
// Stato della scelta Giornaliero / Somma 5 giorni (resta cambiando pagina).
const etfLineState = { mode: "sum" };

OT.registerWidget("etfFlowLine", {
  title: "Trend flussi netti ETF spot USA",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    const t = OT_CONFIG.texts.etf;
    // Serie "somma 5 giorni": assente nei dati prodotti prima del 2026-11-26;
    // in quel caso si mostra solo la giornaliera.
    const hasSum = Array.isArray(h.series.etf_flow_sum);
    if (!hasSum) etfLineState.mode = "daily";

    const choices = hasSum ? OT.ui.choiceButtons("etfLine", [["daily", t.daily], ["sum", t.sum5]], etfLineState.mode) : "";
    body.innerHTML = `<div class="ot-toolbar">${choices}</div>
      <div class="ot-chart ot-chart-tall"></div><div class="ot-chart-note">${OT.escape(t.lineNote)}</div>`;
    const container = body.querySelector(".ot-chart");
    let chart = null;

    /** Disegna il grafico; zoom = intervallo da conservare (null = iniziale). */
    function draw(zoom) {
      const daily = etfLineState.mode === "daily";
      const flows = (daily ? h.series.etf_flow_daily : h.series.etf_flow_sum) || [];
      chart = OT.charts.priceWithPane(container, {
        dates: h.dates, price: h.price,
        pane: {
          name: daily ? t.lineDaily : t.lineSum, kind: "line", data: flows,
          color: OT_CONFIG.colors.brand, zeroLine: true, splitNumber: 4,
          format: function (v) { return OT.fmt.number(v, 0) + " M$"; },
          // Asse compatto in miliardi (1.000 M$ = 1 mld$), con il meno tipografico.
          axisFormat: function (v) {
            if (v === 0) return "0";
            const abs = Math.abs(v) / 1000;
            return (v < 0 ? "−" : "") + OT.fmt.number(abs, abs % 1 === 0 ? 0 : 1) + " mld$";
          },
        },
        zoomFrom: OT.charts.firstDate(h.dates, flows),
      });
      // Si conserva lo zoom scelto prima del cambio di serie.
      if (zoom) chart.dispatchAction({ type: "dataZoom", start: zoom.start, end: zoom.end });
    }
    draw(null);

    OT.ui.bindChoice(body, "etfLine", function (value) {
      const z = chart.getOption().dataZoom[0];
      etfLineState.mode = value;
      draw({ start: z.start, end: z.end });
    });
  },
});

OT.registerWidget("fundingChart", {
  title: "Funding rate",
  size: "full",
  needs: ["history"],
  render: function (body, files) {
    const h = files.history.data;
    const data = h.series.funding_daily || [];
    const colors = OT_CONFIG.colors;
    OT.charts.priceWithPane(chartFrame(body,
      "Costo giornaliero per tenere aperte le posizioni sui perpetual BTC (Deribit). Positivo (verde) = chi compra a leva paga chi vende: mercato ottimista; negativo (rosso) = pessimismo."), {
      dates: h.dates, price: h.price,
      pane: {
        name: "Funding", kind: "bar", data: data,
        barColor: function (v) { return v >= 0 ? colors.buy : colors.sell; },
        format: function (v) { return OT.fmt.number(v * 100, 3) + "%"; },
      },
      zoomFrom: OT.charts.firstDate(h.dates, data),
    });
  },
});
