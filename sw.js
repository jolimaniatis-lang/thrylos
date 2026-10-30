const C="thr-v12",SH=["./","manifest.webmanifest","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","assets/gate7.jpg","assets/oly-football.jpg","assets/oly-basketball.jpg","assets/oly-amateur.png","assets/ball-football.png","assets/ball-basketball.png","assets/ball-polo.png","assets/ball-volleyball.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SH)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==location.origin)return;
// live match data is never cached: offline it must not show an old score as current
if(u.pathname.includes("/data/live/"))return;
const key=u.pathname.includes("/data/")?u.pathname:r;
e.respondWith(fetch(r).then(x=>{if(x.status===200){const y=x.clone();caches.open(C).then(c=>c.put(key,y))}return x}).catch(()=>caches.match(key).then(m=>m||(r.mode==="navigate"?caches.match("./"):Response.error()))))});
