// Genera el par de claves VAPID para Web Push.
//   bun run vapid
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()
console.log('\nAñade esto a .env.local (y a las env vars de Vercel):\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}\n`)
