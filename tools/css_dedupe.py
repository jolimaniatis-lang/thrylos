#!/usr/bin/env python3
"""Ασφαλής καθαρισμός CSS: αφαιρεί δηλώσεις που ακυρώνονται ΠΑΝΤΑ από μεταγενέστερο κανόνα με ΤΟΝ ΙΔΙΟ selector στο ίδιο @-πλαίσιο.
Δεν αλλάζει το αποτέλεσμα του cascade. Χρήση: css_dedupe.py in.html out.html"""
import re,sys
src=open(sys.argv[1],encoding='utf8').read()
a=src.index('<style>')+7;b=src.index('</style>');css=src[a:b]
def scan_block(s,i):
    """i δείχνει μετά το '{' · επιστρέφει τη θέση του αντίστοιχου '}'"""
    d=1;n=len(s)
    while i<n:
        c=s[i]
        if c=='/' and s[i:i+2]=='/*': i=s.index('*/',i)+2; continue
        if c in '"\'':
            j=i+1
            while s[j]!=c: j+=2 if s[j]=='\\' else 1
            i=j+1; continue
        if c=='{': d+=1
        elif c=='}':
            d-=1
            if d==0: return i
        i+=1
    raise ValueError('unbalanced')
def parse(s,ctx,out,base):
    i=0;n=len(s)
    while i<n:
        m=re.compile(r'\s+|/\*.*?\*/',re.S).match(s,i)
        if m: i=m.end(); continue
        j=i
        while j<n and s[j] not in '{;': 
            if s[j] in '"\'':
                q=s[j];j+=1
                while s[j]!=q: j+=2 if s[j]=='\\' else 1
            j+=1
        if j>=n: break
        if s[j]==';': i=j+1; continue
        pre=s[i:j].strip();e=scan_block(s,j+1)
        if pre.startswith('@'):
            if re.match(r'@(media|supports|layer|container)\b',pre): parse(s[j+1:e],ctx+(re.sub(r'\s+',' ',pre),),out,base+j+1)
        else: out.append({'ctx':ctx,'sel':re.sub(r'\s+',' ',pre),'s':base+j+1,'e':base+e})
        i=e+1
def decls(body):
    res=[];i=0;n=len(body);st=0;d=0
    while i<=n:
        c=body[i] if i<n else ';'
        if c in '"\'':
            q=c;i+=1
            while body[i]!=q: i+=2 if body[i]=='\\' else 1
        elif c=='/' and body[i:i+2]=='/*': i=body.index('*/',i)+1
        elif c=='(': d+=1
        elif c==')': d-=1
        elif c==';' and d==0:
            t=body[st:i]
            if ':' in t and t.strip():
                p,v=t.split(':',1); res.append((p.strip().lower() if not p.strip().startswith('--') else p.strip(),v.strip(),t))
            elif t.strip(): res.append((None,None,t))
            st=i+1
        i+=1
    return res
rules=[];parse(css,(),rules,0)
RISK=re.compile(r'color-mix|env\(|clamp\(|min\(|max\(|\d[dsl]v[hw]|oklch|oklab|light-dark|image-set|-webkit-|-moz-|text-wrap|balance|pretty|subgrid|:has',re.I)
groups={}
for k,r in enumerate(rules): groups.setdefault((r['ctx'],r['sel']),[]).append(k)
edits=[];removed=0;emptied=0
for key,idxs in groups.items():
    if len(idxs)<2: continue
    ds=[decls(css[rules[k]['s']:rules[k]['e']]) for k in idxs]
    for x in range(len(idxs)-1):
        later={}
        for y in range(x+1,len(idxs)):
            for p,v,_ in ds[y]:
                if p: later.setdefault(p,[]).append(v)
        keep=[];ch=False
        for p,v,t in ds[x]:
            if p and p in later and not p.startswith('-webkit-') and not p.startswith('-moz-'):
                lv=later[p]; imp=v.rstrip().endswith('!important')
                # ασφαλές μόνο αν ΚΑΠΟΙΟΣ μεταγενέστερος έχει τιμή χωρίς «νέες» συναρτήσεις και ίδια/μεγαλύτερη βαρύτητα
                if any((not RISK.search(w)) and (w.rstrip().endswith('!important') or not imp) for w in lv) and not RISK.search(p):
                    ch=True;removed+=1;continue
            keep.append(t)
        if ch:
            body=';'.join(x_.strip() for x_ in keep if x_.strip())
            edits.append((rules[idxs[x]]['s'],rules[idxs[x]]['e'],body))
            if not body: emptied+=1
out=css
for s_,e_,body in sorted(edits,reverse=True): out=out[:s_]+body+out[e_:]
# κανόνες που άδειασαν
out2=re.sub(r'(?<=[};])\s*[^{}@;/]+\{\}','',out)
open(sys.argv[2],'w',encoding='utf8').write(src[:a]+out2+src[b:])
print('κανόνες',len(rules),'· δηλώσεις που αφαιρέθηκαν',removed,'· κανόνες που άδειασαν',emptied,'· CSS',len(css),'→',len(out2))
