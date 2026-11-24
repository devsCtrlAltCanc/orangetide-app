// ============================================================
// js/actions.js — AGGIORNAMENTO DEI DATI DALL'APP E MINUTI DI ACTIONS
//                 (SPEC 6.1, 11.4, 11.7)
// ============================================================
// A cosa serve:
//   1. Pulsante "↻ Aggiorna dati" nella barra in alto: avvia su GitHub lo
//      stesso workflow dell'aggiornamento notturno (update.yml), ne segue
//      lo stato e, a fine esecuzione, riscarica i JSON.
//      - Se un aggiornamento è già in coda o in corso (anche quello della
//        notte) non se ne avvia un altro: si segue quello (nessuna coda).
//      - Mentre l'aggiornamento è in corso il pulsante è disattivato.
//   2. Contatore dei minuti di GitHub Actions del mese (pagina Info,
//      riquadro "App e dati"): esecuzioni e minuti STIMATI.
//
// Serve il permesso "Actions: Read and write" del token (SPEC 6.1). Senza,
//   GitHub risponde 403/404: il pulsante e il contatore lo spiegano, e il
//   token NON viene segnato come rifiutato (per i dati continua a valere).
//
// API di GitHub usate (documentazione: docs.github.com/rest/actions):
//   GET  /repos/{owner}/{repo}/actions/workflows/{file}/runs   esecuzioni del workflow
//   POST /repos/{owner}/{repo}/actions/workflows/{file}/dispatches  avvio manuale
//   GET  /repos/{owner}/{repo}/actions/runs/{id}               stato di un'esecuzione
//   GET  /repos/{owner}/{repo}/actions/runs?created=>=...      esecuzioni del mese
//
// Usato da: app.js (avvio: collega il pulsante), info.js (contatore).
//
// Costrutti JavaScript usati qui:
//   setTimeout(funzione, ms)   esegue la funzione una volta, dopo ms millisecondi
//   new Promise(...)           "risultato futuro" creato a mano (qui per aspettare)
// ============================================================

window.OT = window.OT || {};

