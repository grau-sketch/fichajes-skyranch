-- ============================================================================
-- Datos iniciales. Ejecútalo DESPUÉS de db/schema.sql, en el SQL Editor.
-- Es idempotente: se puede repetir sin duplicar nada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Centro de trabajo: SKYRANCH
-- Coordenadas: 40.317603, -4.474293
-- Rozas de Puerto Real (Madrid). Al ser una finca y no un local de calle, el
-- radio va holgado (500 m, lo ya medido) para que se pueda fichar desde
-- cualquier punto del recinto. Ajústalo desde la app si hace falta.
-- ----------------------------------------------------------------------------
insert into centros (nombre, direccion, lat, lon, radio_m, tz)
values (
  'SKYRANCH',
  'Calle Logroño, Entrepinos, 28648 Rozas de Puerto Real (Madrid)',
  40.317603,
  -4.474293,
  500,
  'Europe/Madrid'
)
on conflict do nothing;

-- Si ya existía con otros datos, esto lo pone al día.
update centros
set direccion = 'Calle Logroño, Entrepinos, 28648 Rozas de Puerto Real (Madrid)',
    lat = 40.317603,
    lon = -4.474293,
    radio_m = 500,
    tz = 'Europe/Madrid'
where nombre = 'SKYRANCH';

-- ----------------------------------------------------------------------------
-- Tu usuario como administrador.
-- Antes: crea la cuenta en Authentication → Users y entra una vez en la app
-- (el trigger crea el perfil). Luego cambia el correo de aquí abajo y ejecuta.
-- ----------------------------------------------------------------------------
-- update perfiles
-- set rol = 'admin',
--     centro_id = (select id from centros where nombre = 'SKYRANCH')
-- where email = 'tu@empresa.com';

-- Comprobación rápida de que el centro quedó bien.
select nombre, direccion, lat, lon, radio_m from centros;
