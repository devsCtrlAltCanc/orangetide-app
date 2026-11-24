// ============================================================
// js/settings.js — WIDGET DELLA PAGINA IMPOSTAZIONI (SPEC 6.1, 11.5)
// ============================================================
// Widget definiti qui:
//   tokenSettings  inserimento, verifica e rimozione del token GitHub
//   preferences    tema, sorgente dei dati, copie salvate sul dispositivo
//   tokenGuide     come creare e rinnovare il token (passo per passo)
//
// Il token si salva solo su questo dispositivo (vedi auth.js).
// ============================================================

// Classe del badge per ogni stato del token (vedi css/style.css).
const TOKEN_STATE_BADGE = {
  missing: "hold", rejected: "sell", expired: "sell", expiring: "brand", ok: "buy",
};

// ============================================================
// WIDGET tokenSettings — TOKEN GITHUB
// ============================================================
OT.registerWidget("tokenSettings", {
  title: "Token GitHub",
  needs: [],

  render: function (body) {
    const t = OT_CONFIG.texts.token;
    const expiry = OT.auth.getExpiry();
    const days = OT.auth.daysLeft();

    const localNote = OT.data.source() === "local"
      ? `<div class="ot-note-warning mb-3"><i class="bi bi-pc-display"></i> ${t.notNeededLocal}</div>` : "";
    const expiryText = expiry
      ? `scade il ${OT.fmt.date(expiry)} (${days >= 0 ? "tra " + days + " giorni" : "scaduto"})`
      : "data di scadenza non indicata";

    body.innerHTML = `
      ${localNote}
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="ot-muted">Stato</span>
        <span class="ot-badge" id="ot-token-state"></span>
      </div>
      ${OT.auth.getToken() ? `<div class="small ot-muted mb-3">Token salvato su questo dispositivo · ${expiryText}</div>` : ""}
      <!-- form: novalidate = i controlli li facciamo noi; autocomplete off = non
           proporre valori salvati nel browser -->
      <form class="ot-form" novalidate autocomplete="off">
        <label class="form-label small ot-strong" for="ot-token-input">Nuovo token</label>
        <!-- type="password": il testo inserito resta nascosto -->
        <input type="password" class="form-control mb-3" id="ot-token-input" placeholder="github_pat_…" spellcheck="false">
        <label class="form-label small ot-strong" for="ot-expiry-input">Data di scadenza (la mostra GitHub quando crei il token)</label>
        <input type="date" class="form-control mb-3" id="ot-expiry-input" value="${expiry || ""}">
        <div class="d-flex gap-2 flex-wrap">
          <button type="submit" class="btn ot-btn-brand"><i class="bi bi-shield-check"></i> Verifica e salva</button>
          ${OT.auth.getToken() ? `<button type="button" class="btn ot-btn-plain" id="ot-token-remove"><i class="bi bi-trash"></i> Rimuovi</button>` : ""}
        </div>
        <div class="mt-3 small" id="ot-token-result"></div>
      </form>`;

    // Stato del token: si mostra subito e si aggiorna dopo una lettura di
    // prova (GitHub potrebbe rifiutare un token che sembrava valido).
    function showState() {
      const current = OT.auth.state();
      const badge = body.querySelector("#ot-token-state");
      badge.className = "ot-badge ot-badge-" + TOKEN_STATE_BADGE[current];
      badge.textContent = t.stateNames[current];
    }
    showState();
    if (OT.data.source() === "github" && OT.auth.getToken()) {
      OT.data.load("meta").catch(function () {}).then(showState);
    }

    const form = body.querySelector("form");
    const result = body.querySelector("#ot-token-result");

    // submit = pulsante "Verifica e salva" (o Invio nel campo).
    form.addEventListener("submit", async function (event) {
      event.preventDefault();            // evita il ricaricamento della pagina
      const token = body.querySelector("#ot-token-input").value.trim();
      const newExpiry = body.querySelector("#ot-expiry-input").value || null;
      if (!token) {
        // Solo la data cambiata: si aggiorna la scadenza del token già salvato.
        if (OT.auth.getToken()) {
          OT.auth.save(OT.auth.getToken(), newExpiry);
          OT.app.refresh();
        }
        return;
      }
      result.innerHTML = `<span class="ot-muted">${OT_CONFIG.texts.loading}</span>`;
      const check = await OT.auth.verify(token);
      if (!check.ok) {
        result.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle"></i> ${OT.escape(check.message)}</span>`;
        return;
      }
      OT.auth.save(token, newExpiry);
      await OT.data.clearCopies();       // i dati si riscaricano con il nuovo token
      OT.app.refresh();
    });

    const remove = body.querySelector("#ot-token-remove");
    if (remove) {
      remove.addEventListener("click", function () {
        OT.auth.clear();
        OT.app.refresh();
      });
    }
  },
});

