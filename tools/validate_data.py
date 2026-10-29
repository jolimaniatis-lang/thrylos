#!/usr/bin/env python3
"""Έλεγχος δομής των data/*.json (μόνο stdlib).

Χρήση:  python3 tools/validate_data.py [data_dir=data]

- ΣΦΑΛΜΑ  (exit 1): ακυρο JSON, ρίζα που δεν είναι αντικείμενο, index.json που δείχνει σε αρχείο που λείπει.
- ΠΡΟΕΙΔΟΠΟΙΗΣΗ (exit 0): πεδίο που λείπει ή έχει διαφορετικό τύπο από το αναμενόμενο.
  Οι προειδοποιήσεις δεν μπλοκάρουν ποτέ τη ροή δεδομένων· τα δεδομένα είναι γραμμένα από agents
  και η εφαρμογή ανέχεται ελλιπή πεδία. Η περιγραφή των πεδίων βρίσκεται στο docs/DATA.md.
Το tools/sync.py χρησιμοποιεί τη check() μόνο για να τυπώνει προειδοποιήσεις."""
import json, os, sys, glob

STR, LIST, DICT, NUM, BOOL = str, list, dict, (int, float), bool
# (αρχείο ή ομάδα) -> (πεδία ρίζας, {λίστα: υποχρεωτικά πεδία των στοιχείων})
SCHEMA = {
    "editions": ({"date": STR, "headline": STR, "items": LIST, "fixtures": LIST, "betting": LIST, "sources": LIST, "updatedAt": STR},
                 {"items": {"sport": STR, "kind": STR, "title": STR, "body": STR, "source": STR, "url": STR},
                  "fixtures": {"sport": STR, "comp": STR, "match": STR, "day": STR, "time": STR},
                  "betting": {"sport": STR, "text": STR}, "sources": {"title": STR, "url": STR}}),
    "rosters": ({"sport": STR, "groups": LIST, "summary": LIST, "sources": LIST, "updatedAt": STR},
                {"groups": {"name": STR, "players": LIST}, "summary": {"label": STR, "value": STR},
                 "sources": {"title": STR, "url": STR}}),
    "live/now": ({"matches": LIST, "updatedAt": STR},
                 {"matches": {"id": STR, "sport": STR, "opp": STR, "home": BOOL, "status": STR, "olyScore": NUM, "oppScore": NUM}}),
    "schedule/season": ({"matches": LIST, "sources": LIST, "updatedAt": STR},
                        {"matches": {"sport": STR, "comp": STR, "opp": STR, "home": BOOL, "d": STR}}),
    "schedule/opponents": ({"list": LIST, "updatedAt": STR},
                           {"list": {"id": STR, "sport": STR, "opp": STR, "d": STR, "home": BOOL}}),
    "schedule/standings": ({"tables": LIST, "updatedAt": STR},
                           {"tables": {"sport": STR, "title": STR, "columns": LIST, "rows": LIST}}),
    "schedule/scorers": ({"tables": LIST, "updatedAt": STR},
                         {"tables": {"sport": STR, "title": STR, "columns": LIST, "rows": LIST}}),
    "schedule/discipline": ({"items": LIST, "updatedAt": STR}, {"items": {"name": STR, "sport": STR, "type": STR, "text": STR}}),
    "schedule/rumors": ({"items": LIST, "updatedAt": STR}, {"items": {"player": STR, "title": STR, "body": STR, "status": STR}}),
    "schedule/quotes": ({"items": LIST, "updatedAt": STR}, {"items": {"who": STR, "title": STR, "points": LIST}}),
    "schedule/amateur": ({"teams": LIST, "updatedAt": STR}, {"teams": {"sport": STR, "title": STR, "next": STR, "last": STR}}),
    "schedule/betting": ({"matches": LIST, "updatedAt": STR},
                         {"matches": {"id": STR, "sport": STR, "match": STR, "markets": LIST, "risk": STR}}),
}

def key_for(rel):
    """rel: διαδρομή σχετική με το data/, π.χ. 'editions/2026-10-29.json'."""
    rel = rel.replace(os.sep, "/")[:-5]
    if rel.startswith("editions/"): return "editions"
    if rel.startswith("rosters/"): return "rosters"
    return rel

def _tn(t):
    return "/".join(x.__name__ for x in (t if isinstance(t, tuple) else (t,)))

def check(rel, d):
    """Επιστρέφει λίστα προειδοποιήσεων (κείμενο) για ένα έγγραφο· δεν απορρίπτει ποτέ δεδομένα."""
    sch = SCHEMA.get(key_for(rel))
    if not sch: return []
    top, lists = sch
    w = []
    for k, t in top.items():
        if k not in d: w.append(f"{rel}: λείπει το πεδίο '{k}'")
        elif not isinstance(d[k], t) or (t is not BOOL and isinstance(d[k], bool) and t != BOOL):
            w.append(f"{rel}: το '{k}' δεν είναι {_tn(t)}")
    for lk, fields in lists.items():
        for i, o in enumerate(d.get(lk) or []):
            if not isinstance(o, dict): w.append(f"{rel}: {lk}[{i}] δεν είναι αντικείμενο"); continue
            for k, t in fields.items():
                if k not in o: w.append(f"{rel}: {lk}[{i}] λείπει '{k}'")
                elif not isinstance(o[k], t): w.append(f"{rel}: {lk}[{i}].{k} δεν είναι {_tn(t)}")
            if len(w) > 40: w.append(f"{rel}: … (περισσότερες προειδοποιήσεις)"); return w
    return w

def main(data):
    errs, warns = [], []
    for f in sorted(glob.glob(os.path.join(data, "**", "*.json"), recursive=True)):
        rel = os.path.relpath(f, data)
        try: d = json.load(open(f, encoding="utf8"))
        except Exception as e: errs.append(f"{rel}: άκυρο JSON ({e})"); continue
        if not isinstance(d, dict): errs.append(f"{rel}: η ρίζα δεν είναι αντικείμενο"); continue
        if rel != "index.json": warns += check(rel, d)
    ip = os.path.join(data, "index.json")
    if os.path.exists(ip):
        try:
            idx = json.load(open(ip, encoding="utf8"))
            for part in ("editions", "rosters"):
                for n in idx.get(part, []):
                    if not os.path.exists(os.path.join(data, part, n + ".json")): errs.append(f"index.json: λείπει το {part}/{n}.json")
        except Exception as e: errs.append(f"index.json: {e}")
    else: errs.append("λείπει το index.json")
    for m in warns: print("ΠΡΟΕΙΔΟΠΟΙΗΣΗ", m)
    for m in errs: print("ΣΦΑΛΜΑ", m)
    print(f"data: {len(errs)} σφάλματα, {len(warns)} προειδοποιήσεις")
    return 1 if errs else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")))
