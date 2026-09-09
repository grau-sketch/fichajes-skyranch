import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { demoActiva, supabaseConfigurado } from './configurado'

type CookieToSet = { name: string; value: string; options: CookieOptions }

const PUBLICAS = ['/login', '/manifest.webmanifest', '/sw.js', '/offline', '/demo']

// Refresca la sesión de Supabase en cada request y protege la app.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const ruta = request.nextUrl.pathname

  // Despliegue sin Supabase todavía: la app real no puede funcionar, así que
  // se manda todo a la demo en lugar de reventar con un 500.
  if (!supabaseConfigurado) {
    if (ruta.startsWith('/demo') || ruta.startsWith('/offline')) return response
    const url = request.nextUrl.clone()
    url.pathname = demoActiva ? '/demo/fichar' : '/sin-configurar'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANTE: getUser() revalida el token contra Supabase Auth.
  // Si Supabase no responde tratamos la sesión como inexistente (falla cerrado)
  // en lugar de devolver un 500 en toda la app.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  const path = ruta

  if (path.startsWith('/api/cron')) return response

  if (!user && !PUBLICAS.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/fichar'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
