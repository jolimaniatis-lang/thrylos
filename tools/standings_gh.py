#!/usr/bin/env python3
"""Αυτόματες βαθμολογίες από το 365scores (χωρίς κλειδί, χωρίς Claude). Τρέχει στο GitHub Actions (news.yml), μία φορά την ώρα.
Γράφει standings.json: πίνακες στη μορφή της εφαρμογής. Μόνο ό,τι δίνει η πηγή· αν ένας πίνακας δεν είναι πλήρης, κρατιέται ο προηγούμενος.
Χρήση: standings_gh.py <standings.json>"""
import json, re, sys, datetime, urllib.request, urllib.parse
from zoneinfo import ZoneInfo
ATH = ZoneInfo("Europe/Athens")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Accept": "application/json"}
BASE = "https://webws.365scores.com/web/"
def get(path, lang=39, **q):
    q.update(appTypeId=5, langId=lang, timezoneName="Europe/Athens", userCountryId=21)
    with urllib.request.urlopen(urllib.request.Request(BASE + path + "?" + urllib.parse.urlencode(q), headers=UA), timeout=25) as r:
        return json.load(r)
now = datetime.datetime.now(ATH)
# key, competitionId, sport, τίτλος, είδος στηλών
COMPS = [["sl", 84, "football", "Super League", "fb"], ["el", 569, "basketball", "Euroleague", "wl"], ["gbl", 85, "basketball", "Basket League", "wlp"],
         ["vm", 7561, "amateur", "Βόλεϊ ανδρών · Volley League", "wlp"], ["vw", 8297, "amateur", "Βόλεϊ γυναικών · Volley League", "wlp"]]
# Europa League: ο κωδικός διοργάνωσης βρίσκεται από τον πιο πρόσφατο αγώνα του ημερολογίου
try:
    season = json.load(open("data/schedule/season.json", encoding="utf8"))["matches"]
    past = sorted((m for m in season if m.get("sport") == "football" and re.search(r"europa league", m.get("comp") or "", re.I)
                   and not re.search(r"προκριμ", m.get("comp") or "", re.I) and m.get("d", "9") <= now.date().isoformat()), key=lambda m: m["d"])
    if past:
        y, mo, d = past[-1]["d"].split("-"); ds = "%s/%s/%s" % (d, mo, y)
        j = get("games/allscores/", lang=1, startDate=ds, endDate=ds, showOdds="false")
        for g in j.get("games", []):
            if g.get("sportId") == 1 and g.get("competitionId") != 84 and any(re.search(r"olympia[ck]os", c.get("name", ""), re.I) and c.get("countryId") == 13 for c in (g["homeCompetitor"], g["awayCompetitor"])):
                COMPS.insert(1, ["uel", g["competitionId"], "football", "Europa League · League Phase", "fb"]); break
except Exception as e:
    print("europa:", str(e)[:100])
