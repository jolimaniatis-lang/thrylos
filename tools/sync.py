#!/usr/bin/env python3
"""Αντιγράφει εξαγωγή της βάσης (ArtifactData out_dir) στο data/ του repo, ξαναφτιάχνει το data/index.json,
κάνει commit και push (με επανάληψη σε conflict).
Χρήση: python3 tools/sync.py [--dry-run] [export_dir=/tmp/exp] [μέρη: editions rosters schedule live]
--dry-run: μόνο έλεγχος της εξαγωγής (τίποτα δεν γράφεται, δεν γίνεται commit/push).
Προστασίες (το push γίνεται στο main = παραγωγή):
 1. Εκτελείται μόνο όταν το τρέχον branch είναι το main (το --dry-run επιτρέπεται παντού).
 2. Το commit περιλαμβάνει ΜΟΝΟ διαδρομές data/ (ό,τι άλλο είναι staged δεν μπαίνει).
 3. Πριν από κάθε push ελέγχεται ότι τα commits που θα σταλούν αγγίζουν μόνο data/· αλλιώς το push ακυρώνεται."""
import json, os, sys, glob, shutil, subprocess, time
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dry = "--dry-run" in sys.argv
argv = [a for a in sys.argv[1:] if a != "--dry-run"]
exp = argv[0] if argv else "/tmp/exp"
parts = argv[1:] or ["editions", "rosters", "schedule", "live"]
def _git(*a):
    return subprocess.run(["git", "-C", root, *a], capture_output=True, text=True)
if not dry:
    br = _git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    if br != "main":
        print("ΑΡΝΗΣΗ: το sync.py τρέχει μόνο στο branch 'main' (τώρα: '%s'). Δεν γράφτηκε τίποτα, δεν έγινε push." % br)
        print("Για απλό έλεγχο εξαγωγής χρησιμοποίησε --dry-run.")
        sys.exit(2)
try:
    from validate_data import check  # προειδοποιήσεις δομής: ενημερωτικές, δεν μπλοκάρουν τίποτα
except Exception:
    check = lambda rel, d: []
data = os.path.join(root, "data")
n = 0
for part in parts:
    for f in glob.glob(os.path.join(exp, part, "*.json")):
        try:
            d = json.load(open(f, encoding="utf8"))
        except Exception as e:
            print("skip (άκυρο JSON):", f, e); continue
        if not isinstance(d, dict) or not d:
            print("skip (κενό):", f); continue
        for w in check(part + "/" + os.path.basename(f), d)[:10]:
            print("ΠΡΟΕΙΔΟΠΟΙΗΣΗ:", w)
        dst = os.path.join(data, part, os.path.basename(f))
        if dry:
            n += 1; continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        new = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
        if not os.path.exists(dst) or open(dst, encoding="utf8").read() != new:
            open(dst, "w", encoding="utf8").write(new); n += 1
if dry:
    print("dry-run: %d έγκυρα αρχεία θα αντιγράφονταν" % n); sys.exit(0)
# κράτα τις 60 νεότερες εκδόσεις
eds = sorted((os.path.basename(f)[:-5] for f in glob.glob(data + "/editions/*.json")), reverse=True)
for old in eds[60:]:
    os.remove(os.path.join(data, "editions", old + ".json"))
eds = eds[:60]
ros = sorted(os.path.basename(f)[:-5] for f in glob.glob(data + "/rosters/*.json"))
idx = json.dumps({"editions": eds, "rosters": ros}, ensure_ascii=False, separators=(",", ":"))
ip = os.path.join(data, "index.json")
if not os.path.exists(ip) or open(ip).read() != idx:
    open(ip, "w").write(idx); n += 1
print("αλλαγμένα αρχεία:", n)
g = _git
def non_data_changes():
    """Αρχεία εκτός data/ στα commits που θα σταλούν (None αν δεν μπορεί να ελεγχθεί)."""
    if g("fetch", "-q", "origin", "main").returncode != 0: return None
    r = g("log", "--name-only", "--format=", "origin/main..HEAD")
    if r.returncode != 0: return None
    return [l for l in r.stdout.splitlines() if l and not l.startswith("data/")]
g("add", "-A", "data")
if g("diff", "--cached", "--quiet", "--", "data").returncode == 0:
    print("τίποτα νέο για commit"); sys.exit(0)
g("-c", "user.name=Thrylos Bot", "-c", "user.email=bot@thrylos.local", "commit", "-qm",
  "data " + time.strftime("%Y-%m-%d %H:%M", time.gmtime()) + "Z (" + ",".join(parts) + ")", "--", "data")
for i in range(5):
    bad = non_data_changes()
    if bad:
        print("ΑΚΥΡΩΣΗ push: τα commits περιέχουν αρχεία εκτός data/:", ", ".join(bad[:8])); sys.exit(3)
    if bad is None:
        print("push ακυρώθηκε προσωρινά: δεν ήταν δυνατός ο έλεγχος του origin/main"); time.sleep(3 + i * 2); continue
    r = g("push", "origin", "HEAD:main")
    if r.returncode == 0:
        print("push OK"); sys.exit(0)
    print("push απέτυχε, ξαναδοκιμάζω:", r.stderr.strip()[-200:])
    g("pull", "--rebase", "-X", "theirs", "origin", "main"); time.sleep(3 + i * 2)
print("ΑΠΟΤΥΧΙΑ push"); sys.exit(1)
