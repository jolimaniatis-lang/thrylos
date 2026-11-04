#!/usr/bin/env python3
"""Στέλνει ειδοποιήσεις (ntfy.sh) όταν αλλάζει κάτι στο auto.json: έναρξη, γκολ (ποδόσφαιρο/πόλο), ημίχρονο, τελικό.
Χρήση: notify.py <prev.json> <new.json> <topic>"""
import json, sys, urllib.request
prev_f, new_f, topic = sys.argv[1:4]
def load(f):
    try: return {f'{m["d"]}|{m["opp"]}|{m["sport"]}': m for m in json.load(open(f, encoding="utf8")).get("matches", [])}
    except Exception: return None
prev, new = load(prev_f), load(new_f)
if prev is None or new is None: sys.exit(0)   # πρώτη εκτέλεση: τίποτα να συγκρίνουμε
EMO = {"football": "⚽", "basketball": "🏀", "volleyball": "🏐", "handball": "🤾", "polo": "🤽"}
def send(title, msg):
    body = json.dumps({"topic": topic, "title": title, "message": msg, "priority": 4}).encode()
    try: urllib.request.urlopen(urllib.request.Request("https://ntfy.sh/", body, {"Content-Type": "application/json"}), timeout=15)
    except Exception as e: print("ntfy σφάλμα", e)
def line(m):
    a, b = m.get("olyScore"), m.get("oppScore"); oly, opp = "Ολυμπιακός", m["opp"]
    L, R = ((oly, a), (opp, b)) if m.get("home", True) else ((opp, b), (oly, a))
    return f"{L[0]} {L[1]} - {R[1]} {R[0]}"
for k, m in new.items():
    p = prev.get(k); e = EMO.get(m["sport"], "🔴")
    if p is None or p.get("status") not in ("live", "ht", "ft") :
        if m.get("status") == "live": send(f"{e} Ξεκίνησε ο αγώνας", line(m)); 
        continue
    if m.get("status") == "ft" and p.get("status") != "ft": send(f"{e} Τελικό", line(m))
    elif m.get("status") == "ht" and p.get("status") != "ht": send(f"{e} Ημίχρονο", line(m))
    elif m["sport"] in ("football", "polo"):
        s = lambda x: (x.get("olyScore") or 0) + (x.get("oppScore") or 0)
        if s(m) > s(p): send(f"{e} ΓΚΟΛ!" if m["sport"] == "football" else f"{e} Γκολ", line(m))
