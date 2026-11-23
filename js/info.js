// ============================================================
// js/info.js — WIDGET DELLA PAGINA INFO (SPEC 11.4)
// ============================================================
// Widget definiti qui:
//   sourcesStatus   stato di ogni fonte dati (da meta.json)
//   (in arrivo: methodInfo, credits, disclaimer)
//
// Testi e colori degli stati: config.js (texts.sourceNames, texts.sourceStatus).
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
      <div class="ot-muted small mb-2">Ultimo aggiornamento: ${OT.fmt.dateTime(meta.generated_at)}</div>
      <div class="ot-rows">${rows}</div>`;
  },
});
