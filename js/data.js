// ============================================================
// js/data.js — CARICAMENTO DEI FILE JSON (SPEC 6, 9.1)
// ============================================================
// A cosa serve:
//   Scarica i 4 file JSON del core (latest, history, backtest, meta) dalla
//   sorgente scelta in config.js e ne conserva una copia sul dispositivo:
//   se la rete o GitHub non rispondono si mostrano gli ultimi dati salvati.
//
// Sorgenti (config.js: dataSource):
//   "local"  -> cartella output/ di orangetide-core tramite il server locale
//   "github" -> API di GitHub con il token salvato in Impostazioni (auth.js)
//   "auto"   -> "local" se l'app gira sul PC (localhost), altrimenti "github"
//
// Usato da: app.js (carica i file richiesti dai widget della pagina).
//
// Costrutti JavaScript usati qui:
//   async function / await   funzione "asincrona": await aspetta il risultato
//                            di un'operazione lenta (es. scaricare un file)
//                            senza bloccare l'interfaccia. Una funzione async
//                            restituisce una "Promise" (risultato futuro).
//   try { } catch (e) { }    gestione degli errori, come in C#
//   `testo ${valore}`        stringa con valori inseriti (template string)
//   fetch(url)               scarica un indirizzo web (funzione del browser)
//   caches                   "Cache Storage": memoria del browser per le
//                            risposte web; resta anche chiudendo l'app
// ============================================================

// window.OT = oggetto globale dell'app: raccoglie le parti (data, widget...).
// "|| {}" = se non esiste ancora, lo si crea vuoto.
window.OT = window.OT || {};

