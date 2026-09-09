-- ============================================================================
-- Comprobación de la instalación. Solo lee: no cambia nada.
-- Pega esto en el SQL Editor y mándame la salida.
-- ============================================================================

-- 1) Las diez tablas, con si tienen RLS activo
select
  c.relname as tabla,
  c.relrowsecurity as rls_activo,
  (select count(*) from pg_policies p
   where p.schemaname = 'public' and p.tablename = c.relname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'centros','perfiles','fichajes','plantillas_turno','turnos',
    'push_suscripciones','avisos','ausencias','partes_trabajo'
  )
order by c.relname;

-- 2) Las funciones que tienen que existir
select proname as funcion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in (
    'fichar','fichaje_manual','fichaje_anular','fichaje_corregir',
    'ausencia_solicitar','ausencia_decidir','parte_guardar',
    'generar_turnos','purgar_ubicaciones','hora_local_txt',
    'avisar_responsables','avisar_empleado','mi_rol','mi_centro',
    'es_admin','puedo_ver_empleado','turno_minutos','ausencia_dias'
  )
order by proname;

-- 3) Los índices únicos de avisos (los que evitan avisos repetidos)
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'avisos'
order by indexname;

-- 4) El bucket de justificantes: tiene que ser PRIVADO
select id, public as es_publico, file_size_limit from storage.buckets
where id = 'justificantes';

-- 5) El centro, con su radio
select nombre, direccion, lat, lon, radio_m, tz from centros;

-- 6) La vista de estado y el trigger de alta de perfiles
select
  (select count(*) from pg_views where schemaname='public' and viewname='estado_actual') as vista_estado_actual,
  (select count(*) from pg_trigger where tgname='trg_crear_perfil') as trigger_perfiles;
