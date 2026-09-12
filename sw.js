/* Wikigacha — service worker.

   Trois raisons d'etre :
   1. rendre le jeu utilisable hors ligne (collection, albums, succes et mode
      histoire ne demandent aucun reseau : sans ce fichier, la page ne
      s'ouvrait meme pas) ;
   2. demarrer instantanement, sans attendre le reseau ;
   3. satisfaire la condition d'installabilite exigee pour l'empaquetage
      Play Store.

   Regle de prudence : rien de ce qui vient de l'API Wikipedia n'est mis en
   cache. Un tirage doit rester aleatoire et frais — servir une vieille
   reponse fausserait le jeu. Seules les IMAGES d'articles sont conservees,
   pour que la collection reste illustree hors ligne. */

var VERSION = 'wikigacha-v7';   /* a incrementer quand la liste change */
var COQUILLE = VERSION + '-coquille';   /* le jeu lui-meme */
var POLICES  = VERSION + '-polices';
var IMAGES   = 'wikigacha-images';      /* survit aux versions : c'est lourd */
var IMAGES_MAX = 400;

var A_PRECHARGER = [
  './',
  './index.html',
  './pont-pub.js',
  './pont-notif.js',
  './pont-achats.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(COQUILLE).then(function (c) {
      /* addAll echoue en bloc si une seule ressource manque : on tolere les
         absences pour ne jamais empecher l'installation. */
      return Promise.all(A_PRECHARGER.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' }))['catch'](function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.map(function (n) {
        if (n !== COQUILLE && n !== POLICES && n !== IMAGES) return caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* La page demande explicitement le passage a la nouvelle version. */
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'MAJ') self.skipWaiting();
});

/* Cache d'images borne : on jette les plus anciennes entrees. */
function bornerImages() {
  return caches.open(IMAGES).then(function (c) {
    return c.keys().then(function (ks) {
      if (ks.length <= IMAGES_MAX) return;
      return Promise.all(ks.slice(0, ks.length - IMAGES_MAX).map(function (k) {
        return c.delete(k);
      }));
    });
  });
}

function depuisCache(req, nom, borner) {
  return caches.match(req).then(function (rep) {
    if (rep) return rep;
    return fetch(req).then(function (net) {
      if (net && (net.ok || net.type === 'opaque')) {
        var copie = net.clone();
        caches.open(nom).then(function (c) {
          return c.put(req, copie);
        }).then(function () { if (borner) bornerImages(); });
      }
      return net;
    });
  });
}

function reseauDabord(req) {
  return fetch(req).then(function (net) {
    if (net && net.ok) {
      var copie = net.clone();
      caches.open(COQUILLE).then(function (c) { c.put(req, copie); });
    }
    return net;
  })['catch'](function () {
    return caches.match(req).then(function (rep) {
      return rep || caches.match('./index.html');
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  var hote = url.hostname;

  /* 1. Les appels de jeu : jamais de cache. Un paquet doit etre tire pour
        de bon, et un adversaire du jour doit etre celui du jour. */
  if (url.pathname.indexOf('/w/api.php') !== -1
      || url.pathname.indexOf('/api/rest_v1/') !== -1
      || hote === 'wikimedia.org') {
    return;   /* on laisse passer au reseau, sans interception */
  }

  /* 2. Les images d'articles : gardees, pour une collection illustree meme
        hors ligne. */
  if (hote === 'upload.wikimedia.org') {
    e.respondWith(depuisCache(req, IMAGES, true));
    return;
  }

  /* 3. Les polices : elles ne changent jamais. */
  if (hote === 'fonts.googleapis.com' || hote === 'fonts.gstatic.com') {
    e.respondWith(depuisCache(req, POLICES, false));
    return;
  }

  /* 4. Le jeu lui-meme : reseau d'abord pour recevoir les mises a jour,
        cache en secours quand il n'y a pas de reseau. */
  if (url.origin === self.location.origin) {
    e.respondWith(reseauDabord(req));
  }
});
