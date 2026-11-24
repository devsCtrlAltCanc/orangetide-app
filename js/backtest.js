// ============================================================
// js/backtest.js — WIDGET DELLA PAGINA BACKTEST (SPEC 5, 11.2, 16.1)
// ============================================================
// A cosa serve:
//   Mostra le tabelle del backtest: cosa è successo al prezzo dopo ogni
//   segnale (per orizzonte), dopo ogni livello di un indicatore e in ogni
//   fascia dell'indice di rischio; per il periodo di taratura, di verifica
//   o per tutto lo storico.
//
// Widget definiti qui:
//   backtestTables  tabelle con i pulsanti di vista e di periodo
//
// Legge: backtest.json (tabelle e criteri), latest.json (nomi e ruolo di
//        orizzonti e indicatori).
// Usa: OT.ui (app.js) per i pulsanti di scelta, riskColor (dashboard.js)
//      per il colore delle fasce di rischio.
// ============================================================

// ============================================================
// SEZIONE 1 — STATO DELLE SCELTE DELL'UTENTE
// ============================================================
// Le scelte (vista, periodo, indicatore) restano finché l'app è aperta,
// anche se la pagina viene ridisegnata (es. cambio di tema).
const backtestState = {
  period: OT_CONFIG.backtest.defaultPeriod,
  view: OT_CONFIG.backtest.defaultView,
  indicator: null,          // indicatore scelto nella vista "Indicatori" (null = il primo)
};

// ============================================================
// SEZIONE 2 — COSTRUZIONE DELLE TABELLE
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
    return `<span class="ot-badge ot-badge-${cls}">${OT.ui.signed(level)}</span>`;
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
  const period = backtestState.period;
  const metric = b.order_metric;
  const title = function (days) { return tb.forwardTitle.replace("{days}", days); };

  if (backtestState.view === "horizon") {
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

  if (backtestState.view === "indicator") {
    const id = backtestState.indicator;
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
      const selected = ind.id === backtestState.indicator ? " selected" : "";
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
    if (!backtestState.indicator) {
      const first = latest.horizons[OT_CONFIG.horizonOrder[0]];
      backtestState.indicator = first ? first.indicators[0].id : null;
    }

    const periodOptions = Object.keys(tb.periods).map(function (p) { return [p, tb.periods[p]]; });
    const viewOptions = Object.keys(tb.views).map(function (v) { return [v, tb.views[v]]; });
    const notes = tb.notes.map(function (n) {
      return `<li>${OT.escape(n.replace("{n}", OT_CONFIG.backtest.fewEpisodes))}</li>`;
    }).join("");

    body.innerHTML = `
      <div class="ot-toolbar">
        ${OT.ui.choiceButtons("view", viewOptions, backtestState.view)}
        ${OT.ui.choiceButtons("period", periodOptions, backtestState.period)}
      </div>
      <div class="ot-bt-period ot-muted small"></div>
      <div class="ot-bt-indicator"></div>
      <div class="ot-bt-content"></div>
      <ul class="ot-chart-note ot-bt-notes">${notes}</ul>`;

    // Ridisegna solo la parte che cambia con le scelte.
    function update() {
      body.querySelector(".ot-bt-period").textContent =
        `${tb.periods[backtestState.period]}: ${periodRangeText(b, backtestState.period)}`;
      const selectBox = body.querySelector(".ot-bt-indicator");
      selectBox.innerHTML = backtestState.view === "indicator" ? indicatorSelect(latest) : "";
      const select = selectBox.querySelector("select");
      if (select) {
        // "change" = l'utente ha scelto un'altra voce dell'elenco.
        select.addEventListener("change", function () { backtestState.indicator = select.value; update(); });
      }
      body.querySelector(".ot-bt-content").innerHTML = backtestContent(b, latest);
    }
    OT.ui.bindChoice(body, "view", function (value) { backtestState.view = value; update(); });
    OT.ui.bindChoice(body, "period", function (value) { backtestState.period = value; update(); });
    update();
  },
});
