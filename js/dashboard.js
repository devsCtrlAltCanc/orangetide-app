// ============================================================
// js/dashboard.js — WIDGET DELLA SITUAZIONE DI OGGI (SPEC 11.1, 16)
// ============================================================
// A cosa serve:
//   Definisce i widget della situazione di oggi. Ogni widget si registra
//   con OT.registerWidget (vedi app.js) e può essere messo in qualunque
//   pagina elencandolo in config.js.
//
// Widget definiti qui:
//   priceHero        prezzo attuale, variazioni e grafico del prezzo
//   riskGauge        indice di rischio 0–1 e ultimi 30 giorni (SPEC 16.1)
//   fearGreed        Fear & Greed Index di oggi e degli ultimi giorni
//   combinedReading  lettura combinata lungo × breve (SPEC 2.3)
//   horizonCards     segnale, convenienza, accordo e dettaglio per orizzonte (SPEC 2.2)
//   cycleSummary     distanza dal CVDD, drawdown, epoca di halving, massimo di
//                    ciclo (SPEC 16.3–16.5)
//   report           report a semafori (SPEC 9.2; non usato nella dashboard)
//
// Legge: latest.json (situazione di oggi), meta.json (ora dell'aggiornamento),
//        history.json (grafico del prezzo e ultimi giorni di rischio e Fear & Greed).
// ============================================================

// ============================================================
// SEZIONE 1 — FUNZIONI DI SUPPORTO
// ============================================================
/** Classe CSS di un segnale: "BUY" -> "buy"; n/d -> "hold". */
function signalClass(signal) {
  return { BUY: "buy", SELL: "sell" }[signal] || "hold";
}

/** Classe CSS di un livello −2…+2: positivo -> buy, negativo -> sell, 0/null -> hold. */
function levelClass(level) {
  if (level === null) return "hold";
  return level > 0 ? "buy" : (level < 0 ? "sell" : "hold");
}

/** Livello come testo con segno: 2 -> "+2", −1 -> "−1", null -> "n/d". */
function levelText(level) {
  if (level === null) return "n/d";
  if (level > 0) return "+" + level;
  return level < 0 ? "−" + Math.abs(level) : "0";
}

/** Numero intero con segno: 88 -> "+88", −38 -> "−38". */
function signedInt(value) {
  if (value === null) return "n/d";
  return value > 0 ? "+" + value : (value < 0 ? "−" + Math.abs(value) : "0");
}

/**
 * Fascia del Fear & Greed di un valore (config.js: fearGreedBands).
 * @returns {{label: string, color: string}}
 */
function fearGreedBand(value) {
  const bands = OT_CONFIG.fearGreedBands;
  return bands.find(function (b) { return value < b.to; }) || bands[bands.length - 1];
}

