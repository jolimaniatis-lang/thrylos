#!/usr/bin/env python3
"""Μόνο ανάγνωση: λίστα CSS selectors που ορίζονται πάνω από μία φορά στο ίδιο media context του index.html.
Δεν αλλάζει κανένα αρχείο. Χρήση: python3 tools/css_audit.py [index.html]
Κάθε εγγραφή χρειάζεται χειροκίνητο έλεγχο (σειρά, ειδικότητα, media, θέματα, !important) πριν αφαιρεθεί κάτι."""
import re, sys, collections, os
src = open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "index.html"), encoding="utf8").read()
css = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
def top(t):
    out, d, st, hs, head = [], 0, 0, 0, ""
    for i, c in enumerate(t):
        if c == "{":
            if d == 0: head, hs = t[st:i].strip(), i + 1
            d += 1
        elif c == "}":
            d -= 1
            if d == 0: out.append((head, t[hs:i])); st = i + 1
    return out
seen = collections.defaultdict(list)
for h, b in top(css):
    inner = [(h, h2, b2) for h2, b2 in top(b)] if h.startswith(("@media", "@supports")) else ([] if h.startswith("@") else [("", h, b)])
    for med, sel, body in inner:
        for s in sel.split(","): seen[(med, s.strip())].append(body)
dups = {k: v for k, v in seen.items() if len(v) > 1}
print("κανόνες με πολλαπλό ορισμό: %d · !important: %d" % (len(dups), css.count("!important")))
for (med, sel), bodies in sorted(dups.items()):
    props = collections.Counter(p.split(":")[0].strip() for b in bodies for p in b.split(";") if ":" in p)
    print("%-30s x%d  επικαλυπτόμενες ιδιότητες: %s  %s" % (sel[:30], len(bodies), ",".join(p for p, c in props.items() if c > 1) or "-", ("[" + med[:30] + "]") if med else ""))
