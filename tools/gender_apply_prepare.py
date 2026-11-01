#!/usr/bin/env python3
"""Φάση 3Β: ετοιμάζει (ΔΕΝ γράφει στη βάση) νέο season.json με το πεδίο gender και ελέγχει ότι άλλαξε ΜΟΝΟ αυτό.
Χρήση: python3 tools/gender_apply_prepare.py <season_in.json> <preview.json> <season_out.json>
 - preview.json: έξοδος του `node tools/gender_preview.js season_in.json preview.json`
 - Δεν αγγίζεται αγώνας που έχει ήδη gender· αγώνες χωρίς πρόταση μένουν χωρίς πεδίο.
 - Έλεγχοι: ίδιος αριθμός αγώνων, ίδια σειρά, κάθε πεδίο εκτός gender ίδιο, root πεδία ίδια. Αποτυχία → exit 1, δεν γράφεται αρχείο."""
import json, sys, copy
src, prev, out = sys.argv[1:4]
d = json.load(open(src, encoding="utf8")); p = json.load(open(prev, encoding="utf8"))
key = lambda m: (m.get("d"), m.get("sport"), m.get("comp"), m.get("opp"))
pm = {}
for o in p:
    k = (o["d"], o["sport"], o["comp"], o["opp"])
    if k in pm: sys.exit(f"διπλό κλειδί στην προεπισκόπηση: {k}")
    pm[k] = o["proposed"]
new = copy.deepcopy(d); added = 0; skipped = 0
for m in new["matches"]:
    g = pm.get(key(m), "ΛΕΙΠΕΙ")
    if g == "ΛΕΙΠΕΙ": sys.exit(f"αγώνας που δεν υπάρχει στην προεπισκόπηση (η προεπισκόπηση είναι παλιά): {key(m)}")
    if "gender" in m: skipped += 1; continue
    if g in ("m", "w"): m["gender"] = g; added += 1
# επαλήθευση: καμία άλλη αλλαγή
assert [k for k in new if k != "matches"] == [k for k in d if k != "matches"], "άλλαξαν πεδία ρίζας"
assert {k: v for k, v in new.items() if k != "matches"} == {k: v for k, v in d.items() if k != "matches"}, "άλλαξαν τιμές ρίζας"
assert len(new["matches"]) == len(d["matches"]), "άλλαξε το πλήθος αγώνων"
for a, b in zip(d["matches"], new["matches"]):
    bb = {k: v for k, v in b.items() if k != "gender"}
    assert a == bb, f"άλλαξε άλλο πεδίο στον αγώνα {key(a)}"
json.dump(new, open(out, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
print(f"OK: αγώνες {len(new['matches'])}, προστέθηκε gender σε {added}, ήδη είχαν {skipped}, χωρίς πρόταση {len(new['matches'])-added-skipped}")
