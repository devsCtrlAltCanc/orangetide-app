// ============================================================
// js/info.js — WIDGET DELLA PAGINA INFO (SPEC 11.4)
// ============================================================
// Widget definiti qui:
//   sourcesStatus   stato di ogni fonte dati (da meta.json)
//   appInfo         versione dell'app e dei dati, sorgente, ultimo aggiornamento,
//                   minuti di GitHub Actions del mese (stima, SPEC 11.4)
//   methodInfo      spiegazione sintetica del metodo (SPEC 4) e degli indicatori
//   credits         fonti dei dati (con licenza) e librerie usate
//
// Nessun testo di avvertenza "non è un consiglio finanziario" in tutta l'app
// (decisione dell'utente del 2026-11-24, SPEC 11.4).
//
// Legge: meta.json (fonti, versione dello schema, parametri del metodo),
//        latest.json (orizzonti, ruoli e indicatori attivi).
// Testi: config.js (texts.info, texts.method, texts.credits,
//        texts.sourceNames, texts.sourceStatus).
// ============================================================

// ============================================================
// WIDGET sourcesStatus — STATO DELLE FONTI
// ============================================================
OT.registerWidget("sourcesStatus", {
  title: "Stato delle fonti",
  needs: ["meta"],

  render: function (body, files) {
    const meta = files.meta.data;
    const texts = OT_CONFIG.texts;
    // map() trasforma ogni elemento dell'array in una riga HTML;
    // join("") unisce le righe in un unico testo.
    const rows = meta.sources.map(function (source) {
      const style = texts.sourceStatus[source.status] || texts.sourceStatus.error;
      const name = texts.sourceNames[source.source] || source.source;
      return `
        <div class="ot-row">
          <div>
            <div class="ot-strong">${OT.escape(name)}</div>
            <div class="ot-muted small">${OT.escape(source.message)}</div>
          </div>
          <span class="ot-badge ot-badge-${style.badge}">${OT.escape(style.text)}</span>
        </div>`;
    }).join("");

    body.innerHTML = `
      <div class="ot-muted small mb-2">${texts.info.lastUpdate}: ${OT.fmt.dateTime(meta.generated_at)}</div>
      <div class="ot-rows">${rows}</div>`;
  },
});

// ============================================================
// WIDGET appInfo — VERSIONI E SORGENTE DEI DATI
// ============================================================
OT.registerWidget("appInfo", {
  title: "App e dati",
  needs: ["meta"],

  render: function (body, files) {
    const meta = files.meta.data;
    const t = OT_CONFIG.texts.info;
    const status = OT_CONFIG.texts.sourceStatus[meta.overall] || OT_CONFIG.texts.sourceStatus.error;

    // Versione dello schema: se i JSON del core hanno una versione diversa
    // da quella che l'app sa leggere, lo si segnala.
    let schema = String(meta.schema_version);
    if (meta.schema_version !== OT_CONFIG.schemaVersion) {
      schema += ` <span class="ot-badge ot-badge-sell">${OT.escape(t.schemaMismatch.replace("{expected}", OT_CONFIG.schemaVersion))}</span>`;
    }

    // Una riga "etichetta — valore" per ogni voce.
    const items = [
      [t.appVersion, OT.escape(OT_CONFIG.version)],
      [t.schema, schema],
      [t.dataSource, OT.escape(t.dataSourceNames[OT.data.source()] || OT.data.source())],
      [t.dataDate, OT.fmt.date(meta.data_date)],
      [t.lastUpdate, OT.fmt.dateTime(meta.generated_at)],
      [t.overall, `<span class="ot-badge ot-badge-${status.badge}">${OT.escape(status.text)}</span>`],
      [t.actions, `<span id="ot-actions-usage" class="ot-muted">${OT_CONFIG.texts.loading}</span>`],
    ];
    body.innerHTML = `<div class="ot-rows">` + items.map(function (item) {
      return `<div class="ot-row"><span class="ot-muted">${item[0]}</span><b class="text-end">${item[1]}</b></div>`;
    }).join("") + `</div>
      <div class="ot-chart-note mt-2">${OT.escape(t.actionsNote)}</div>`;
    showActionsUsage(body.querySelector("#ot-actions-usage"));
  },
});

