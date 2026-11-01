#!/usr/bin/env python3
"""Ενημερώνει ένα στοιχείο του live/now.json από το API-Sports (μπάσκετ).

Χρήση:  APISPORTS_KEY=... python3 tools/apisports_live.py <game_id> <live_now.json> <match_id> [--oly-id 1542] [--rosters data/rosters/basketball.json] [--squad "Επώνυμο1,Επώνυμο2,..."]

- Το κλειδί διαβάζεται ΜΟΝΟ από τη μεταβλητή περιβάλλοντος APISPORTS_KEY (ποτέ από αρχείο του repo, το repo είναι δημόσιο).
- Γράφει σκορ, περίοδο, δωδεκάδα/αρχική πεντάδα και στατιστικά ομάδων στο στοιχείο με id=<match_id>· κρατά όλα τα άλλα πεδία.
- Τα ονόματα του Ολυμπιακού αντιστοιχίζονται στα ελληνικά από το rosters/basketball.json (πεδίο latin).
- Κάθε εκτέλεση κάνει 3 αιτήματα (το Free πλάνο επιτρέπει 100 την ημέρα ανά άθλημα).
"""
import json, os, sys, urllib.request, urllib.parse

BASE = "https://v1.basketball.api-sports.io/"


def api(path, **q):
    key = os.environ.get("APISPORTS_KEY", "")
    if not key:
        sys.exit("Λείπει η μεταβλητή APISPORTS_KEY")
    req = urllib.request.Request(BASE + path + "?" + urllib.parse.urlencode(q), headers={"x-apisports-key": key})
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.load(r)
    if d.get("errors"):
        sys.exit("API σφάλμα: %s" % d["errors"])
    return d["response"]


def tokens(s):
    return tuple(sorted(s.lower().replace("-", " ").replace(".", " ").split()))


def norm(s):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn").replace("ς", "σ")


def load_roster(path):
    out = {}
    if path and os.path.exists(path):
        for g in json.load(open(path, encoding="utf8")).get("groups", []):
            for p in g.get("players", []):
                if p.get("latin"):
                    out[tokens(p["latin"])] = p
    return out


def pos_letter(pos):
    p = (pos or "").lower()
    if "γκαρντ" in p and "φόργουορντ" in p:
        return "G/F"
    if "γκαρντ" in p:
        return "G"
    if "σέντερ" in p and "φόργουορντ" in p:
        return "F/C"
    if "σέντερ" in p:
        return "C"
    if "φόργουορντ" in p:
        return "F"
    return ""


STATUS = {"NS": "pre", "Q1": "live", "Q2": "live", "Q3": "live", "Q4": "live", "OT": "live", "BT": "live",
          "HT": "ht", "FT": "ft", "AOT": "ft", "POST": "ft", "CANC": "ft", "SUSP": "live", "AWD": "ft", "ABD": "ft"}
CLOCK = {"NS": "Έναρξη", "Q1": "1η περίοδος", "Q2": "2η περίοδος", "Q3": "3η περίοδος", "Q4": "4η περίοδος", "OT": "Παράταση",
         "BT": "Διάλειμμα", "HT": "Ημίχρονο", "FT": "Τελικό", "AOT": "Τελικό (παράταση)", "POST": "Αναβολή", "CANC": "Ακυρώθηκε"}