// ============================================================
// WIDGET priceHero — PREZZO DI OGGI E GRAFICO DEL PREZZO
// ============================================================
OT.registerWidget("priceHero", {
  title: null,
  size: "full",
  needs: ["latest", "meta", "history"],

  /**
   * @param {HTMLElement} body   corpo del pannello
   * @param {object} files       files.<nome> = { data, fromCache, savedAt }
   */
  render: function (body, files) {
    const latest = files.latest.data;
    const meta = files.meta.data;
    const history = files.history.data;
    const texts = OT_CONFIG.texts;
    const ranges = OT_CONFIG.charts.priceRanges;

    // Avviso se i dati vengono dalla memoria del dispositivo (rete assente).
    const cacheNote = files.latest.fromCache
      ? `<div class="ot-note-warning mt-3"><i class="bi bi-cloud-slash"></i> ${texts.fromCache}</div>`
      : "";

    const buttons = ranges.map(function (r) {
      return `<button type="button" class="ot-range" data-range="${r.label}">${r.label}</button>`;
    }).join("");

    body.innerHTML = `
      <div class="ot-hero">
        <div class="ot-tile ot-tile-hero ot-hero-price">
          <div class="d-flex justify-content-between align-items-start">
            <div class="ot-tile-label">Bitcoin</div>
            <i class="bi bi-currency-bitcoin fs-4"></i>
          </div>
          <div class="ot-tile-value">${OT.fmt.usd(latest.price)}</div>
          <div class="d-flex flex-column gap-1 ot-tile-sub">
            <span><span class="ot-badge">${OT.fmt.pct(latest.cycle.drawdown)}</span> dal massimo storico</span>
            <span><span class="ot-badge">${OT.fmt.pct(latest.cycle.roi_since_halving)}</span> dall'halving</span>
          </div>
          <div class="ot-tile-sub mt-3">${texts.dataAsOf} ${OT.fmt.date(latest.date)} · ${texts.updatedAt} ${OT.fmt.dateTime(meta.generated_at)}</div>
        </div>
        <div class="ot-hero-chart">
          <div class="ot-ranges">${buttons}</div>
          <div class="ot-chart ot-price-area"></div>
        </div>
      </div>
      ${cacheNote}`;

    // Disegna il grafico per il periodo scelto e evidenzia il pulsante.
    const chartBox = body.querySelector(".ot-price-area");
    function draw(label) {
      const range = ranges.find(function (r) { return r.label === label; });
      const from = range.days === null ? 0 : Math.max(0, history.dates.length - range.days);
      const points = [];
      for (let i = from; i < history.dates.length; i++) {
        if (history.price[i] !== null) points.push([history.dates[i], history.price[i]]);
      }
      OT.charts.priceArea(chartBox, points);
      for (const b of body.querySelectorAll(".ot-range")) {
        b.classList.toggle("active", b.dataset.range === label);
      }
    }
    for (const b of body.querySelectorAll(".ot-range")) {
      b.addEventListener("click", function () { draw(b.dataset.range); });
    }
    draw(OT_CONFIG.charts.priceRangeDefault);
  },
});

/**
 * Ultimi N valori non nulli di una colonna di history.json, come [data, valore].
 * @param {object} history   contenuto di history.json
 * @param {Array} values     colonna (es. history.risk)
 * @param {number} count     quanti valori
 */
function lastPoints(history, values, count) {
  const points = [];
  for (let i = values.length - 1; i >= 0 && points.length < count; i--) {
    if (values[i] !== null) points.unshift([history.dates[i], values[i]]);
  }
  return points;
}

/** Colore della fascia di rischio di un valore 0–1 (config.js: colors.riskBands). */
function riskColor(value) {
  const bands = OT_CONFIG.colors.riskBands;
  const band = bands.find(function (b) { return value <= b[0]; }) || bands[bands.length - 1];
  return band[1];
}

// ============================================================
// WIDGET riskGauge — INDICE DI RISCHIO (SPEC 16.1)
// ============================================================
OT.registerWidget("riskGauge", {
  title: "Indice di rischio",
  needs: ["latest", "history"],

  render: function (body, files) {
    const risk = files.latest.data.risk;
    const history = files.history.data;
    if (!risk || risk.value === null) {
      body.innerHTML = `<div class="ot-muted">${OT_CONFIG.texts.dataUnavailable}</div>`;
      return;
    }
    body.innerHTML = `
      <div class="ot-chart ot-semicircle"></div>
      <div class="text-center">
        <span class="ot-badge ot-badge-brand fs-6">${OT.escape(risk.label)}</span>
      </div>
      <div class="ot-chart ot-sparkline"></div>`;
    // Arco arancione sfumato (dal chiaro allo scuro), come la tessera del prezzo.
    const gradient = new echarts.graphic.LinearGradient(0, 0, 1, 0, [
      { offset: 0, color: OT_CONFIG.colors.brandLight },
      { offset: 1, color: OT_CONFIG.colors.brand },
    ]);
    OT.charts.semicircle(body.querySelector(".ot-semicircle"), {
      value: risk.value, min: 0, max: 1, decimals: 2, color: gradient,
    });
    OT.charts.recentBars(body.querySelector(".ot-sparkline"),
      lastPoints(history, history.risk, OT_CONFIG.charts.sparklineDays), riskColor, { max: 1, decimals: 2 });
  },
});

