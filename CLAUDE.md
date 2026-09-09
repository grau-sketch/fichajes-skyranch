# CLAUDE.md — Repo fichajes

Contexto para trabajar este repositorio con Claude Code. Léelo entero antes de
cambiar nada. El README tiene la puesta en marcha y las notas legales.

## Qué es
PWA de registro de jornada (art. 34.9 ET). El empleado ficha entrada/pausas/salida
desde el móvil con captura de ubicación en el instante del fichaje; el responsable
ve el estado del equipo, saca informes y planifica turnos; la app avisa por push
si falta un fichaje. Se instala desde un enlace, sin tiendas de apps.

## Stack y comandos
- Next.js 14 (App Router, TypeScript estricto, Server Components + Server Actions).
- Supabase (PostgreSQL + Auth + RLS). Hosting: **Netlify** (`netlify.toml`), con
  la tarea programada de avisos en `netlify/functions/avisos.mts`.
- CSS plano con tokens en `app/globals.css`. Sin Tailwind, sin librerías de UI.
- Web Push con VAPID (`web-push`) y service worker propio en `public/sw.js`.

> En esta máquina solo hay **bun** (no npm). `bun install`, `bun run dev`,
> `bun run build`, `bun run pruebas`.

## Invariantes (no los rompas)

1. **`fichajes` no se escribe desde el cliente.** No tiene políticas de
   INSERT/UPDATE/DELETE. Todo pasa por `fichar()` (empleado) o
   `fichaje_manual()` (admin/encargado), ambas SECURITY DEFINER. Si necesitas un
   nuevo camino de escritura, hazlo como función en la base, no como policy.
2. **La distancia al centro se calcula en el servidor**, dentro de `fichar()`.
   El cliente manda lat/lon/precisión; nunca `dentro_radio`.
3. **Nada se borra ni se edita**. Tres operaciones, todas con motivo obligatorio:
   `fichaje_manual()` añade uno que faltaba; `fichaje_anular()` marca
   `anulado_por/anulado_en/motivo_anulacion` y el fichaje deja de contar pero
   sigue existiendo; `fichaje_corregir()` anula el original y crea el sustituto
   con `corrige_a` apuntando a él. Es requisito de trazabilidad ante una
   inspección. Si añades una operación nueva sobre fichajes, que siga este
   patrón: marcar, nunca `update` del dato original ni `delete`.
4. **Los permisos viven en RLS**, no en la UI. `es_admin()`, `mi_rol()`,
   `mi_centro()` y `puedo_ver_empleado()` son los helpers; úsalos en cualquier
   policy nueva. Admin ve todo, encargado su centro, empleado lo suyo.
5. **`lib/constants.ts` es la única fuente de verdad** de tipos de fichaje,
   transiciones, roles y umbrales. Si cambias las transiciones, replica el
   `if not (...)` de `fichar()` en `db/schema.sql`.
6. **`SUPABASE_SERVICE_ROLE_KEY` solo en Route Handlers** (`lib/supabase/admin.ts`,
   marcado con `server-only`). Hoy solo la usa el cron de avisos.
7. **El cálculo de horas vive en `lib/jornada.ts` y `lib/proyeccion.ts`**, en
   TypeScript y no en SQL, para poder probarlo sin base de datos. Si lo tocas,
   ejecuta `bun run pruebas` y añade el caso.
8. **Fichar fuera del radio nunca se bloquea.** Se registra con
   `dentro_radio = false` y `fichar()` deja un aviso para los responsables vía
   `avisar_responsables()`; el push lo manda `notificarAvisosDeFichaje()` desde
   la Server Action. No conviertas esto en una validación que impida fichar.
9. **`crearEmpleado` y `restablecerPassword` usan `service_role`**, que salta
   RLS. La comprobación `rol !== 'admin'` dentro de la acción es la única
   defensa: no la quites ni la muevas a la interfaz.
10. **Los textos que genera SQL usan `hora_local_txt()`**, no `to_char()` a
    secas: Supabase corre en UTC y la hora saldría desfasada.
11. **La ubicación es obligatoria para fichar.** Sin posición no se envía nada;
    si cae fuera del radio, el `Reloj` pregunta antes de enviar y el servidor
    vuelve a calcular la distancia por su cuenta. No conviertas el aviso en un
    bloqueo: fuera del radio se puede fichar, confirmando.
12. **El trabajador no ve su histórico de fichajes.** `/jornadas` ya no existe;
    su pantalla es `/turnos` (calendario de horario). El acceso legal al
    registro se cubre entregándolo desde `/admin/informes`. No vuelvas a
    exponerlo en la app sin hablarlo.
13. **La app arranca sin Supabase.** `lib/supabase/configurado.ts` decide: si
    faltan las variables, el middleware manda todo a `/demo`. Cualquier código
    nuevo que consulte Supabase en el arranque debe respetar esa comprobación.

## Modelo de datos
`centros` (lat/lon/radio_m/tz) · `perfiles` (1:1 con auth.users; rol
`admin|encargado|empleado`, `centro_id`, `horas_semana`) · `fichajes` (el registro
legal, con `anulado_*` y `corrige_a`) · `plantillas_turno` (patrón semanal) ·
`turnos` (día concreto, la "proyección") · `push_suscripciones` · `avisos`
(`empleado_id` = a quién se refiere, `destinatario_id` = quién lo recibe, null
significa el propio empleado; índices únicos por turno y por fichaje para no
repetir un aviso) · vista `estado_actual` (`security_invoker = on`, así que
respeta RLS, y excluye los fichajes anulados).

