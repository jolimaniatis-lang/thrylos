// Φάση 3Α: έλεγχος του κεντρικού μηχανισμού αντιστοίχισης αγώνα → ομάδα: node tests/team_map.js
// Ελέγχει γνωστές διοργανώσεις, όλους τους αγώνες/πίνακες του repo, και καταγράφει όσους δεν ταξινομούνται με βεβαιότητα.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';fs.readFile(path.join(root,p),(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});r.end(d)})});
const J=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
// [sport, τίτλος διοργάνωσης, αναμενόμενη ομάδα ή null = αμφιβολία]
const KNOWN=[
 ['football','Super League · 9η αγων.','football-m'],['football','Europa League · League Phase, 4η','football-m'],['football','Champions League · Προκριματικά','football-m'],['football','Κύπελλο · League Phase','football-m'],
 ['football','Πρωτάθλημα γυναικών · 1η αγων.','football-w'],['football','Super League Γυναικών · 3η αγων.','football-w'],['football','Άγνωστη διοργάνωση','null'],
 ['basketball','Euroleague · 10η αγων.','basketball-m'],['basketball','Basket League · 5η αγωνιστική','basketball-m'],['basketball','Euroleague γυναικών · 1η αγων.','basketball-w'],['basketball','Άγνωστη διοργάνωση','null'],
 ['amateur','Μπάσκετ γυναικών · Α1 5η αγων.','basketball-w'],['amateur','Μπάσκετ γυναικών · EuroCup 3η αγων.','basketball-w'],['amateur','Μπάσκετ ανδρών · Κύπελλο','basketball-m'],
 ['amateur','Βόλεϊ ανδρών · Volley League 1η αγων.','volleyball-m'],['amateur','Βόλεϊ ανδρών · League Cup προημιτελικά','volleyball-m'],
 ['amateur','Βόλεϊ γυναικών · Volley League 3η αγων.','volleyball-w'],['amateur','Βόλεϊ γυναικών · Challenge Cup (ρεβάνς)','volleyball-w'],['amateur','Βόλεϊ · Κάποιο τουρνουά','null'],
 ['polo','Πόλο ανδρών · Waterpolo League 6η αγων.','polo-m'],['polo','Πόλο ανδρών · Champions League όμιλος','polo-m'],['polo','Πόλο γυναικών · Champions League 1η αγων. (3ος όμιλος)','polo-w'],['polo','Πόλο γυναικών · Waterpolo League 7η αγων.','polo-w'],
 ['polo','Champions League · Όμιλος','null'],
 ['amateur','Χάντμπολ · Handball Premier 7η αγων.','handball-m'],['amateur','Χάντμπολ · EHF European Cup (32)','null'],['amateur','Χάντμπολ γυναικών · Α1','handball-w'],['amateur','Χάντμπολ ανδρών · EHF European League','handball-m'],
 ['amateur','Νέο τμήμα','null'],['amateur','Βόλεϊ ανδρών και γυναικών · Φιλικό','null'],['football','Βόλεϊ ανδρών · Volley League','null'],['polo','Μπάσκετ γυναικών · Α1','null']];

