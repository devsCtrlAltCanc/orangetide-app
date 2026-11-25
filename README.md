# OrangeTide — app (PWA)

Interfaccia di OrangeTide: una **PWA** (app web installabile) che mostra i
dati calcolati da `orangetide-core`. Questo repository è **pubblico** e non
contiene dati né token (SPEC 6).

> **Stato (v0.7.0):** Fase 4 completata. Pronte tutte le pagine: Dashboard,
> Storico, Backtest, Cicli, Grafici, Info, Impostazioni (token GitHub) e
> avvisi. Pubblicata su GitHub Pages, installata e provata su PC (Edge) e
> iPhone (Safari) il 2026-11-24.

---

## Provarla sul PC (modalità locale)

Serve un piccolo server web, perché il browser non permette a una pagina
aperta come file di leggere altri file. Si usa quello incluso in Python.

1. Aprire un terminale nella cartella **`OrangeTide`** (quella che contiene
   sia `orangetide-app` sia `orangetide-core`).
2. Avviare il server:
   ```
   orangetide-core\.venv\Scripts\python -m http.server 8000 --bind 127.0.0.1
   ```
3. Aprire nel browser: <http://localhost:8000/orangetide-app/>
4. Per fermare il server: `Ctrl+C` nel terminale.

I dati letti sono quelli di `orangetide-core/output/`: per averli aggiornati
lanciare prima `git pull` in `orangetide-core` (li aggiorna GitHub ogni notte)
oppure `scripts\update.py`.

