const CACHE_NAME = 'vibecheck-bundle-v5';

// Daftar seluruh aset inti yang akan dicache satu per satu
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Poppins:wght@600;700;800&display=swap'
];

// 1. INSTALASI: Teknik "Satu per satu" (Toleran Kesalahan)
self.addEventListener('install', event => {
  self.skipWaiting(); // Langsung aktifkan versi terbaru
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Jika satu file gagal di-cache, file lain tetap aman dan aplikasi tidak crash
      CORE_ASSETS.forEach(url => {
        cache.add(url).catch(err => console.warn("[PWA] Gagal cache aset:", url));
      });
    })
  );
});

// 2. AKTIVASI: Pembersihan Cache Lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[PWA] Menghapus cache versi lama:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH: Strategi "Network First, lalu Fallback ke Cache"
self.addEventListener('fetch', event => {
  // Hanya proses pengambilan data (GET), abaikan ekstensi/plugin browser
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Jika sedang online, simpan/perbarui file ke dalam cache untuk cadangan offline
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Jika OFFLINE (internet terputus), langsung ambil dari memori HP
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Jika file benar-benar tidak ada di cache (misal pindah halaman), kembalikan ke UI utama
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
