//service worker for offline functionality

//on install cache resources
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open("cache-v1").then(function (cache) {
      //add everything to cache
      return cache.addAll(["/index.html"]);
    })
  );
});

self.addEventListener("fetch", function (e) {
  e.respondWith(
    fetch(e.request).catch(function () {
      return caches.match(e.request);
    })
  );
});
