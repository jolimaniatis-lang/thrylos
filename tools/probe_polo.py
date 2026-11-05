import json, sys, urllib.request, urllib.parse
UA={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36","Accept":"application/json"}
def get(path, **q):
    q.update(appTypeId=5, langId=1, timezoneName="Europe/Athens", userCountryId=21)
    with urllib.request.urlopen(urllib.request.Request("https://webws.365scores.com/web/"+path+"?"+urllib.parse.urlencode(q), headers=UA), timeout=25) as r: return json.load(r)
res={}
try: res["sports"]=[(s["id"],s["name"]) for s in get("sports/").get("sports",[])]
except Exception as e: res["sports_err"]=str(e)[:100]
for day in ("04/11/2026","06/11/2026"):
    try:
        j=get("games/allscores/",startDate=day,endDate=day,showOdds="false")
        gs=j.get("games",[])
        res[day]={"n":len(gs),"sports":sorted({g["sportId"] for g in gs}),
         "olymp":[(g["sportId"],g["homeCompetitor"]["name"],g["awayCompetitor"]["name"],g["homeCompetitor"].get("countryId"),g["startTime"],g.get("competitionDisplayName")) for g in gs if "lymp" in (g["homeCompetitor"]["name"]+g["awayCompetitor"]["name"]).lower() or "λυμπ" in (g["homeCompetitor"]["name"]+g["awayCompetitor"]["name"]).lower()],
         "polo_guess":[(g["sportId"],g["homeCompetitor"]["name"],g["awayCompetitor"]["name"],g.get("competitionDisplayName")) for g in gs if "polo" in str(g.get("competitionDisplayName","")).lower() or "water" in str(g.get("competitionDisplayName","")).lower()][:10]}
    except Exception as e: res[day]={"err":str(e)[:120]}
json.dump(res,open(sys.argv[1],"w",encoding="utf8"),ensure_ascii=False)
