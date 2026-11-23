// ============================================================
// js/auth.js — TOKEN DI ACCESSO A GITHUB (SPEC 6.1)
// ============================================================
// A cosa serve:
//   Gestisce il token GitHub (fine-grained, sola lettura) con cui l'app
//   legge i JSON dal repository privato orangetide-core:
//     - lo salva SOLO nella memoria locale di questo dispositivo (localStorage);
//     - ricorda la data di scadenza, inserita a mano in Impostazioni;
//     - tiene traccia degli errori 401/403 (token scaduto o non valido);
//     - calcola lo stato del token per gli avvisi e la pagina Impostazioni.
//
// Perché la scadenza si inserisce a mano: GitHub la comunica nell'intestazione
//   "github-authentication-token-expiration", ma non la rende leggibile alle
//   pagine web (non è tra le intestazioni "esposte" dall'API). La data si
//   copia dalla pagina di GitHub quando si crea il token.
//
// Usato da: data.js (intestazioni delle richieste, esito), settings.js
//           (pagina Impostazioni), app.js (avvisi).
//
// localStorage = piccola memoria del browser legata a questo sito e a questo
//   dispositivo: resta anche chiudendo l'app; si perde cancellando i dati
//   del browser o disinstallando l'app.
// ============================================================

window.OT = window.OT || {};

OT.auth = (function () {
  // Chiavi nella memoria locale.
  const KEY_TOKEN = "ot-token";
  const KEY_EXPIRY = "ot-token-expiry";      // "AAAA-MM-GG" oppure assente
  const KEY_REJECTED = "ot-token-rejected";  // "1" se GitHub ha risposto 401/403

  // Stati possibili del token.
  const STATE = {
    MISSING: "missing",      // nessun token salvato
    REJECTED: "rejected",    // GitHub lo ha rifiutato (scaduto, revocato, permessi)
    EXPIRED: "expired",      // la data di scadenza inserita è passata
    EXPIRING: "expiring",    // scade entro N giorni (config.js: alerts.tokenExpiryWarningDays)
    OK: "ok",
  };

  // ============================================================
  // SEZIONE 1 — LETTURA E SALVATAGGIO
  // ============================================================
  /** Token salvato, o null. */
  function getToken() {
    return localStorage.getItem(KEY_TOKEN);
  }

  /** Data di scadenza salvata ("AAAA-MM-GG"), o null. */
  function getExpiry() {
    return localStorage.getItem(KEY_EXPIRY);
  }

  /**
   * Salva token e data di scadenza (sostituisce quelli precedenti).
   * @param {string} token
   * @param {string|null} expiry  "AAAA-MM-GG" oppure null se non indicata
   */
  function save(token, expiry) {
    localStorage.setItem(KEY_TOKEN, token.trim());
    if (expiry) localStorage.setItem(KEY_EXPIRY, expiry);
    else localStorage.removeItem(KEY_EXPIRY);
    localStorage.removeItem(KEY_REJECTED);
  }

  /** Cancella il token da questo dispositivo. */
  function clear() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_EXPIRY);
    localStorage.removeItem(KEY_REJECTED);
  }

  // ============================================================
  // SEZIONE 2 — ESITO DELLE RICHIESTE (chiamate da data.js)
  // ============================================================
  /** GitHub ha accettato il token. */
  function markAccepted() {
    localStorage.removeItem(KEY_REJECTED);
  }

  /** GitHub ha rifiutato il token (401/403). */
  function markRejected() {
    localStorage.setItem(KEY_REJECTED, "1");
  }

  // ============================================================
  // SEZIONE 3 — STATO DEL TOKEN
  // ============================================================
  /**
   * Giorni che mancano alla scadenza (0 = scade oggi, negativo = scaduto),
   * oppure null se la data non è stata inserita.
   */
  function daysLeft() {
    const expiry = getExpiry();
    if (!expiry) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(expiry + "T00:00:00");
    // 86400000 = millisecondi in un giorno
    return Math.round((end - today) / 86400000);
  }

  /** Stato attuale del token (uno dei valori di STATE). */
  function state() {
    if (!getToken()) return STATE.MISSING;
    if (localStorage.getItem(KEY_REJECTED) === "1") return STATE.REJECTED;
    const days = daysLeft();
    if (days !== null && days < 0) return STATE.EXPIRED;
    if (days !== null && days <= OT_CONFIG.alerts.tokenExpiryWarningDays) return STATE.EXPIRING;
    return STATE.OK;
  }

  // ============================================================
  // SEZIONE 4 — RICHIESTE A GITHUB
  // ============================================================
  /**
   * Intestazioni HTTP per l'API di GitHub.
   * "application/vnd.github.raw+json" = restituisci il contenuto del file
   * così com'è (senza la codifica base64 delle risposte standard).
   * @param {string} token
   */
  function headers(token) {
    return {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /**
   * Prova un token leggendo meta.json (il file più piccolo).
   * @param {string} token
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async function verify(token) {
    try {
      const response = await fetch(OT.data.githubUrl(OT_CONFIG.files.meta),
        { headers: headers(token.trim()), cache: "no-store" });
      if (response.ok) {
        await response.json();               // controlla che sia davvero il file atteso
        return { ok: true, message: OT_CONFIG.texts.token.verifyOk };
      }
      return { ok: false, message: describeError(response) };
    } catch (error) {
      return { ok: false, message: OT_CONFIG.texts.token.networkError + " (" + error.message + ")" };
    }
  }

  /**
   * Spiegazione in italiano di una risposta di errore di GitHub.
   * 403 con "X-RateLimit-Remaining: 0" = troppe richieste, non un token sbagliato.
   * @param {Response} response
   */
  function describeError(response) {
    const t = OT_CONFIG.texts.token;
    if (response.status === 403 && response.headers.get("X-RateLimit-Remaining") === "0") return t.rateLimited;
    if (response.status === 401) return t.error401;
    if (response.status === 403) return t.error403;
    if (response.status === 404) return t.error404;
    return `${t.errorOther} (${response.status})`;
  }

  /** True se la risposta indica un token rifiutato (non un limite di richieste). */
  function isRejection(response) {
    if (response.status === 401) return true;
    return response.status === 403 && response.headers.get("X-RateLimit-Remaining") !== "0";
  }

  return {
    STATE: STATE, getToken: getToken, getExpiry: getExpiry, save: save, clear: clear,
    markAccepted: markAccepted, markRejected: markRejected, daysLeft: daysLeft, state: state,
    headers: headers, verify: verify, describeError: describeError, isRejection: isRejection,
  };
})();
