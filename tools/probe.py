import json, sys, urllib.request, re, time
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Accept": "*/*"}
res = {}
def probe(name, url, headers=None):
    h = dict(UA); h.update(headers or {})
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=25)
        b = r.read().decode("utf8", "replace")
        res[name] = {"code": r.status, "len": len(b), "oly": len(re.findall(r"olympia[ck]os", b, re.I)), "head": b[:200].replace("\n", " ")}
        return b
    except Exception as e:
        res[name] = {"err": str(e)[:100]}
probe("sofa_www", "https://www.sofascore.com/api/v1/sport/volleyball/scheduled-events/2026-11-04")
probe("365_all", "https://webws.365scores.com/web/games/allscores/?appTypeId=5&langId=1&timezoneName=Europe/Athens&userCountryId=21&startDate=04/11/2026&endDate=04/11/2026&showOdds=false")
for sid, nm in ((12, "volley"), (7, "handball"), (22, "wpolo"), (3, "basket")):
    probe("flash_" + nm, "https://global.flashscore.ninja/2/x/feed/f_%d_0_2_en-gr_1" % sid, {"x-fsign": "SW9D1eZo", "Referer": "https://www.flashscore.gr/"})
probe("tsdb_volley", "https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=2026-11-04&s=Volleyball")
probe("tsdb_hand", "https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=2026-11-04&s=Handball")
probe("fotmob", "https://www.fotmob.com/api/matches?date=20261104")
probe("espn_soccer", "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard")
probe("sportscore_fix", "https://sportscore.com/api/v1/fixtures/?sport=football&date=2026-11-04&team=olympiacos-piraeus")
json.dump(res, open(sys.argv[1], "w"), ensure_ascii=False)
print(json.dumps(res, ensure_ascii=False, indent=1))
