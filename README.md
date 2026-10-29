# Θρύλος Daily

Προσωπική PWA για τον Ολυμπιακό: νέα, αγώνες, ζωντανή ροή, ρόστερ, αντίπαλοι, στοιχηματικά, βαθμολογίες, στατιστικά και ιδιωτικό chat οικογένειας.
Στατική εφαρμογή (ένα `index.html` με inline CSS/JS), χωρίς build step. Δημοσιεύεται με GitHub Pages.

- Production: https://jolimaniatis-lang.github.io/thrylos/ (branch `main`, ρίζα του repo)
- Γλώσσα διεπαφής: ελληνικά · θέματα light/dark · εγκαθίσταται στην αρχική οθόνη (iPhone/Android)

## Δομή αρχείων
| Διαδρομή | Ρόλος |
|---|---|
| `index.html` | Ολόκληρη η εφαρμογή (CSS, JS, καρτέλες, μενού «Κι άλλα») |
| `sw.js` | Service worker (network-first, offline fallback, cache `thr-vN`) |
| `manifest.webmanifest`, `icons/`, `assets/` | PWA manifest, εικονίδια, εμβλήματα/λογότυπα |
| `data/` | Δεδομένα JSON (δομή: [`docs/DATA.md`](docs/DATA.md)) |
| `tools/sync.py` | Αντιγραφή εξαγωγής δεδομένων στο `data/` + commit/push στο `main` |
| `tools/validate_data.py` | Έλεγχος δομής των `data/*.json` |
| `tools/css_audit.py` | Μόνο ανάγνωση: εντοπισμός CSS selectors με πολλαπλούς ορισμούς |
| `tests/smoke.js` | Smoke + προσβασιμότητα + αξιοπιστία (Playwright) |
| `docs/` | Τεκμηρίωση ([`DATA.md`](docs/DATA.md), [`MAINTENANCE.md`](docs/MAINTENANCE.md)) |

Πώς δουλεύει: η εφαρμογή διαβάζει τα `data/*.json` με polling (π.χ. `live/now` 15 s, τα υπόλοιπα 45 s· μόνο όταν η σελίδα είναι ορατή),
το chat χρησιμοποιεί Supabase (RPC `valid_code`, `post_message`, `report_message`), και το Euroleague overlay ανανεώνει σκορ απευθείας από το live.euroleague.net.
Κλειδιά localStorage: `thr_code`, `thr_name`, `thr_seen`, `thr_f`, `thr_g`, `thr_m`, `thr_r`, `thr_theme`, `thr_draft` (πρόχειρο chat — μόνο κείμενο).

## Τοπική εκτέλεση
```bash
python3 -m http.server 8000      # από τη ρίζα του repo → http://localhost:8000/
```
Ο service worker λειτουργεί σε `localhost`. Για καθαρή δοκιμή: DevTools → Application → Clear storage.

## Tests
Απαιτούνται Node.js και Playwright με εγκατεστημένο Chromium (`npm i -g playwright && npx playwright install chromium`).
```bash
NODE_PATH=$(npm root -g) node tests/smoke.js     # έξοδος 0 = πέρασαν όλα
python3 tools/validate_data.py                   # δομή δεδομένων
```
Το smoke test στήνει δικό του στατικό server, προσομοιώνει Supabase/Euroleague (δεν χρησιμοποιεί πραγματικό κωδικό) και ελέγχει:
πλάτη 360/390/430/1280 px (overflow, σφάλματα κονσόλας, καρτέλες, μενού «Κι άλλα»), touch, προσβασιμότητα (αντίθεση light/dark, ονόματα κουμπιών, πληκτρολόγιο, focus, reduced-motion),
polling κρυφής/ορατής σελίδας, αποτυχία/άκυρο JSON, offline μέσω service worker και διατήρηση πρόχειρου chat.
**Δεν καλύπτει:** πραγματικό Supabase/live feed, πραγματική συσκευή, screen reader.

## Ενημέρωση δεδομένων
Τα δεδομένα παράγονται από scheduled tasks (βάση τεχνουργήματος → εξαγωγή → `sync.py`):
```bash
python3 tools/sync.py --dry-run /tmp/exp          # μόνο έλεγχος, δεν γράφει τίποτα
python3 tools/sync.py /tmp/exp editions live      # αντιγραφή, commit "data …Z", push στο main
```
- Παραλείπονται αρχεία με άκυρο JSON ή κενά· για γνωστά αρχεία τυπώνονται προειδοποιήσεις δομής (δεν μπλοκάρουν).
- Κρατιούνται οι 60 νεότερες εκδόσεις και ξαναγράφεται το `data/index.json`.
- ⚠️ **Το `sync.py` κάνει push `HEAD:main` (παραγωγή).** Τρέχει μόνο από καθαρό clone του `main`, ποτέ από branch ανάπτυξης (π.χ. `ui-v5`) — θα δημοσίευε και τον κώδικα του branch.

## Διαδικασία ανάπτυξης και δημοσίευσης
1. Δουλεύουμε σε branch (`ui-v5` για την τρέχουσα αναβάθμιση). Backup: `backup-pre-ui-v5` — δεν αλλάζει.
2. Μικρά commits, ένα ανά φάση/αλλαγή· πριν από κάθε commit τρέχουν τα tests παραπάνω.
3. Έλεγχος σε 360/390/430/1280 px και light/dark.
4. **Η δημοσίευση (push στο `main` / merge) απαιτεί ξεχωριστή, ρητή έγκριση του ιδιοκτήτη.** Μέχρι τότε το `main` μένει ανέγγιχτο, εκτός από τα αυτόματα commits δεδομένων του sync.
5. Αν αλλάξει η λίστα precache ή η στρατηγική cache στο `sw.js`, ανέβασε την έκδοση `thr-vN`.
6. Επαναφορά: `git revert <commit>` (το GitHub Pages ανανεώνεται μέσα σε λίγα λεπτά).

## Ασφάλεια
- Το Supabase publishable key είναι ορατό στον client (αναμενόμενο)· η προστασία βασίζεται σε RLS/RPC στη βάση — **δεν επαληθεύεται από αυτό το repo**, έλεγξέ το στο Supabase dashboard.
- Μην αποθηκεύεις κωδικούς πρόσκλησης, tokens ή ιστορικό chat στο repo, στην cache ή στα logs.
