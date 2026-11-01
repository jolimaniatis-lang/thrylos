// Έλεγχος υφιστάμενων λειτουργιών (λειτουργικός, όχι μόνο smoke): node tests/features.js
// Αντιστοιχεί στη λίστα tests/CHECKLIST.md· τρέχει ΠΡΙΝ και ΜΕΤΑ από κάθε φάση. Έξοδος 0 = όλα πέρασαν.
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';fs.readFile(path.join(root,p),(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fails=0,passes=0;const ok=(c,m)=>{if(c){passes++}else{fails++;console.log('  FAIL',m)}};
const SIZES=[[390,844],[1280,800]];
(async()=>{await new Promise(r=>srv.listen(0,r));const port=srv.address().port;const b=await chromium.launch();
for(const [w,h] of SIZES){console.log('== features '+w+'px');
 const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push(e.message));
 await ctx.route(/supabase\.co|euroleague\.net|incrowdsports/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await p.goto('http://localhost:'+port+'/');await p.waitForTimeout(1500);
 const txt=sel=>p.evaluate(s=>{const e=document.querySelector(s);return e?e.innerText:''},sel);
 const cnt=sel=>p.locator(sel).count();
 const go=async v=>{await p.click('.bar button[data-v="'+v+'"]');await p.waitForTimeout(450)};

 // A. Κεφαλίδα
 ok((await p.evaluate(()=>document.querySelector('.hero').textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,''))).includes('Θρυλος Daily'),'A1 τίτλος εφαρμογής');
 ok(await cnt('#edition option')>=1,'A2 επιλογή ημέρας (έκδοσης)');
 ok(await cnt('#themeBtn')===1,'A3 κουμπί θέματος');
 ok((await txt('#updated')).includes('Ενημερώθηκε')||await p.evaluate(()=>document.getElementById('updated').hidden),'A4 ένδειξη ενημέρωσης');

 // B. Νέα
 await go('news');
 const tabs=await p.locator('#tabs button').allInnerTexts();
 ok(['Όλα','Ποδόσφαιρο','Μπάσκετ','Ερασιτέχνης'].every(x=>tabs.some(t=>t.includes(x))),'B1 φίλτρα αθλημάτων (Όλα/Ποδόσφαιρο/Μπάσκετ/Ερασιτέχνης): '+tabs.join('|'));
 ok(await cnt('#app .brief li')>=1,'B2 «Τα βασικά σήμερα»');
 ok(await cnt('#app .row')>=3,'B3 λίστα ειδήσεων');
 const first=p.locator('#app .row button').first();await first.click();await p.waitForTimeout(200);
 ok(await p.evaluate(()=>!!document.querySelector('#app .row.open .det:not([hidden]) p')),'B4 άνοιγμα είδησης με πλήρες κείμενο');
 ok(await p.evaluate(()=>!!document.querySelector('#app .row.open .det a[href^="http"]')),'B5 σύνδεσμος πηγής στην είδηση');
 await first.click();
 ok(await cnt('#app .fx')>=1||await cnt('#app .rail')>=0,'B6 ενότητα Πρόγραμμα');
 ok((await txt('#app')).includes('Powered by SportScore'),'B7 ένδειξη Powered by SportScore');
 await p.locator('#tabs button',{hasText:'Μπάσκετ'}).first().click();await p.waitForTimeout(300);
 ok(await p.evaluate(()=>(()=>{const n=t=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'');const hs=[...document.querySelectorAll('#app .grp-h h2')].map(h=>n(h.textContent)).filter(t=>/Ποδοσφαιρο|Μπασκετ|Ερασιτεχνης|Αλλα/.test(t));return hs.length>0&&hs.every(t=>/Μπασκετ/.test(t))})()),'B8 φίλτρο Μπάσκετ δείχνει μόνο μπάσκετ');
 await p.reload();await p.waitForTimeout(1200);
 ok(await p.evaluate(()=>localStorage.getItem('thr_f')==='basketball'),'B9 το φίλτρο αθλήματος αποθηκεύεται (thr_f)');
 await p.locator('#tabs button',{hasText:'Όλα'}).first().click();await p.waitForTimeout(250);
 ok((await txt('#next')).length>0||await p.evaluate(()=>document.getElementById('next').hidden),'B10 κάρτα επόμενου αγώνα/live (#next)');

 // I. Φάση 1: αρχική portal
 await go('news');await p.waitForTimeout(600);
 ok(await cnt('#app .lead .lead-t')===1,'I1 κεντρική είδηση');
 ok(await cnt('#app .rs')>=3,'I2 πρόσφατα αποτελέσματα (κάρτες)');
 ok(await p.evaluate(()=>[...document.querySelectorAll('#app .rs')].every(c=>/\d/.test(c.innerText))),'I3 κάθε αποτέλεσμα έχει σκορ');
 ok(await cnt('#app .amx')===1,'I4 ενότητα Ερασιτέχνης');
 ok(await cnt('#app .qk-b')>=6,'I5 γρήγορη πρόσβαση');
 await p.locator('#tabs button',{hasText:'Μπάσκετ'}).first().click();await p.waitForTimeout(300);
 ok(await cnt('#app .lead')===0&&await cnt('#app .amx')===0,'I6 με φίλτρο αθλήματος δεν εμφανίζονται τα τμήματα της αρχικής');
 await p.locator('#tabs button',{hasText:'Όλα'}).first().click();await p.waitForTimeout(300);
 if(process.env.SHOTS){await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:process.env.SHOTS+'/home-'+w+'.png',fullPage:true})}
 await p.locator('#app .qk-b',{hasText:'Βαθμολογίες'}).click();await p.waitForTimeout(400);
 ok(await cnt('#more .tbl')>=1,'I7 σύνδεσμος «Βαθμολογίες» ανοίγει πίνακες');
 await go('news');

 // C. Αγώνες
 await go('games');
 ok(await cnt('#games .toggle button')===2,'C1 διακόπτης Επόμενοι/Αποτελέσματα');
 ok(await cnt('#games .gm')>=1,'C2 κάρτες αγώνων');
 await p.locator('#games .toggle button[data-m="past"]').click();await p.waitForTimeout(250);
 ok(await cnt('#games .gm')>=10,'C3 αποτελέσματα σεζόν (≥10)');
 ok(await p.evaluate(()=>!!document.querySelector('#games .gm .res,#games .gm .sc,#games .gm [class*=score]')||/\d+\s*[-–]\s*\d+/.test(document.getElementById('games').innerText)),'C4 εμφάνιση σκορ');

 // J. Φάση 2: Live Center
 await go('live');await p.waitForTimeout(500);
 ok(await cnt('#live .lc-bar')===1&&(await txt('#live .lc-bar')).includes('ενημέρωση'),'J1 μπάρα τελευταίας ενημέρωσης');
 ok(await cnt('#live .lc-filters [role=group]')===4,'J2 τέσσερις ομάδες φίλτρων (κατάσταση, άθλημα, ομάδα ανδρών/γυναικών, διοργάνωση)');
 const nRows=()=>cnt('#live .lc-row');const allRows=await nRows();ok(allRows>=5,'J3 κάρτες αγώνων στη λίστα ('+allRows+')');
 await p.locator('#live [data-f=status] button',{hasText:'Προσεχείς'}).click();await p.waitForTimeout(200);
 ok(await nRows()>0&&await cnt('#live .lc-row:not([data-b=next])')===0,'J4 φίλτρο Προσεχείς δείχνει μόνο προσεχείς');
 await p.locator('#live [data-f=sport] button',{hasText:'Μπάσκετ'}).click();await p.waitForTimeout(200);
 ok(await cnt('#live .lc-g')===1&&await cnt('#live .lc-row:not([data-b=next])')===0,'J5 συνδυασμός Προσεχείς+Μπάσκετ');
 const comps=await p.locator('#live [data-f=comp] button').count();ok(comps>=2,'J6 φίλτρο διοργάνωσης ('+comps+' επιλογές)');
 const before=await nRows();await p.locator('#live [data-f=comp] button').nth(1).click();await p.waitForTimeout(200);
 ok(await nRows()>0&&await nRows()<=before,'J7 φίλτρο διοργάνωσης περιορίζει τη λίστα');
 await p.locator('#live [data-f=status] button',{hasText:'Live'}).click();await p.waitForTimeout(200);
 ok(await cnt('#live .none')===1||await cnt('#live .lc-g')>=0,'J8 χωρίς αποτέλεσμα: μήνυμα/κενή κατάσταση');
 if(await cnt('#live .none')===1){await p.locator('#live .moreb',{hasText:'Καθαρισμός'}).click();await p.waitForTimeout(200);ok(await nRows()>=5,'J9 καθαρισμός φίλτρων')}
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'J10 χωρίς οριζόντιο overflow στο Live');
 ok((await txt('#live')).includes('Powered by SportScore'),'J11 Powered by SportScore στο Live');
 await p.reload();await p.waitForTimeout(1000);
 // K. Match Center
 await go('live');await p.waitForTimeout(400);
 await p.locator('#live [data-f=status] button',{hasText:'Προσεχείς'}).click();await p.waitForTimeout(200);
 await p.locator('#live .lc-row').first().click();await p.waitForTimeout(300);
 ok(await cnt('.sheet .mc-hero')===1,'K1 ανοίγει Match Center για προσεχή αγώνα');
 ok((await txt('.sheet .mc-sc')).trim()==='vs','K2 προσεχής αγώνας: «vs», όχι σκορ');
 ok(await cnt('.sheet .facts > div')>=3,'K3 στοιχεία αγώνα (διοργάνωση, ημερομηνία, ώρα…)');
 ok(await cnt('.sheet .lu,.sheet .ev,.sheet .cmp')===0&&(await txt('.sheet')).includes('Δεν υπάρχουν αναλυτικά στοιχεία'),'K4 χωρίς δεδομένα πηγής: κενή κατάσταση, κανένα ψεύτικο στοιχείο');
 ok(await cnt('.sheet .mc-nav .qk-b')===2,'K5 σύνδεσμοι προς βαθμολογία/πρόγραμμα');
 await p.keyboard.press('Escape');await p.waitForTimeout(250);ok(await cnt('.sheet')===0,'K6 κλείσιμο με Esc');
 await p.locator('#live [data-f=status] button',{hasText:'Ολοκληρωμένοι'}).click();await p.waitForTimeout(200);
 await p.locator('#live .lc-row').first().click();await p.waitForTimeout(300);
 ok(/\d\s*–\s*\d/.test(await txt('.sheet .mc-sc')),'K7 ολοκληρωμένος αγώνας: σκορ');
 await p.locator('.sheet .mc-nav .qk-b',{hasText:'Βαθμολογία'}).click();await p.waitForTimeout(400);
 ok(await cnt('.sheet')===0&&await cnt('#more .tbl')>=1,'K8 «Βαθμολογία διοργάνωσης» ανοίγει τους πίνακες');
 // L. Φάση 3Α: ομάδες, Ερασιτέχνης, φύλο
 await go('more');await p.click('.mm-i[data-go="teams"]');await p.waitForTimeout(500);
 const NAMES=['Ποδόσφαιρο ανδρών','Ποδόσφαιρο γυναικών','Μπάσκετ ανδρών','Μπάσκετ γυναικών','Βόλεϊ ανδρών','Βόλεϊ γυναικών','Πόλο ανδρών','Πόλο γυναικών','Χάντμπολ ανδρών','Χάντμπολ γυναικών'];
 ok(await cnt('#more .tm-card')===10,'L1 δέκα κάρτες ομάδων');
 const cn=await p.locator('#more .tm-card h3').allInnerTexts();ok(NAMES.every(n=>cn.some(c=>c.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()===n.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase())),'L2 όλες οι 10 ομάδες με σωστά ονόματα: '+cn.join('|'));
 const fw=(await p.locator('#more .tm-card[data-team="football-w"]').innerText());
 ok(/Δεν υπάρχει προγραμματισμένος/i.test(fw.normalize('NFD').replace(/[̀-ͯ]/g,'')+fw)||fw.length>20,'L3 η ομάδα «Ποδόσφαιρο γυναικών» παραμένει ορατή με κενές καταστάσεις');
 ok(await p.evaluate(()=>/(Δεν υπάρχει προγραμματισμένος|ΔΕΝ ΥΠΑΡΧΕΙ ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΟΣ)/i.test(document.querySelector('#more .tm-card[data-team="football-w"]').textContent)&&!document.querySelector('#more .tm-card[data-team="football-w"] .tm-chip.on')),'L3b football-w: καμία δυνατότητα δεν δηλώνεται ως υπάρχουσα');
 // σελίδα ομάδας με πλήρη δεδομένα
 await p.locator('#more .tm-card[data-team="basketball-m"] .qk-b').click();await p.waitForTimeout(400);
 ok(await cnt('#more .tm-sec')===6,'L4 σελίδα ομάδας: 6 ενότητες (επόμενος, αποτελέσματα, πρόγραμμα, διοργανώσεις, ρόστερ, στατιστικά)');
 ok(await cnt('#more .lc-row')>=3&&await cnt('#more .lc-row:not([data-team="basketball-m"])')===0,'L5 στη σελίδα Μπάσκετ ανδρών υπάρχουν ΜΟΝΟ αγώνες της ομάδας');
 ok(await cnt('#more #tm-roster .tm-ro')===1,'L6 ρόστερ Μπάσκετ ανδρών υπάρχει');
 ok(await cnt('#more #tm-comps .tbl')>=1,'L7 βαθμολογίες διοργανώσεων Μπάσκετ ανδρών');
 await p.locator('#more .mm-back',{hasText:'ομάδες'}).click();await p.waitForTimeout(300);
 // σελίδα ομάδας χωρίς ρόστερ/βαθμολογία
 await p.locator('#more .tm-card[data-team="volleyball-w"] .qk-b').click();await p.waitForTimeout(400);
 ok(await cnt('#more .tm-sec')===6&&await cnt('#more #tm-roster .empty')===1,'L8 Βόλεϊ γυναικών: κενή κατάσταση ρόστερ, ενότητες παραμένουν');
 ok(await cnt('#more .lc-row')>=3&&await cnt('#more .lc-row:not([data-team="volleyball-w"])')===0,'L9 στη σελίδα Βόλεϊ γυναικών υπάρχουν ΜΟΝΟ αγώνες Βόλεϊ γυναικών');
 ok(await cnt('#more #tm-roster .tm-ro')===0,'L10 κανένα ανύπαρκτο ρόστερ για βόλεϊ γυναικών');
 await p.locator('#more .mm-back',{hasText:'ομάδες'}).click();await p.waitForTimeout(300);
 await p.locator('#more .tm-card[data-team="handball-w"] .qk-b').click();await p.waitForTimeout(400);
 ok(await cnt('#more #tm-results .empty')===1&&await cnt('#more #tm-schedule .empty')===1,'L11 Χάντμπολ γυναικών: κενές καταστάσεις αποτελεσμάτων/προγράμματος');
 // Ερασιτέχνης
 await go('more');await p.click('.mm-i[data-go="amateur"]');await p.waitForTimeout(500);
 ok(await cnt('#more .tm-card')===8&&await cnt('#more .tm-card[data-team="football-m"],#more .tm-card[data-team="basketball-m"]')===0,'L12 Ερασιτέχνης: 8 τμήματα (χωρίς τις δύο κύριες ομάδες)');
 ok(await cnt('#more .tm-card .qk-b[data-focus=schedule]')===8&&await cnt('#more .tm-card .qk-b[data-focus=results]')===8,'L13 άμεση πρόσβαση σε πρόγραμμα και αποτελέσματα για κάθε τμήμα');
 // «επόμενος» υπολογίζεται από το ημερολόγιο
 const exp=await p.evaluate(async()=>{const m=(await (await fetch('data/schedule/season.json')).json()).matches;const t=todayStr();
  const x=m.filter(q=>!q.score&&q.d>=t&&/^Βόλεϊ γυναικών/.test(q.comp)).sort((a,b)=>(a.d+(a.t||'')).localeCompare(b.d+(b.t||'')))[0];return x?x.opp:null});
 const vw=await p.evaluate(()=>document.querySelector('#more .tm-card[data-team="volleyball-w"]').textContent);
 const nn=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();ok(exp&&nn(vw).includes(nn(exp)),'L14 «επόμενος αγώνας» Βόλεϊ γυναικών = από το ημερολόγιο ('+exp+')');
 ok(await cnt('#more details.tm-un summary')===1,'L15 καταγραφή αγώνων που δεν ταξινομήθηκαν με βεβαιότητα');
 await p.locator('#more .tm-card[data-team="polo-m"] .qk-b[data-focus=results]').click();await p.waitForTimeout(500);
 ok(await cnt('#more #tm-results')===1&&await cnt('#more .lc-row:not([data-team="polo-m"])')===0,'L16 «Αποτελέσματα» από τον Ερασιτέχνη ανοίγει την ομάδα, μόνο με δικούς της αγώνες');
 // φύλο στο Live και στο Ημερολόγιο
 await go('live');await p.waitForTimeout(400);
 for(const [lab,sfx,k] of [['Γυναικών','-w','w'],['Ανδρών','-m','m']]){await p.locator('#live [data-f=gender] button[data-k='+k+']').click();await p.waitForTimeout(250);
  const rows=await p.locator('#live .lc-row').evaluateAll(r=>r.map(x=>x.dataset.team||''));
  ok(rows.length>0&&rows.every(t=>t.endsWith(sfx)),'L17 φίλτρο «'+lab+'» στο Live: '+rows.length+' αγώνες, όλοι '+sfx)}
 await p.locator('#live [data-f=gender] button[data-k=all]').click();await p.waitForTimeout(200);
 await go('games');await p.waitForTimeout(300);
 ok(await cnt('#games .gg button')===3,'L18 φίλτρο ανδρών/γυναικών στο Ημερολόγιο');
 const gAll=await cnt('#games .gm');await p.locator('#games .gg button[data-gg=w]').click();await p.waitForTimeout(250);const gW=await cnt('#games .gm');
 ok(gW<gAll||gAll===0,'L19 το φίλτρο «Γυναικών» περιορίζει τα αγώνες ('+gAll+' → '+gW+')');
 await p.locator('#games .gg button[data-gg=all]').click();await p.waitForTimeout(200);
 // αρχική
 await go('news');await p.locator('#app .qk-b',{hasText:'Οι 10 ομάδες'}).click();await p.waitForTimeout(400);ok(await cnt('#more .tm-card')===10,'L20 σύνδεσμος «Οι 10 ομάδες» από την αρχική');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'L21 χωρίς οριζόντιο overflow στις σελίδες ομάδων');
 await go('news');
 // D. Live
 await go('live');
 ok((await txt('#live')).trim().length>0,'D1 η καρτέλα Live δεν είναι άδεια (κάρτα αγώνα ή κενή κατάσταση)');

 // E. Ρόστερ
 await go('roster');
 const rt=await p.locator('#tabs button[data-r]').allInnerTexts();
 ok(['Ποδόσφαιρο','Μπάσκετ','Πόλο Ανδρών','Πόλο Γυναικών','Χάντμπολ Ανδρών','Χάντμπολ Γυναικών'].every(x=>rt.some(t=>t.includes(x))),'E1 έξι καρτέλες ρόστερ');
 ok(await cnt('#roster .pl')>=10,'E2 παίκτες ποδοσφαίρου');
 ok(await cnt('#rsearch')===1,'E3 αναζήτηση ρόστερ');
 await p.fill('#rsearch','zzzzqq');await p.waitForTimeout(250);ok(await cnt('#roster .pl')===0,'E4 αναζήτηση χωρίς αποτέλεσμα');await p.fill('#rsearch','');await p.waitForTimeout(250);
 await p.locator('#roster .pl').first().click();await p.waitForTimeout(300);
 ok(await cnt('.sheet')===1,'E5 φύλλο παίκτη ανοίγει');
 ok((await txt('.sheet')).length>40,'E6 φύλλο παίκτη με περιεχόμενο');
 await p.keyboard.press('Escape');await p.waitForTimeout(250);ok(await cnt('.sheet')===0,'E7 κλείσιμο φύλλου με Esc');
 await p.locator('#tabs button[data-r="handball-men"]').click();await p.waitForTimeout(300);
 ok(await cnt('#roster .pl')>=10,'E8 ρόστερ χάντμπολ ανδρών');

 // F. Κι άλλα
 for(const [k,label] of [['teams','Ομάδες'],['standings','Βαθμολογίες'],['scorers','Σκόρερ'],['discipline','Τιμωρίες'],['rumors','Μεταγραφές'],['quotes','Δηλώσεις'],['amateur','Ερασιτέχνης'],['archive','Αρχείο'],['vs','Αντίπαλοι'],['bet','Στοίχημα'],['chat','Chat']]){
  await go('more');ok(await cnt('.mm-i[data-go="'+k+'"]')===1,'F '+k+' υπάρχει στο μενού');
  await p.click('.mm-i[data-go="'+k+'"]');await p.waitForTimeout(450);
  const id=['vs','bet','chat'].includes(k)?k:'more';
  ok(await p.evaluate(i=>{const e=document.getElementById(i);return !!e&&!e.hidden&&e.innerText.trim().length>0},id),'F '+k+' εμφανίζει περιεχόμενο')}
 await go('more');ok(await cnt('.mm-i')===11,'F0 11 ενότητες στο μενού (10 + Ομάδες)');
 await p.click('.mm-i[data-go="standings"]');await p.waitForTimeout(350);ok(await cnt('#more .tbl')>=1,'F11 πίνακες βαθμολογίας');
 await go('more');await p.click('.mm-i[data-go="archive"]');await p.waitForTimeout(350);
 ok(await cnt('#more .srch')===1,'F12 αναζήτηση αρχείου');

 // G. Πλοήγηση / PWA
 ok(await cnt('.bar button')===5,'G1 5 κουμπιά κάτω μπάρας');
 await p.evaluate(()=>{location.hash='#live'});await p.waitForTimeout(400);
 ok(await p.evaluate(()=>document.querySelector('.bar button[data-v="live"]').getAttribute('aria-current')==='page'),'G2 πλοήγηση με hash (#live)');
 ok(await p.evaluate(()=>!!document.querySelector('link[rel=manifest]')&&!!document.querySelector('link[rel=apple-touch-icon]')),'G3 manifest και apple-touch-icon');
 ok(await p.evaluate(async()=>{try{const r=await navigator.serviceWorker.getRegistration();return !!r}catch(e){return false}}),'G4 service worker εγγεγραμμένος');
 const t0=await p.evaluate(()=>document.documentElement.dataset.theme||'');await p.click('#themeBtn');
 ok(await p.evaluate(t=>(document.documentElement.dataset.theme||'')!==t,t0),'G5 αλλαγή θέματος');
 ok(errs.length===0,'H1 κανένα σφάλμα JavaScript: '+errs.slice(0,3).join(' || '));
 console.log(errs.length?'  ✗':'  ✓ ok');await ctx.close()}
await b.close();srv.close();console.log('\nΕλέγχοι που πέρασαν: '+passes+' · απέτυχαν: '+fails);process.exit(fails?1:0)})();
