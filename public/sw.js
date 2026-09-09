/* Service worker de Fichajes.
   - Cachea el armazón para que la app abra sin cobertura.
   - Recibe los avisos push y los muestra.
   Estrategia: network-first para navegación (los datos deben ser frescos) con
   caída a caché; cache-first para estáticos.                                */

const CACHE = 'fichajes-v1'
const ARMAZON = ['/offline', '/icons/icono-192.png']

/* En desarrollo no cacheamos nada: Next sirve los chunks con query de versión y
   una caché intermedia devolvería código viejo. El push sí sigue funcionando. */
const DESARROLLO = ['localhost', '127.0.0.1'].includes(self.location.hostname)

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (DESARROLLO
      ? Promise.resolve()
      : caches.open(CACHE).then((c) => c.addAll(ARMAZON))
    ).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  // Solo se borran las cachés de versiones anteriores, nunca la actual: si se
  // borrara todo en cada activación, la primera carga sin red se quedaría sin
  // nada que servir.
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  if (DESARROLLO) return
  const req = evento.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Nunca cachear API ni auth: el fichaje siempre va a red.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth')) return

  if (req.mode === 'navigate') {
    /* Stale-while-revalidate: se responde con lo cacheado si lo hay (arranque
       instantáneo, y funciona en las zonas de la finca sin cobertura) y se
       refresca en segundo plano. Sin esto, un primer arranque sin red falla. */
    evento.respondWith(
      caches.match(req).then((cacheado) => {
        const red = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copia = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copia))
            }
            return res
          })
          .catch(() => cacheado || caches.match('/offline'))
        return cacheado || red
      }),
    )
    return
  }

  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons/')) {
    evento.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
            return res
          }),
      ),
    )
  }
})

self.addEventListener('push', (evento) => {
  let datos = { titulo: 'Fichajes', cuerpo: '', url: '/fichar' }
  try {
    datos = { ...datos, ...evento.data.json() }
  } catch {
    if (evento.data) datos.cuerpo = evento.data.text()
  }
  evento.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: '/icons/icono-192.png',
      badge: '/icons/icono-192.png',
      tag: datos.tag || 'fichajes',
      renotify: true,
      requireInteraction: false,
      data: { url: datos.url },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || '/fichar'
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.includes(destino) && 'focus' in v) return v.focus()
      }
      return self.clients.openWindow(destino)
    }),
  )
})