OT.data = (function () {
  // ============================================================
  // SEZIONE 0 — STATO INTERNO
  // ============================================================
  // Questa "funzione che si esegue subito" (function () { ... })() crea uno
  // spazio privato: le variabili qui dentro non sono visibili da fuori,
  // solo ciò che è restituito alla fine (return { ... }) lo è.

  const CACHE_NAME = "ot-data";   // nome della memoria dei dati sul dispositivo

  // File già caricati in questa sessione: nome -> Promise del risultato.
  // Così se due widget chiedono lo stesso file, lo si scarica una volta sola.
  const loaded = {};

  // ============================================================
  // SEZIONE 1 — INDIRIZZO DI UN FILE
  // ============================================================
  /** Sorgente effettiva dei dati: "local" o "github" (risolve "auto"). */
  function source() {
    if (OT_CONFIG.dataSource !== "auto") return OT_CONFIG.dataSource;
    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    return isLocalhost ? "local" : "github";
  }

  /**
   * Indirizzo di un file nell'API di GitHub ("contents" del repository).
   * @param {string} fileName  es. "meta.json"
   */
  function githubUrl(fileName) {
    const gh = OT_CONFIG.github;
    return `${gh.apiBase}/repos/${gh.owner}/${gh.repo}/contents/${gh.path}/${fileName}?ref=${gh.branch}`;
  }

  /**
   * Indirizzo da cui scaricare un file, secondo la sorgente.
   * @param {string} name  nome logico: "latest", "history", "backtest", "meta"
   * @returns {string} l'URL
   */
  function fileUrl(name) {
    const fileName = OT_CONFIG.files[name];
    if (source() === "local") return OT_CONFIG.local.basePath + fileName;
    return githubUrl(fileName);
  }

  // ============================================================
  // SEZIONE 2 — DOWNLOAD
  // ============================================================
  /**
   * Scarica un file dalla sorgente configurata.
   * @param {string} url
   * @returns {Promise<Response>} la risposta (solo se lo stato è 200–299)
   */
  async function download(url) {
    // cache: "no-store" = non usare la cache HTTP del browser: si vuole
    // sempre la versione più recente (la copia di riserva la gestiamo noi).
    if (source() === "local") {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    }

    // GitHub: serve il token salvato in Impostazioni.
    const token = OT.auth.getToken();
    if (!token) throw tokenError(OT_CONFIG.texts.token.missing);
    const response = await fetch(url, { headers: OT.auth.headers(token), cache: "no-store" });
    if (response.ok) {
      OT.auth.markAccepted();
      return response;
    }
    if (OT.auth.isRejection(response)) {
      OT.auth.markRejected();
      throw tokenError(OT.auth.describeError(response));
    }
    throw new Error(OT.auth.describeError(response));
  }

  /**
   * Errore "manca il token o GitHub lo rifiuta". Ha in più la proprietà
   * isTokenError: i riquadri la riconoscono e mostrano un messaggio neutro
   * (l'azione da fare la dice già l'avviso in alto: SPEC 11.6).
   * In JavaScript a un oggetto Error si possono aggiungere proprietà libere.
   * @param {string} message
   * @returns {Error}
   */
  function tokenError(message) {
    const error = new Error(message);
    error.isTokenError = true;
    return error;
  }

  // ============================================================
  // SEZIONE 3 — COPIA SUL DISPOSITIVO
  // ============================================================
  /** True se il browser ha la Cache Storage (serve https o localhost). */
  function hasCache() {
    return "caches" in window;
  }

  /**
   * Salva una copia della risposta sul dispositivo, con data e ora del salvataggio.
   * @param {string} url
   * @param {string} text  contenuto del file
   */
  async function saveCopy(url, text) {
    if (!hasCache()) return;
    const cache = await caches.open(CACHE_NAME);
    const headers = { "Content-Type": "application/json", "X-OT-Saved-At": new Date().toISOString() };
    await cache.put(url, new Response(text, { headers: headers }));
  }

  /**
   * Legge la copia salvata di un file.
   * @param {string} url
   * @returns {Promise<{text: string, savedAt: string} | null>} null se non c'è
   */
  async function readCopy(url) {
    if (!hasCache()) return null;
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    if (!response) return null;
    return { text: await response.text(), savedAt: response.headers.get("X-OT-Saved-At") };
  }

  // ============================================================
  // SEZIONE 4 — CARICAMENTO CON RISERVA
  // ============================================================
  /**
   * Carica un file: prima dalla rete; se fallisce, dalla copia salvata.
   * @param {string} name  "latest", "history", "backtest" o "meta"
   * @returns {Promise<{data: object, fromCache: boolean, savedAt: string|null, error: string|null}>}
   *   data      = contenuto del JSON
   *   fromCache = true se viene dalla copia sul dispositivo
   *   error     = motivo per cui la rete non ha funzionato (se fromCache)
   * Se non c'è né rete né copia, la Promise fallisce (errore).
   */
  async function fetchWithFallback(name) {
    const url = fileUrl(name);
    try {
      const response = await download(url);
      const text = await response.text();
      const data = JSON.parse(text);          // controlla anche che sia JSON valido
      await saveCopy(url, text);
      return { data: data, fromCache: false, savedAt: null, error: null };
    } catch (error) {
      const copy = await readCopy(url);
      if (copy === null) {
        const wrapped = new Error(`${OT_CONFIG.files[name]}: ${error.message}`);
        wrapped.isTokenError = error.isTokenError === true;   // si conserva il tipo di errore
        throw wrapped;
      }
      return { data: JSON.parse(copy.text), fromCache: true, savedAt: copy.savedAt, error: error.message };
    }
  }

  /**
   * Carica un file una sola volta per sessione (le richieste successive
   * riusano lo stesso risultato).
   * @param {string} name
   */
  function load(name) {
    if (!(name in loaded)) {
      loaded[name] = fetchWithFallback(name);
      // Se il caricamento fallisce, lo si dimentica: al prossimo tentativo si riprova.
      loaded[name].catch(function () { delete loaded[name]; });
    }
    return loaded[name];
  }

  /** Dimentica i file caricati: la prossima richiesta li riscarica. */
  function reset() {
    for (const name of Object.keys(loaded)) {
      delete loaded[name];
    }
  }

  // Ciò che è visibile da fuori: OT.data.load(...), OT.data.reset().
  /** Cancella le copie dei dati salvate sul dispositivo. */
  async function clearCopies() {
    reset();
    if (hasCache()) await caches.delete(CACHE_NAME);
  }

  return { load: load, reset: reset, fileUrl: fileUrl, githubUrl: githubUrl, source: source,
           clearCopies: clearCopies };
})();