// ============================================================
// WIDGET fearGreed — FEAR & GREED INDEX
// ============================================================
OT.registerWidget("fearGreed", {
  title: "Fear & Greed Index",
  needs: ["history"],

  render: function (body, files) {
    const history = files.history.data;
    const points = lastPoints(history, history.series.fear_greed || [], OT_CONFIG.charts.sparklineDays);
    if (points.length === 0) {
      body.innerHTML = `<div class="ot-muted">${OT_CONFIG.texts.dataUnavailable}</div>`;
      return;
    }
    const today = points[points.length - 1];
    const band = fearGreedBand(today[1]);

    body.innerHTML = `
      <div class="ot-chart ot-semicircle"></div>
      <div class="text-center">
        <span class="ot-badge fs-6" style="background:${band.color}22;color:${band.color}">${band.label}</span>
      </div>
      <div class="ot-chart ot-sparkline"></div>`;

    OT.charts.semicircle(body.querySelector(".ot-semicircle"), {
      value: today[1], min: 0, max: 100, decimals: 0, color: band.color,
    });
    OT.charts.recentBars(body.querySelector(".ot-sparkline"), points,
      function (v) { return fearGreedBand(v).color; }, { max: 100, decimals: 0 });
  },
});

// ============================================================
// WIDGET combinedReading — LETTURA COMBINATA (SPEC 2.3), su una riga
// ============================================================
OT.registerWidget("combinedReading", {
  title: "Lettura combinata",
  size: "full",
  needs: ["latest"],

  render: function (body, files) {
    const r = files.latest.data.combined_reading;
    const t = OT_CONFIG.texts;
    body.innerHTML = `
      <div class="ot-reading-row">
        <div class="ot-reading">
          <div class="ot-reading-icon"><i class="bi bi-compass"></i></div>
          <div>
            <div class="ot-label">${t.readingMarket}</div>
            <div class="ot-reading-text">${OT.escape(r.market)}</div>
            <div class="mt-1 d-flex gap-2 flex-wrap">
              <span class="ot-badge ot-badge-${signalClass(r.long)}">${t.combinedLong} ${r.long}</span>
              <span class="ot-badge ot-badge-${signalClass(r.short)}">${t.combinedShort} ${r.short}</span>
            </div>
          </div>
        </div>
        <div class="ot-tile">
          <div class="ot-tile-label"><i class="bi bi-cart-plus"></i> ${t.readingBuy}</div>
          <div class="ot-strong mt-1">${OT.escape(r.buy)}</div>
        </div>
        <div class="ot-tile">
          <div class="ot-tile-label"><i class="bi bi-wallet2"></i> ${t.readingHold}</div>
          <div class="ot-strong mt-1">${OT.escape(r.hold)}</div>
        </div>
      </div>`;
  },
});

// ============================================================
// WIDGET horizonCards — I TRE ORIZZONTI (SPEC 2.2, 11.1)
// ============================================================
OT.registerWidget("horizonCards", {
  title: "Orizzonti",
  size: "full",
  needs: ["latest"],

  render: function (body, files) {
    const latest = files.latest.data;
    // Testo di ogni indicatore dal report del core (già formattato all'italiana):
    // "🟢 MVRV Z-Score: +0,25 (percentile 7 → +2)" -> "+0,25 (percentile 7 → +2)".
    const reportById = {};
    for (const line of latest.report) {
      const colon = line.text.indexOf(": ");
      reportById[line.id] = colon >= 0 ? line.text.slice(colon + 2) : line.text;
    }

    const cards = OT_CONFIG.horizonOrder
      .filter(function (id) { return id in latest.horizons; })
      .map(function (id) { return horizonCard(id, latest.horizons[id], reportById); })
      .join("");
    body.innerHTML = `<div class="ot-horizons">${cards}</div>`;
  },
});

/**
 * HTML della card di un orizzonte.
 * @param {string} id           "short", "medium" o "long"
 * @param {object} h            orizzonte da latest.json (signal, convenience, ...)
 * @param {object} reportById   id indicatore -> testo del valore
 */