// Φάση 3Β: προαιρετικό πεδίο gender — [sport, τίτλος, gender, αναμενόμενη ομάδα]
const GCASES=[
 ['polo','Champions League · Όμιλος','m','polo-m'],['polo','Champions League · Όμιλος','w','polo-w'],['polo','Champions League · Όμιλος',undefined,'null'],
 ['amateur','Χάντμπολ · EHF European Cup (32)','m','handball-m'],['amateur','Χάντμπολ · EHF European Cup (32)','w','handball-w'],['amateur','Χάντμπολ · EHF European Cup (32)','','null'],
 ['polo','Πόλο ανδρών · Waterpolo League 6η αγων.','m','polo-m'],['polo','Πόλο ανδρών · Waterpolo League 6η αγων.','w','null'],   // αντίφαση → όχι σε ομάδα
 ['polo','Πόλο γυναικών · Champions League 1η αγων.','m','null'],['polo','Πόλο γυναικών · Champions League 1η αγων.','w','polo-w'],
 ['football','Super League · 9η αγων.','w','null'],['football','Super League · 9η αγων.','m','football-m'],['football','Super League · 9η αγων.',undefined,'football-m'],
 ['basketball','Euroleague · 10η αγων.','x','null'],['basketball','Euroleague · 10η αγων.','M','null'],   // άκυρη τιμή
 ['amateur','Νέο τμήμα','m','null'],                                                    // άγνωστο άθλημα: το πεδίο δεν το σώζει
 ['amateur','Βόλεϊ ανδρών και γυναικών · Φιλικό','m','null'],                           // αντιφατικός τίτλος: το πεδίο δεν τον σώζει
 ['football','Βόλεϊ ανδρών · Volley League','m','null'],                                // λάθος άθλημα
 ['amateur','Βόλεϊ · Κάποιο τουρνουά','w','volleyball-w'],['amateur','Βόλεϊ · Κάποιο τουρνουά','m','volleyball-m']];
const TABLES=[['Super League · μετά την 9η αγωνιστική (Ολυμπιακός)','football','football-m'],['Europa League · League Phase · μετά την 3η αγωνιστική','football','football-m'],['Euroleague · μετά την 9η αγωνιστική','basketball','basketball-m'],['Basket League · μετά την 4η αγωνιστική','basketball','basketball-m'],
 ['Champions League πόλο ανδρών · Όμιλος Α','polo','polo-m'],['Handball Premier · κορυφή (μετά την 7η αγων.)','amateur','handball-m'],['Σκόρερ Ολυμπιακού (ποδόσφαιρο)','football','football-m'],['Μέσοι όροι Ολυμπιακού (Basket League)','basketball','basketball-m'],['Σκόρερ πόλο ανδρών (Champions League)','polo','polo-m']];
