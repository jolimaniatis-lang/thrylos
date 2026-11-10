#!/usr/bin/env python3
"""Μόνιμα τελικά σκορ, χωρίς Claude. Τρέχει στο GitHub Actions (live.yml) και γράφει finals.json στο branch live-data.
Η εφαρμογή συμπληρώνει με αυτά όσους αγώνες του ημερολογίου (schedule/season) δεν έχουν ακόμη σκορ.
Μόνο ό,τι δίνει η πηγή (365scores, τελικό) — τίποτα επινοημένο. Σκορ: Ολυμπιακός πρώτα (o), αντίπαλος (p).
Χρήση: finals.py <finals.json> [auto.json] [--catchup]
  auto.json : πέρνα τα «ft» του live στο finals.json
  --catchup : ψάξε στην πηγή τους αγώνες του χθες/σήμερα που δεν έχουν σκορ (μία φορά ανά εκτέλεση του workflow)"""
import json, sys, re, os, datetime, urllib.request, urllib.parse
from zoneinfo import ZoneInfo
ATH = ZoneInfo("Europe/Athens")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Accept": "application/json"}
BASE = "https://webws.365scores.com/web/"
args = [a for a in sys.argv[1:] if not a.startswith("--")]
catchup = "--catchup" in sys.argv
out = args[0]; auto = args[1] if len(args) > 1 else None
now = datetime.datetime.now(ATH)
def load(p, dflt):
    try: return json.load(open(p, encoding="utf8"))
    except Exception: return dflt
doc = load(out, {})
fin = {(f["d"], f["opp"], f["sport"]): f for f in doc.get("finals", []) if isinstance(f, dict) and f.get("d")}
before = json.dumps(sorted(fin.items()), ensure_ascii=False)
def put(d, opp, sport, o, p, per, src):
    k = (d, opp, sport)
    if k in fin and fin[k]["o"] == o and fin[k]["p"] == p and (fin[k].get("per") or not per): return
    fin[k] = {"d": d, "opp": opp, "sport": sport, "o": int(o), "p": int(p), "per": per or "", "src": src, "at": now.isoformat(timespec="seconds")}
if auto:
    for m in load(auto, {}).get("matches", []):
        if m.get("status") == "ft" and m.get("d") and m.get("opp") and isinstance(m.get("olyScore"), int) and isinstance(m.get("oppScore"), int):
            put(m["d"], m["opp"], m.get("sport", ""), m["olyScore"], m["oppScore"], m.get("periods", ""), m.get("src", "365scores"))
if catchup:
    try:
        season = json.load(open("data/schedule/season.json", encoding="utf8"))["matches"]
        back = max(1, min(7, int(os.environ.get("FINALS_DAYS", "1") or 1)))  # πόσες μέρες πίσω (προεπιλογή: χθες)
        days = [now.date() - datetime.timedelta(days=i) for i in range(back, -1, -1)]
        todo = [m for m in season if m.get("d") in {d.isoformat() for d in days} and not m.get("score") and not m.get("res")
                and (m["d"], m["opp"], m.get("sport", "")) not in fin and m.get("sport") != "polo"]
        if todo:
            def get(path, **q):
                q.update(appTypeId=5, langId=1, timezoneName="Europe/Athens", userCountryId=21)
                with urllib.request.urlopen(urllib.request.Request(BASE + path + "?" + urllib.parse.urlencode(q), headers=UA), timeout=25) as r:
                    return json.load(r)
            is_oly = lambda c: bool(re.search(r"olympia[ck]os", c.get("name", ""), re.I)) and c.get("countryId") == 13
            women = lambda c: bool(re.search(r"\(w\)|women", c.get("name", ""), re.I))
            def want(m):
                c = (m.get("comp") or "").lower(); s = m.get("sport")
                if s == "football": return {1}
                if s == "basketball": return {2}
                if "βόλεϊ" in c: return {8}
                if "χάντμπολ" in c: return {5}
                if "μπάσκετ" in c: return {2}
                if "ποδόσφαιρο" in c: return {1}
                return None
            j = get("games/allscores/", startDate=days[0].strftime("%d/%m/%Y"), endDate=days[-1].strftime("%d/%m/%Y"), showOdds="false")
            games = [g for g in j.get("games", []) if g.get("statusGroup") == 4 and (is_oly(g["homeCompetitor"]) or is_oly(g["awayCompetitor"]))]
            for m in todo:
                ws = want(m)
                if ws is None or not re.match(r"^\d{1,2}:\d{2}$", m.get("t") or ""): continue
                h, mi = map(int, m["t"].split(":")); y, mo, dd = map(int, m["d"].split("-"))
                k = datetime.datetime(y, mo, dd, h, mi, tzinfo=ATH); best = None
                for g in games:
                    oh = is_oly(g["homeCompetitor"]); oc = g["homeCompetitor"] if oh else g["awayCompetitor"]
                    if g["sportId"] not in ws or (m.get("gender") == "w") != women(oc): continue
                    if (m.get("home") is not False) != oh: continue
                    gap = abs((datetime.datetime.fromisoformat(g["startTime"]) - k).total_seconds())
                    if gap <= 2400 and (best is None or gap < best[0]): best = (gap, g, oh)
                if not best: continue
                g, oh = best[1], best[2]
                oc, pc = (g["homeCompetitor"], g["awayCompetitor"]) if oh else (g["awayCompetitor"], g["homeCompetitor"])
                if oc.get("score", -1) < 0 or pc.get("score", -1) < 0: continue
                put(m["d"], m["opp"], m.get("sport", ""), oc["score"], pc["score"], "", "365scores")
    except Exception as e:
        print("catchup:", str(e)[:120])
lim = (now.date() - datetime.timedelta(days=120)).isoformat()
rows = sorted((f for f in fin.values() if f["d"] >= lim), key=lambda f: (f["d"], f["opp"], f["sport"]))
if json.dumps(sorted(((f["d"], f["opp"], f["sport"]), f) for f in rows), ensure_ascii=False) != before or not os.path.exists(out):
    json.dump({"updatedAt": now.isoformat(timespec="seconds"), "finals": rows}, open(out, "w", encoding="utf8"), ensure_ascii=False)
    print("finals:", len(rows))