function horizonCard(id, h, reportById) {
  const t = OT_CONFIG.texts;
  const cls = signalClass(h.signal);

  // Frase semplice: "Contesto favorevole all'acquisto · 4 indicatori su 4 positivi".
  const nonNeutral = h.positives + h.negatives;
  const majority = h.convenience >= 0 ? h.positives : h.negatives;
  const word = h.convenience >= 0 ? "positivi" : "negativi";
  const countText = nonNeutral === 0 ? "tutti gli indicatori neutri"
    : `${majority} indicatori su ${h.available} ${word}`;

  // Barra della convenienza: parte dal centro (0) verso destra (+) o sinistra (−).
  let fill = "";
  if (h.convenience !== null) {
    const half = Math.abs(h.convenience) / 2;        // 100 -> 50% della barra
    const left = h.convenience >= 0 ? 50 : 50 - half;
    const color = h.convenience >= 0 ? "var(--ot-buy)" : "var(--ot-sell)";
    fill = `<div class="ot-meter-fill" style="left:${left}%;width:${half}%;background:${color}"></div>`;
  }

  // Un pallino per indicatore, colorato secondo il livello.
  const dots = h.indicators.map(function (ind) {
    return `<span class="ot-dot ot-dot-${levelClass(ind.level)}" title="${OT.escape(ind.name)}: ${levelText(ind.level)}"></span>`;
  }).join("");

  const rows = h.indicators.map(function (ind) {
    return `
      <div class="ot-indicator-row">
        <div>
          <div class="ot-strong">${OT.escape(ind.name)}</div>
          <div class="ot-muted">${OT.escape(reportById[ind.id] || "n/d")}</div>
        </div>
        <span class="ot-badge ot-badge-${levelClass(ind.level)}">${levelText(ind.level)}</span>
      </div>`;
  }).join("");

  return `
    <div class="ot-hcard">
      <div class="ot-hcard-head ot-hcard-${cls}">
        <div>
          <div class="ot-hcard-name">${OT.escape(h.name)}
            <span class="ot-hcard-role">${OT.escape(h.role)}</span></div>
          <div class="ot-hcard-period">${t.horizonPeriods[id]}</div>
        </div>
        <div class="ot-hcard-signal">${h.signal}</div>
      </div>
      <div class="ot-hcard-body">
        <div class="ot-hcard-sentence">${t.signalSentences[h.signal] || ""}</div>
        <div class="ot-muted small">${countText}</div>
        <div class="ot-kv mt-3"><span class="ot-muted">${t.convenience}</span><b>${signedInt(h.convenience)}</b></div>
        <div class="ot-meter"><div class="ot-meter-zero"></div>${fill}</div>
        <div class="d-flex justify-content-between small ot-muted"><span>−100</span><span>0</span><span>+100</span></div>
        <div class="ot-kv mt-2">
          <span class="ot-muted">${t.agreement}</span>
          <b>${h.agreement === null ? "n/d" : h.agreement + "%"}</b>
        </div>
        <div class="ot-dots">${dots}</div>
        <details class="ot-details">
          <summary>${t.showDetails}</summary>
          ${rows}
        </details>
      </div>
    </div>`;
}

// ============================================================
// WIDGET cycleSummary — CONTESTO CICLICO DI OGGI (SPEC 16.3, 16.4, 16.5)
// ============================================================
/**
 * Tessera "Distanza dal CVDD" (SPEC 16.5): quante volte il prezzo è sopra il
 * CVDD e in quale zona storica si trova. Contesto descrittivo, non un segnale.
 * @param {object|null|undefined} cvdd  latest.json cycle.cvdd:
 *   { value, ratio (prezzo / CVDD), zone (etichetta o null), zones [{max, label}] }
 * @returns {string} HTML ("" se il CVDD manca)
 */
