#!/usr/bin/env python3
"""Live σκορ όλων των αθλημάτων του Ολυμπιακού από το 365scores (χωρίς κλειδί). Τρέχει στο GitHub Actions και γράφει auto.json.
Μόνο ό,τι επιστρέφει η πηγή — τίποτα επινοημένο. Κωδικός εξόδου 3 = κανένας αγώνας στο παράθυρο (δεν χρειάζεται βρόχος).
Χρήση: live_gh.py <out.json>"""
import json, sys, time, urllib.request, urllib.parse, datetime, re
from zoneinfo import ZoneInfo
ATH = ZoneInfo("Europe/Athens")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Accept": "application/json"}
BASE = "https://webws.365scores.com/web/"
def get(path, **q):
    q.update(appTypeId=5, langId=1, timezoneName="Europe/Athens", userCountryId=21)
    with urllib.request.urlopen(urllib.request.Request(BASE + path + "?" + urllib.parse.urlencode(q), headers=UA), timeout=25) as r:
        return json.load(r)
now = datetime.datetime.now(ATH); today = now.strftime("%Y-%m-%d")
season = json.load(open("data/schedule/season.json", encoding="utf8"))["matches"]
def kick(m):
    t = m.get("t") or ""
    if re.match(r"^\d{1,2}:\d{2}$", t):
        h, mi = map(int, t.split(":")); return now.replace(hour=h, minute=mi, second=0, microsecond=0)
def window(m):
    k = kick(m)
    return k is None or -75*60 <= (now - k).total_seconds() <= 4*3600 + 1800
todo = [m for m in season if m.get("d") == today and window(m)]
diag = []
if not todo:
    print("κανένας αγώνας στο παράθυρο"); sys.exit(3)
SPORT = {"football": {1}, "basketball": {2}, "volleyball": {8}, "handball": {5}}
def want_sports(m):
    c = (m.get("comp") or "").lower(); s = m.get("sport")
    if s == "football": return {1}
    if s == "basketball": return {2}
    if s == "polo": return None
    if "βόλεϊ" in c: return {8}
    if "χάντμπολ" in c: return {5}
    if "μπάσκετ" in c: return {2}
    if "ποδόσφαιρο" in c: return {1}
    return None
def is_oly(c): return bool(re.search(r"olympia[ck]os", c.get("name", ""), re.I)) and c.get("countryId") == 13
def women(c): return bool(re.search(r"\(w\)|women", c.get("name", ""), re.I))
j = get("games/allscores/", startDate=now.strftime("%d/%m/%Y"), endDate=now.strftime("%d/%m/%Y"), showOdds="false")
games = [g for g in j.get("games", []) if is_oly(g["homeCompetitor"]) or is_oly(g["awayCompetitor"])]
diag.append({"games": len(j.get("games", [])), "oly": len(games)})
def clock_of(g, m):
    t, d = g.get("statusText", ""), g.get("gameTimeDisplay", "")
    if g["statusGroup"] == 4: return "Τελικό"
    if re.search(r"half\s*time|^ht$", t, re.I): return "Ημίχρονο"
    if g["sportId"] == 1 and d: return d.replace("'", "′")
    s = re.match(r"^Set (\d)", t)
    if s: return s.group(1) + "ο σετ"
    if re.match(r"^Q\d$", t) and d: return t + " " + d.replace("'", "′")
    return t or "Σε εξέλιξη"
out = []
for m in todo:
    ws = want_sports(m); k = kick(m); best = None
    for g in games:
        oc = g["homeCompetitor"] if is_oly(g["homeCompetitor"]) else g["awayCompetitor"]
        if (m.get("gender") == "w") != women(oc): continue
        if ws is not None and g["sportId"] not in ws: continue
        if ws is None and g["sportId"] in (1, 2, 5, 8): continue
        st = datetime.datetime.fromisoformat(g["startTime"])
        gap = abs((st - k).total_seconds()) if k else 0
        if gap <= 2400 and (best is None or gap < best[0]): best = (gap, g)
    if not best: diag.append({"match": m["opp"], "found": False}); continue
    g = best[1]
    if g["statusGroup"] not in (3, 4): diag.append({"match": m["opp"], "status": g.get("statusText")}); continue
    oh = is_oly(g["homeCompetitor"]); oc, pc = (g["homeCompetitor"], g["awayCompetitor"]) if oh else (g["awayCompetitor"], g["homeCompetitor"])
    o, p = int(max(oc.get("score", 0), 0)), int(max(pc.get("score", 0), 0))
    per = ""
    if g["sportId"] != 1:
        try:
            dj = get("game/", gameId=g["id"], topBookmaker=14); per_l = []
            for s in dj["game"].get("stages", []):
                if s.get("name") in ("Current Score", "Sets", "Score") or s.get("shortName") in ("Score", "Sets"): continue
                a, b = s.get("homeCompetitorScore", -1), s.get("awayCompetitorScore", -1)
                if a < 0 or b < 0: continue
                x, y = (a, b) if oh else (b, a)
                per_l.append("%d-%d" % (x, y))
            per = ", ".join(per_l)
        except Exception as e: diag.append({"detail": str(e)[:60]})
    status = "ft" if g["statusGroup"] == 4 else ("ht" if re.search(r"half\s*time", g.get("statusText", ""), re.I) else "live")
    out.append({"d": m["d"], "opp": m["opp"], "sport": m["sport"], "comp": m.get("comp", ""), "kickoff": m.get("t", ""), "home": m.get("home") is not False, "tv": m.get("tv", ""),
                "olyScore": o, "oppScore": p, "status": status, "clock": clock_of(g, m), "periods": per, "src": "365scores"})
doc = {"updatedAt": datetime.datetime.now(ATH).isoformat(timespec="seconds"), "matches": out, "diag": diag}
json.dump(doc, open(sys.argv[1], "w", encoding="utf8"), ensure_ascii=False)
print(json.dumps({"matches": [(x["opp"], x["status"], x["olyScore"], x["oppScore"], x["clock"], x["periods"]) for x in out], "diag": diag}, ensure_ascii=False))
