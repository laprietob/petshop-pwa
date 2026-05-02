// ============================================================
// PetShop PWA — Service Worker
// Estrategia: Cache First para assets, Network First para API
// ============================================================

const CACHE_VERSION = "v1.0.0";
const CACHE_STATIC = `petshop-static-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `petshop-dynamic-${CACHE_VERSION}`;
const CACHE_API = `petshop-api-${CACHE_VERSION}`;

// Archivos que se cachean en la instalación (obligatorios para offline)
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/public/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// URLs de API que se cachean para offline
const API_CACHE_PATTERNS = [
  /\/api\/products/
];

// ─── INSTALL ────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando versión:", CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log("[SW] Cacheando assets estáticos");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Error cacheando algunos assets:", err);
        // No fallar la instalación si algún asset no carga
      });
    }).then(() => {
      console.log("[SW] Instalación completada");
      return self.skipWaiting(); // Activar inmediatamente
    })
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activando versión:", CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Eliminar cachés de versiones anteriores
            return (
              name.startsWith("petshop-") &&
              !name.includes(CACHE_VERSION)
            );
          })
          .map((name) => {
            console.log("[SW] Eliminando caché antigua:", name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log("[SW] Activación completa");
      return self.clients.claim(); // Tomar control inmediatamente
    })
  );
});

// ─── FETCH ──────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones no-GET y extensiones de desarrollo
  if (request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;
  if (url.hostname === "localhost" && url.port !== "" && url.pathname.includes("/__")) return;

  // ── API calls: Network First (con fallback a caché)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // ── Assets estáticos: Cache First (con fallback a red)
  event.respondWith(cacheFirstStatic(request));
});

// Estrategia: Network First para API
async function networkFirstAPI(request) {
  const url = new URL(request.url);

  try {
    const networkResponse = await fetchWithTimeout(request, 5000);

    if (networkResponse.ok) {
      // Solo cachear GET de productos (no datos de usuario)
      const shouldCache = API_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname));
      if (shouldCache) {
        const cache = await caches.open(CACHE_API);
        cache.put(request, networkResponse.clone());
      }
    }

    return networkResponse;
  } catch (err) {
    console.warn("[SW] API offline, buscando en caché:", url.pathname);

    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Respuesta offline por defecto para la API
    return new Response(
      JSON.stringify({
        error: "Sin conexión",
        offline: true,
        message: "Datos no disponibles sin internet"
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

// Estrategia: Cache First para assets estáticos
async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Actualizar en segundo plano (stale-while-revalidate)
    updateCache(request);
    return cached;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // Fallback al index.html para rutas de la SPA
    const fallback = await caches.match("/index.html");
    if (fallback) return fallback;

    return new Response("Sin conexión — Abre la app con internet primero", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

// Actualizar caché en segundo plano
async function updateCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, networkResponse);
    }
  } catch {
    // Silencioso — ya tenemos el dato en caché
  }
}

// Fetch con timeout
function fetchWithTimeout(request, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeout);
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// ─── BACKGROUND SYNC ────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-cart") {
    console.log("[SW] Sincronizando carrito...");
    event.waitUntil(syncCart());
  }
});

async function syncCart() {
  try {
    const cache = await caches.open("petshop-pending");
    const requests = await cache.keys();
    for (const request of requests) {
      const cached = await cache.match(request);
      const body = await cached.json();
      await fetch("/api/cart?action=save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": body.token },
        body: JSON.stringify(body)
      });
      await cache.delete(request);
    }
    console.log("[SW] Carrito sincronizado");
  } catch (err) {
    console.warn("[SW] Error sincronizando carrito:", err);
  }
}

// ─── PUSH NOTIFICATIONS ─────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() || { title: "PetShop", body: "¡Tienes novedades!" };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      vibrate: [200, 100, 200],
      data: { url: data.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/")
  );
});