OT.actions = (function () {
  // ============================================================
  // SEZIONE 0 — STATO INTERNO
  // ============================================================
  // Id dell'esecuzione che si sta seguendo (null = nessuna).
  let followedRunId = null;
  // Timer del prossimo controllo dello stato (per poterlo annullare).
  let pollTimer = null;

  // Stati di un'esecuzione di GitHub che significano "non ancora finita".
  // "completed" = finita (con esito in "conclusion": success, failure, ...).
  const ACTIVE_STATUSES = ["queued", "in_progress", "waiting", "requested", "pending"];

  // ============================================================
  // SEZIONE 1 — RICHIESTE ALL'API DI GITHUB
  // ============================================================
  /** Indirizzo dell'API del repository del core + il resto del percorso. */
  function repoUrl(path) {
    const gh = OT_CONFIG.github;
    return `${gh.apiBase}/repos/${gh.owner}/${gh.repo}/${path}`;
  }

  /** Indirizzo dell'API del workflow di aggiornamento + il resto del percorso. */
  function workflowUrl(path) {
    return repoUrl(`actions/workflows/${OT_CONFIG.github.workflowFile}/${path}`);
  }

  /**
   * Errore delle richieste di Actions, con un "tipo" che dice cosa mostrare:
   *   "local"      sorgente dati locale: niente GitHub
   *   "noToken"    token non inserito
   *   "permission" il token non ha il permesso Actions (403 / 404)
   *   "rejected"   token non valido o scaduto (401)
   *   "other"      rete assente, limite di richieste, altro errore di GitHub
   */
  function actionsError(kind, message) {
    const error = new Error(message || OT_CONFIG.texts.refresh[kind] || kind);
    error.kind = kind;
    return error;
  }

  /**
   * Richiesta all'API di GitHub con il token salvato.
   * @param {string} url
   * @param {object} [options]  { method: "POST", body: {...} } per gli avvii
   * @returns {Promise<object|null>} il JSON della risposta (null se vuota, es. 204)
   */
  async function request(url, options) {
    if (OT.data.source() === "local") throw actionsError("local");
    const token = OT.auth.getToken();
    if (!token) throw actionsError("noToken");
    const opts = options || {};
    let response;
    try {
      response = await fetch(url, {
        method: opts.method || "GET",
        // "application/vnd.github+json" = risposta JSON standard dell'API
        headers: Object.assign(OT.auth.headers(token, "application/vnd.github+json"),
          opts.body ? { "Content-Type": "application/json" } : {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
      });
    } catch (error) {
      throw actionsError("other", OT_CONFIG.texts.token.networkError);
    }
    if (response.ok) {
      // 204 = "fatto, nessun contenuto" (risposta dell'avvio del workflow).
      return response.status === 204 ? null : response.json();
    }
    // Limite di richieste: non è un problema di permessi.
    if (response.status === 403 && response.headers.get("X-RateLimit-Remaining") === "0") {
      throw actionsError("other", OT_CONFIG.texts.token.rateLimited);
    }
    if (response.status === 401) throw actionsError("rejected");
    // 403 = permesso mancante; 404 = GitHub nasconde il workflow a chi non ha
    // il permesso Actions (risponde "non trovato" invece di "vietato").
    if (response.status === 403 || response.status === 404) throw actionsError("permission");
    throw actionsError("other", `${OT_CONFIG.texts.token.errorOther} (${response.status})`);
  }

  /**
   * Esecuzione del workflow di aggiornamento ancora in coda o in corso, o null.
   * Si guardano le ultime esecuzioni (le più recenti vengono per prime).
   * @returns {Promise<object|null>} l'esecuzione (oggetto "run" di GitHub)
   */
  async function findActiveRun() {
    const data = await request(workflowUrl("runs?per_page=10"));
    const active = data.workflow_runs.find(function (run) {
      return ACTIVE_STATUSES.includes(run.status);
    });
    return active || null;
  }

  /** Avvia il workflow sul ramo dei dati (come "Run workflow" sul sito). */
  async function dispatch() {
    await request(workflowUrl("dispatches"), { method: "POST", body: { ref: OT_CONFIG.github.branch } });
  }

  /** Stato attuale di un'esecuzione. */
  function getRun(id) {
    return request(repoUrl(`actions/runs/${id}`));
  }

  /** Aspetta N secondi (await wait(5) = pausa di 5 secondi). */
  function wait(seconds) {
    return new Promise(function (resolve) { setTimeout(resolve, seconds * 1000); });
  }

  // ============================================================
  // SEZIONE 2 — PULSANTE E RIGA DI STATO
  // ============================================================
  /**
   * Aspetto del pulsante: icona normale, oppure rotellina che gira e
   * pulsante disattivato mentre un aggiornamento è in corso.
   * @param {boolean} busy
   */
  function setBusy(busy) {
    const button = document.getElementById("refresh-button");
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle("ot-spinning", busy);
  }

  /**
   * Mostra (o toglie) la riga di stato sotto la barra in alto.
   * @param {string|null} level  "info" | "warning" | "danger" | "running" | null (= togli)
   * @param {string} [text]
   * @param {string} [actionHtml]  pulsante o collegamento a destra (facoltativo)
   */
  function showStatus(level, text, actionHtml) {
    const box = document.getElementById("refresh-status");
    if (!box) return;
    if (!level) {
      box.innerHTML = "";
      return;
    }
    const icons = {
      running: "bi-arrow-clockwise ot-spin", info: "bi-check-circle",
      warning: "bi-exclamation-triangle", danger: "bi-x-octagon",
    };
    const style = level === "running" ? "info" : level;
    box.innerHTML = `<div class="ot-banner ot-banner-${style}"><i class="bi ${icons[level]}"></i>
      <span>${OT.escape(text)}</span>${actionHtml || ""}
      <button type="button" class="ot-banner-close" aria-label="Chiudi"><i class="bi bi-x-lg"></i></button></div>`;
    box.querySelector(".ot-banner-close").addEventListener("click", function () { box.innerHTML = ""; });
  }

  /** Spiega un errore nella riga di stato (con il collegamento a Impostazioni se serve). */
  function showError(error) {
    const t = OT_CONFIG.texts.refresh;
    const needsSettings = ["noToken", "permission", "rejected"].includes(error.kind);
    const link = needsSettings && OT.app.currentPageId() !== "impostazioni"
      ? `<a href="#impostazioni" class="ot-banner-action">${OT_CONFIG.texts.banners.goToSettings}</a>` : "";
    showStatus(error.kind === "local" ? "warning" : "danger", error.message || t.other, link);
  }

  /** Ora "HH:MM" di una data ISO di GitHub, nell'ora del dispositivo. */
  function timeOf(isoDateTime) {
    return new Date(isoDateTime).toLocaleTimeString(OT_CONFIG.locale, { hour: "2-digit", minute: "2-digit" });
  }

  // ============================================================
  // SEZIONE 3 — AVVIO E SEGUITO DI UN AGGIORNAMENTO
  // ============================================================
  /**
   * Pressione del pulsante "Aggiorna dati".
   *   1. se si sta già seguendo un aggiornamento, non si fa nulla;
   *   2. se su GitHub c'è già un'esecuzione in coda o in corso, si segue quella;
   *   3. altrimenti si avvia il workflow e si aspetta che compaia nell'elenco.
   */
  async function start() {
    const t = OT_CONFIG.texts.refresh;
    if (followedRunId !== null) return;          // pressioni ripetute ignorate
    setBusy(true);
    showStatus("running", t.checking);
    try {
      let run = await findActiveRun();
      if (run) {
        showStatus("running", t.alreadyRunning.replace("{time}", timeOf(run.created_at)));
      } else {
        await dispatch();
        run = await waitForNewRun();
      }
      follow(run);
    } catch (error) {
      setBusy(false);
      showError(error);
    }
  }

  /**
   * Dopo l'avvio, GitHub impiega qualche secondo a creare l'esecuzione:
   * si ricontrolla l'elenco finché compare (al massimo N volte, config.js).
   * @returns {Promise<object>} l'esecuzione appena creata
   */
  async function waitForNewRun() {
    const cfg = OT_CONFIG.refresh;
    for (let attempt = 0; attempt < cfg.findRunAttempts; attempt++) {
      await wait(cfg.findRunSeconds);
      const run = await findActiveRun();
      if (run) return run;
    }
    throw actionsError("other", OT_CONFIG.texts.refresh.notFound);
  }

  /**
   * Segue un'esecuzione: ne controlla lo stato ogni N secondi (config.js)
   * finché non è finita, aggiornando la riga di stato.
   * @param {object} run  esecuzione di GitHub (serve l'id)
   */
  function follow(run) {
    const t = OT_CONFIG.texts.refresh;
    followedRunId = run.id;
    setBusy(true);
    showStatus("running", run.status === "queued" ? t.queued : t.running);

    async function check() {
      let current;
      try {
        current = await getRun(followedRunId);
      } catch (error) {
        // Errore temporaneo (es. rete persa per un attimo): si riprova al giro dopo.
        pollTimer = setTimeout(check, OT_CONFIG.refresh.pollSeconds * 1000);
        return;
      }
      if (current.status !== "completed") {
        showStatus("running", current.status === "queued" ? t.queued : t.running);
        pollTimer = setTimeout(check, OT_CONFIG.refresh.pollSeconds * 1000);
        return;
      }
      finish(current);
    }
    clearTimeout(pollTimer);
    pollTimer = setTimeout(check, OT_CONFIG.refresh.pollSeconds * 1000);
  }

  /**
   * Esecuzione finita: si riscaricano i dati (anche se è finita con errori:
   * il core salva comunque i JSON, con la fonte in errore segnata in
   * meta.json) e si mostra l'esito.
   * @param {object} run  esecuzione completata ("conclusion" = esito)
   */
  function finish(run) {
    const t = OT_CONFIG.texts.refresh;
    followedRunId = null;
    setBusy(false);
    OT.app.refresh();
    const link = `<a href="${run.html_url}" target="_blank" rel="noopener" class="ot-banner-action">${t.openOnGithub}</a>`;
    if (run.conclusion === "success") {
      showStatus("info", t.done);
      // Il messaggio di successo sparisce da solo dopo qualche secondo.
      setTimeout(function () {
        const box = document.getElementById("refresh-status");
        if (box && box.querySelector(".ot-banner-info")) showStatus(null);
      }, OT_CONFIG.refresh.doneHideSeconds * 1000);
    } else if (run.conclusion === "cancelled") {
      showStatus("warning", t.cancelled, link);
    } else {
      showStatus("danger", t.failed, link);
    }
  }

  /**
   * All'apertura dell'app: se su GitHub c'è un aggiornamento in corso (es.
   * quello della notte o uno avviato da un altro dispositivo) lo si segue,
   * così il pulsante resta disattivato fino alla fine. Senza token o senza
   * permesso non si mostra nulla.
   */
  async function resumeIfRunning() {
    if (OT.data.source() !== "github" || !OT.auth.getToken()) return;
    try {
      const run = await findActiveRun();
      if (run && followedRunId === null) follow(run);
    } catch (error) {
      // Silenzioso: l'errore si vede solo premendo il pulsante.
    }
  }

  /** Collega il pulsante della barra in alto (chiamata all'avvio da app.js). */
  function init() {
    const button = document.getElementById("refresh-button");
    button.title = OT_CONFIG.texts.refresh.button;
    button.setAttribute("aria-label", OT_CONFIG.texts.refresh.button);
    button.addEventListener("click", start);
    resumeIfRunning();
  }

  // ============================================================
  // SEZIONE 4 — MINUTI DI ACTIONS DEL MESE (stima)
  // ============================================================
  /**
   * Esecuzioni e minuti stimati di GitHub Actions dal primo giorno del mese
   * (UTC) a oggi, per tutti i workflow del repository del core.
   * Stima: per ogni esecuzione durata = ultimo aggiornamento − inizio,
   * arrotondata per eccesso al minuto (GitHub fattura così ogni job; il
   * workflow di aggiornamento ha un solo job). Un'esecuzione in corso conta
   * fino a adesso.
   * @returns {Promise<{runs: number, minutes: number}>}
   */
  async function monthUsage() {
    const now = new Date();
    // Primo giorno del mese in formato AAAA-MM-01 (mesi di JavaScript da 0 a 11).
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const since = `${now.getUTCFullYear()}-${month}-01`;
    let runs = 0;
    let minutes = 0;
    // Le esecuzioni arrivano a pagine di 100: si leggono tutte le pagine.
    for (let page = 1; ; page++) {
      const data = await request(repoUrl(`actions/runs?created=>=${since}&per_page=100&page=${page}`));
      for (const run of data.workflow_runs) {
        if (!run.run_started_at) continue;      // mai partita (es. in coda)
        const end = run.status === "completed" ? new Date(run.updated_at) : now;
        const ms = end - new Date(run.run_started_at);
        runs += 1;
        minutes += Math.max(1, Math.ceil(ms / 60000));   // 60000 ms = 1 minuto
      }
      if (data.workflow_runs.length < 100 || page * 100 >= data.total_count) break;
    }
    return { runs: runs, minutes: minutes };
  }

  return { init: init, start: start, monthUsage: monthUsage };
})();
