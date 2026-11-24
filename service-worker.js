// ============================================================
// service-worker.js — FUNZIONAMENTO OFFLINE E VERSIONI (SPEC 6.2)
// ============================================================
// A cosa serve:
//   Il service worker è un piccolo programma che il browser tiene attivo
//   "dietro" all'app. Qui conserva una copia dell'INTERFACCIA (HTML, CSS,
//   JavaScript, librerie, icone) per aprire l'app anche senza rete.
//
//   I DATI (i JSON del core) NON passano da qui: li gestisce js/data.js,
//   che tiene la propria copia sul dispositivo.
//
// Versioni:
//   VERSION va incrementata a ogni rilascio, insieme a "version" in
//   js/config.js. Il browser confronta questo file con quello installato:
//   se è cambiato, installa la nuova versione con una nuova copia
//   dell'interfaccia e cancella quella vecchia.
// ============================================================

const VERSION = "0.5.1";
const CACHE_NAME = "ot-app-" + VERSION;

// File dell'interfaccia salvati subito all'installazione.
const APP_FILES = [
  "./",
  "index.html",
  "css/style.css",
  "js/config.js",
  "js/auth.js",
  "js/data.js",
  "js/app.js",
  "js/charts.js",
  "js/dashboard.js",
  "js/storico.js",
  "js/backtest.js",
  "js/cicli.js",
  "js/graphs.js",
  "js/info.js",
  "js/settings.js",
  "manifest.json",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

// Indirizzi delle librerie esterne (CDN e font): salvate al primo utilizzo.
const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

// ============================================================
// INSTALLAZIONE: salva l'interfaccia
// ============================================================
// self = il service worker stesso. waitUntil = "non considerare finita
// l'installazione finché questa operazione non è completata".
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_FILES); })
  );
});

// ============================================================
// ATTIVAZIONE: cancella le copie delle versioni precedenti
// ============================================================
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names
        .filter(function (name) { return name.startsWith("ot-app-") && name !== CACHE_NAME; })
        .map(function (name) { return caches.delete(name); }));
    })
  );
});

// ============================================================
// RICHIESTE: interfaccia dalla copia salvata, se c'è
// ============================================================
// Per ogni file chiesto dall'app:
//   - file dell'app (stesso indirizzo) o librerie CDN -> prima la copia
//     salvata (avvio rapido e offline); se manca, dalla rete e la si salva;
//   - tutto il resto (dati JSON, API di GitHub) -> non si tocca.
self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);
  const isApp = url.origin === self.location.origin && url.pathname.startsWith(scopePath());
  const isCdn = CDN_HOSTS.includes(url.hostname);
  if (event.request.method !== "GET" || !(isApp || isCdn)) {
    return;   // il browser gestisce la richiesta normalmente
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(event.request, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
});

/** Percorso della cartella dell'app (es. "/orangetide-app/"). */
function scopePath() {
  return new URL(self.registration.scope).pathname;
}

// ============================================================
// AGGIORNAMENTO SU RICHIESTA DELL'APP
// ============================================================
// Quando l'utente preme "Aggiorna", l'app manda il messaggio "skipWaiting":
// la nuova versione prende subito il posto di quella vecchia.
self.addEventListener("message", function (event) {
  if (event.data === "skipWaiting") self.skipWaiting();
});
