// ============================================================
// js/app.js — AVVIO, NAVIGAZIONE, WIDGET E TEMA (SPEC 10.2, 11)
// ============================================================
// A cosa serve:
//   - registro dei WIDGET: ogni riquadro dell'app (prezzo, tachimetro del
//     rischio, grafico...) è un widget che si "registra" qui con un nome;
//   - costruisce la navigazione dalle pagine di config.js;
//   - mostra la pagina richiesta (#dashboard, #storico, ...) disegnando i
//     suoi widget nell'ordine indicato in config.js;
//   - tema chiaro / scuro / automatico;
//   - funzioni di formattazione comuni (numeri, date, percentuali);
//   - avvisi globali in alto (token, dati vecchi, nuova versione: SPEC 11.6);
//   - registrazione del service worker (app installabile e offline) e
//     avviso "Nuova versione disponibile — Aggiorna" (SPEC 6.2).
//
// Ordine di caricamento in index.html: config.js, data.js, app.js, poi i
// file dei widget (dashboard.js, ...), che usano OT.registerWidget.
// L'avvio vero e proprio avviene quando la pagina è pronta (SEZIONE 7).
//
// Come si scrive un widget (in un qualunque file dei widget):
//   OT.registerWidget("nome", {
//     title: "Titolo del riquadro",          // null = senza intestazione
//     size: "full",                           // "full" = tutta la larghezza;
//                                             // "half" (default) = mezza su PC
//     needs: ["latest"],                      // file JSON necessari
//     render: function (body, files) { ... } // disegna dentro "body";
//   });                                       // files.latest.data = contenuto
// ============================================================

window.OT = window.OT || {};

// ============================================================
// SEZIONE 1 — REGISTRO DEI WIDGET
// ============================================================
OT.widgets = {};   // nome -> definizione del widget

/**
 * Registra un widget, rendendolo utilizzabile in qualunque pagina.
 * @param {string} id          nome del widget (quello usato in config.js)
 * @param {object} definition  { title, needs, render }
 */
OT.registerWidget = function (id, definition) {
  OT.widgets[id] = definition;
};

// ============================================================
// SEZIONE 2 — FORMATTAZIONE (numeri e date all'italiana)
// ============================================================
// Intl.NumberFormat / toLocaleString sono le funzioni del browser che
// scrivono numeri e date secondo le regole di una lingua (qui it-IT).
OT.fmt = {
  /**
   * Numero con N decimali: OT.fmt.number(1234.5, 1) -> "1.234,5".
   * Restituisce "n/d" se il valore manca (null).
   */
  number: function (value, decimals) {
    if (value === null || value === undefined) return "n/d";
    return value.toLocaleString(OT_CONFIG.locale, {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    });
  },

  /** Prezzo in dollari: 61169.55 -> "61.170 $". */
  usd: function (value) {
    if (value === null || value === undefined) return "n/d";
    return OT.fmt.number(value, 0) + " $";
  },

  /**
   * Frazione come percentuale con segno: -0.5096 -> "−51,0%".
   * @param {number} value     frazione (−0,25 = −25%)
   * @param {number} decimals  decimali (default 1)
   */
  pct: function (value, decimals) {
    if (value === null || value === undefined) return "n/d";
    const d = decimals === undefined ? 1 : decimals;
    const text = OT.fmt.number(Math.abs(value * 100), d) + "%";
    if (value > 0) return "+" + text;
    if (value < 0) return "−" + text;    // segno meno tipografico, come nel report
    return text;
  },

  /** Data "AAAA-MM-GG" -> "23/11/2026". */
  date: function (isoDate) {
    if (!isoDate) return "n/d";
    // "T00:00:00Z" = mezzanotte UTC: le date del core sono giorni UTC.
    const d = new Date(isoDate + "T00:00:00Z");
    return d.toLocaleDateString(OT_CONFIG.locale, { timeZone: "UTC" });
  },

  /** Data e ora ISO -> "23/11/2026, 04:19" (ora locale del dispositivo). */
  dateTime: function (isoDateTime) {
    if (!isoDateTime) return "n/d";
    return new Date(isoDateTime).toLocaleString(OT_CONFIG.locale, {
      dateStyle: "short", timeStyle: "short",
    });
  },
};