Funciones: `fichar`, `fichaje_manual`, `fichaje_anular`, `fichaje_corregir`,
`generar_turnos` (las llama el cliente) y `avisar_responsables`,
`avisar_empleado`, `hora_local_txt`, `mi_rol`, `mi_centro`, `es_admin`,
`puedo_ver_empleado` (internas, sin grant a `authenticated`).

Tipos de fichaje: `entrada → pausa_inicio ⇄ pausa_fin → salida`.

## Reglas de cálculo
- Una jornada va de `entrada` a `salida` y se imputa al **día natural de la
  entrada**, aunque cruce medianoche.
- Las pausas se descuentan. Una pausa sin cerrar se marca `pausa_abierta`.
- Jornada abierta **hoy**: cuenta el tiempo en curso, no es incidencia.
  Abierta en un día pasado: incidencia `sin_salida`.
- Fichaje dentro del centro si `distancia <= radio + min(precisión, 100)`. El
  error del GPS cuenta a favor de la persona.
- Proyección = fichado + turnos que aún no han terminado, contra
  `horas_semana * días / 7`.
- Todo el tiempo se calcula en la zona del centro (`Europe/Madrid` por defecto),
  con `instanteLocal()` / `finTurno()` de `lib/fechas.ts`, que ya manejan los
  cambios de hora. **No uses `new Date('YYYY-MM-DDTHH:MM')`** para horas locales.

## Convenciones
- Datos en Server Components; mutaciones en Server Actions (`app/actions.ts`) y
  luego `revalidatePath`.
- Los formularios de administración usan `components/Formulario.tsx`, que llama a
  la acción y muestra el resultado (evitamos `useFormState` para no depender de
  APIs experimentales de React).
- Móvil primero: objetivos táctiles de 46 px mínimo, `font-size: 16px` en los
  inputs (si no, iOS hace zoom), una sola acción primaria por pantalla.
- Interfaz y código en español, igual que el resto de los repos.
- TypeScript estricto: el build falla con `any` implícito. Antes de dar algo por
  hecho: `bunx tsc --noEmit --noUnusedLocals`.

## Demo
`/demo` es una versión **usable** de la app con datos inventados, solo en
desarrollo: `/demo/fichar`, `/demo/jornadas`, `/demo/turnos` y `/demo/admin/*`,
con navegación propia, conmutador de rol y botón de reiniciar.

- `lib/demo.ts` son los datos de partida (los de hoy, relativos a la hora
  actual: si les pones horas fijas quedan en el futuro y rompen el orden).
- `lib/demoEstado.ts` reproduce las funciones de la base (`fichar`,
  `fichaje_anular`, `fichaje_corregir`, `generar_turnos`…) en memoria, con las
  mismas validaciones. Si la demo no te deja hacer algo, en producción tampoco.
- `components/DemoProvider.tsx` guarda ese estado en `localStorage` y no pinta
  nada hasta haberlo leído (el estado inicial depende de la hora y el servidor
  no coincidiría con el cliente).
- Los componentes compartidos (`Reloj`, `PanelEquipo`, `BloqueInforme`,
  `HistorialFichajes`, `Formulario`, `AvisoBanner`) aceptan un `demo` o un
  `alMarcar`/`obtenerPosicion` que sustituye la llamada al servidor. **Si
  cambias una pantalla, la demo se actualiza sola; si duplicas markup en la
  demo, lo estás haciendo mal.**
- En `/demo/fichar` la ubicación se elige a mano (dentro / a 1,2 km / sin GPS),
  porque el navegador de desarrollo no da geolocalización.

El centro real del proyecto es **SKYRANCH** (Rozas de Puerto Real, Madrid:
40.317603, -4.474293, radio 400 m), en `db/seed.sql` y en `lib/demo.ts`.

## Estado del proyecto
**Hecho:** fichaje con ubicación y cola offline, jornadas y proyecciones propias,
panel de equipo con incidencias, informes CSV (jornadas + historial de
movimientos) e impresión a PDF, correcciones trazadas (añadir, corregir,
anular), historial visible para el trabajador, alta de trabajadores y cambio de
contraseña desde la app, centros con búsqueda de dirección y captura de
coordenadas por GPS, avisos push (al trabajador y al responsable) con cron, PWA
instalable con service worker.

**Pendiente (orden sugerido):**
1. Vacaciones y ausencias, para que el objetivo del periodo las descuente.
2. Resumen semanal por correo al responsable (Resend) con las incidencias.
3. Fichaje por QR en el local como refuerzo de la ubicación.
4. Exportación sellada/firmada del informe mensual.
5. Recuperación de contraseña por el propio trabajador.
6. Mapa en el panel con el punto del fichaje que cayó fuera del radio.

## No hagas
- No añadas policies de escritura sobre `fichajes`.
- No confíes en `dentro_radio` que venga del cliente.
- No metas la `service_role` key en componentes de cliente.
- No dupliques estados, transiciones ni umbrales fuera de `lib/constants.ts`.
- No presentes la validación por GPS como antifraude: el navegador se puede
  falsear y eso está documentado en el README.
- No amplíes la captura de ubicación más allá del instante del fichaje sin
  revisar antes la parte legal (proporcionalidad AEPD).
- No impidas fichar por estar fuera del radio, sin ubicación o sin cobertura:
  el registro de jornada es una obligación legal y bloquearlo la incumple.
- No borres ni sobrescribas un fichaje: anula y corrige.
