// Φάση 2: επιβεβαίωση LIVE και σκορ «μη διαθέσιμο»: node tests/live_status.js
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';fs.readFile(path.join(root,p),(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});r.end(d)})});
(async()=>{await new Promise(r=>srv.listen(0,r));const port=srv.address().port;const b=await chromium.launch();let f=0;const ok=(c,m)=>{if(!c){f++;console.log('FAIL',m)}else console.log('ok  ',m)};
const mk=(upd,status,sc)=>JSON.stringify({updatedAt:upd,matches:[{id:'x1',sport:'basketball',comp:'Basket League',d:new Date().toISOString().slice(0,10),home:true,opp:'Δοκιμή',status,clock:"3η περίοδος",olyScore:sc,oppScore:sc==null?undefined:40}]});
for(const [name,upd,status,sc,expect] of [['φρέσκο live',new Date().toISOString(),'live',50,'LIVE'],['παλιό live (2 ώρες)',new Date(Date.now()-2*3600e3).toISOString(),'live',50,'ΕΚΚΡΕΜΕΙ'],['live χωρίς σκορ',new Date().toISOString(),'live',null,'LIVE']]){
 const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();
 await ctx.route(/supabase\.co|euroleague\.net|incrowdsports/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await ctx.route(/\/data\/live\/now/,r=>r.fulfill({status:200,contentType:'application/json',body:mk(upd,status,sc)}));
 await p.goto('http://localhost:'+port+'/#live');await p.waitForTimeout(1500);
 const t=await p.evaluate(()=>document.getElementById('live').innerText);const sc2=await p.evaluate(()=>document.querySelector('#live .sc')?document.querySelector('#live .sc').innerText.replace(/\s+/g,''):'');
 ok(t.includes(expect),name+' → '+expect+' | σκορ '+sc2);if(sc==null)ok(sc2.startsWith('–')&&!/^0/.test(sc2),'σκορ που λείπει = «–», όχι 0 ('+sc2+')');
 if(expect==='ΕΚΚΡΕΜΕΙ'){ok(/Τελευταία γνωστή/.test(t),'δείχνει τελευταία γνωστή κατάσταση');await p.goto('http://localhost:'+port+'/');await p.waitForTimeout(1200);ok(!(await p.evaluate(()=>!!document.querySelector('#next .nmlive'))),'το banner Live της αρχικής ΔΕΝ εμφανίζεται για ανεπιβεβαίωτο live')}
 await ctx.close()}
await b.close();srv.close();process.exit(f?1:0)})();
