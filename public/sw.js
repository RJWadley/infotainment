//service worker for offline functionality

//on install cache resources
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open("cache").then(function (cache) {
      //add everything to cache
      return cache.addAll(["/index.html"]);
    })
  );
});

//on fetch, request from network
//if network success, add to cache
//if network fail, return from cache
self.addEventListener("fetch", function (e) {
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        return caches.open("cache").then(function (cache) {
          cache.put(e.request, res.clone());
          return res;
        });
      })
      .catch(function (err) {
        return caches.match(e.request);
      })
  );
});
