// Φάση 2: αξιοπιστία ένδειξης LIVE και σκορ «μη διαθέσιμο»: node tests/live_status.js
// Τα δεδομένα εδώ είναι ΜΟΝΟ προσομοιώσεις δοκιμής (route mock)· δεν γράφονται πουθενά.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';fs.readFile(path.join(root,p),(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});r.end(d)})});
const day=o=>{const d=new Date(Date.now()+o*864e5);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const iso=ms=>new Date(Date.now()+ms).toISOString();
const mk=(upd,status,sc,d)=>{const o={matches:[{id:'x1',sport:'basketball',comp:'Basket League',d,home:true,opp:'Δοκιμή',status,clock:'3η περίοδος',olyScore:sc,oppScore:sc==null?undefined:40}]};if(upd!==undefined)o.updatedAt=upd;return JSON.stringify(o)};
const M=60e3;
// [όνομα, updatedAt, status, σκορ, ημερομηνία αγώνα, αναμένεται LIVE;]
const CASES=[
 ['live + φρέσκο updatedAt',iso(-2*M),'live',50,day(0),true],
 ['ht + φρέσκο updatedAt',iso(-2*M),'ht',50,day(0),true],
 ['live + updatedAt 2 ώρες πριν',iso(-120*M),'live',50,day(0),false],
 ['live + updatedAt 31 λεπτά πριν',iso(-31*M),'live',50,day(0),false],
 ['live + updatedAt λείπει',undefined,'live',50,day(0),false],
 ['live + updatedAt άκυρο ("χθες το πρωί")','χθες το πρωί','live',50,day(0),false],
 ['live + updatedAt κενό','','live',50,day(0),false],
 ['live + updatedAt στο μέλλον (+3 ώρες)',iso(180*M),'live',50,day(0),false],
 ['live + φρέσκο updatedAt αλλά αγώνας προχθές',iso(-2*M),'live',50,day(-2),false],
 ['status άγνωστο ("inprogress") + φρέσκο updatedAt',iso(-2*M),'inprogress',50,day(0),false],
 ['status λείπει + φρέσκο updatedAt',iso(-2*M),undefined,50,day(0),false],
 ['ft + φρέσκο updatedAt',iso(-2*M),'ft',91,day(0),false],
 ['pre + φρέσκο updatedAt',iso(-2*M),'pre',null,day(0),false],
];
(async()=>{await new Promise(r=>srv.listen(0,r));const port=srv.address().port;const b=await chromium.launch();let f=0;const ok=(c,m)=>{if(!c){f++;console.log('FAIL',m)}else console.log('ok  ',m)};
for(const [name,upd,status,sc,d,expLive] of CASES){
 const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await ctx.route(/supabase\.co|euroleague\.net|incrowdsports/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await ctx.route(/\/data\/live\/now/,r=>r.fulfill({status:200,contentType:'application/json',body:mk(upd,status,sc,d)}));
 await p.goto('http://localhost:'+port+'/#live');await p.waitForTimeout(1400);
 const r=await p.evaluate(()=>({badgeLive:!!document.querySelector('#live .st-badge.live'),stale:!!document.querySelector('#live .st-badge.stale'),bar:document.querySelector('#live .lc-bar')?document.querySelector('#live .lc-bar').innerText:'',liveBtn:(document.querySelector('#live [data-f=status] button:nth-child(2) .n')||{}).textContent}));
 const conf=/σε εξέλιξη/.test(r.bar)&&!r.stale;ok(conf===expLive&&(!expLive||status==='ht'||r.badgeLive),name+' → '+(expLive?'LIVE':'ΟΧΙ live')+' (badge='+r.badgeLive+')');
 await p.goto('http://localhost:'+port+'/');await p.waitForTimeout(1200);
 const banner=await p.evaluate(()=>!!document.querySelector('#next .nmlive'));
 ok(banner===expLive,'   banner αρχικής '+(expLive?'εμφανίζεται':'ΔΕΝ εμφανίζεται'));
 if(!expLive&&(status==='live'||status==='ht')&&d===day(0)&&upd){ // ανεπιβεβαίωτο: ρητή ένδειξη
   await p.goto('http://localhost:'+port+'/#live');await p.waitForTimeout(1000);
   ok(await p.evaluate(()=>!!document.querySelector('#live .st-badge.stale')),'   δείχνει «Εκκρεμεί επιβεβαίωση»')}
 if(sc==null&&status==='live'){await p.goto('http://localhost:'+port+'/#live');await p.waitForTimeout(800);const t=await p.evaluate(()=>document.querySelector('#live .sc')?document.querySelector('#live .sc').innerText.replace(/\s+/g,''):'');ok(/^–/.test(t),'   σκορ που λείπει = «–» ('+t+')')}
 ok(errs.length===0,'   χωρίς σφάλμα JS');
 await ctx.close()}
// προσεχείς/ολοκληρωμένοι από το ημερολόγιο δεν είναι ποτέ LIVE, ακόμη κι αν το live/now είναι φρέσκο
{const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();
 await ctx.route(/supabase\.co|euroleague\.net|incrowdsports/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await ctx.route(/\/data\/live\/now/,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({updatedAt:iso(-1*M),matches:[]})}));
 await p.goto('http://localhost:'+port+'/#live');await p.waitForTimeout(1500);
 const r=await p.evaluate(()=>({rows:document.querySelectorAll('#live .lc-row').length,live:document.querySelectorAll('#live .st-badge.live').length,bad:[...document.querySelectorAll('#live .lc-row .st-badge')].filter(e=>!/ΠΡΟΣΕΧΩΣ|ΤΕΛΙΚΟ|ΧΩΡΙΣ ΣΚΟΡ/.test(e.textContent)).length}));
 ok(r.rows>5&&r.live===0&&r.bad===0,'ημερολόγιο (προσεχείς/ολοκληρωμένοι): '+r.rows+' αγώνες, κανένας LIVE');await ctx.close()}
await b.close();srv.close();console.log(f?'\nΑΠΟΤΥΧΙΕΣ: '+f:'\nΟΛΑ ΠΕΡΑΣΑΝ');process.exit(f?1:0)})();