/**
 * Riempie la riga "GitHub Actions questo mese" (la richiesta a GitHub
 * arriva dopo il resto del riquadro, che intanto è già visibile).
 * @param {HTMLElement} cell  elemento in cui scrivere
 */
async function showActionsUsage(cell) {
  const t = OT_CONFIG.texts.info;
  try {
    const usage = await OT.actions.monthUsage();
    cell.className = "";
    cell.textContent = fillPlaceholders(t.actionsUsage, {
      runs: OT.fmt.number(usage.runs, 0),
      minutes: OT.fmt.number(usage.minutes, 0),
      // useGrouping "always" = punto delle migliaia anche a 4 cifre (2.000, non 2000)
      included: OT_CONFIG.refresh.includedMinutes.toLocaleString(OT_CONFIG.locale, { useGrouping: "always" }),
    });
  } catch (error) {
    // Senza token / permesso / dati locali: lo si dice in grigio.
    cell.textContent = error.kind === "local" ? t.actionsLocal : error.message;
  }
}

// ============================================================
// WIDGET methodInfo — COME FUNZIONA (SPEC 4, 16.1, 5)
// ============================================================
/** Finestra in giorni come testo: 365 -> "1 anno", 1460 -> "4 anni". */
function windowText(days) {
  const t = OT_CONFIG.texts.info;
  const years = Math.round(days / 365 * 10) / 10;     // al massimo un decimale
  return `${OT.fmt.number(years, years % 1 === 0 ? 0 : 1)} ${years === 1 ? t.year : t.years}`;
}

/**
 * Valori dei segnaposto dei testi del metodo, dai parametri del core
 * (meta.json, voce "method"). Vedi il commento in config.js (texts.method).
 * @param {object|undefined} method  meta.method (può mancare con dati vecchi)
 * @returns {object} nome del segnaposto -> valore
 */
function methodValues(method) {
  if (!method) return {};
  const w = method.percentile_window_days;
  const th = method.percentile_thresholds;
  const yearOf = function (date) { return date ? date.slice(0, 4) : "…"; };
  return {
    short: windowText(w.short), medium: windowText(w.medium), long: windowText(w.long),
    t1: th[0], t2: th[1], t3: th[2], t4: th[3],
    buy: method.signal.buy_score, sell: method.signal.sell_score, agree: method.signal.min_agreement,
    min: method.min_indicators,
    calEnd: yearOf(method.periods.calibration.end),
    valStart: yearOf(method.periods.validation.start),
  };
}

/**
 * Sostituisce i segnaposto {nome} di un testo con i valori; un segnaposto
 * senza valore diventa "…".
 * /\{(\w+)\}/g è un'"espressione regolare": trova ogni testo tra graffe
 * (g = tutte le volte). Per ognuno replace chiama la funzione, che
 * restituisce il testo da mettere al suo posto.
 */
function fillPlaceholders(text, values) {
  return text.replace(/\{(\w+)\}/g, function (whole, name) {
    return name in values ? String(values[name]) : "…";
  });
}
/**
 * Elenco degli indicatori attivi di un orizzonte, con tipo e descrizione.
 * @param {object} horizon  orizzonte da latest.json (indicators: [{id, name, type}])
 */
function indicatorList(horizon) {
  const m = OT_CONFIG.texts.method;
  return horizon.indicators.map(function (ind) {
    const type = m.typeNames[ind.type] || ind.type;
    const description = m.descriptions[ind.id] || "";
    return `
      <div class="ot-indicator-row">
        <div>
          <div class="ot-strong">${OT.escape(ind.name)}</div>
          <div class="ot-muted">${OT.escape(description)}</div>
        </div>
        <span class="ot-badge ot-badge-hold">${OT.escape(type)}</span>
      </div>`;
  }).join("");
}

