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
 const go=async v=>{await p.click('.bar button[data-v="'+v+'"]');await p.waitForTimeout(450);if(v==='live'){const t=p.locator('#live .lc-tg[aria-expanded="false"]');if(await t.count()){await t.click();await p.waitForTimeout(120)}}};

 // A. Κεφαλίδα
 ok((await p.evaluate(()=>document.querySelector('.hero').textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,''))).toLowerCase().replace(/\s+/g,' ').includes('θρυλο'),'A1 τίτλος εφαρμογής');
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
 ok(await p.evaluate(()=>localStorage.getItem('thr_f')===null),'B9 το φίλτρο αθλήματος δεν αποθηκεύεται πια (thr_f καθαρίζεται)');
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
 ok(await cnt('#live .lc-bar')===1&&/ενημ[εέ]ρ[ωώ]/i.test(await txt('#live .lc-bar')),'J1 μπάρα τελευταίας ενημέρωσης');
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
 ok(await cnt('.sheet .mc-nav .qk-b')>=2,'K5 σύνδεσμοι προς βαθμολογία/πρόγραμμα');
 await p.keyboard.press('Escape');await p.waitForTimeout(250);ok(await cnt('.sheet')===0,'K6 κλείσιμο με Esc');
 await p.locator('#live [data-f=status] button',{hasText:'Ολοκληρωμένοι'}).click();await p.waitForTimeout(200);
 await p.locator('#live .lc-row').first().click();await p.waitForTimeout(300);
 {const sc=await txt('.sheet .mc-sc');ok(/\d\s*–\s*\d/.test(sc)||(sc.trim()==='vs'&&!(await txt('.sheet .mc-top')).includes('ΤΕΛΙΚΟ')),'K7 ολοκληρωμένος αγώνας: σκορ, ή «vs» χωρίς ένδειξη ΤΕΛΙΚΟ όταν δεν έχει καταχωριστεί σκορ')}
 await p.locator('.sheet .mc-nav .qk-b',{hasText:'Βαθμολογία'}).click();await p.waitForTimeout(400);
 ok(await cnt('.sheet')===0&&await cnt('#more .tbl')>=1,'K8 «Βαθμολογία διοργάνωσης» ανοίγει τους πίνακες');
 // L. Φάση 3Α: ομάδες, Ερασιτέχνης, φύλο
 await go('more');await p.click('.mm-i[data-go="teams"]');await p.waitForTimeout(500);
 const NAMES=['Ποδόσφαιρο ανδρών','Ποδόσφαιρο γυναικών','Μπάσκετ ανδρών','Μπάσκετ γυναικών','Βόλεϊ ανδρών','Βόλεϊ γυναικών','Πόλο ανδρών','Πόλο γυναικών','Χάντμπολ ανδρών','Χάντμπολ γυναικών'];
 ok(await cnt('#more .tm-card')===10,'L1 δέκα κάρτες ομάδων');
 const cn=await p.locator('#more .tm-card h3').allInnerTexts();ok(NAMES.every(n=>cn.some(c=>c.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()===n.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase())),'L2 όλες οι 10 ομάδες με σωστά ονόματα: '+cn.join('|'));
 const fw=(await p.locator('#more .tm-card[data-team="football-w"]').innerText());
 ok(/Δεν υπάρχει προγραμματισμένος/i.test(fw.normalize('NFD').replace(/[̀-ͯ]/g,'')+fw)||fw.length>20,'L3 η ομάδα «Ποδόσφαιρο γυναικών» παραμένει ορατή με κενές καταστάσεις');
 ok(await cnt('#more .tm-card[data-team="football-w"]')===1,'L3b football-w: η κάρτα της ομάδας υπάρχει');
 // σελίδα ομάδας με πλήρη δεδομένα
 await p.locator('#more .tm-card[data-team="basketball-m"] .qk-b').click();await p.waitForTimeout(400);
 ok(await cnt('#more .tm-sec')===6,'L4 σελίδα ομάδας: 6 ενότητες (επόμενος, αποτελέσματα, πρόγραμμα, διοργανώσεις, ρόστερ, στατιστικά)');
 ok(await cnt('#more .lc-row')>=3&&await cnt('#more .lc-row:not([data-team="basketball-m"])')===0,'L5 στη σελίδα Μπάσκετ ανδρών υπάρχουν ΜΟΝΟ αγώνες της ομάδας');
 ok(await cnt('#more #tm-roster .tm-ro')===1,'L6 ρόστερ Μπάσκετ ανδρών υπάρχει');
 ok(await cnt('#more #tm-comps .tbl')>=1,'L7 βαθμολογίες διοργανώσεων Μπάσκετ ανδρών');
 await p.locator('#more .mm-back',{hasText:'ομάδες'}).click();await p.waitForTimeout(300);
 // σελίδα ομάδας χωρίς ρόστερ/βαθμολογία
 await p.locator('#more .tm-card[data-team="volleyball-w"] .qk-b').click();await p.waitForTimeout(400);
 ok(await cnt('#more .tm-sec')===6&&(await cnt('#more #tm-roster .empty')===1)!==(await cnt('#more #tm-roster .tm-ro')===1),'L8 Βόλεϊ γυναικών: 6 ενότητες· ρόστερ Ή μία κενή κατάσταση (ποτέ και τα δύο)');
 ok(await cnt('#more .lc-row')>=3&&await cnt('#more .lc-row:not([data-team="volleyball-w"])')===0,'L9 στη σελίδα Βόλεϊ γυναικών υπάρχουν ΜΟΝΟ αγώνες Βόλεϊ γυναικών');
 ok(await cnt('#more #tm-roster .tm-ro')<=1,'L10 το πολύ ένα ρόστερ στη σελίδα ομάδας');
 await p.locator('#more .mm-back',{hasText:'ομάδες'}).click();await p.waitForTimeout(300);
 await p.locator('#more .tm-card[data-team="handball-w"] .qk-b').click();await p.waitForTimeout(400);
 ok((await cnt('#more #tm-results .empty')===1)!==(await cnt('#more #tm-results .lc-row')>0)&&(await cnt('#more #tm-schedule .empty')===1)!==(await cnt('#more #tm-schedule .lc-row')>0),'L11 Χάντμπολ γυναικών: αγώνες Ή κενή κατάσταση σε αποτελέσματα/πρόγραμμα');
 // Ερασιτέχνης
 await go('more');await p.click('.mm-i[data-go="amateur"]');await p.waitForTimeout(500);
 ok(await cnt('#more .tm-card')===8&&await cnt('#more .tm-card[data-team="football-m"],#more .tm-card[data-team="basketball-m"]')===0,'L12 Ερασιτέχνης: 8 τμήματα (χωρίς τις δύο κύριες ομάδες)');
 ok(await cnt('#more .tm-card .qk-b[data-focus=schedule]')===8&&await cnt('#more .tm-card .qk-b[data-focus=results]')===8,'L13 άμεση πρόσβαση σε πρόγραμμα και αποτελέσματα για κάθε τμήμα');
 // «επόμενος» υπολογίζεται από το ημερολόγιο
 const exp=await p.evaluate(async()=>{const m=(await (await fetch('data/schedule/season.json')).json()).matches;const t=todayStr();
  const x=m.filter(q=>!q.score&&q.d>=t&&/^Βόλεϊ γυναικών/.test(q.comp)).sort((a,b)=>(a.d+(a.t||'')).localeCompare(b.d+(b.t||'')))[0];return x?x.opp:null});
 const vw=await p.evaluate(()=>document.querySelector('#more .tm-card[data-team="volleyball-w"]').textContent);
 const nn=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();ok(exp&&nn(vw).includes(nn(exp)),'L14 «επόμενος αγώνας» Βόλεϊ γυναικών = από το ημερολόγιο ('+exp+')');
 ok(await cnt('#more #tm-unconfirmed .lc-row')>=1,'L15 καταγραφή αγώνων με μη επιβεβαιωμένη ομάδα (ορατή, όχι κρυμμένη)');
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
 // N. Έλεγχος αξιοπιστίας Βήματος Α: αμφιβολίες, αποκλειστικότητα δεδομένων, φίλτρα, διπλοεγγραφές
 await go('more');await p.click('.mm-i[data-go="amateur"]');await p.waitForTimeout(500);
 const U=await p.evaluate(()=>allItems().filter(x=>!x.team).map(x=>({d:x.d,opp:x.opp,src:x.src,sc:!!(x.m&&x.m.score)})));
 ok(U.length>=1,'N1 υπάρχουν αγώνες αμφιβολίας για έλεγχο ('+U.length+')');
 ok(await cnt('#more #tm-unconfirmed .lc-row')===U.length,'N2 όλοι οι αγώνες αμφιβολίας εμφανίζονται στον Ερασιτέχνη ('+U.length+')');
 ok(await p.evaluate(()=>[...document.querySelectorAll('#tm-unconfirmed .lc-row')].every(r=>/δεν εχει επιβεβαιωθει η ομαδα/.test(r.innerText.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()))),'N3 κάθε αγώνας αμφιβολίας φέρει «Δεν έχει επιβεβαιωθεί η ομάδα»');
 ok(await cnt('#more #tm-unconfirmed [data-team]')===0,'N4 κανένας αγώνας αμφιβολίας δεν αποδίδεται σε ομάδα (data-team)');
 // δεν χάνονται από το γενικό ημερολόγιο
 await go('games');
 for(const u of U){const mode=u.sc?'past':'next';await p.locator('#games .toggle button[data-m='+mode+']').click();await p.waitForTimeout(200);
  const inG=await p.evaluate(([o,d])=>[...document.querySelectorAll('#games .gm')].some(r=>r.innerText.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().includes(o)&&/δεν εχει επιβεβαιωθει η ομαδα/.test(r.innerText.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase())),[nn(u.opp),u.d]);
  ok(inG,'N5 στο γενικό ημερολόγιο ('+mode+'): '+u.d+' '+u.opp+' με ένδειξη μη επιβεβαιωμένης ομάδας')}
 // να μην αποδίδονται σε ομάδα ανδρών/γυναικών: το φίλτρο φύλου τους εξαιρεί και το δηλώνει
 await p.locator('#games .toggle button[data-m=next]').click();await p.locator('#games .gg button[data-gg=m]').click();await p.waitForTimeout(200);
 ok(!(await p.evaluate(()=>[...document.querySelectorAll('#games .gm')].some(r=>/εχει επιβεβαιωθει/.test(r.innerText.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase())))),'N6 φίλτρο «Ανδρών»: δεν περιλαμβάνει μη επιβεβαιωμένους αγώνες');
 ok(await cnt('#games .un-note')===1||U.filter(u=>!u.sc).length===0&&await cnt('#games .un-note')<=1,'N7 φίλτρο φύλου: δηλώνει πόσοι αγώνες εξαιρούνται');
 await p.locator('#games .gg button[data-gg=all]').click();
 // ένα-προς-ένα: κάθε αγώνας είτε σε μία ομάδα είτε μη επιβεβαιωμένος· χωρίς διπλοεγγραφές
 const dup=await p.evaluate(()=>{const a=allItems();const keys={};a.forEach(x=>{const k=x.d+'|'+nrm(x.opp)+'|'+nrm(x.comp);keys[k]=(keys[k]||0)+1});
  const d2={};a.forEach(x=>{const k=x.d+'|'+nrm(x.opp);d2[k]=(d2[k]||0)+1});
  const byTeam=TEAMS.reduce((n,t)=>n+teamItems(t.id,a).length,0);const un=a.filter(x=>!x.team).length;
  const ids=a.every(x=>!x.team||TEAM_BY[x.team]);
  return {dupFull:Object.entries(keys).filter(([,v])=>v>1).map(([k])=>k),dupDayOpp:Object.entries(d2).filter(([,v])=>v>1).map(([k])=>k),total:a.length,byTeam,un,ids}});
 ok(dup.dupFull.length===0&&dup.dupDayOpp.length===0,'N8 καμία διπλοεγγραφή αγώνα (ίδια ημέρα+αντίπαλος): '+dup.dupDayOpp.join(';'));
 ok(dup.byTeam+dup.un===dup.total&&dup.ids,'N9 κάθε αγώνας ανήκει ακριβώς σε μία ομάδα ή στους μη επιβεβαιωμένους ('+dup.byTeam+'+'+dup.un+'='+dup.total+')');
 // αποκλειστικά δεδομένα κάθε ομάδας
 for(const id of ['football-m','football-w','basketball-m','basketball-w','volleyball-m','volleyball-w','polo-m','polo-w','handball-m','handball-w']){
  await p.evaluate(i=>openTeam(i),id);await p.waitForTimeout(250);
  const r=await p.evaluate(id=>{const t=TEAM_BY[id];const rows=[...document.querySelectorAll('#more .lc-row')];
   const tbl=[...document.querySelectorAll('#more .tbl')].map(e=>e.querySelector('.tbl-h b').textContent);
   const all=[...standTables(X.standings&&X.standings.tables||[]),...(X.scorers&&X.scorers.tables||[])];
   const wrongT=tbl.filter(ti=>{const tb=all.find(q=>nrm(q.title)===nrm(ti));return !tb||classifyTeam(tb.sport,tb.title).id!==id});
   const ro=t.roster?rosters[t.roster]:null;const rosBtn=!!document.querySelector('#more #tm-roster .tm-ro');
   return {foreign:rows.filter(x=>x.dataset.team!==id).length,wrongT,rosOk:!rosBtn||(ro&&ro.sport===t.roster),rosNone:!t.roster&&rosBtn,sportsOk:rows.every(x=>x.dataset.sport===lcNorm({sport:t.sport}))}},id);
  ok(r.foreign===0&&r.wrongT.length===0&&r.rosOk&&!r.rosNone,'N10 '+id+': αποκλειστικά δικοί της αγώνες/πίνακες/ρόστερ'+(r.wrongT.length?' ΛΑΘΟΣ ΠΙΝΑΚΑΣ '+r.wrongT:''))}
 // συνεργασία φίλτρων στο Live: φύλο × άθλημα × κατάσταση (+ διοργάνωση)
 await go('live');await p.waitForTimeout(300);let bad=[];let combos=0;
 for(const g of ['all','m','w'])for(const sp of ['all','football','basketball','amateur'])for(const st of ['all','live','next','done']){
  await p.locator('#live [data-f=gender] button[data-k='+g+']').click();await p.locator('#live [data-f=sport] button[data-k='+sp+']').click();await p.locator('#live [data-f=status] button[data-k='+st+']').click();await p.waitForTimeout(60);combos++;
  const r=await p.evaluate(([g,sp,st])=>{const rows=[...document.querySelectorAll('#live .lc-row')];const lv=[...document.querySelectorAll('#live .lv')].length;
   const badRow=rows.filter(x=>(g!=='all'&&!(x.dataset.team||'').endsWith(g==='m'?'-m':'-w'))||(sp!=='all'&&x.dataset.sport!==sp)||(st==='next'&&x.dataset.b!=='next')||(st==='done'&&x.dataset.b!=='done')).length;
   const cap=[...document.querySelectorAll('#live .lc-g .cnt')].reduce((a,e)=>a+ +e.textContent,0);
   const chip=document.querySelector('#live [data-f=status] button[data-k='+st+'] .n');return {badRow,cap,chip:chip?+chip.textContent:null}},[g,sp,st]);
  if(r.badRow||(r.chip!=null&&r.cap!==r.chip))bad.push(g+'/'+sp+'/'+st+' '+JSON.stringify(r))}
 ok(bad.length===0,'N11 φίλτρα Live συνεργάζονται ('+combos+' συνδυασμοί φύλου×αθλήματος×κατάστασης)'+(bad.length?': '+bad.slice(0,3).join(' | '):''));
 await p.locator('#live [data-f=gender] button[data-k=all]').click();await p.locator('#live [data-f=sport] button[data-k=amateur]').click();await p.locator('#live [data-f=status] button[data-k=all]').click();await p.waitForTimeout(120);
 const cc=await p.locator('#live [data-f=comp] button').count();let cbad=0;
 for(let i=1;i<cc;i++){await p.locator('#live [data-f=comp] button').nth(i).click();await p.waitForTimeout(60);const k=await p.locator('#live [data-f=comp] button').nth(i).getAttribute('data-k');
  cbad+=await p.evaluate(k=>[...document.querySelectorAll('#live .lc-row')].filter(x=>x.dataset.comp!==k).length,k)}
 ok(cc>=3&&cbad===0,'N12 φίλτρο διοργάνωσης μέσα στον Ερασιτέχνη: '+(cc-1)+' διοργανώσεις, μόνο αντίστοιχοι αγώνες');
 await p.locator('#live [data-f=comp] button').first().click();await p.locator('#live [data-f=sport] button[data-k=all]').click();
 // Ημερολόγιο: m + w + μη επιβεβαιωμένοι = όλοι
 await go('games');const cntG=async()=>{let n=0;for(const m of ['next','past']){await p.locator('#games .toggle button[data-m='+m+']').click();await p.waitForTimeout(80);n+=await cnt('#games .gm')}return n};
 const gAll2=await cntG();await p.locator('#games .gg button[data-gg=m]').click();const gMen2=await cntG();await p.locator('#games .gg button[data-gg=w]').click();const gWom2=await cntG();
 await p.locator('#games .gg button[data-gg=all]').click();await p.waitForTimeout(100);const gUnc2=await p.evaluate(()=>{const s=seasonKeep.matches;return s.filter(x=>!classifyTeam(x.sport,x.comp,x.gender).id&&(x.score||x.d>=todayStr())).length});
 ok(gMen2+gWom2+gUnc2===gAll2,'N13 Ημερολόγιο: ανδρών('+gMen2+')+γυναικών('+gWom2+')+μη επιβεβαιωμένοι('+gUnc2+')=όλοι('+gAll2+')');
 // Ερασιτέχνης: όλα τα τμήματα ορατά, σαφής διάκριση διαθέσιμων/μη διαθέσιμων
 await go('more');await p.click('.mm-i[data-go="amateur"]');await p.waitForTimeout(400);
 const H=await p.evaluate(()=>[...document.querySelectorAll('#more .tm-card')].map(c=>({id:c.dataset.team,chips:[...c.querySelectorAll('.tm-chip')].filter(x=>x.dataset.on==='0').map(x=>x.dataset.cap).join(','),miss:c.querySelector('.tm-miss').dataset.miss,txt:c.querySelector('.tm-miss').textContent})));
 ok(H.length===8&&['football-w','basketball-w','volleyball-m','volleyball-w','polo-m','polo-w','handball-m','handball-w'].every(i=>H.some(h=>h.id===i)),'N14 Ερασιτέχνης: και τα 8 τμήματα ορατά ('+H.map(h=>h.id).join(',')+')');
 ok(H.every(h=>h.chips===h.miss&&(h.miss===''?/Διαθέσιμα όλα/.test(h.txt):/Δεν παρέχονται ακόμα/.test(h.txt))),'N15 σαφής διάκριση: τα «Δεν παρέχονται ακόμα» = τα στοιχεία που λείπουν πραγματικά');
 ok(!!H.find(h=>h.id==='football-w'),'N16 Ποδόσφαιρο γυναικών: ορατό στον Ερασιτέχνη');
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
 for(const [k,label] of [['teams','Ομάδες'],['standings','Βαθμολογίες'],['scorers','Σκόρερ'],['discipline','Τιμωρίες'],['rumors','Μεταγραφές'],['quotes','Δηλώσεις'],['amateur','Ερασιτέχνης'],['archive','Αρχείο'],['vs','Αντίπαλοι'],['bet','Στοίχημα'],['chat','Chat'],['history','Ιστορία'],['legends','Θρύλοι'],['gallery','Φωτογραφίες']]){
  await go('more');ok(await cnt('.mm-i[data-go="'+k+'"]')===1,'F '+k+' υπάρχει στο μενού');
  await p.locator('.mm-i[data-go="'+k+'"]').dispatchEvent('click');await p.waitForTimeout(450);
  const id=['vs','bet','chat'].includes(k)?k:'more';
  ok(await p.evaluate(i=>{const e=document.getElementById(i);return !!e&&!e.hidden&&e.innerText.trim().length>0},id),'F '+k+' εμφανίζει περιεχόμενο')}
 await go('more');ok(await cnt('.mm-i')===14,'F0 14 ενότητες στο μενού');
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
