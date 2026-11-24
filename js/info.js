// ============================================================
// js/info.js — WIDGET DELLA PAGINA INFO (SPEC 11.4)
// ============================================================
// Widget definiti qui:
//   sourcesStatus   stato di ogni fonte dati (da meta.json)
//   appInfo         versione dell'app e dei dati, sorgente, ultimo aggiornamento
//   methodInfo      spiegazione sintetica del metodo (SPEC 4) e degli indicatori
//   credits         fonti dei dati (con licenza) e librerie usate
//
// L'avvertenza "non è un consiglio finanziario" non ha un riquadro proprio
// (decisione dell'utente del 2026-11-24): resta solo la riga in fondo al
// menu laterale (index.html).
//
// Legge: meta.json (fonti, versione dello schema), latest.json (orizzonti,
//        ruoli e indicatori attivi).
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
    ];
    body.innerHTML = `<div class="ot-rows">` + items.map(function (item) {
      return `<div class="ot-row"><span class="ot-muted">${item[0]}</span><b>${item[1]}</b></div>`;
    }).join("") + `</div>`;
  },
});

// ============================================================
// WIDGET methodInfo — COME FUNZIONA (SPEC 4, 16.1, 5)
// ============================================================
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
  needs: ["latest"],

  render: function (body, files) {
    const latest = files.latest.data;
    const t = OT_CONFIG.texts;
    const m = t.method;

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
            <div class="ot-muted">${OT.escape(step.text)}</div></div>
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
        <div class="ot-tile"><div class="ot-strong">${m.backtestTitle}</div><div class="ot-muted small">${OT.escape(m.backtestText)}</div></div>
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

    body.innerHTML = `
      <div class="ot-bt-caption">${c.dataTitle}</div>
      <div class="ot-rows mb-3">${sources}</div>
      <div class="ot-bt-caption">${c.libsTitle}</div>
      <div class="ot-rows">${libraries}</div>`;
  },
});