function cvddTile(cvdd) {
  if (!cvdd) return "";
  const t = OT_CONFIG.texts.cycle;
  // Colore della pillola: quello della zona in cui cade il rapporto
  // (stesso ordine delle zone del core: config.js, cvdd.zoneBadges).
  const zoneIndex = cvdd.zones.findIndex(function (z) { return cvdd.ratio <= z.max; });
  const badge = zoneIndex >= 0 ? (OT_CONFIG.cvdd.zoneBadges[zoneIndex] || "hold") : "hold";
  const zoneText = cvdd.zone || t.cvddNoZone;
  // ratio 1,2459 -> "+24,6%" sopra il CVDD; sotto 1 -> negativo.
  const distance = cvdd.ratio - 1;
  const position = distance >= 0 ? t.cvddAbove : t.cvddBelow;
  return `
    <div class="ot-tile">
      <div class="ot-tile-label">${t.cvdd}</div>
      <div class="ot-tile-value">${OT.fmt.number(cvdd.ratio, 2)}×</div>
      <div class="ot-tile-sub">
        <span class="ot-badge ot-badge-${badge}">${OT.escape(zoneText)}</span>
        ${OT.fmt.pct(distance)} ${position} ${OT.fmt.usd(cvdd.value)}
      </div>
    </div>`;
}

OT.registerWidget("cycleSummary", {
  title: "Contesto ciclico",
  size: "full",
  needs: ["latest"],

  render: function (body, files) {
    const c = files.latest.data.cycle;
    const t = OT_CONFIG.texts.cycle;

    const peakTile = c.peak === null ? "" : `
      <div class="ot-tile">
        <div class="ot-tile-label">${t.peak}
          ${c.peak.provisional ? `<span class="ot-badge ot-badge-brand ms-1">${t.provisional}</span>` : ""}
        </div>
        <div class="ot-tile-value">${c.days_since_peak} ${t.peakDays}</div>
        <div class="ot-tile-sub">
          <span class="ot-badge ot-badge-${c.roi_since_peak < 0 ? "sell" : "buy"}">${OT.fmt.pct(c.roi_since_peak)}</span>
          ${t.athOn} ${OT.fmt.usd(c.peak.price)} il ${OT.fmt.date(c.peak.date)}
        </div>
      </div>`;

    body.innerHTML = `
      <div class="ot-tiles">
        ${cvddTile(c.cvdd)}
        <div class="ot-tile">
          <div class="ot-tile-label">${t.drawdown}</div>
          <div class="ot-tile-value">${OT.fmt.pct(c.drawdown)}</div>
          <div class="ot-tile-sub">${t.athOn} ${OT.fmt.usd(c.ath)} il ${OT.fmt.date(c.ath_date)}</div>
        </div>
        <div class="ot-tile">
          <div class="ot-tile-label">${t.epoch}</div>
          <div class="ot-tile-value">${t.epochDay} ${c.epoch_day ?? "n/d"}</div>
          <div class="ot-tile-sub">
            <span class="ot-badge ot-badge-${c.roi_since_halving < 0 ? "sell" : "buy"}">${OT.fmt.pct(c.roi_since_halving)}</span>
            ${t.sinceHalving} del ${OT.fmt.date(c.halving)}
          </div>
        </div>
        ${peakTile}
      </div>`;
  },
});

// ============================================================
// WIDGET etfSummary — FLUSSI ETF DEGLI ULTIMI GIORNI (SPEC 11.1, 16.6)
// ============================================================
// Contesto, come il CVDD: non cambia i punteggi. Dati: latest.json → etf
// (milioni di dollari; null se i flussi mancano; assente nei dati prodotti
// prima del 2026-11-26).

/**
 * Importo in milioni di dollari con segno: 812.4 -> "+812 M$", −95 -> "−95 M$".
 * @param {number|null} value
 */
function signedMillions(value) {
  if (value === null || value === undefined) return "n/d";
  const sign = value > 0 ? "+" : (value < 0 ? "−" : "");
  return sign + OT.fmt.number(Math.abs(value), 0) + " M$";
}

/** Classe del colore di un importo: verde se entrate, rosso se uscite. */
function flowClass(value) {
  if (value > 0) return "ot-pos";
  if (value < 0) return "ot-neg";
  return "";
}

