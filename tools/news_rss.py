#!/usr/bin/env python3
"""Τελευταίοι ΤΙΤΛΟΙ ειδήσεων για τον Ολυμπιακό από RSS, χωρίς Claude. Τρέχει στο GitHub Actions (news.yml) κάθε ~15′.
Γράφει news.json: μόνο τίτλος, πηγή, ώρα και σύνδεσμος προς το άρθρο (κανένα κείμενο άρθρου).
Χρήση: news_rss.py <news.json>"""
import json, re, sys, html, datetime, urllib.request, email.utils
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor
ATH = ZoneInfo("Europe/Athens")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Accept": "application/rss+xml, application/xml, text/xml, */*"}
GN = "https://news.google.com/rss/search?hl=el&gl=GR&ceid=GR:el&q="
# (όνομα πηγής, url, όλα τα θέματα αφορούν τον Ολυμπιακό;)
FEEDS = [
    ("olympiacos.org", "https://www.olympiacos.org/feed/", True),
    ("Gazzetta", "https://www.gazzetta.gr/teams/olympiakos/rss", True),
    ("Redfreaks", "https://www.redfreaks.gr/feed/", False),
    ("Eurohoops", "https://www.eurohoops.net/el/feed/", False),
    ("SDNA", "https://www.sdna.gr/latest.xml", False),
    ("in.gr", "https://www.in.gr/sports/feed/", False),
    ("Τα Νέα", "https://www.tanea.gr/category/sports/feed/", False),
    ("Athletiko", "https://www.athletiko.gr/feed", False),
    ("Sportime", "https://sportime.gr/feed/", False),
    ("Novasports", "https://www.novasports.gr/rss", False),
    ("Newsit", "https://www.newsit.gr/category/athlitika/feed/", False),
    ("Sportal", "https://www.sportal.gr/rss", False),
    ("Athlosnews", "https://www.athlosnews.gr/feed/", False),
    ("Sport-FM", "https://www.sport-fm.gr/rss/news", False),
    ("Gazzetta", "https://www.gazzetta.gr/rss", False),
    ("", GN + "%CE%9F%CE%BB%CF%85%CE%BC%CF%80%CE%B9%CE%B1%CE%BA%CF%8C%CF%82+when:1d", False),
    ("", GN + "%CE%9F%CE%BB%CF%85%CE%BC%CF%80%CE%B9%CE%B1%CE%BA%CF%8C%CF%82+%CF%80%CF%8C%CE%BB%CE%BF+OR+%CE%B2%CF%8C%CE%BB%CE%B5%CF%8A+OR+%CF%87%CE%AC%CE%BD%CF%84%CE%BC%CF%80%CE%BF%CE%BB+when:2d", False),
]
OLY = re.compile(r"Ολυμπιακ|Θρύλο[ςυ]|[Εε]ρυθρ[οό]λ[εέ]υκ|Olympia[ck]os", re.I)
NOT = re.compile(r"Ολυμπιακ\S*\s+(Λευκωσίας|Βόλου|Αγών|αγών)|Ολυμπιακ(ή|ής|ό)\s+(Επιτροπή|Ακαδημία|Φλόγα|[Σσ]τάδιο)|Ολυμπιακ(οί|ών|ούς)\s+Αγών|ολυμπιονίκ", re.I)
def sport_of(t, u):
    s = (t + " " + u).lower()
    if re.search(r"πόλο|polo|υδατοσφ|waterpolo", s): return "polo"
    if re.search(r"βόλεϊ|βολεϊ|volley|χάντμπολ|χαντμπολ|handball|γυναικών|γυναίκες|στίβο|κολύμβ|πάλη|ιστιοπλο|επιτραπέζ|ερασιτέχν", s): return "amateur"
    if re.search(r"μπάσκετ|μπασκετ|basket|euroleague|ευρωλίγκα|gbl|μπαρτζώκα|βεζένκο|φουρνιέ|μιλουτίνοφ|παπανικολάου|ντόρσεϊ|/mpasket", s): return "basketball"
    return "football"
def clean(x):
    x = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", x or "", flags=re.S)
    x = html.unescape(html.unescape(re.sub(r"<[^>]+>", "", x)))
    return re.sub(r"\s+", " ", x).strip()
def tag(item, name):
    m = re.search(r"<%s(?:\s[^>]*)?>(.*?)</%s>" % (name, name), item, re.S)
    return m.group(1) if m else ""
def fetch(f):
    name, url, allin = f; res = []
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
            x = r.read().decode("utf8", "replace")
    except Exception as e:
        print("feed ERR", url[:60], str(e)[:50]); return res
    for it in re.findall(r"<item[\s>].*?</item>", x, re.S):
        title = clean(tag(it, "title")).split("|||")[0].strip(); link = clean(tag(it, "link")); src = name
        if not src:
            src = clean(tag(it, "source")) or "Google News"
            title = re.sub(r"\s+[-–|]\s+%s\s*$" % re.escape(src), "", title)
        if not title or not link.startswith("http"): continue
        if NOT.search(title) or not (allin or OLY.search(title)): continue
        try: t = email.utils.parsedate_to_datetime(clean(tag(it, "pubDate")))
        except Exception: continue
        if t.tzinfo is None: t = t.replace(tzinfo=datetime.timezone.utc)
        res.append({"title": title[:200], "src": src[:40], "url": link, "t": t.astimezone(ATH).isoformat(timespec="minutes"), "sport": sport_of(title, link)})
    return res
now = datetime.datetime.now(ATH)
with ThreadPoolExecutor(6) as ex: lists = list(ex.map(fetch, FEEDS))
seen, items = set(), []
key = lambda s: re.sub(r"[^a-zα-ω0-9]", "", s.lower().translate(str.maketrans("άέήίόύώϊϋΐΰ", "αεηιουωιυιυ")))[:48]
for lst in lists:
    for i in lst:
        age = (now - datetime.datetime.fromisoformat(i["t"])).total_seconds()
        if age < -600 or age > 36 * 3600: continue
        k = key(i["title"])
        if len(k) < 12 or k in seen: continue
        seen.add(k); items.append(i)
items.sort(key=lambda i: i["t"], reverse=True); items = items[:80]
ok = sum(1 for l in lists if l)
print("feeds με αποτελέσματα: %d/%d · τίτλοι: %d" % (ok, len(FEEDS), len(items)))
if ok < 3 or len(items) < 5:
    print("πολύ λίγα αποτελέσματα· το news.json δεν αλλάζει"); sys.exit(0)
try: old = json.load(open(sys.argv[1], encoding="utf8")).get("items")
except Exception: old = None
if old != items:
    json.dump({"updatedAt": now.isoformat(timespec="seconds"), "items": items}, open(sys.argv[1], "w", encoding="utf8"), ensure_ascii=False)
    print("news.json ενημερώθηκε")