In `js/config.js` l'impostazione `dataSource` sceglie da dove leggere i dati:
`"local"` (questa modalità), `"github"` (API di GitHub con token) oppure
`"auto"` (predefinito: locale se l'indirizzo è `localhost`, GitHub altrimenti).
In locale il token non serve.

---

## Usarla da iPhone e PC (app pubblicata)

Indirizzo: **<https://devsctrlaltcanc.github.io/orangetide-app/>**
(pubblicato da GitHub Pages a ogni push su `main`).

L'interfaccia è pubblica, i **dati no**: stanno nel repository privato
`orangeTide-core` e l'app li legge con un **token GitHub** di sola lettura,
salvato solo sul dispositivo (SPEC 6.1).

### 1. Creare il token (una volta, sul sito di GitHub)

1. Aprire <https://github.com/settings/personal-access-tokens/new>.
2. **Token name**: es. "OrangeTide 2026". **Expiration**: la durata preferita
   (al massimo un anno). **Annotare la data di scadenza.**
3. **Repository access** → *Only select repositories* → solo **orangeTide-core**.
4. **Permissions** → *Repository permissions*:
   - **Contents: Read-only** — per leggere i dati;
   - **Actions: Read and write** — per il pulsante **↻ Aggiorna dati** e il
     contatore dei minuti di Actions nella pagina Info (SPEC 6.1, 11.7).
     Permette di avviare e annullare l'aggiornamento, non di modificare
     codice o dati;
   - **Variables: Read and write** — per "Aggiorna ogni N ore" in
     Impostazioni (variabile `UPDATE_HOURS` del core; non dà accesso ai
     segreti come la chiave FRED).

   Nessun altro permesso. Per aggiungere un permesso a un token già creato:
   aprirlo su GitHub → *Edit* → cambiare i permessi → salvare (il token resta
   lo stesso, non va reinserito nell'app).
5. **Generate token** e copiarlo (inizia con `github_pat_`). **GitHub lo
   mostra solo adesso**: dopo non si può più rivedere.
6. Conservarlo in un gestore di password (es. Portachiavi iCloud): servirà
   per inserirlo su ogni dispositivo.

### 2. Installare l'app

- **iPhone**: aprire l'indirizzo in **Safari** → pulsante Condividi →
  **Aggiungi alla schermata Home**.
- **PC**: aprire l'indirizzo in **Chrome o Edge** → icona "Installa" nella
  barra dell'indirizzo (oppure menu → *Installa OrangeTide*).

### 3. Inserire il token (una volta per dispositivo)

Nell'app: **Altro → Impostazioni** → incollare token e data di scadenza →
**Verifica e salva** (l'app prova una lettura vera dei dati).

Su iPhone va fatto **dentro l'app installata**, non in Safari: le due hanno
memorie separate.

### Aggiornare i dati dall'app

Il pulsante **↻** in alto, accanto alla data dell'ultimo aggiornamento, avvia
su GitHub lo stesso aggiornamento della notte (circa 2–4 minuti). Sotto la
barra compare lo stato ("in corso…", poi "completato" o "terminato con
errori"); alla fine l'app ricarica i dati da sola. Se un aggiornamento è già
in corso (anche quello notturno) non ne parte un altro: l'app segue quello.

### Aggiornamento automatico (Impostazioni)

- **Aggiorna ogni N ore** (da 1 a 24) — salvato **su GitHub**, vale per tutti
  i dispositivi e anche con l'app chiusa. Gli orari partono dalle 03:19 UTC;
  la pagina li mostra nell'ora del dispositivo con la stima dei minuti di
  Actions al mese. Valore iniziale: ogni 4 ore.
- **Aggiorna all'apertura** — vale **solo su quel dispositivo**. Aprendo
  l'app, se i dati del giorno non sono ancora arrivati (GitHub ha saltato gli
  orari), parte l'aggiornamento.

### Token perso su un dispositivo

Se su un dispositivo il token salvato si perde (dati del browser cancellati o
rovinati), creare un **nuovo** token per quel dispositivo, con gli stessi
permessi: rigenerare quello esistente lo farebbe smettere di funzionare anche
sugli altri dispositivi.

### Rinnovo del token

- Circa 15 giorni prima della scadenza l'app mostra un avviso in alto.
- Su <https://github.com/settings/personal-access-tokens> aprire il token →
  **Regenerate token** → copiare il nuovo → incollarlo in Impostazioni su
  **ogni** dispositivo (con la nuova data di scadenza).
- Se il token scade o viene rifiutato compare l'avviso "Token scaduto o non
  valido": l'app continua a mostrare gli ultimi dati salvati, con la loro data.
- Disinstallando l'app o cancellando i dati del browser il token salvato si
  perde e va reinserito.

---

## Come è organizzata

| File | Contenuto |
|---|---|
| `index.html` | struttura della pagina (intestazione, menu, contenuto) |
| `css/style.css` | colori (tema chiaro e scuro) e stile |
| `js/config.js` | **tutta** la configurazione: sorgente dati, versione, pagine, colori, testi |
| `js/data.js` | caricamento dei JSON e copia di riserva sul dispositivo |
| `js/auth.js` | token GitHub: salvataggio, scadenza, avvisi |
| `js/actions.js` | pulsante "Aggiorna dati" e minuti di GitHub Actions |
| `js/app.js` | avvio, navigazione, tema, formattazione, registro dei widget |
| `js/dashboard.js`, `js/storico.js`, `js/backtest.js`, `js/cicli.js`, `js/graphs.js`, `js/info.js`, `js/settings.js` | i widget di ogni pagina |
| `manifest.json` | nome, icone e colori dell'app installata |
| `service-worker.js` | copia dell'interfaccia per l'uso offline e gestione versioni |
| `icons/` | icone dell'app |

### Pagine e widget

Ogni riquadro dell'app è un **widget** indipendente (es. `priceHero`,
`riskGauge`). Le pagine sono solo **elenchi di widget** in `js/config.js`
(voce `pages`): per spostare un riquadro da una pagina all'altra, o cambiarne
l'ordine, basta spostarne il nome nell'elenco. Un widget non ancora scritto
compare come riquadro tratteggiato "In arrivo".

### Rilasciare una nuova versione

Incrementare **insieme** `version` in `js/config.js` e `VERSION` in
`service-worker.js` (es. `0.1.0` → `0.1.1`), poi commit + push. GitHub Pages
ripubblica in circa un minuto; le app installate mostrano l'avviso "Nuova
versione disponibile — Aggiorna" (non serve reinstallarle).