/**
 * Testo della serie di giorni consecutivi: +3 -> "3 giorni" / "consecutivi
 * in entrata"; −1 -> "1 giorno" / "in uscita"; 0 -> ultimo flusso a zero.
 * @param {number} streak
 * @returns {{value: string, sub: string}}
 */
function streakText(streak) {
  const t = OT_CONFIG.texts.etf;
  if (!streak) return { value: "0", sub: t.streakFlat };
  const n = Math.abs(streak);
  const value = n === 1 ? t.streakDay : t.streakDays.replace("{n}", n);
  if (streak > 0) return { value: value, sub: n === 1 ? t.streakInOne : t.streakIn };
  return { value: value, sub: n === 1 ? t.streakOutOne : t.streakOut };
}

OT.registerWidget("etfSummary", {
  title: "Flussi ETF",
  size: "full",
  needs: ["latest"],

  render: function (body, files) {
    const e = files.latest.data.etf;
    const t = OT_CONFIG.texts.etf;
    if (!e) {
      body.innerHTML = `<div class="ot-muted">${t.missing}</div>`;
      return;
    }
    // Pillola della settimana: verde se afflussi, rossa se deflussi.
    const weekBadge = e.level > 0 ? "buy" : (e.level < 0 ? "sell" : "hold");
    const streak = streakText(e.streak);
    // Percentile troncato all'intero, come nel report (SPEC 9.2).
    const percentile = e.percentile === null ? "n/d" : Math.floor(e.percentile);

    body.innerHTML = `
      <div class="ot-tiles">
        <div class="ot-tile">
          <div class="ot-tile-label">${t.lastDay}</div>
          <div class="ot-tile-value ${flowClass(e.flow)}">${signedMillions(e.flow)}</div>
          <div class="ot-tile-sub">${OT.fmt.date(e.date)}</div>
        </div>
        <div class="ot-tile">
          <div class="ot-tile-label">${t.sum.replace("{days}", e.sum_days)}</div>
          <div class="ot-tile-value ${flowClass(e.sum)}">${signedMillions(e.sum)}</div>
          <div class="ot-tile-sub">${t.daysIn.replace("{in}", e.days_in).replace("{days}", e.sum_days)}</div>
        </div>
        <div class="ot-tile">
          <div class="ot-tile-label">${t.week}</div>
          <div class="ot-tile-value"><span class="ot-badge ot-badge-${weekBadge} ot-badge-lg">${OT.escape(e.label || "n/d")}</span></div>
          <div class="ot-tile-sub">${t.weekSub.replace("{p}", percentile)}</div>
        </div>
        <div class="ot-tile">
          <div class="ot-tile-label">${t.streak}</div>
          <div class="ot-tile-value ${flowClass(e.streak)}">${streak.value}</div>
          <div class="ot-tile-sub">${streak.sub}</div>
        </div>
      </div>
      <div class="ot-chart-note mt-2">${OT.escape(t.note)}</div>`;
  },
});

// ============================================================
// WIDGET report — REPORT A SEMAFORI (SPEC 9.2)
// ============================================================
// Non è nella dashboard (decisione del 2026-11-23: il dettaglio degli
// indicatori nelle card degli orizzonti lo sostituisce), ma resta
// disponibile: basta aggiungere "report" a una pagina in config.js.
OT.registerWidget("report", {
  title: "Report",
  size: "full",
  needs: ["latest"],

  render: function (body, files) {
    const lines = files.latest.data.report;
    const names = OT_CONFIG.texts.horizonNames;
    let html = "";
    for (const horizon of OT_CONFIG.horizonOrder) {
      const group = lines.filter(function (line) { return line.horizon === horizon; });
      if (group.length === 0) continue;
      html += `<div class="ot-row-group">${OT.escape(names[horizon] || horizon)}</div>`;
      html += group.map(function (line) {
        return `<div class="ot-row"><span>${OT.escape(line.text)}</span></div>`;
      }).join("");
    }
    body.innerHTML = `<div class="ot-rows">${html}</div>`;
  },
});
