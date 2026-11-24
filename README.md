# OrangeTide — app (PWA)

Interfaccia di OrangeTide: una **PWA** (app web installabile) che mostra i
dati calcolati da `orangetide-core`. Questo repository è **pubblico** e non
contiene dati né token (SPEC 6).

> **Stato (v0.3.0):** Fase 4 in corso. Pronte: Dashboard, Storico, Backtest,
> Cicli, Grafici, Impostazioni (token GitHub) e avvisi. Da fare: Info
> (metodo, crediti, avvertenza), pubblicazione su GitHub Pages.

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
`"local"` (questa modalità) o `"github"` (API di GitHub con token, per l'uso
da iPhone: in arrivo nel passo 2).

---

## Come è organizzata

| File | Contenuto |
|---|---|
| `index.html` | struttura della pagina (intestazione, menu, contenuto) |
| `css/style.css` | colori (tema chiaro e scuro) e stile |
| `js/config.js` | **tutta** la configurazione: sorgente dati, versione, pagine, colori, testi |
| `js/data.js` | caricamento dei JSON e copia di riserva sul dispositivo |
| `js/app.js` | avvio, navigazione, tema, formattazione, registro dei widget |
| `js/dashboard.js`, `js/storico.js`, `js/backtest.js`, `js/cicli.js`, `js/graphs.js`, `js/info.js`, `js/settings.js` | i widget di ogni pagina |
| `manifest.json` | nome, icone e colori dell'app installata |
| `service-worker.js` | copia dell'interfaccia per l'uso offline e gestione versioni |
| `icons/` | icone dell'app |

### Pagine e widget

Ogni riquadro dell'app è un **widget** indipendente (es. `priceSummary`,
`riskGauge`). Le pagine sono solo **elenchi di widget** in `js/config.js`
(voce `pages`): per spostare un riquadro da una pagina all'altra, o cambiarne
l'ordine, basta spostarne il nome nell'elenco. Un widget non ancora scritto
compare come riquadro tratteggiato "In arrivo".

### Rilasciare una nuova versione

Incrementare **insieme** `version` in `js/config.js` e `VERSION` in
`service-worker.js` (es. `0.1.0` → `0.1.1`), poi commit + push.
