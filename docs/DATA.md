# Δομή δεδομένων (`data/`)

Η εφαρμογή διαβάζει στατικά JSON από το `data/` (δεν υπάρχει backend για τα δεδομένα). Τα αρχεία γράφονται από
scheduled tasks και συγχρονίζονται με το `tools/sync.py`. Το αρχείο αυτό **περιγράφει τα υπάρχοντα δεδομένα· δεν ορίζει νέο συμβόλαιο**.

Σύμβολα: **\*** = υπάρχει σε όλα τα τρέχοντα στοιχεία (υποχρεωτικό στην πράξη) · **?** = προαιρετικό.
Έλεγχος δομής: `python3 tools/validate_data.py` (σφάλμα μόνο για άκυρο JSON ή index που δείχνει σε αρχείο που λείπει· τα υπόλοιπα είναι προειδοποιήσεις).

Κοινές συμβάσεις: ημερομηνίες `YYYY-MM-DD` (πεδίο `d`/`date`), ώρες `HH:MM` ώρα Ελλάδας (`t`/`time`), `updatedAt` ISO-8601 κείμενο.
`sport` ∈ `football | basketball | amateur | polo`. Κάθε ρίζα είναι αντικείμενο (ποτέ λίστα). `sources` = λίστα `{title, url}`.

## `index.json`
`{"editions": ["2026-10-29", …], "rosters": ["basketball", …]}` — το ξαναφτιάχνει το `sync.py` (έως 60 νεότερες εκδόσεις). Η εφαρμογή το διαβάζει για να βρει ποια αρχεία να φορτώσει.

## `editions/YYYY-MM-DD.json` — καθημερινή έκδοση
| Πεδίο | Τύπος | |
|---|---|---|
| `date`, `headline`, `updatedAt` | str | \* |
| `items` | list | \* ειδήσεις |
| `fixtures` | list | \* αγώνες των επόμενων ημερών |
| `betting` | list | \* σύντομες στοιχηματικές σημειώσεις |
| `sources` | list | \* |

- `items[]`: `sport, kind, title, body, source, url` (\*, str)· `kind` ∈ `match, injury, quote, transfer, club, off`· `full` (?, list από str — πλήρες κείμενο, παράγραφοι).
- `fixtures[]`: `sport, comp, match, day, time` (\*)· `tv` (?).
- `betting[]`: `sport, text` (\*).

## `rosters/{basketball,football,polo-men,polo-women}.json`
- Ρίζα: `sport, groups, summary, sources, updatedAt` (\*)· `coach` (?, str — λείπει στο `polo-women`)· `note` (?, str).
- `summary[]`: `label, value` (str).
- `groups[]`: `name` (str), `players` (list).
- `players[]`: `name, pos` (\*, str)· `no` (?, int ή str)· `age, height` (?, int)· `latin` (?, str)· `nat` (?, str)· `captain` (?, bool)·
  `status` (?, `out | doubt | away`) με `statusText`, `statusNote` (?, str)· `stats` (?, αντικείμενο με ελληνικές ετικέτες π.χ. `Αγ.`, `Γκολ`, `Πόντ.` → αριθμοί)·
  `bio` (?, αντικείμενο: `born, birthplace, foot, joined, contract, value, national, career, honours, summary, sources, statTables` — όλα προαιρετικά).

## `live/now.json` — ζωντανοί/πρόσφατοι αγώνες (ανανεώνεται κάθε 15 s από την εφαρμογή)
Ρίζα: `matches` (list), `updatedAt`.
`matches[]` (όλα \*): `id` (π.χ. `marko-2026-10-28`), `sport, comp, d, kickoff, opp, home` (bool), `status` (`ft` κ.ά.), `clock, periods, note, tv` (str),
`olyScore, oppScore` (int), `events` (list `{min, team: "oly"|"opp", text, type}`), `stats` (list `{label, a, b, lower?}`), `links` (list `{title, url}`).
Το Euroleague overlay (άμεση κλήση στο live.euroleague.net) ενημερώνει μόνο το σκορ/ρολόι στην οθόνη· δεν γράφει στα αρχεία.

## `schedule/*.json`
| Αρχείο | Ρίζα | Στοιχεία |
|---|---|---|
| `season.json` | `matches, note, sources` | `sport, comp, opp, home, d` (\*)· `t, tv, note` (?)· `res` (`W|D|L`) και `score` (?, μόνο για παιγμένους) |
| `opponents.json` | `list` | `id, sport, comp, opp, d, t, home, meta, angle, olyForm, oppForm, keys[], absOly[], absOpp[], rows[{label,aText,bText}], sources[]` (\*)· `h2h, note` (?) |
| `standings.json` | `tables, sources` | `tables[]`: `sport, title, note, columns[], rows[][]` |
| `scorers.json` | `tables` | ίδιο σχήμα με standings (χωρίς `sources`) |
| `discipline.json` | `items` | `name, sport, type, text, until` |
| `rumors.json` | `items, sources` | `player, title, body, source, url, sport, dir (in|out), status, reliability (int)` |
| `quotes.json` | `items, sources` | `who, role, title, d, sport, source, url, points[]` (str) |
| `amateur.json` | `teams` | `sport, comp, title, next, last, source` |
| `betting.json` | `matches, history, recordNote, sources` | `matches[]`: `id, sport, comp, match, d, t, risk, markets[]` (\*, `markets[]`: `market, pick, conf (low|med|high), why`)· `oddsNote` (?)· `odds` (?, `{asOf, src, items[{l, v}]}`)· `builder` (?, `{legs[], why}`) |

Όλα έχουν και `updatedAt` (str). Στα `standings`/`scorers` η πρώτη στήλη του `columns` αντιστοιχεί στη θέση του πίνακα· οι τιμές των `rows` είναι αριθμοί ή κείμενο, με την ίδια σειρά με τα `columns`.

## Τι να προσέχεις όταν γράφεις δεδομένα
- Ο έλεγχος του `sync.py` απορρίπτει μόνο άκυρο JSON και κενό/μη-αντικείμενο. Ό,τι άλλο περνά· οι προειδοποιήσεις τυπώνονται απλώς.
- Μην αφήνεις `null` σε πεδία που η εφαρμογή περιμένει ως κείμενο· παράλειψε το πεδίο.
- Το doc `live/now.json` δεν αποθηκεύεται ποτέ στο cache του service worker.
