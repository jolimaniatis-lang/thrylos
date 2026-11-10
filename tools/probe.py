import json,re,sys,time,urllib.request,urllib.parse
UA={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36","Accept":"*/*"}
def raw(u,t=25):
    with urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=t) as r: return r.read()
B="https://webws.365scores.com/web/"
def get(path,lang=1,**q):
    q.update(appTypeId=5,langId=lang,timezoneName="Europe/Athens",userCountryId=21)
    return json.loads(raw(B+path+"?"+urllib.parse.urlencode(q)))
comps={};gid=None
for d in ["06/11/2026","07/11/2026","08/11/2026"]:
    try:
        j=get("games/allscores/",startDate=d,endDate=d,showOdds="false")
        cn={c["id"]:c.get("name") for c in j.get("competitions",[])}
        for g in j.get("games",[]):
            h,a=g["homeCompetitor"],g["awayCompetitor"]
            if re.search(r"olympia[ck]os",h.get("name","")+a.get("name",""),re.I) and 13 in (h.get("countryId"),a.get("countryId")):
                print("GAME",d,g["id"],g["sportId"],g.get("competitionId"),cn.get(g.get("competitionId")),g.get("competitionDisplayName"),h["name"],h.get("score"),a["name"],a.get("score"),g.get("statusGroup"),g.get("statusText"),g.get("startTime"),"season",g.get("seasonNum"),"stage",g.get("stageNum"),"round",g.get("roundNum"),g.get("roundName"))
                comps[g.get("competitionId")]=g["sportId"]
                if g["sportId"]==1: gid=g["id"]
    except Exception as e: print("ERR allscores",d,e)
print("COMPS",comps)
for c in list(comps)[:8]:
    try:
        j=get("standings/",competitions=c)
        st=j.get("standings",[])
        print("STAND",c,"keys",list(j.keys()),"n",len(st))
        for s in st[:1]:
            print(" skeys",[k for k in s.keys() if k!="rows"],"headers",json.dumps(s.get("headers"),ensure_ascii=False)[:600])
            for r in s.get("rows",[])[:4]: print("  ROW",json.dumps(r,ensure_ascii=False)[:700])
            print("  nrows",len(s.get("rows",[])),"groups",json.dumps(s.get("groups"),ensure_ascii=False)[:300])
    except Exception as e: print("ERR stand",c,e)
if gid:
    for L in list(range(1,45)):
        try:
            j=get("game/",lang=L,gameId=gid); g=j["game"]; print("LANG",L,g["homeCompetitor"]["name"],"|",g["awayCompetitor"]["name"],"|",g.get("competitionDisplayName"),"|",g.get("statusText"))
        except Exception as e: print("LANGERR",L,str(e)[:40])
        time.sleep(0.15)
FEEDS=["https://news.google.com/rss/search?q=%CE%9F%CE%BB%CF%85%CE%BC%CF%80%CE%B9%CE%B1%CE%BA%CF%8C%CF%82+when:1d&hl=el&gl=GR&ceid=GR:el","https://www.redfreaks.gr/feed/","https://www.gazzetta.gr/rss","https://www.gazzetta.gr/rss.xml","https://www.gazzetta.gr/teams/olympiakos/rss","https://www.sport24.gr/rss","https://www.sport24.gr/feed","https://www.sdna.gr/rss.xml","https://www.sdna.gr/latest.xml","https://www.in.gr/sports/feed/","https://www.tanea.gr/category/sports/feed/","https://www.to10.gr/feed/","https://www.athletiko.gr/feed","https://sportime.gr/feed/","https://www.eurohoops.net/el/feed/","https://www.novasports.gr/rss","https://www.fosonline.gr/rss","https://www.fosonline.gr/feed","https://www.newsit.gr/category/athlitika/feed/","https://www.sportal.gr/rss","https://www.onsports.gr/rss.xml","https://www.sportdog.gr/feed","https://www.olympiacos.org/feed/","https://www.olympiacosbc.gr/feed/","https://www.olympiacossfp.gr/index.php?format=feed&type=rss","https://www.contra.gr/feed","https://www.newsbomb.gr/athlitika?format=feed&type=rss","https://www.athlosnews.gr/feed/","https://aquafeed24.com/feed/","https://www.monobala.gr/feed","https://www.sportfm.gr/rss","https://www.sport-fm.gr/rss/news"]
for u in FEEDS:
    try:
        x=raw(u,20).decode("utf8","replace"); its=re.findall(r"<item[\s>].*?</item>",x,re.S) or re.findall(r"<entry[\s>].*?</entry>",x,re.S)
        ol=[i for i in its if re.search(r"Ολυμπιακ|Θρύλο|ερυθρόλευκ|ερυθρολεύκ|Olympia[ck]os",i)]
        print("FEED OK",u,"items",len(its),"oly",len(ol))
        for i in (ol or its)[:2]:
            print("   ",re.sub(r"\s+"," ",i)[:420])
    except Exception as e: print("FEED ERR",u,str(e)[:60])