OT.registerWidget("methodInfo", {
  title: "Come funziona",
  size: "full",
  needs: ["latest", "meta"],

  render: function (body, files) {
    const latest = files.latest.data;
    const t = OT_CONFIG.texts;
    const m = t.method;
    // Testo con i numeri del core al posto dei segnaposto (poi protetto per l'HTML).
    const values = methodValues(files.meta.data.method);
    const fill = function (text) { return OT.escape(fillPlaceholders(text, values)); };

    // Orizzonti: nome, ruolo (guida / informativo) e periodo di validità.
    const horizons = OT_CONFIG.horizonOrder.filter(function (id) { return id in latest.horizons; }).map(function (id) {
      const h = latest.horizons[id];
      const roleClass = h.role === "guida" ? "buy" : "hold";
      return `
        <div class="ot-tile">
          <div class="d-flex justify-content-between align-items-center gap-2">
            <span class="ot-strong">${OT.escape(h.name)}</span>
            <span class="ot-badge ot-badge-${roleClass}">${OT.escape(h.role)}</span>
          </div>
          <div class="ot-muted small mt-1">${t.horizonPeriods[id]}</div>
        </div>`;
    }).join("");

    // I cinque passi del calcolo, numerati.
    const steps = m.steps.map(function (step, i) {
      return `
        <div class="ot-step">
          <span class="ot-step-number">${i + 1}</span>
          <div><div class="ot-strong">${OT.escape(step.title)}</div>
            <div class="ot-muted">${fill(step.text)}</div></div>
        </div>`;
    }).join("");

    // Indicatori di ogni orizzonte, in sezioni apribili (<details>).
    const indicators = OT_CONFIG.horizonOrder.filter(function (id) { return id in latest.horizons; }).map(function (id) {
      const h = latest.horizons[id];
      return `<details class="ot-details">
          <summary>${OT.escape(h.name)} · ${h.indicators.length}</summary>
          ${indicatorList(h)}
        </details>`;
    }).join("");

    body.innerHTML = `
      <p>${OT.escape(m.intro)}</p>
      <h3 class="ot-bt-title">${m.horizonsTitle}</h3>
      <div class="ot-method-horizons">${horizons}</div>
      <div class="ot-chart-note mb-3">${OT.escape(m.roleNote)}</div>
      <h3 class="ot-bt-title">${m.stepsTitle}</h3>
      <div class="ot-steps-list">${steps}</div>
      <div class="ot-method-extra">
        <div class="ot-tile"><div class="ot-strong">${m.riskTitle}</div><div class="ot-muted small">${OT.escape(m.riskText)}</div></div>
        <div class="ot-tile"><div class="ot-strong">${m.backtestTitle}</div><div class="ot-muted small">${fill(m.backtestText)}</div></div>
      </div>
      <h3 class="ot-bt-title mt-3">${m.indicatorsTitle}</h3>
      ${indicators}`;
  },
});

// ============================================================
// WIDGET credits — FONTI DEI DATI E LIBRERIE
// ============================================================
OT.registerWidget("credits", {
  title: "Fonti e crediti",
  size: "full",
  needs: [],

  render: function (body) {
    const c = OT_CONFIG.texts.credits;
    // rel="noopener" = la pagina aperta non può controllare questa (sicurezza).
    const link = function (item) {
      return `<a href="${item.url}" target="_blank" rel="noopener">${OT.escape(item.name)}</a>`;
    };
    const license = function (item) {
      return item.license ? `<span class="ot-badge ot-badge-hold">${OT.escape(item.license)}</span>` : "";
    };
    const sources = c.sources.map(function (s) {
      return `<div class="ot-row"><div>${link(s)}<div class="ot-muted small">${OT.escape(s.use)}</div></div>${license(s)}</div>`;
    }).join("");
    const libraries = c.libraries.map(function (l) {
      return `<div class="ot-row"><div>${link(l)}</div>${license(l)}</div>`;
    }).join("");

    // Su PC due colonne (dati | librerie), su telefono una sotto l'altra.
    body.innerHTML = `
      <div class="ot-credits">
        <div>
          <div class="ot-bt-caption">${c.dataTitle}</div>
          <div class="ot-rows">${sources}</div>
        </div>
        <div>
          <div class="ot-bt-caption">${c.libsTitle}</div>
          <div class="ot-rows">${libraries}</div>
        </div>
      </div>`;
  },
});
