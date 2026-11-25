// ============================================================
// js/settings.js — WIDGET DELLA PAGINA IMPOSTAZIONI (SPEC 6.1, 11.5)
// ============================================================
// Widget definiti qui:
//   tokenSettings  inserimento, verifica e rimozione del token GitHub
//   preferences    tema, sorgente dei dati, copie salvate sul dispositivo
//   autoUpdate     aggiornamento automatico: ogni N ore (su GitHub, condiviso)
//                  e all'apertura (solo su questo dispositivo), SPEC 11.7
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
// WIDGET autoUpdate — AGGIORNAMENTO AUTOMATICO (SPEC 11.5, 11.7)
// ============================================================
/**
 * Orari di turno nell'ora di questo dispositivo, in ordine: "04:19, 08:19, …".
 * Date.UTC crea un istante a partire da ora e minuto UTC di oggi;
 * toLocaleTimeString lo scrive nel fuso orario del dispositivo.
 * @param {number[]} hours  ore UTC
 */
function localTimes(hours) {
  const now = new Date();
  const minute = OT_CONFIG.refresh.scheduleMinute;
  const times = hours.map(function (h) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, minute));
  });
  // sort con una funzione di confronto: ordina per ora del giorno locale.
  times.sort(function (a, b) {
    return (a.getHours() * 60 + a.getMinutes()) - (b.getHours() * 60 + b.getMinutes());
  });
  return times.map(function (d) {
    return d.toLocaleTimeString(OT_CONFIG.locale, { hour: "2-digit", minute: "2-digit" });
  }).join(", ");
}

/**
 * Dettaglio sotto l'intervallo: orari locali e stima mensile.
 * @param {number} n  intervallo in ore
 */
function intervalDetails(n) {
  const a = OT_CONFIG.texts.autoUpdate;
  const hours = OT.actions.hoursForInterval(n);
  const runs = hours.length * 30;                       // circa 30 giorni al mese
  const minutes = runs * OT_CONFIG.refresh.minutesPerRun;
  const estimate = a.estimate.replace("{runs}", OT.fmt.number(runs, 0)).replace("{minutes}", OT.fmt.number(minutes, 0));
  return `${a.times}: <b>${localTimes(hours)}</b><br>${estimate}`;
}

OT.registerWidget("autoUpdate", {
  title: "Aggiornamento automatico",
  size: "full",
  needs: [],

  render: function (body) {
    const a = OT_CONFIG.texts.autoUpdate;
    // Scelta del dispositivo: interruttore di Bootstrap (form-switch).
    const checked = OT.actions.getOnOpen() ? "checked" : "";
    body.innerHTML = `
      <div class="ot-auto-grid">
        <div class="ot-tile">
          <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-1">
            <span class="ot-strong">${a.everyTitle}</span>
            <span class="ot-badge ot-badge-brand"><i class="bi bi-github"></i> ${a.everyScope}</span>
          </div>
          <div class="ot-muted small mb-3">${a.everyHelp}</div>
          <div id="ot-interval" class="small"><span class="ot-muted">${OT_CONFIG.texts.loading}</span></div>
        </div>
        <div class="ot-tile">
          <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-1">
            <span class="ot-strong">${a.openTitle}</span>
            <span class="ot-badge ot-badge-hold"><i class="bi bi-phone"></i> ${a.openScope}</span>
          </div>
          <div class="ot-muted small mb-3">${a.openHelp}</div>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch" id="ot-on-open" ${checked}>
            <label class="form-check-label" for="ot-on-open">${a.openTitle}</label>
          </div>
        </div>
      </div>`;

    // "change" = l'interruttore è stato spostato: si salva subito.
    body.querySelector("#ot-on-open").addEventListener("change", function (event) {
      OT.actions.setOnOpen(event.target.checked);
    });
    showInterval(body.querySelector("#ot-interval"));
  },
});

/**
 * Legge da GitHub l'intervallo e mostra il campo per cambiarlo.
 * @param {HTMLElement} box
 */
async function showInterval(box) {
  const a = OT_CONFIG.texts.autoUpdate;
  if (OT.data.source() === "local") {
    box.innerHTML = `<span class="ot-muted">${a.local}</span>`;
    return;
  }
  let current;
  try {
    current = await OT.actions.readInterval();
  } catch (error) {
    // Senza token o senza permesso Variables: lo si spiega (niente campo).
    box.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle"></i> ${OT.escape(error.message)}</span>`;
    return;
  }
  const n = current.n || 4;
  box.innerHTML = `
    <form class="d-flex align-items-center gap-2 flex-wrap" novalidate>
      <label for="ot-hours-input">${a.hoursLabel}</label>
      <input type="number" class="form-control ot-hours-input" id="ot-hours-input" min="1" max="24" step="1" value="${n}" inputmode="numeric">
      <span>${a.hoursUnit}</span>
      <button type="submit" class="btn btn-sm ot-btn-brand ms-auto"><i class="bi bi-cloud-upload"></i> ${a.save}</button>
    </form>
    <div class="ot-muted mt-2" id="ot-interval-details">${intervalDetails(n)}</div>
    ${current.isDefault ? `<div class="ot-muted mt-1 fst-italic ot-interval-default">${a.notSet}</div>` : ""}
    <div class="mt-2" id="ot-interval-result"></div>`;

  const input = box.querySelector("#ot-hours-input");
  const details = box.querySelector("#ot-interval-details");
  const result = box.querySelector("#ot-interval-result");
  /** Valore del campo se è un intero da 1 a 24, altrimenti null. */
  function value() {
    const v = Number(input.value);
    return Number.isInteger(v) && v >= 1 && v <= 24 ? v : null;
  }
  // "input" = a ogni cifra digitata: si aggiornano subito orari e stima.
  input.addEventListener("input", function () {
    result.innerHTML = "";
    if (value() !== null) details.innerHTML = intervalDetails(value());
  });
  box.querySelector("form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const v = value();
    if (v === null) {
      result.innerHTML = `<span class="text-danger">${a.invalid}</span>`;
      return;
    }
    result.innerHTML = `<span class="ot-muted">${a.saving}</span>`;
    try {
      await OT.actions.saveInterval(v);
      // La variabile ora esiste: la nota "valore iniziale" non serve più.
      const note = box.querySelector(".ot-interval-default");
      if (note) note.remove();
      result.innerHTML = `<span class="ot-pos"><i class="bi bi-check-circle"></i> ${a.saved}</span>`;
    } catch (error) {
      result.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle"></i> ${OT.escape(error.message)}</span>`;
    }
  });
}

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
        <li><b>Permissions</b> → <i>Repository permissions</i> → <b>Contents: Read-only</b> (per leggere i dati), <b>Actions: Read and write</b> (pulsante <i>Aggiorna dati</i> e contatore dei minuti in Info) e <b>Variables: Read and write</b> (<i>Aggiorna ogni N ore</i>). Nessun altro permesso.</li>
        <li>Premi <b>Generate token</b>, copia il token (inizia con <code>github_pat_</code>) e annota la data di scadenza mostrata. <b>GitHub mostra il token solo adesso</b>: salvalo subito in un gestore di password.</li>
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
      </div>
      <div class="small ot-muted mt-2">
        <b>Token perso su un dispositivo</b> (es. dati del browser cancellati o rovinati): crea un <b>nuovo</b> token
        per quel dispositivo invece di rigenerare quello esistente, che smetterebbe di funzionare anche sugli altri.
      </div>`;
  },
});
