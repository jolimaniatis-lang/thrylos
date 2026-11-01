#!/usr/bin/env python3
"""Ενημερώνει ένα στοιχείο του live/now.json από το SportScore (ποδόσφαιρο, μπάσκετ). Χωρίς κλειδί.

Χρήση:  python3 tools/sportscore_live.py <sport> <team_slug> <YYYY-MM-DD> <live_now.json> <match_id>
  sport: football | basketball
  team_slug: π.χ. olympiacos-piraeus (ποδόσφαιρο), olympiacos-piraeus-bc (μπάσκετ)
  date: ημερομηνία αγώνα (UTC· για αγώνα μετά τις 02:00 ώρα Ελλάδας ισχύει η ίδια μέρα)

- Βρίσκει τον αγώνα από το fixtures?team=..., γράφει status/clock/σκορ στο στοιχείο με id=<match_id>.
- Αν η υπηρεσία δώσει incidents/lineups/stats, τα προσθέτει μόνο όταν είναι σε γνωστή μορφή· αλλιώς δεν πειράζει τα υπάρχοντα.
- Όρος χρήσης: στη σελίδα πρέπει να φαίνεται «Powered by SportScore» (υπάρχει στο υποσέλιδο της εφαρμογής).
- Επιστρέφει: "ft", "live", "ht" ή "pre" στην έξοδο (πρώτη λέξη)· κωδικός εξόδου 0 και σε μη βρεθέντα αγώνα (γράφει "none").
"""
import datetime, json, sys, urllib.parse, urllib.request

BASE = "https://sportscore.com/api/v1/"


def get(path, **q):
    req = urllib.request.Request(BASE + path + "?" + urllib.parse.urlencode(q), headers={"User-Agent": "thrylos-app"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def status_of(m):
    s = (m.get("status") or "").lower()
    t = (m.get("status_text") or "").lower()
    if s == "finished" or t in ("finished", "ft", "after overtime", "aet"):
        return "ft"
    if "half" in t and "time" in t or t in ("ht", "halftime", "half time", "half-time"):
        return "ht"
    if s in ("live", "inprogress", "in_progress") or m.get("live_minute"):
        return "live"
    if s in ("postponed", "cancelled", "canceled"):
        return "ft"
    return "pre"


def main():
    a = sys.argv[1:]
    if len(a) < 5:
        sys.exit(__doc__)
    sport, team, date, path, mid = a[:5]
    day = get("fixtures/", sport=sport, date=date, team=team)
    ms = day.get("matches", [])
    if not ms:
        print("none")
        return
    m = ms[0]
    detail = {}
    if m.get("url"):
        slug = m["url"].strip("/").split("/")[2] if m["url"].count("/") >= 3 else None
        if slug:
            try:
                detail = get("match/", sport=sport, slug=slug).get("match", {})
            except Exception:
                detail = {}
    mm = {**m, **detail}
    d = json.load(open(path, encoding="utf8"))
    item = next((x for x in d.get("matches", []) if x.get("id") == mid), None)
    if item is None:
        sys.exit("Δεν βρέθηκε στοιχείο με id=" + mid)
    st = status_of(mm)
    home_oly = bool(item.get("home"))
    try:
        hs, as_ = int(mm.get("home_score") or 0), int(mm.get("away_score") or 0)
    except ValueError:
        hs = as_ = 0
    item["olyScore"], item["oppScore"] = (hs, as_) if home_oly else (as_, hs)
    item["status"] = st
    minute = mm.get("live_minute")
    if st == "ft":
        item["clock"] = "Τελικό"
    elif st == "ht":
        item["clock"] = "Ημίχρονο"
    elif st == "live":
        item["clock"] = ("%s′" % minute) if minute not in (None, "") else (mm.get("status_text") or "Σε εξέλιξη")
    # γεγονότα/συνθέσεις/στατιστικά: μόνο αν υπάρχουν
    if isinstance(mm.get("stats"), list) and mm["stats"]:
        rows = []
        for s in mm["stats"]:
            if isinstance(s, dict) and {"label", "a", "b"} <= set(s):
                rows.append(s)
        if rows:
            item["stats"] = rows
    item["source"] = "SportScore"
    d["updatedAt"] = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=2))).isoformat(timespec="seconds")
    json.dump(d, open(path, "w", encoding="utf8"), ensure_ascii=False)
    print("%s %s-%s" % (st, item["olyScore"], item["oppScore"]))


if __name__ == "__main__":
    main()