def main():
    a = sys.argv[1:]
    if len(a) < 3:
        sys.exit(__doc__)
    gid, path, mid = a[0], a[1], a[2]
    oly_id = int(a[a.index("--oly-id") + 1]) if "--oly-id" in a else 1542
    rost = load_roster(a[a.index("--rosters") + 1]) if "--rosters" in a else {}

    g = api("games", id=gid, timezone="Europe/Athens")[0]
    players = api("games/statistics/players", id=gid)
    teams = api("games/statistics/teams", id=gid)

    home_oly = g["teams"]["home"]["id"] == oly_id
    O, P = ("home", "away") if home_oly else ("away", "home")
    st = g["status"]["short"]
    sc = g["scores"]
    quarters = []
    for i in ("quarter_1", "quarter_2", "quarter_3", "quarter_4", "over_time"):
        o, p = sc[O].get(i), sc[P].get(i)
        if o is not None and p is not None:
            quarters.append("%d-%d" % (o, p))

    def team_players(tid, is_oly):
        starters, bench = [], []
        for x in players:
            if x["team"]["id"] != tid:
                continue
            nm = x["player"]["name"]
            r = rost.get(tokens(nm)) if is_oly else None
            if is_oly and r is None:
                c = [p for k, p in rost.items() if set(k) & set(tokens(nm)) and any(len(t) > 3 for t in set(k) & set(tokens(nm)))]
                r = c[0] if len(c) == 1 else None
            e = {"name": r["name"] if r else nm, "no": (r.get("no") if r and r.get("no") is not None else ""),
                 "pos": pos_letter(r.get("pos")) if r else ""}
            (starters if x.get("type") == "starters" else bench).append(e)
        return starters, bench

    oid, pid = g["teams"][O]["id"], g["teams"][P]["id"]
    squad = [x.strip() for x in a[a.index("--squad") + 1].split(",")] if "--squad" in a else []
    os_, ob = team_players(oid, True)
    ps_, pb = team_players(pid, False)
    # Δωδεκάδα (επίσημη λίστα): όσοι δεν έχουν ακόμα στατιστικά προστίθενται στον πάγκο από το ρόστερ
    have = {norm(x["name"]) for x in os_ + ob}
    for nm in squad:
        if any(norm(nm) in h or h.endswith(norm(nm).split()[-1]) for h in have):
            continue
        for p in rost.values():
            if norm(nm).split()[-1] in norm(p["name"]):
                ob.append({"name": p["name"], "no": p.get("no") if p.get("no") is not None else "", "pos": pos_letter(p.get("pos"))})
                have.add(norm(p["name"]))
                break

    def ts(tid):
        return next((t for t in teams if t["team"]["id"] == tid), None)
    to, tp = ts(oid), ts(pid)
    stats = []
    if to and tp:
        def fr(t, k):
            return "%s/%s" % (t[k]["total"], t[k]["attempts"])
        stats = [
            {"label": "Ριμπάουντ", "a": to["rebounds"]["total"], "b": tp["rebounds"]["total"]},
            {"label": "Ασίστ", "a": to["assists"], "b": tp["assists"]},
            {"label": "Κλεψίματα", "a": to["steals"], "b": tp["steals"]},
            {"label": "Μπλοκ", "a": to["blocks"], "b": tp["blocks"]},
            {"label": "Λάθη", "a": to["turnovers"], "b": tp["turnovers"], "lower": True},
            {"label": "Εύστοχα σουτ", "a": fr(to, "field_goals"), "b": fr(tp, "field_goals")},
            {"label": "Τρίποντα", "a": fr(to, "threepoint_goals"), "b": fr(tp, "threepoint_goals")},
            {"label": "Βολές", "a": fr(to, "freethrows_goals"), "b": fr(tp, "freethrows_goals")},
        ]

    d = json.load(open(path, encoding="utf8"))
    m = next((x for x in d.get("matches", []) if x.get("id") == mid), None)
    if m is None:
        sys.exit("Δεν βρέθηκε στοιχείο με id=" + mid)
    m["status"] = STATUS.get(st, m.get("status", "live"))
    m["clock"] = CLOCK.get(st, st)
    m["olyScore"] = sc[O]["total"] or 0
    m["oppScore"] = sc[P]["total"] or 0
    m["periods"] = (", ".join(quarters) + " (Ολυμπιακός πρώτος)") if quarters else ""
    lu = m.setdefault("lineups", {})
    for k, (s_, b_) in (("oly", (os_, ob)), ("opp", (ps_, pb))):
        T = lu.setdefault(k, {})
        if s_ or b_:
            T["starters"], T["bench"] = s_, b_
        T.setdefault("subs", [])
        T.setdefault("formation", "")
    if os_ or ps_:
        lu["status"] = "Αρχική πεντάδα"
    if stats:
        m["stats"] = stats
    m["source"] = "API-Sports"
    import datetime
    d["updatedAt"] = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=2))).isoformat(timespec="seconds")
    json.dump(d, open(path, "w", encoding="utf8"), ensure_ascii=False)
    print("%s %s-%s %s" % (m["status"], m["olyScore"], m["oppScore"], m["periods"]))


if __name__ == "__main__":
    main()
