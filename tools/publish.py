#!/usr/bin/env python3
"""Δημοσίευση δεδομένων της εφαρμογής ΑΠΕΥΘΕΙΑΣ στο GitHub (χωρίς βάση ArtifactData, χωρίς task συγχρονισμού).

Χρήση (από τα scheduled tasks, μέσα στο clone του repo):
  python3 tools/publish.py --pull   φέρνει τις τελευταίες αλλαγές από το main (πριν αλλάξεις αρχείο data/)
  python3 tools/publish.py          ελέγχει τα data/*.json, ξαναφτιάχνει το data/index.json,
                                    κάνει commit ΜΟΝΟ του data/ και push στο main (με επανάληψη)

Προστασίες (το main είναι η παραγωγή):
 1. Τρέχει μόνο στο branch main.
 2. Το commit περιλαμβάνει ΜΟΝΟ διαδρομές data/· πριν το push ελέγχεται ότι τα commits που θα σταλούν αγγίζουν μόνο data/.
 3. Άκυρο JSON / ρίζα που δεν είναι αντικείμενο / υπερβολικό μέγεθος -> ΑΚΥΡΩΣΗ πριν το commit.
 4. Το πεδίο gender των αγώνων του schedule/season.json δεν χάνεται ποτέ (επαναφέρεται από το προηγούμενο commit).
Έξοδος: «push OK» όταν η αλλαγή είναι ζωντανή· «τίποτα νέο για commit» όταν δεν άλλαξε τίποτα."""
import json, os, sys, glob, subprocess, time

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = os.path.join(root, "data")
MAX_BYTES = 6 * 1024 * 1024
ID = ["-c", "user.name=Thrylos Bot", "-c", "user.email=bot@thrylos.local"]


def g(*a):
    return subprocess.run(["git", "-C", root, *ID, *a], capture_output=True, text=True)


def branch_ok():
    br = g("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    if br != "main":
        print("ΑΡΝΗΣΗ: το publish.py τρέχει μόνο στο branch 'main' (τώρα: '%s')." % br)
        sys.exit(2)


def do_pull():
    branch_ok()
    g("fetch", "-q", "origin", "main")
    r = g("pull", "--rebase", "--autostash", "-q", "-X", "theirs", "origin", "main")
    if r.returncode != 0:
        print("ΠΡΟΣΟΧΗ: pull απέτυχε:", (r.stderr or r.stdout).strip()[-300:])
        sys.exit(1)
    print("pull OK:", g("log", "-1", "--format=%h %cd %s", "--date=format:%H:%MZ").stdout.strip())


def validate():
    bad = []
    for f in glob.glob(data + "/**/*.json", recursive=True):
        if os.path.getsize(f) > MAX_BYTES:
            bad.append("%s: πολύ μεγάλο αρχείο" % os.path.relpath(f, root)); continue
        try:
            d = json.load(open(f, encoding="utf8"))
        except Exception as e:
            bad.append("%s: άκυρο JSON (%s)" % (os.path.relpath(f, root), e)); continue
        if not isinstance(d, dict) or not d:
            bad.append("%s: η ρίζα πρέπει να είναι μη κενό αντικείμενο" % os.path.relpath(f, root))
    return bad


def keep_gender():
    """Αν το schedule/season.json έχασε πεδία gender σε αγώνες, τα επαναφέρει από το HEAD."""
    rel = "data/schedule/season.json"
    p = os.path.join(root, rel)
    old = g("show", "HEAD:" + rel)
    if old.returncode != 0 or not os.path.exists(p):
        return
    try:
        o = json.loads(old.stdout)["matches"]
        d = json.load(open(p, encoding="utf8"))
    except Exception:
        return
    key = lambda m: (m.get("d"), m.get("opp"), m.get("sport"), m.get("comp"))
    gm = {key(m): m["gender"] for m in o if m.get("gender")}
    fixed = 0
    for m in d.get("matches", []):
        if not m.get("gender") and key(m) in gm:
            m["gender"] = gm[key(m)]; fixed += 1
    if fixed:
        open(p, "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, separators=(",", ":")))
        print("gender: επαναφέρθηκε σε %d αγώνες" % fixed)


def rebuild_index():
    eds = sorted((os.path.basename(f)[:-5] for f in glob.glob(data + "/editions/*.json")), reverse=True)
    for old in eds[60:]:
        os.remove(os.path.join(data, "editions", old + ".json"))
    eds = eds[:60]
    ros = sorted(os.path.basename(f)[:-5] for f in glob.glob(data + "/rosters/*.json"))
    idx = json.dumps({"editions": eds, "rosters": ros}, ensure_ascii=False, separators=(",", ":"))
    ip = os.path.join(data, "index.json")
    if not os.path.exists(ip) or open(ip, encoding="utf8").read() != idx:
        open(ip, "w", encoding="utf8").write(idx)


def non_data_changes():
    if g("fetch", "-q", "origin", "main").returncode != 0:
        return None
    r = g("log", "--name-only", "--format=", "origin/main..HEAD")
    if r.returncode != 0:
        return None
    return [l for l in r.stdout.splitlines() if l and not l.startswith("data/")]


def publish():
    branch_ok()
    bad = validate()
    if bad:
        print("ΑΚΥΡΩΣΗ (τίποτα δεν δημοσιεύτηκε):")
        for b in bad[:10]:
            print(" -", b)
        sys.exit(3)
    keep_gender()
    rebuild_index()
    g("add", "-A", "data")
    staged = g("diff", "--cached", "--name-only", "--", "data").stdout.split()
    if not staged:
        print("τίποτα νέο για commit"); return
    g("commit", "-qm", "data %s (%s)" % (time.strftime("%Y-%m-%d %H:%M", time.gmtime()) + "Z",
                                          ", ".join(sorted({p.split("/")[1] if p.count("/") > 1 else p for p in staged}))),
      "--", "data")
    for i in range(5):
        bad = non_data_changes()
        if bad:
            print("ΑΚΥΡΩΣΗ push: τα commits περιέχουν αρχεία εκτός data/:", ", ".join(bad[:8])); sys.exit(3)
        if bad is None:
            print("push αναβλήθηκε: δεν ήταν δυνατός ο έλεγχος του origin/main"); time.sleep(3 + i * 2); continue
        r = g("push", "origin", "HEAD:main")
        if r.returncode == 0:
            print("push OK (%d αρχεία)" % len(staged)); return
        print("push απέτυχε, ξαναδοκιμάζω:", r.stderr.strip()[-160:])
        rb = g("pull", "--rebase", "-X", "theirs", "origin", "main")
        if rb.returncode != 0:
            g("rebase", "--abort")
            print("ΠΡΟΣΟΧΗ: σύγκρουση με άλλο task, ξαναδοκιμάζω")
        time.sleep(3 + i * 2)
    print("ΑΠΟΤΥΧΙΑ push"); sys.exit(1)


if __name__ == "__main__":
    if "--pull" in sys.argv:
        do_pull()
    else:
        publish()
