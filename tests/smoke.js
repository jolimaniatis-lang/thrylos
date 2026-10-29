// Smoke tests: node tests/smoke.js  (needs playwright; serves the repo statically)
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});r.end(d)})});
const VIEWS=['news','games','vs','bet','live','chat','roster'];const SIZES=[[360,780],[390,844],[430,932],[1280,800]];
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('  FAIL',m)}};
(async()=>{await new Promise(r=>srv.listen(0,r));const port=srv.address().port;const b=await chromium.launch();
for(const [w,h] of SIZES){console.log('== '+w+'px');const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts\.g|ERR_|Failed to load resource|supabase|euroleague|incrowd/.test(m.text()+m.location().url))errs.push(m.text())});
 await ctx.route(/supabase\.co|euroleague\.net|incrowdsports/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await p.goto('http://localhost:'+port+'/');await p.waitForTimeout(1500);
 const ovf=async(t)=>{const o=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);ok(o<=1,t+': οριζόντιο overflow '+o+'px')};
 await ovf('home');
 for(const v of VIEWS){await p.click('.bar button[data-v="'+v+'"]');await p.waitForTimeout(500);
  const st=await p.evaluate(v=>{const e=document.getElementById(v==='news'?'app':v);return !!e&&!e.hidden&&e.innerText.trim().length},v);ok(st>0,'view '+v+' άδεια/κρυμμένη');await ovf('view '+v)}
 // more hub tabs
 await p.click('#hubBtn');await p.waitForTimeout(500);ok(await p.evaluate(()=>!document.getElementById('more').hidden),'hub δεν άνοιξε');
 for(const t of ['Βαθμολογίες','Σκόρερ','Τιμωρίες','Μεταγραφές','Δηλώσεις','Ερασιτέχνης','Αρχείο']){const bt=p.locator('button.tab',{hasText:t}).first();if(await bt.count()){await bt.click();await p.waitForTimeout(250);await ovf('more '+t)}else ok(false,'tab '+t+' λείπει')}
 // roster + player sheet
 await p.click('.bar button[data-v="roster"]');await p.waitForTimeout(400);const pl=p.locator('#roster .pl').first();
 if(await pl.count()){await pl.click();await p.waitForTimeout(300);ok(await p.locator('.sheet').count()===1,'φύλλο παίκτη');await ovf('player sheet');await p.keyboard.press('Escape');ok(await p.locator('.sheet').count()===0,'το φύλλο δεν έκλεισε')}else ok(false,'ρόστερ χωρίς παίκτες');
 // theme toggle
 const t0=await p.evaluate(()=>document.documentElement.dataset.theme||'');await p.click('#themeBtn');const t1=await p.evaluate(()=>document.documentElement.dataset.theme||'');ok(t0!==t1,'theme toggle');
 // sport filters on news
 await p.click('.bar button[data-v="news"]');await p.waitForTimeout(300);const tabs=p.locator('#tabs button');const n=await tabs.count();ok(n>=4,'φίλτρα αθλημάτων: '+n);if(n>1){await tabs.nth(1).click();await p.waitForTimeout(200);await ovf('filter')}
 ok(await p.evaluate(()=>!!document.querySelector('link[rel=manifest]')),'manifest link');
 if(errs.length){fails++;console.log('  ERRORS:',errs.slice(0,5))}
 console.log(errs.length?'  ✗':'  ✓ ok');await ctx.close()}
await b.close();srv.close();console.log(fails?'\nFAILED: '+fails:'\nALL PASSED');process.exit(fails?1:0)})();
