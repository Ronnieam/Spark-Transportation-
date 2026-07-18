const CACHE='spark-v3-0-3-embedded-locations';
const ASSETS=[
 './',
 'index.html',
 'style.css?v=3.0.3',
 'app.js?v=3.0.3',
 'manifest.json',
 'logo.png',
 'icon-192.png',
 'icon-512.png'
];

self.addEventListener('install',event=>{
 self.skipWaiting();
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
 ]));
});

self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 event.respondWith(
  fetch(event.request,{cache:'no-store'}).then(response=>{
   const copy=response.clone();
   caches.open(CACHE).then(cache=>cache.put(event.request,copy));
   return response;
  }).catch(()=>caches.match(event.request))
 );
});
