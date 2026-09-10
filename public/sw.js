/* Service worker de Fichajes.
   - Cachea el armazón para que la app abra sin cobertura.
   - Recibe los avisos push y los muestra.

   Estrategia: network-first para navegación, con caída a caché si la red no
   contesta a tiempo; cache-first para estáticos, que van con hash en el nombre
   y por tanto son inmutables.                                               */

const CACHE = 'fichajes-v2'
const ARMAZON = ['/offline', '/icons/icono-192.png']

/* En desarrollo no cacheamos nada: Next sirve los chunks con query de versión y
   una caché intermedia devolvería código viejo. El push sí sigue funcionando. */
const DESARROLLO = ['localhost', '127.0.0.1'].includes(self.location.hostname)

/* Cuánto se espera a la red antes de servir la copia guardada. Corto: en la
   finca hay cobertura irregular y la pantalla no puede quedarse en blanco. */
const TIMEOUT_MS = 2500

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
    /* Network-first de verdad.

       Antes esto era stale-while-revalidate: devolvía la copia en caché al
       instante y refrescaba por detrás. El problema es que el HTML cacheado
       apunta a los chunks del despliegue anterior — que también están en
       caché —, así que tras publicar una versión nueva la primera carga
       mostraba la vieja entera. De ahí el "recarga dos veces".

       Ahora manda la red, y la caché solo entra si la red no contesta en
       TIMEOUT_MS o falla. Eso conserva lo que importaba —abrir sin cobertura
       en la finca— sin volver a enseñar una versión que ya no existe. */
    evento.respondWith(
      (async () => {
        const guardar = (res) => {
          if (res && res.ok) {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
          }
          return res
        }

        const red = fetch(req).then(guardar)

        // Si en TIMEOUT_MS no hay respuesta, se sirve lo cacheado si lo hay;
        // la petición a red sigue viva y actualiza la caché para la próxima.
        const espera = new Promise((resolver) => setTimeout(() => resolver(null), TIMEOUT_MS))

        try {
          const carrera = await Promise.race([red, espera])
          if (carrera) return carrera
          const cacheado = await caches.match(req)
          if (cacheado) return cacheado
          return await red
        } catch {
          return (await caches.match(req)) || (await caches.match('/offline'))
        }
      })(),
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