// ============================================================
// WIDGET preferences — PREFERENZE
// ============================================================
OT.registerWidget("preferences", {
  title: "Preferenze",
  needs: [],

  render: function (body) {
    const texts = OT_CONFIG.texts;
    const choices = [
      { value: "auto", label: texts.themeAuto },
      { value: "light", label: texts.themeLight },
      { value: "dark", label: texts.themeDark },
    ];
    const buttons = choices.map(function (c) {
      const active = OT.theme.get() === c.value ? "active" : "";
      return `<button type="button" class="ot-range ${active}" data-theme="${c.value}">${c.label}</button>`;
    }).join("");
    const sourceText = OT.data.source() === "local"
      ? "cartella output/ di orangetide-core (PC)" : "GitHub, repository " + OT.escape(OT_CONFIG.github.repo);

    body.innerHTML = `
      <div class="ot-row mb-2"><span>Tema</span><span class="d-flex gap-1">${buttons}</span></div>
      <div class="ot-row mb-2"><span>Origine dei dati</span><span class="ot-muted small text-end">${sourceText}</span></div>
      <div class="ot-row mb-2"><span>Versione dell'app</span><span class="ot-muted">${OT_CONFIG.version}</span></div>
      <div class="ot-row">
        <span>Dati salvati sul dispositivo</span>
        <button type="button" class="btn btn-sm ot-btn-plain" id="ot-clear-data"><i class="bi bi-arrow-clockwise"></i> Riscarica</button>
      </div>`;

    for (const b of body.querySelectorAll("[data-theme]")) {
      b.addEventListener("click", function () {
        OT.theme.set(b.dataset.theme);
        OT.app.updateThemeButton();
      });
    }
    body.querySelector("#ot-clear-data").addEventListener("click", async function () {
      await OT.data.clearCopies();
      OT.app.refresh();
    });
  },
});

// ============================================================
// WIDGET tokenGuide — COME CREARE E RINNOVARE IL TOKEN
// ============================================================
OT.registerWidget("tokenGuide", {
  title: "Come creare o rinnovare il token",
  size: "full",
  needs: [],

  render: function (body) {
    const t = OT_CONFIG.texts.token;
    const gh = OT_CONFIG.github;
    body.innerHTML = `
      <ol class="ot-steps">
        <li>Apri <a href="${t.createUrl}" target="_blank" rel="noopener">GitHub → Fine-grained tokens → Generate new token</a> (accedi con l'account <b>${OT.escape(gh.owner)}</b>).</li>
        <li><b>Token name</b>: per esempio "OrangeTide ${new Date().getFullYear()}". <b>Expiration</b>: la durata che preferisci (al massimo un anno).</li>
        <li><b>Repository access</b> → <i>Only select repositories</i> → scegli solo <b>${OT.escape(gh.repo)}</b>.</li>
        <li><b>Permissions</b> → <i>Repository permissions</i> → <b>Contents: Read-only</b> (per leggere i dati) e <b>Actions: Read and write</b> (per il pulsante <i>Aggiorna dati</i> e il contatore dei minuti in Info). Nessun altro permesso.</li>
        <li>Premi <b>Generate token</b>, copia il token (inizia con <code>github_pat_</code>) e annota la data di scadenza mostrata.</li>
        <li>Incollalo qui sopra con la data e premi <b>Verifica e salva</b>. Su iPhone fallo <b>dentro l'app installata</b>: ha una memoria separata da Safari.</li>
        <li>Conservalo in un gestore di password (es. Portachiavi iCloud) per reinserirlo sugli altri dispositivi.</li>
      </ol>
      <div class="small ot-muted">
        <b>Rinnovo</b>: circa 15 giorni prima della scadenza l'app mostra un avviso. Su
        <a href="${t.listUrl}" target="_blank" rel="noopener">GitHub → Fine-grained tokens</a> apri il token → <i>Regenerate token</i>,
        poi incolla il nuovo qui, su ogni dispositivo. Se cancelli i dati del browser o disinstalli l'app, il token va reinserito.
      </div>
      <div class="small ot-muted mt-2">
        <b>Aggiungere un permesso a un token esistente</b> (es. Actions): sulla stessa pagina apri il token → <i>Edit</i>,
        cambia i permessi e salva. Il token resta lo stesso: non serve reinserirlo nell'app.
      </div>`;
  },
});
