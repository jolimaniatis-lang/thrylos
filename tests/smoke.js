// Smoke tests: node tests/smoke.js  (needs playwright; serves the repo statically)
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});r.end(d)})});
const VIEWS=['news','games','live','roster'];const MENU_VIEWS=['vs','bet','chat'];const MT=['standings','scorers','discipline','rumors','quotes','amateur','archive'];const SIZES=[[360,780],[390,844],[430,932],[1280,800]];
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
 // 5-tab bar + Κι άλλα menu
 ok(await p.locator('.bar button').count()===5,'η κάτω μπάρα πρέπει να έχει 5 καρτέλες');
 const bb=await p.evaluate(()=>{const r=document.querySelector('.bar').getBoundingClientRect();return [r.left,r.right,r.bottom,innerWidth,innerHeight]});ok(bb[0]>=0&&bb[1]<=bb[3]+0.5&&bb[2]<=bb[4]+0.5,'η μπάρα βγαίνει εκτός οθόνης '+bb);
 for(const g of MENU_VIEWS){await p.click('#hubBtn');await p.waitForTimeout(300);ok(await p.evaluate(()=>!document.getElementById('more').hidden&&!!document.querySelector('.mm-i')),'το μενού δεν άνοιξε');
  await p.click('.mm-i[data-go="'+g+'"]');await p.waitForTimeout(500);const st=await p.evaluate(v=>{const e=document.getElementById(v);return !!e&&!e.hidden&&e.innerText.trim().length},g);ok(st>0,'μενού→'+g+' άδεια/κρυμμένη');
  ok(await p.evaluate(()=>document.querySelector('.bar button[data-v="more"]').getAttribute('aria-current')==='page'),'το «Κι άλλα» δεν είναι ενεργό στο '+g);await ovf('menu→'+g)}
 for(const k of MT){await p.click('.bar button[data-v="more"]');await p.waitForTimeout(250);ok(await p.locator('.mm-i').count()===10,'το μενού πρέπει να έχει 10 ενότητες');
  await p.click('.mm-i[data-go="'+k+'"]');await p.waitForTimeout(350);ok(await p.evaluate(()=>!document.getElementById('more').hidden&&!!document.querySelector('.mm-back')),'περιεχόμενο '+k+' / κουμπί πίσω');ok(await p.evaluate(()=>document.getElementById('more').innerText.length>20),'άδειο '+k);ok(await p.evaluate(k=>localStorage.getItem('thr_m')===k,k),'thr_m '+k);await ovf('more '+k)}
 await p.click('.mm-back');await p.waitForTimeout(250);ok(await p.locator('.mm-i').count()===10,'το «‹ Κι άλλα» δεν επέστρεψε στο μενού');
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
// touch (mobile emulation): bar + menu via tap
{console.log('== touch 390px (iPhone emulation)');const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});const p=await ctx.newPage();
 await ctx.route(/supabase\.co|euroleague\.net|incrowdsports/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await p.goto('http://localhost:'+port+'/');await p.waitForTimeout(1200);
 for(const v of ['games','live','roster','more','news']){await p.tap('.bar button[data-v="'+v+'"]');await p.waitForTimeout(350);ok(await p.evaluate(v=>document.querySelector('.bar button[data-v="'+v+'"]').getAttribute('aria-current')==='page',v),'touch: δεν ενεργοποιήθηκε '+v)}
 await p.tap('.bar button[data-v="more"]');await p.waitForTimeout(250);await p.tap('.mm-i[data-go="bet"]');await p.waitForTimeout(400);ok(await p.evaluate(()=>!document.getElementById('bet').hidden),'touch: μενού→bet');
 const sz=await p.evaluate(()=>[...document.querySelectorAll('.bar button')].map(b=>{const r=b.getBoundingClientRect();return Math.min(r.width,r.height)}));ok(sz.every(x=>x>=44),'touch targets <44px: '+sz.map(Math.round));
 await ctx.close()}
await b.close();srv.close();console.log(fails?'\nFAILED: '+fails:'\nALL PASSED');process.exit(fails?1:0)})();