/**
 * Protegge un testo prima di inserirlo nell'HTML: i caratteri < > & " '
 * diventerebbero altrimenti codice HTML.
 */
OT.escape = function (text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
};

// ============================================================
// SEZIONE 3 — TEMA CHIARO / SCURO
// ============================================================
// Bootstrap 5.3 cambia i colori in base all'attributo data-bs-theme
// dell'elemento <html>: "light" o "dark". La scelta dell'utente
// ("auto", "light", "dark") è salvata nella memoria locale (localStorage).
OT.theme = {
  STORAGE_KEY: "ot-theme",

  /** Scelta salvata: "auto" (default), "light" o "dark". */
  get: function () {
    return localStorage.getItem(OT.theme.STORAGE_KEY) || "auto";
  },

  /** Salva la scelta e la applica. */
  set: function (choice) {
    localStorage.setItem(OT.theme.STORAGE_KEY, choice);
    OT.theme.apply();
  },

  /** Applica il tema: "auto" segue l'impostazione del sistema operativo. */
  apply: function () {
    let theme = OT.theme.get();
    if (theme === "auto") {
      // matchMedia chiede al browser se il sistema è in modalità scura.
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-bs-theme", theme);
    // Evento personalizzato: i grafici lo ascoltano per ridisegnarsi coi nuovi colori.
    document.dispatchEvent(new CustomEvent("ot:themechange", { detail: theme }));
  },

  /** Passa al tema successivo: automatico -> chiaro -> scuro -> automatico. */
  cycle: function () {
    const order = ["auto", "light", "dark"];
    const next = order[(order.indexOf(OT.theme.get()) + 1) % order.length];
    OT.theme.set(next);
    OT.app.updateThemeButton();
  },
};

// ============================================================
// SEZIONE 4 — NAVIGAZIONE
// ============================================================
OT.app = {};

/** Pagina di config.js con quell'id (o la pagina iniziale se non esiste). */
OT.app.findPage = function (id) {
  const page = OT_CONFIG.pages.find(function (p) { return p.id === id; });
  return page || OT_CONFIG.pages.find(function (p) { return p.id === OT_CONFIG.homePage; });
};

/**
 * Costruisce i menu dalle pagine di config.js:
 *   - menu laterale (PC): tutte le pagine;
 *   - barra in basso (telefono): pagine "main" + menu "Altro" con le "more".
 */
OT.app.buildNavigation = function () {
  const side = document.getElementById("nav-side");
  const bottom = document.getElementById("nav-bottom");
  const moreMenu = document.getElementById("nav-more-menu");
  side.innerHTML = "";
  bottom.innerHTML = "";
  moreMenu.innerHTML = "";

  for (const page of OT_CONFIG.pages) {
    // Menu laterale: un collegamento per ogni pagina.
    side.insertAdjacentHTML("beforeend",
      `<a class="ot-side-link" href="#${page.id}" data-page="${page.id}">
         <i class="bi ${page.icon}"></i><span>${OT.escape(page.title)}</span></a>`);

    if (page.nav === "main") {
      bottom.insertAdjacentHTML("beforeend",
        `<a class="ot-tab" href="#${page.id}" data-page="${page.id}">
           <i class="bi ${page.icon}"></i><span>${OT.escape(page.title)}</span></a>`);
    } else {
      moreMenu.insertAdjacentHTML("beforeend",
        `<li><a class="dropdown-item" href="#${page.id}" data-page="${page.id}">
           <i class="bi ${page.icon}"></i> ${OT.escape(page.title)}</a></li>`);
    }
  }
  // Il pulsante "Altro" va mostrato solo se ci sono pagine "more".
  const hasMore = OT_CONFIG.pages.some(function (p) { return p.nav !== "main"; });
  document.getElementById("nav-more").classList.toggle("d-none", !hasMore);
};

/** Evidenzia nei menu la pagina corrente. */
OT.app.highlightNavigation = function (pageId) {
  // querySelectorAll trova tutti gli elementi che corrispondono al selettore CSS.
  for (const link of document.querySelectorAll("[data-page]")) {
    link.classList.toggle("active", link.dataset.page === pageId);
  }
  // Il pulsante "Altro" è attivo se la pagina corrente è nel suo menu.
  const page = OT.app.findPage(pageId);
  document.getElementById("nav-more-button").classList.toggle("active", page.nav !== "main");
};

/** Aggiorna l'icona del pulsante del tema secondo la scelta corrente. */
OT.app.updateThemeButton = function () {
  const icons = { auto: "bi-circle-half", light: "bi-sun", dark: "bi-moon-stars" };
  const labels = { auto: OT_CONFIG.texts.themeAuto, light: OT_CONFIG.texts.themeLight, dark: OT_CONFIG.texts.themeDark };
  const choice = OT.theme.get();
  const button = document.getElementById("theme-button");
  button.innerHTML = `<i class="bi ${icons[choice]}"></i>`;
  button.title = "Tema: " + labels[choice];
};

/** Mostra nella barra in alto la data dei dati (da latest.json). */
OT.app.showDataDate = async function () {
  try {
    const latest = await OT.data.load("latest");
    document.getElementById("data-date").innerHTML =
      `<i class="bi bi-calendar3"></i> ${OT_CONFIG.texts.dataAsOf} ${OT.fmt.date(latest.data.date)}`;
  } catch (error) {
    // Nessun dato: la pillola resta vuota (i widget mostrano l'errore).
  }
};

// ============================================================
// SEZIONE 5 — DISEGNO DI UNA PAGINA
// ============================================================
/**
 * Mostra una pagina: crea un riquadro per ogni widget elencato in config.js,
 * carica i file JSON che servono e disegna i widget.
 * Un widget che dà errore mostra un messaggio solo nel proprio riquadro:
 * gli altri continuano a funzionare.
 * @param {string} pageId
 */
OT.app.showPage = function (pageId) {
  const page = OT.app.findPage(pageId);
  const main = document.getElementById("page");
  document.title = `${page.title} · ${OT_CONFIG.texts.appName}`;
  document.getElementById("page-title").textContent = page.title;
  OT.app.highlightNavigation(page.id);

  main.innerHTML = `<div class="ot-widgets"></div>`;
  const container = main.querySelector(".ot-widgets");

  const rendering = [];
  for (const widgetId of page.widgets) {
    const card = OT.app.createWidgetCard(widgetId);
    container.appendChild(card);
    rendering.push(OT.app.renderWidget(widgetId, card));
  }
  window.scrollTo(0, 0);
  // Gli avvisi si aggiornano quando i widget hanno finito di caricare i dati
  // (es. un 401 di GitHub scoperto durante il caricamento).
  Promise.all(rendering).then(OT.app.renderBanners);
};

/** Riscarica i dati e ridisegna la pagina corrente (dopo un cambio di token). */
OT.app.refresh = function () {
  OT.data.reset();
  OT.app.showDataDate();
  OT.app.showPage(OT.app.currentPageId());
};

// ============================================================
// SEZIONE 5b — AVVISI GLOBALI (SPEC 11.6)
// ============================================================
/**
 * Disegna gli avvisi in alto:
 *   - token mancante / rifiutato / scaduto / in scadenza (solo con dati da GitHub);
 *   - dati vecchi (ultimo aggiornamento oltre alerts.staleDataHours);
 *   - nuova versione dell'app pronta.
 */
OT.app.renderBanners = async function () {
  const b = OT_CONFIG.texts.banners;
  const banners = [];
  // Collegamento a Impostazioni (non serve se si è già lì).
  const settingsLink = OT.app.currentPageId() === "impostazioni" ? ""
    : `<a href="#impostazioni" class="ot-banner-action">${b.goToSettings}</a>`;

  if (OT.data.source() === "github") {
    const state = OT.auth.state();
    const S = OT.auth.STATE;
    if (state === S.MISSING) banners.push({ level: "warning", text: b.tokenMissing, action: settingsLink });
    if (state === S.REJECTED) banners.push({ level: "danger", text: b.tokenRejected, action: settingsLink });
    if (state === S.EXPIRED) banners.push({ level: "danger", text: b.tokenExpired, action: settingsLink });
    if (state === S.EXPIRING) {
      banners.push({ level: "warning", text: b.tokenExpiring.replace("{date}", OT.fmt.date(OT.auth.getExpiry())),
        action: settingsLink });
    }
  }

  try {
    const meta = await OT.data.load("meta");
    const hours = (Date.now() - new Date(meta.data.generated_at)) / 3600000;   // ms -> ore
    if (hours > OT_CONFIG.alerts.staleDataHours) {
      banners.push({ level: "warning", text: b.staleData.replace("{date}", OT.fmt.dateTime(meta.data.generated_at)) });
    }
  } catch (error) {
    // Nessun dato: lo dicono già i widget (e l'eventuale avviso sul token).
  }

  if (OT.app.waitingWorker) {
    banners.push({ level: "info", text: b.newVersion,
      action: `<button type="button" class="ot-banner-action" id="ot-update-button">${b.update}</button>` });
  }

  const box = document.getElementById("banners");
  box.innerHTML = banners.map(function (x) {
    const icon = { danger: "bi-exclamation-octagon", warning: "bi-exclamation-triangle", info: "bi-stars" }[x.level];
    return `<div class="ot-banner ot-banner-${x.level}"><i class="bi ${icon}"></i>
      <span>${OT.escape(x.text)}</span>${x.action || ""}</div>`;
  }).join("");

  const update = document.getElementById("ot-update-button");
  if (update) update.addEventListener("click", OT.app.applyUpdate);
};

/**
 * Crea il pannello di un widget, con titolo e corpo vuoto.
 * @returns {HTMLElement}
 */
OT.app.createWidgetCard = function (widgetId) {
  const widget = OT.widgets[widgetId];
  const card = document.createElement("section");
  card.className = "ot-widget";
  if (widget && widget.size === "full") card.classList.add("ot-widget-full");
  card.dataset.widget = widgetId;
  const title = widget ? widget.title : widgetId;
  card.innerHTML =
    (title ? `<h2 class="ot-widget-title">${OT.escape(title)}</h2>` : "") +
    `<div class="ot-widget-body"><div class="ot-muted">${OT_CONFIG.texts.loading}</div></div>`;
  return card;
};

/**
 * Carica i dati di un widget e lo disegna nel suo riquadro.
 * Se il widget non esiste ancora mostra "In arrivo".
 */
OT.app.renderWidget = async function (widgetId, card) {
  const body = card.querySelector(".ot-widget-body");
  const widget = OT.widgets[widgetId];
  if (!widget) {
    card.classList.add("ot-widget-todo");
    body.innerHTML = `<div class="ot-muted"><i class="bi bi-hourglass-split"></i> ${OT_CONFIG.texts.widgetComingSoon}</div>`;
    return;
  }
  try {
    // Carica in parallelo tutti i file richiesti dal widget.
    // Promise.all aspetta che tutte le operazioni siano finite.
    const needs = widget.needs || [];
    const results = await Promise.all(needs.map(function (name) { return OT.data.load(name); }));
    const files = {};
    needs.forEach(function (name, i) { files[name] = results[i]; });
    body.innerHTML = "";
    widget.render(body, files);
  } catch (error) {
    console.error(`Widget ${widgetId}:`, error);
    body.innerHTML = `<div class="text-danger"><i class="bi bi-exclamation-triangle"></i>
      ${OT_CONFIG.texts.widgetError}: ${OT.escape(error.message)}</div>`;
  }
};

/** Pagina indicata nell'indirizzo (#storico -> "storico"). */
OT.app.currentPageId = function () {
  return window.location.hash.replace("#", "") || OT_CONFIG.homePage;
};

// ============================================================
// SEZIONE 6 — SERVICE WORKER (app installabile e offline)
// ============================================================
/**
 * Registra il service worker: il file che tiene in memoria l'interfaccia
 * per farla funzionare anche senza rete, e controlla se c'è una versione
 * nuova dell'app (SPEC 6.2):
 *   - il browser scarica service-worker.js; se è cambiato (nuova VERSION)
 *     installa la nuova versione, che resta "in attesa";
 *   - config.autoUpdate true  -> la si attiva subito e la pagina si ricarica;
 *     config.autoUpdate false -> avviso "Nuova versione disponibile — Aggiorna".
 */
OT.app.registerServiceWorker = function () {
  if (!("serviceWorker" in navigator)) return;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalhost && !OT_CONFIG.serviceWorkerOnLocalhost) {
    // In sviluppo: si rimuove un eventuale service worker già installato.
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (const registration of registrations) registration.unregister();
    });
    return;
  }
  // Quando la nuova versione prende il controllo, si ricarica la pagina una volta.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("service-worker.js").then(function (registration) {
    // Versione già scaricata e in attesa (es. da un'apertura precedente).
    if (registration.waiting && navigator.serviceWorker.controller) OT.app.onUpdateReady(registration.waiting);
    // Versione trovata adesso: si aspetta che finisca di installarsi.
    registration.addEventListener("updatefound", function () {
      const worker = registration.installing;
      worker.addEventListener("statechange", function () {
        // "controller" esiste solo se c'era già una versione: al primo avvio non si avvisa.
        if (worker.state === "installed" && navigator.serviceWorker.controller) OT.app.onUpdateReady(worker);
      });
    });
    registration.update();   // controlla subito se c'è una versione nuova
  }).catch(function (error) {
    console.warn("Service worker non registrato:", error);
  });
};

