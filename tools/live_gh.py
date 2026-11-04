#!/usr/bin/env python3
"""Live σκορ για τους αγώνες της ημέρας, χωρίς κλειδί. Τρέχει στο GitHub Actions και γράφει auto.json.
Πηγές: SportScore (ποδόσφαιρο/μπάσκετ ανδρών) και SofaScore (όλα τα άλλα αθλήματα). Μόνο ό,τι επιστρέφουν — τίποτα επινοημένο.
Χρήση: live_gh.py <out.json>   (κωδικός εξόδου 3 = κανένας αγώνας στο παράθυρο, δεν χρειάζεται βρόχος)"""
import json, sys, time, urllib.request, urllib.parse, datetime, re
from zoneinfo import ZoneInfo
ATH = ZoneInfo("Europe/Athens")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) thrylos-live", "Accept": "application/json"}
def get(url, **q):
    if q: url += "?" + urllib.parse.urlencode(q)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return json.load(r)
now = datetime.datetime.now(ATH)
today = now.strftime("%Y-%m-%d")
season = json.load(open("data/schedule/season.json", encoding="utf8"))["matches"]
def kick(m):
    t = m.get("t") or ""
    if re.match(r"^\d{1,2}:\d{2}$", t):
        h, mi = map(int, t.split(":")); return now.replace(hour=h, minute=mi, second=0, microsecond=0)
    return None
todo = []
for m in season:
    if m.get("d") != today or m.get("score"): continue
    k = kick(m)
    if k is None or -75*60 <= (now - k).total_seconds() <= 4*3600 + 1800:
        todo.append(m)
if not todo:
    print("κανένας αγώνας στο παράθυρο"); sys.exit(3)
def sofa_sport(m):
    c = (m.get("comp") or "").lower(); s = m.get("sport")
    if s == "football": return "football"
    if s == "basketball": return "basketball"
    if s == "polo": return "water-polo"
    if "βόλεϊ" in c or "volley" in c: return "volleyball"
    if "χάντμπολ" in c or "handball" in c: return "handball"
    if "μπάσκετ" in c: return "basketball"
    if "ποδόσφαιρο" in c: return "football"
    return None
def is_oly(n): return bool(re.search(r"olympia[ck]os", n or "", re.I))
def women(n): return bool(re.search(r"(\bW\b|women|\(w\))\s*$", (n or "").strip(), re.I))
def sofa_find(m, sp, diag):
    d = m["d"]
    try:
        j = get("https://api.sofascore.com/api/v1/sport/%s/scheduled-events/%s" % (sp, d)); diag.append({"src": "sofa", "sport": sp, "ok": True, "events": len(j.get("events", []))})
    except Exception as e:
        diag.append({"src": "sofa", "sport": sp, "ok": False, "err": str(e)[:80]}); return None
    best = None
    for ev in j.get("events", []):
        h, a = ev["homeTeam"]["name"], ev["awayTeam"]["name"]
        if not (is_oly(h) or is_oly(a)): continue
        oly = h if is_oly(h) else a
        if (m.get("gender") == "w") != women(oly): continue
        k = kick(m); st = datetime.datetime.fromtimestamp(ev["startTimestamp"], ATH)
        gap = abs((st - k).total_seconds()) if k else 0
        if gap > 4*3600: continue
        if best is None or gap < best[0]: best = (gap, ev)
    return best[1] if best else None
def from_sofa(m, ev, sp):
    oh = is_oly(ev["homeTeam"]["name"]); s = ev.get("status", {}).get("type")
    hs, as_ = ev.get("homeScore", {}), ev.get("awayScore", {})
    o, p = (hs, as_) if oh else (as_, hs)
    if s == "notstarted": return None
    status = {"inprogress": "live", "finished": "ft"}.get(s, "live")
    desc = (ev.get("status", {}).get("description") or "")
    if re.search(r"half\s*time|^ht$", desc, re.I): status = "ht"
    per = []
    for i in range(1, 8):
        a, b = o.get("period%d" % i), p.get("period%d" % i)
        if a is not None and b is not None: per.append("%s-%s" % (a, b))
    clock = "Τελικό" if status == "ft" else ("Ημίχρονο" if status == "ht" else desc)
    if sp == "football" and status == "live":
        t0 = ev.get("time", {}).get("currentPeriodStartTimestamp")
        if t0:
            mins = int((time.time() - t0) // 60)
            if re.search(r"2nd", desc): mins += 45
            clock = "%d′" % max(mins + 1, 1)
    if status == "ft" and ev.get("status", {}).get("code") == 100: pass
    return {"olyScore": o.get("current", 0), "oppScore": p.get("current", 0), "status": status, "clock": clock, "periods": ", ".join(per), "src": "SofaScore"}
def sportscore(m, diag):
    sp = m["sport"]; slug = {"football": "olympiacos-piraeus", "basketball": "olympiacos-piraeus-bc"}[sp]
    k = (kick(m) or now).astimezone(datetime.timezone.utc)
    for dd in (k.strftime("%Y-%m-%d"), (k + datetime.timedelta(days=1)).strftime("%Y-%m-%d")):
        try:
            r = get("https://sportscore.com/api/v1/fixtures/", sport=sp, date=dd, team=slug); diag.append({"src": "sportscore", "sport": sp, "ok": True, "n": len(r.get("matches", []))})
        except Exception as e:
            diag.append({"src": "sportscore", "sport": sp, "ok": False, "err": str(e)[:80]}); continue
        if r.get("matches"):
            x = r["matches"][0]
            return x
    return None
def from_sc(m, x):
    s = (x.get("status") or "").lower(); t = (x.get("status_text") or "").lower()
    st = "ft" if (s == "finished" or t in ("finished", "ft", "after overtime", "aet")) else "ht" if ("half" in t and "time" in t) else "live" if (s in ("live", "inprogress") or x.get("live_minute")) else "pre"
    if st == "pre": return None
    try: hs, as_ = int(x.get("home_score") or 0), int(x.get("away_score") or 0)
    except ValueError: hs = as_ = 0
    o, p = (hs, as_) if m.get("home") else (as_, hs)
    mn = x.get("live_minute")
    clock = "Τελικό" if st == "ft" else "Ημίχρονο" if st == "ht" else ("%s′" % mn if mn not in (None, "") else (x.get("status_text") or "Σε εξέλιξη"))
    return {"olyScore": o, "oppScore": p, "status": st, "clock": clock, "periods": "", "src": "SportScore"}
out, diag = [], []
for m in todo:
    sp = sofa_sport(m)
    if sp is None: diag.append({"match": m["opp"], "skip": "άγνωστο άθλημα"}); continue
    res = None
    if m["sport"] in ("football", "basketball") and m.get("gender", "m") == "m":
        x = sportscore(m, diag)
        if x: res = from_sc(m, x)
    if res is None:
        ev = sofa_find(m, sp, diag)
        if ev: res = from_sofa(m, ev, sp)
    if res:
        out.append({"d": m["d"], "opp": m["opp"], "sport": m["sport"], "comp": m.get("comp", ""), "kickoff": m.get("t", ""), "home": m.get("home") is not False, "tv": m.get("tv", ""), **res})
doc = {"updatedAt": datetime.datetime.now(ATH).isoformat(timespec="seconds"), "matches": out, "diag": diag}
json.dump(doc, open(sys.argv[1], "w", encoding="utf8"), ensure_ascii=False)
print(json.dumps({"matches": [(x["opp"], x["status"], x["olyScore"], x["oppScore"]) for x in out], "diag": diag}, ensure_ascii=False))