(async()=>{await new Promise(r=>srv.listen(0,r));const port=srv.address().port;const b=await chromium.launch();let f=0;const ok=(c,m)=>{if(!c){f++;console.log('FAIL',m)}};let n=0;
const ctx=await b.newContext();const p=await ctx.newPage();await ctx.route(/supabase\.co|euroleague\.net|incrowdsports/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
await p.goto('http://localhost:'+port+'/');await p.waitForTimeout(800);
const cls=(s,t)=>p.evaluate(([s,t])=>classifyTeam(s,t).id||'null',[s,t]);
for(const [s,t,e] of KNOWN){n++;const g=await cls(s,t);ok(g===e,'διοργάνωση «'+t+'» ('+s+'): '+g+' αντί '+e)}
const stand=J('data/schedule/standings.json').tables,sc=J('data/schedule/scorers.json').tables;
for(const [t,s,e] of TABLES){n++;const g=await cls(s,t);ok(g===e,'πίνακας «'+t+'»: '+g+' αντί '+e)}
// όλοι οι πίνακες του repo: αν ταξινομούνται, να συμφωνούν με το φύλο/άθλημα του τίτλου
for(const t of [...stand,...sc]){n++;const g=await cls(t.sport,t.title);const x=await p.evaluate(s=>s,t.title);
 if(g!=='null'){if(/γυναικ/i.test(t.title))ok(g.endsWith('-w'),'πίνακας με «γυναικών» σε ομάδα ανδρών: '+t.title);if(/ανδρ/i.test(t.title))ok(g.endsWith('-m'),'πίνακας με «ανδρών» σε ομάδα γυναικών: '+t.title)}
 else console.log('  ΜΗ ΤΑΞΙΝΟΜΗΜΕΝΟΣ ΠΙΝΑΚΑΣ:',t.title)}
// όλοι οι αγώνες του ημερολογίου

for(const [sp,t,g,e] of GCASES){n++;const r=await p.evaluate(([s,t,g])=>classifyTeam(s,t,g).id||'null',[sp,t,g]);ok(r===e,'gender «'+t+'» ('+sp+', '+JSON.stringify(g)+'): '+r+' αντί '+e)}
// seasonToItem: το πεδίο φτάνει στο στοιχείο· χωρίς πεδίο = προηγούμενη συμπεριφορά
for(const [m,e] of [[{sport:'polo',comp:'Champions League · Όμιλος',opp:'Χ',d:'2026-12-01',home:true,gender:'m'},'polo-m'],[{sport:'polo',comp:'Champions League · Όμιλος',opp:'Χ',d:'2026-12-01',home:true},'null'],[{sport:'polo',comp:'Πόλο ανδρών · Waterpolo League',opp:'Χ',d:'2026-12-01',home:true,gender:'w'},'null']]){n++;
 const r=await p.evaluate(m=>seasonToItem(m).team||'null',m);ok(r===e,'seasonToItem '+m.comp+' gender='+m.gender+': '+r+' αντί '+e)}
// όλοι οι αγώνες του repo: η προτεινόμενη τιμή (tools/gender_preview.js) ταξινομεί ΧΩΡΙΣ αντίφαση και χωρίς αμφιβολία
{const {spawnSync}=require('child_process');const pv=spawnSync('node',[path.join(root,'tools/gender_preview.js'),path.join(root,'data/schedule/season.json'),'/tmp/gp.json'],{encoding:'utf8'});n++;
 let j={};try{j=JSON.parse(pv.stdout)}catch(e){}ok(pv.status===0&&j.total===J("data/schedule/season.json").matches.length&&j.contradictions===0&&j.unclassified===0,'gender_preview: '+pv.stdout);
 const pr=JSON.parse(fs.readFileSync('/tmp/gp.json','utf8'));for(const o of pr){n++;const r=await p.evaluate(([s,c,g])=>classifyTeam(s,c,g).id||'null',[o.sport,o.comp,o.proposed]);ok(r===o.team&&r!=='null','προτεινόμενο gender '+o.proposed+' για '+o.d+' '+o.opp+': '+r)}}
const ms=J('data/schedule/season.json').matches;const un=[];const byTeam={};
for(const m of ms){n++;const g=await cls(m.sport,m.comp);
 if(g==='null'){un.push(m);continue}
 (byTeam[g]=byTeam[g]||[]).push(m);
 if(/γυναικ/i.test(m.comp))ok(g.endsWith('-w'),'αγώνας με «γυναικών» σε ομάδα ανδρών: '+m.comp);
 if(/ανδρ/i.test(m.comp))ok(g.endsWith('-m'),'αγώνας με «ανδρών» σε ομάδα γυναικών: '+m.comp);
 const disc=g.split('-')[0];const exp=m.sport==='football'?'football':m.sport==='basketball'?'basketball':null;if(exp)ok(disc===exp,'άθλημα '+m.sport+' σε ομάδα '+g+': '+m.comp);
 if(/^βολ/i.test(m.comp.normalize('NFD').replace(/[̀-ͯ]/g,'')))ok(disc==='volleyball','βόλεϊ σε '+g+': '+m.comp);
 if(/^χαντμπολ/i.test(m.comp.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()))ok(disc==='handball','χάντμπολ σε '+g+': '+m.comp)}
console.log('Ελέγχθηκαν '+n+' περιπτώσεις· αγώνες ημερολογίου '+ms.length+': ταξινομήθηκαν '+(ms.length-un.length)+', αμφιβολία '+un.length);
for(const k of Object.keys(byTeam).sort())console.log('  '+k.padEnd(14)+byTeam[k].length+' αγώνες');
console.log('Αγώνες που ΔΕΝ ταξινομούνται με βεβαιότητα (καταγράφονται στη σελίδα Ερασιτέχνη):');
un.forEach(m=>console.log('  - '+m.d+' · '+m.comp+' · '+m.opp));
ok(ms.length===un.length+Object.values(byTeam).reduce((a,v)=>a+v.length,0),'κάθε αγώνας είτε ταξινομήθηκε είτε καταγράφηκε');
await b.close();srv.close();console.log(f?'\nΑΠΟΤΥΧΙΕΣ: '+f:'\nΟΛΑ ΠΕΡΑΣΑΝ');process.exit(f?1:0)})();
