#!/usr/bin/env python3
"""Ξαναφτιάχνει το data/index.json (λίστες εκδόσεων/ρόστερ + hash ανά αρχείο) μετά από χειροκίνητη αλλαγή στο data/.
Το tools/sync.py το κάνει μόνο του· αυτό χρειάζεται μόνο όταν αλλάζεις αρχεία με το χέρι. Χρήση: python3 tools/mkindex.py [--check]"""
import json, os, sys, glob, hashlib
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); data = os.path.join(root, "data")
eds = sorted((os.path.basename(f)[:-5] for f in glob.glob(data + "/editions/*.json")), reverse=True)[:60]
ros = sorted(os.path.basename(f)[:-5] for f in glob.glob(data + "/rosters/*.json"))
ver = {}
for part in ("editions", "rosters", "schedule"):
    for f in sorted(glob.glob(os.path.join(data, part, "*.json"))):
        ver[part + "/" + os.path.basename(f)[:-5]] = hashlib.md5(open(f, "rb").read()).hexdigest()[:8]
idx = json.dumps({"editions": eds, "rosters": ros, "v": ver}, ensure_ascii=False, separators=(",", ":"))
ip = os.path.join(data, "index.json"); cur = open(ip).read() if os.path.exists(ip) else ""
if "--check" in sys.argv:
    print("index OK" if cur == idx else "ΣΦΑΛΜΑ: το data/index.json δεν συμφωνεί με τα αρχεία (τρέξε tools/mkindex.py)"); sys.exit(0 if cur == idx else 1)
if cur != idx: open(ip, "w").write(idx); print("index ενημερώθηκε")
else: print("index ήδη σωστό")
