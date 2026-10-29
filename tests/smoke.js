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
const AUDIT=()=>{
 const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).map(Number);return {r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1}};
 const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
 const over=(fg,bg)=>({r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a),a:1});
 const bgOf=el=>{let layers=[];for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);const c=parse(cs.backgroundColor);if(cs.backgroundImage!=='none'&&/gradient/.test(cs.backgroundImage))return {grad:true};if(c&&c.a>0){layers.push(c);if(c.a>=.99)break}}
  let base={r:255,g:255,b:255,a:1};const bb=parse(getComputedStyle(document.body).backgroundColor);if(bb&&bb.a>0)base=bb;for(let i=layers.length-1;i>=0;i--)base=over(layers[i],base);return base};
 const out={low:[],small:[],noname:[],nofocus:[],clickdiv:[],imgs:[],tap:[]};
 const vis=e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'};
 const seen=new Set();
 document.querySelectorAll('body *').forEach(e=>{if(!vis(e))return;
  const t=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join(' ');
  if(t){const cs=getComputedStyle(e);const fg=parse(cs.color);const bg=bgOf(e);const fs=parseFloat(cs.fontSize);
   if(bg&&!bg.grad&&fg){const f=over(fg,bg);const L1=lum(f),L2=lum(bg);const ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);const large=fs>=24||(fs>=18.66&&+cs.fontWeight>=700);
    const key=e.className+'|'+Math.round(ratio*10);if(ratio<(large?3:4.5)&&!seen.has(key)){seen.add(key);out.low.push([ratio.toFixed(2),fs,(e.className||e.tagName)+'',t.slice(0,30)])}}
   if(fs<12&&!seen.has('s'+e.className+fs)){seen.add('s'+e.className+fs);out.small.push([fs,(e.className||e.tagName)+'',t.slice(0,24)])}}
  const tag=e.tagName;
  if((tag==='BUTTON'||tag==='A'||e.getAttribute('role')==='button')){const name=(e.getAttribute('aria-label')||e.innerText||e.getAttribute('title')||'').trim();if(!name)out.noname.push((e.className||tag)+'|'+e.outerHTML.slice(0,80));
   const r=e.getBoundingClientRect();if(Math.min(r.width,r.height)<40&&!seen.has('t'+e.className)){seen.add('t'+e.className);out.tap.push([Math.round(r.width)+'x'+Math.round(r.height),(e.className||tag)+'',(e.innerText||'').slice(0,14)])}}
  if(tag==='IMG'&&!e.hasAttribute('alt'))out.imgs.push(e.src.slice(-30));
  const cur=getComputedStyle(e).cursor==='pointer';const focusable=e.tabIndex>=0||['BUTTON','A','INPUT','SELECT','TEXTAREA','LABEL','SUMMARY'].includes(tag);
  if(cur&&!focusable&&!e.closest('button,a,label,[role=button]')&&!seen.has('c'+e.className)){seen.add('c'+e.className);out.clickdiv.push((e.className||tag)+'|'+(e.innerText||'').slice(0,20))}
 });
 return out};
// accessibility checks (Phase 3)
{console.log('== a11y');
 for(const scheme of ['light','dark']){const ctx=await b.newContext({viewport:{width:390,height:844},colorScheme:scheme});const p=await ctx.newPage();
  await ctx.route(/supabase\.co|euroleague\.net|incrowdsports/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await p.goto('http://localhost:'+port+'/');await p.waitForTimeout(1200);
  for(const v of ['news','games','vs','bet','roster','more']){await p.evaluate(v=>{if(v==='more')mmenu=true;setView(v)},v);await p.waitForTimeout(450);const o=await p.evaluate(AUDIT);
   ok(o.low.length===0,scheme+' '+v+' χαμηλή αντίθεση: '+JSON.stringify(o.low.slice(0,3)));ok(o.noname.length===0,scheme+' '+v+' κουμπιά χωρίς όνομα');ok(o.imgs.length===0,scheme+' '+v+' εικόνες χωρίς alt');ok(o.clickdiv.length===0,scheme+' '+v+' κλικαμπλ στοιχεία χωρίς πληκτρολόγιο: '+JSON.stringify(o.clickdiv.slice(0,2)))}
  await ctx.close()}
 const ctx=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const p=await ctx.newPage();
 await ctx.route(/supabase\.co|euroleague\.net|incrowdsports/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await p.goto('http://localhost:'+port+'/');await p.waitForTimeout(1200);
 ok(await p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.hero')).animationDuration)<0.01),'reduced-motion: το animation του hero δεν σταμάτησε');
 // keyboard: games row + sources toggle
 await p.evaluate(()=>setView('games'));await p.waitForTimeout(500);await p.focus('.gm');await p.keyboard.press('Enter');ok(await p.evaluate(()=>document.querySelector('.gm').getAttribute('aria-expanded')==='true'),'games row: Enter δεν άνοιξε');
 await p.keyboard.press('Space');ok(await p.evaluate(()=>document.querySelector('.gm').getAttribute('aria-expanded')==='false'),'games row: Space δεν έκλεισε');
 await p.evaluate(()=>setView('news'));await p.waitForTimeout(500);
 if(await p.locator('.sec-h[role="button"]').count()){await p.focus('.sec-h[role="button"]');await p.keyboard.press('Enter');ok(await p.evaluate(()=>document.querySelector('.sec-h[role="button"]').getAttribute('aria-expanded')==='true'),'πηγές: Enter δεν άνοιξε')}
 // focus visible on header button (white ring on red) and on bar button
 await p.focus('#hubBtn');await p.keyboard.press('Shift+Tab');await p.keyboard.press('Tab');ok(await p.evaluate(()=>{const cs=getComputedStyle(document.activeElement);return cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>=2}),'focus ring λείπει στο header');
 // player sheet: focus trap + return focus
 await p.evaluate(()=>setView('roster'));await p.waitForTimeout(500);const pl=p.locator('#roster .pl').first();await pl.focus();await pl.press('Enter');await p.waitForTimeout(300);
 for(let i=0;i<25;i++)await p.keyboard.press('Tab');ok(await p.evaluate(()=>!!document.activeElement.closest('.sheet')),'player sheet: το focus ξέφυγε από το modal');
 await p.keyboard.press('Escape');await p.waitForTimeout(200);ok(await p.evaluate(()=>!!document.activeElement.closest('#roster .pl')),'player sheet: το focus δεν επέστρεψε στο κουμπί');
 await ctx.close()}
await b.close();srv.close();console.log(fails?'\nFAILED: '+fails:'\nALL PASSED');process.exit(fails?1:0)})();
