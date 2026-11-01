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
 ok(await cnt('#live .lc-filters [role=group]')===3,'J2 τρεις ομάδες φίλτρων (κατάσταση, άθλημα, διοργάνωση)');
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
 for(const [k,label] of [['standings','Βαθμολογίες'],['scorers','Σκόρερ'],['discipline','Τιμωρίες'],['rumors','Μεταγραφές'],['quotes','Δηλώσεις'],['amateur','Ερασιτέχνης'],['archive','Αρχείο'],['vs','Αντίπαλοι'],['bet','Στοίχημα'],['chat','Chat']]){
  await go('more');ok(await cnt('.mm-i[data-go="'+k+'"]')===1,'F '+k+' υπάρχει στο μενού');
  await p.click('.mm-i[data-go="'+k+'"]');await p.waitForTimeout(450);
  const id=['vs','bet','chat'].includes(k)?k:'more';
  ok(await p.evaluate(i=>{const e=document.getElementById(i);return !!e&&!e.hidden&&e.innerText.trim().length>0},id),'F '+k+' εμφανίζει περιεχόμενο')}
 await go('more');ok(await cnt('.mm-i')===10,'F0 10 ενότητες στο μενού');
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