/**
 * Una nuova versione è pronta: la si attiva subito (autoUpdate) oppure si
 * mostra l'avviso con il pulsante "Aggiorna".
 * @param {ServiceWorker} worker  la nuova versione in attesa
 */
OT.app.onUpdateReady = function (worker) {
  OT.app.waitingWorker = worker;
  if (OT_CONFIG.autoUpdate) OT.app.applyUpdate();
  else OT.app.renderBanners();
};

/** Attiva la nuova versione (la pagina si ricarica da sola: vedi "controllerchange"). */
OT.app.applyUpdate = function () {
  if (OT.app.waitingWorker) OT.app.waitingWorker.postMessage("skipWaiting");
};

// ============================================================
// SEZIONE 7 — AVVIO
// ============================================================
// DOMContentLoaded = evento del browser "la pagina HTML è stata letta":
// da qui in poi gli elementi della pagina esistono e si possono modificare.
document.addEventListener("DOMContentLoaded", function () {
  OT.theme.apply();
  OT.app.updateThemeButton();
  document.getElementById("theme-button").addEventListener("click", OT.theme.cycle);
  // Se il tema è "auto" e il sistema cambia tra chiaro e scuro, ci si adegua.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (OT.theme.get() === "auto") OT.theme.apply();
  });

  document.getElementById("app-version").textContent = "OrangeTide v" + OT_CONFIG.version;
  OT.app.buildNavigation();
  OT.app.showDataDate();
  // Cambio di tema: si ridisegna la pagina (i grafici prendono i nuovi colori).
  document.addEventListener("ot:themechange", function () { OT.app.showPage(OT.app.currentPageId()); });

  // hashchange = l'indirizzo dopo "#" è cambiato (clic su un menu, tasto indietro).
  window.addEventListener("hashchange", function () { OT.app.showPage(OT.app.currentPageId()); });
  OT.app.showPage(OT.app.currentPageId());

  OT.app.registerServiceWorker();
});