COLS = {"fb": ["Θ", "Ομάδα", "Αγ.", "Ν", "Ι", "Η", "Γκολ", "Βαθ."], "wl": ["Θ", "Ομάδα", "Αγ.", "Ν", "Η"], "wlp": ["Θ", "Ομάδα", "Αγ.", "Ν", "Η", "Βαθ."]}
# όπου η πηγή δεν δίνει ελληνικό όνομα (μόνο βέβαιες αντιστοιχίες· ό,τι λείπει μένει όπως το δίνει η πηγή)
GR = {"Olympiacos": "Ολυμπιακός", "Olympiakos": "Ολυμπιακός", "Panathinaikos": "Παναθηναϊκός", "PAOK": "ΠΑΟΚ", "AEK": "ΑΕΚ", "AEK Athens": "ΑΕΚ", "Aris": "Άρης", "AS Aris": "Άρης",
      "Crvena Zvezda": "Ερυθρός Αστέρας", "Valencia": "Βαλένθια", "Fenerbahçe": "Φενέρμπαχτσε", "BC Dubai": "Ντουμπάι", "Barcelona": "Μπαρτσελόνα", "Real Madrid": "Ρεάλ Μαδρίτης",
      "Hapoel Tel Aviv": "Χάποελ Τελ Αβίβ", "Zalgiris Kaunas": "Ζαλγκίρις Κάουνας", "KK Partizan": "Παρτιζάν", "Efes": "Αναντολού Εφές", "Besiktas": "Μπεσίκτας", "Paris": "Παρί",
      "Bologna": "Βίρτους Μπολόνια", "ASVEL Villeurbanne": "Βιλερμπάν", "Bayern Munich": "Μπάγερν Μονάχου", "Maccabi Tel Aviv": "Μακάμπι Τελ Αβίβ", "Milano": "Αρμάνι Μιλάνο",
      "Baskonia Vitoria": "Μπασκόνια", "Monaco": "Μονακό", "As Karditsas": "Καρδίτσα", "Kolossos Rhodes": "Κολοσσός Ρόδου", "Peristeri": "Περιστέρι", "Iraklis": "Ηρακλής",
      "Maroussi Honda": "Μαρούσι", "Mykonos": "Μύκονος", "Promitheas Patras": "Προμηθέας Πάτρας", "Panionios Betsson": "Πανιώνιος", "Πανιώνιος Betsson": "Πανιώνιος", "Thira": "Θήρα",
      "Zaon Kifisias": "ΖΑΟΝ Κηφισιάς", "Markopoulos": "Μαρκόπουλο", "OFA Apollonios": "Απολλώνιος", "Παναθηναϊκός Α.Ο.": "Παναθηναϊκός", "Π.Α.Ο.Κ.": "ΠΑΟΚ", "Ο.Φ.Η": "ΟΦΗ",
      "Kifisia": "Κηφισιά", "Kalamata": "Καλαμάτα", "Volos NFC": "Βόλος", "St. Gilloise": "Ουνιόν Σεν Ζιλουάζ", "Torreense": "Τορεένσε", "Celje": "Τσέλιε", "Viktoria Plzen": "Βικτόρια Πλζεν",
      "FC Ararat-Armenia": "Αραράτ-Αρμενία", "ASP Thetis": "Θέτις",
      "Α.Ο.Φλοίσβος": "Φλοίσβος", "Α.Ο.Φοίνικας Σύρου": "Φοίνικας Σύρου", "Α.Ο.Π. Κηφισιάς": "Κηφισιά", "Α.Ο.Καλαμάτα": "Καλαμάτα", "Α.Σ.Άρης": "Άρης"}
n = lambda v: int(v) if isinstance(v, (int, float)) and float(v).is_integer() else v
def table(key, cid, sport, title, kind):
    j = get("standings/", competitions=cid)
    st = [s for s in j.get("standings", []) if s.get("competitionId") == cid] or j.get("standings", [])
    rows = (st[0].get("rows") or []) if st else []
    out = []
    for i, r in enumerate(rows):
        c = r.get("competitor") or {}
        name = re.sub(r"\s*\((W|Γ)\)\s*$", "", c.get("shortName") or c.get("name") or "").strip()
        if not name: return None
        name = GR.get(name, name)
        pos = r.get("position") or i + 1
        gp, w, l, d = n(r.get("gamePlayed")), n(r.get("gamesWon")), n(r.get("gamesLost")), n(r.get("gamesEven"))
        if kind == "fb": out.append([pos, name, gp, w, d, l, "%s-%s" % (n(r.get("for")), n(r.get("against"))), n(r.get("points"))])
        elif kind == "wl": out.append([pos, name, gp, w, l])
        else: out.append([pos, name, gp, w, l, n(r.get("points"))])
    if len(out) < 8 or not any(re.search(r"Ολυμπιακ|Olympia[ck]os", r[1], re.I) for r in out) or any(v is None for r in out for v in r): return None
    return {"key": key, "sport": sport, "title": title, "columns": COLS[kind], "rows": out, "auto": True,
            "asOf": now.isoformat(timespec="minutes"), "note": "Αυτόματη ενημέρωση από 365scores · " + now.strftime("%d/%m %H:%M")}
try: prev = {t["key"]: t for t in json.load(open(sys.argv[1], encoding="utf8")).get("tables", [])}
except Exception: prev = {}
tables = []
for c in COMPS:
    t = None
    try: t = table(*c)
    except Exception as e: print("standings ERR", c[0], str(e)[:80])
    if t is None and c[0] in prev: t = prev[c[0]]; print("κρατήθηκε ο προηγούμενος:", c[0])
    if t: tables.append(t); print(c[0], len(t["rows"]), "ομάδες ·", next((r for r in t["rows"] if re.search(r"Ολυμπιακ|Olympia", r[1])), ""))
if tables and [dict(t, asOf="", note="") for t in tables] != [dict(t, asOf="", note="") for t in prev.values()]:
    json.dump({"updatedAt": now.isoformat(timespec="seconds"), "tables": tables}, open(sys.argv[1], "w", encoding="utf8"), ensure_ascii=False)
    print("standings.json ενημερώθηκε")
