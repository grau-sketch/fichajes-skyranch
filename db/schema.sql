-- ============================================================================
-- FICHAJES — esquema completo (Supabase / PostgreSQL)
-- Ejecútalo en el SQL Editor de Supabase. Es idempotente: se puede repetir.
-- Registro de jornada conforme a RD-ley 8/2019 (art. 34.9 ET): registro diario
-- con hora de inicio y fin, conservado 4 años, accesible a la persona
-- trabajadora, sus representantes y la Inspección de Trabajo.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Centros de trabajo
-- ----------------------------------------------------------------------------
create table if not exists centros (
  id          uuid primary key default gen_random_uuid(),
  -- Único a propósito: sin esto, repetir el seed duplica el centro.
  nombre      text not null unique,
  direccion   text,
  lat         double precision,
  lon         double precision,
  radio_m     integer not null default 150 check (radio_m between 25 and 5000),
  tz          text not null default 'Europe/Madrid',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- Para instalaciones anteriores, donde el nombre no era único.
alter table centros drop constraint if exists centros_nombre_unico;
alter table centros add constraint centros_nombre_unico unique (nombre);

-- ----------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- ----------------------------------------------------------------------------
create table if not exists perfiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text not null,
  email         text,
  rol           text not null default 'empleado' check (rol in ('admin','encargado','empleado')),
  centro_id     uuid references centros(id) on delete set null,
  horas_semana  numeric(5,2) not null default 40 check (horas_semana between 0 and 60),
  -- Días naturales de vacaciones al año (30 es el mínimo legal en España).
  dias_vacaciones smallint not null default 30 check (dias_vacaciones between 0 and 60),
  fecha_nacimiento date,
  telefono text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

alter table perfiles add column if not exists dias_vacaciones smallint not null default 30;
alter table perfiles add column if not exists fecha_nacimiento date;
alter table perfiles add column if not exists telefono text;

-- Alta automática de perfil al crear el usuario en Auth.
create or replace function crear_perfil_al_registrar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, email)
  values (
    new.id,
    -- Si el alta no trae nombre (por ejemplo, creando el usuario a mano desde
    -- el panel de Supabase), queda el identificador y hay que corregirlo luego.
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function crear_perfil_al_registrar();

-- ----------------------------------------------------------------------------
-- Fichajes (el registro legal)
-- ----------------------------------------------------------------------------
create table if not exists fichajes (
  id           uuid primary key default gen_random_uuid(),
  empleado_id  uuid not null references perfiles(id) on delete cascade,
  centro_id    uuid references centros(id) on delete set null,
  tipo         text not null check (tipo in ('entrada','salida','pausa_inicio','pausa_fin')),
  ts           timestamptz not null default now(),
  lat          double precision,
  lon          double precision,
  precision_m  numeric(8,2),
  distancia_m  numeric(10,2),
  dentro_radio boolean,
  origen       text not null default 'app' check (origen in ('app','offline','manual')),
  nota         text,
  editado_por  uuid references perfiles(id) on delete set null,
  editado_en   timestamptz,
  -- Un fichaje nunca se borra ni se sobrescribe: se anula, y la corrección es
  -- un fichaje nuevo que apunta al que sustituye.
  anulado_por      uuid references perfiles(id) on delete set null,
  anulado_en       timestamptz,
  motivo_anulacion text,
  corrige_a        uuid references fichajes(id) on delete set null,
  creado_en    timestamptz not null default now()
);

-- Altas de columnas para instalaciones anteriores (idempotente).
alter table fichajes add column if not exists anulado_por uuid references perfiles(id) on delete set null;
alter table fichajes add column if not exists anulado_en timestamptz;
alter table fichajes add column if not exists motivo_anulacion text;
alter table fichajes add column if not exists corrige_a uuid references fichajes(id) on delete set null;

create index if not exists fichajes_empleado_ts_idx on fichajes (empleado_id, ts desc);
create index if not exists fichajes_ts_idx on fichajes (ts desc);
create index if not exists fichajes_centro_ts_idx on fichajes (centro_id, ts desc);

-- ----------------------------------------------------------------------------
-- Planificación de turnos
-- ----------------------------------------------------------------------------
-- Patrón semanal reutilizable por empleado (0 = domingo … 6 = sábado).
create table if not exists plantillas_turno (
  id           uuid primary key default gen_random_uuid(),
  empleado_id  uuid not null references perfiles(id) on delete cascade,
  centro_id    uuid references centros(id) on delete set null,
  dia_semana   smallint not null check (dia_semana between 0 and 6),
  hora_inicio  time not null,
  hora_fin     time not null,
  pausa_min    integer not null default 0 check (pausa_min >= 0),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  unique (empleado_id, dia_semana, hora_inicio)
);

-- Turno concreto de un día. Es la "proyección" contra la que se compara.
create table if not exists turnos (
  id            uuid primary key default gen_random_uuid(),
  empleado_id   uuid not null references perfiles(id) on delete cascade,
  centro_id     uuid references centros(id) on delete set null,
  fecha         date not null,
  hora_inicio   time not null,
  hora_fin      time not null,
  pausa_min     integer not null default 0 check (pausa_min >= 0),
  -- 'libre' es un día de descanso planificado: se guarda como una fila del
  -- día con hora_inicio = hora_fin, para que el trabajador lo vea en su
  -- calendario y para que no se espere ningún fichaje. No es un turno de
  -- trabajo: no suma minutos y no cuenta como turno sin fichar.
  estado        text not null default 'planificado'
                check (estado in ('planificado','confirmado','cancelado','libre')),
  nota          text,
  creado_en     timestamptz not null default now(),
  unique (empleado_id, fecha, hora_inicio)
);

alter table turnos drop constraint if exists turnos_estado_check;
alter table turnos add constraint turnos_estado_check
  check (estado in ('planificado','confirmado','cancelado','libre'));

-- Un día libre es único por día: no tiene sentido tener dos.
create unique index if not exists turnos_libre_unico
  on turnos (empleado_id, fecha) where estado = 'libre';

create index if not exists turnos_empleado_fecha_idx on turnos (empleado_id, fecha);
create index if not exists turnos_fecha_idx on turnos (fecha);

-- Minutos planificados de un turno (soporta turnos que cruzan medianoche).
create or replace function turno_minutos(p_inicio time, p_fin time, p_pausa integer)
returns integer language sql immutable as $$
  select greatest(
    0,
    (case when p_fin >= p_inicio
       then extract(epoch from (p_fin - p_inicio))
       else extract(epoch from (p_fin - p_inicio)) + 86400
     end)::int / 60 - coalesce(p_pausa, 0)
  )
$$;

-- ----------------------------------------------------------------------------
-- Ausencias: vacaciones, bajas, permisos y faltas
--
-- Sin esto, una semana de vacaciones se leería como incumplimiento de jornada:
-- las horas objetivo del periodo se reducen por cada día de ausencia aprobada.
-- ----------------------------------------------------------------------------
create table if not exists ausencias (
  id            uuid primary key default gen_random_uuid(),
  empleado_id   uuid not null references perfiles(id) on delete cascade,
  tipo          text not null check (tipo in (
                  'vacaciones',      -- las pide la persona, las aprueba el responsable
                  'baja',            -- baja médica
                  'permiso',         -- permiso retribuido
                  'asuntos_propios',
                  'falta'            -- ausencia no justificada: la registra el responsable
                )),
  desde         date not null,
  hasta         date not null,
  motivo        text,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','aprobada','rechazada','cancelada')),
  -- Ruta en el bucket privado `justificantes`. Puede ser un parte médico, así
  -- que es dato de categoría especial: nunca en un bucket público.
  justificante  text,
  creado_por    uuid references perfiles(id) on delete set null,
  creado_en     timestamptz not null default now(),
  decidido_por  uuid references perfiles(id) on delete set null,
  decidido_en   timestamptz,
  nota_decision text,
  constraint ausencias_rango check (hasta >= desde)
);

create index if not exists ausencias_empleado_idx on ausencias (empleado_id, desde desc);
create index if not exists ausencias_rango_idx on ausencias (desde, hasta);
create index if not exists ausencias_estado_idx on ausencias (estado) where estado = 'pendiente';

-- Días naturales que ocupa una ausencia.
create or replace function ausencia_dias(p_desde date, p_hasta date)
returns integer language sql immutable as $$
  select greatest(0, (p_hasta - p_desde) + 1)
$$;

-- ----------------------------------------------------------------------------
-- Parte de trabajo: qué se hizo ese día. En una finca vale más que las horas.
-- ----------------------------------------------------------------------------
create table if not exists partes_trabajo (
  id           uuid primary key default gen_random_uuid(),
  empleado_id  uuid not null references perfiles(id) on delete cascade,
  fecha        date not null,
  texto        text not null,
  actualizado_en timestamptz not null default now(),
  unique (empleado_id, fecha)
);

create index if not exists partes_fecha_idx on partes_trabajo (fecha desc);

-- ----------------------------------------------------------------------------
-- Avisos y Web Push
-- ----------------------------------------------------------------------------
create table if not exists push_suscripciones (
  id           uuid primary key default gen_random_uuid(),
  empleado_id  uuid not null references perfiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  creado_en    timestamptz not null default now()
);

create table if not exists avisos (
  id             uuid primary key default gen_random_uuid(),
  -- Persona a la que se refiere el aviso.
  empleado_id    uuid not null references perfiles(id) on delete cascade,
  -- Persona que lo recibe. Si es null, es para el propio empleado.
  destinatario_id uuid references perfiles(id) on delete cascade,
  turno_id       uuid references turnos(id) on delete cascade,
  fichaje_id     uuid references fichajes(id) on delete cascade,
  tipo           text not null,
  titulo         text not null,
  cuerpo         text not null,
  enviado_en     timestamptz not null default now(),
  leido_en       timestamptz
);

alter table avisos add column if not exists destinatario_id uuid references perfiles(id) on delete cascade;
alter table avisos add column if not exists fichaje_id uuid references fichajes(id) on delete cascade;

alter table avisos drop constraint if exists avisos_tipo_check;
alter table avisos add constraint avisos_tipo_check check (tipo in (
  'sin_entrada',            -- al empleado: empezó su turno y no ha fichado
  'jornada_abierta',        -- al empleado: se dejó la jornada sin cerrar
  'turno_sin_fichar',       -- al responsable: turno pasado sin ningún fichaje
  'fichaje_fuera_radio',    -- al responsable: alguien fichó lejos del centro
  'fichaje_corregido',      -- al empleado: su responsable tocó un fichaje
  'ausencia_pendiente',     -- al responsable: hay una solicitud que decidir
  'ausencia_decidida',      -- al empleado: aprobada o rechazada
  'resumen_encargado'
));

-- Un mismo aviso no se repite: ni por turno ni por fichaje.
drop index if exists avisos_turno_tipo_idx;
create unique index if not exists avisos_turno_tipo_idx
  on avisos (turno_id, tipo, (coalesce(destinatario_id, empleado_id))) where turno_id is not null;
create unique index if not exists avisos_fichaje_tipo_idx
  on avisos (fichaje_id, tipo, (coalesce(destinatario_id, empleado_id))) where fichaje_id is not null;
create index if not exists avisos_empleado_idx on avisos (empleado_id, enviado_en desc);
create index if not exists avisos_destinatario_idx on avisos (destinatario_id, enviado_en desc);

-- ----------------------------------------------------------------------------
-- Helpers de permisos (SECURITY DEFINER para no recursar sobre RLS de perfiles)
-- ----------------------------------------------------------------------------
create or replace function mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

create or replace function mi_centro() returns uuid
language sql stable security definer set search_path = public as $$
  select centro_id from perfiles where id = auth.uid()
$$;

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() = 'admin', false)
$$;

-- Puedo ver a este empleado: yo mismo, o soy admin, o soy encargado de su centro.
create or replace function puedo_ver_empleado(p_empleado uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    p_empleado = auth.uid()
    or es_admin()
    or (
      mi_rol() = 'encargado'
      and mi_centro() is not null
      and exists (
        select 1 from perfiles p
        where p.id = p_empleado and p.centro_id = mi_centro()
      )
    )
$$;

-- Fecha y hora en la zona del centro, para los textos de los avisos.
-- Sin esto to_char() imprimiría UTC y la hora saldría desfasada.
create or replace function hora_local_txt(p_ts timestamptz, p_centro uuid default null)
returns text
language sql stable security definer set search_path = public as $$
  select to_char(
    p_ts at time zone coalesce(
      (select tz from centros where id = p_centro),
      'Europe/Madrid'
    ),
    'DD/MM/YYYY HH24:MI'
  )
$$;

-- ----------------------------------------------------------------------------
-- avisar_responsables(): deja un aviso para cada admin y para el encargado del
-- centro del empleado. El envío push lo hace la app; aquí solo se registra.
-- ----------------------------------------------------------------------------
create or replace function avisar_responsables(
  p_empleado uuid,
  p_fichaje  uuid,
  p_tipo     text,
  p_titulo   text,
  p_cuerpo   text
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_centro uuid; v_n integer;
begin
  select centro_id into v_centro from perfiles where id = p_empleado;

  with destinatarios as (
    select id from perfiles
    where activo
      and id <> p_empleado
      and (
        rol = 'admin'
        or (rol = 'encargado' and v_centro is not null and centro_id = v_centro)
      )
  ), insertados as (
    insert into avisos (empleado_id, destinatario_id, fichaje_id, tipo, titulo, cuerpo)
    select p_empleado, d.id, p_fichaje, p_tipo, p_titulo, p_cuerpo
    from destinatarios d
    on conflict do nothing
    returning 1
  )
  select count(*) into v_n from insertados;

  return v_n;
end $$;

-- Aviso dirigido a la propia persona (por ejemplo, "te he corregido un fichaje").
create or replace function avisar_empleado(
  p_empleado uuid,
  p_fichaje  uuid,
  p_tipo     text,
  p_titulo   text,
  p_cuerpo   text
) returns void
language sql security definer set search_path = public as $$
  insert into avisos (empleado_id, destinatario_id, fichaje_id, tipo, titulo, cuerpo)
  values (p_empleado, p_empleado, p_fichaje, p_tipo, p_titulo, p_cuerpo)
  on conflict do nothing
$$;

-- ----------------------------------------------------------------------------
-- fichar(): única vía para registrar. Valida transición y calcula la distancia
-- en el servidor, para que el cliente no pueda declararse "dentro del radio".
-- ----------------------------------------------------------------------------
create or replace function fichar(
  p_tipo        text,
  p_lat         double precision default null,
  p_lon         double precision default null,
  p_precision   numeric default null,
  p_ts          timestamptz default null,
  p_nota        text default null
) returns fichajes
language plpgsql security definer set search_path = public as $$
declare
  v_emp     perfiles;
  v_centro  centros;
  v_ultimo  text;
  v_dist    numeric := null;
  v_dentro  boolean := null;
  v_ts      timestamptz;
  v_origen  text := 'app';
  v_row     fichajes;
begin
  select * into v_emp from perfiles where id = auth.uid();
  if v_emp.id is null then
    raise exception 'No hay perfil para el usuario actual';
  end if;
  if not v_emp.activo then
    raise exception 'Tu cuenta está desactivada. Habla con tu responsable.';
  end if;

  v_ts := coalesce(p_ts, now());
  if v_ts > now() + interval '2 minutes' then
    raise exception 'La hora del fichaje está en el futuro';
  end if;
  if v_ts < now() - interval '2 days' then
    raise exception 'El fichaje es demasiado antiguo para registrarse desde la app';
  end if;
  -- Un fichaje recuperado de la cola offline llega con hora pasada.
  if p_ts is not null and p_ts < now() - interval '3 minutes' then
    v_origen := 'offline';
  end if;

  select tipo into v_ultimo
  from fichajes
  where empleado_id = v_emp.id
  order by ts desc, creado_en desc
  limit 1;

  if not (
       (v_ultimo is null      and p_tipo = 'entrada')
    or (v_ultimo = 'salida'   and p_tipo = 'entrada')
    or (v_ultimo = 'entrada'  and p_tipo in ('pausa_inicio','salida'))
    or (v_ultimo = 'pausa_inicio' and p_tipo = 'pausa_fin')
    or (v_ultimo = 'pausa_fin'    and p_tipo in ('pausa_inicio','salida'))
  ) then
    raise exception 'Movimiento no permitido: "%" después de "%"', p_tipo, coalesce(v_ultimo, 'ningún fichaje');
  end if;

  if v_emp.centro_id is not null then
    select * into v_centro from centros where id = v_emp.centro_id;
  end if;

  if p_lat is not null and p_lon is not null
     and v_centro.lat is not null and v_centro.lon is not null then
    -- Haversine en metros (radio terrestre 6371008 m). Sin PostGIS.
    v_dist := 6371008 * 2 * asin(sqrt(
        power(sin(radians(v_centro.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(v_centro.lat))
        * power(sin(radians(v_centro.lon - p_lon) / 2), 2)
    ));
    -- El margen de error del GPS cuenta a favor de la persona.
    v_dentro := v_dist <= v_centro.radio_m + least(coalesce(p_precision, 0), 100);
  end if;

  insert into fichajes (
    empleado_id, centro_id, tipo, ts, lat, lon, precision_m,
    distancia_m, dentro_radio, origen, nota
  ) values (
    v_emp.id, v_emp.centro_id, p_tipo, v_ts, p_lat, p_lon, p_precision,
    round(v_dist, 1), v_dentro, v_origen, p_nota
  )
  returning * into v_row;

  -- Fichar fuera del centro NO se bloquea: se registra y se avisa al responsable.
  if v_dentro is false then
    perform avisar_responsables(
      v_emp.id,
      v_row.id,
      'fichaje_fuera_radio',
      'Fichaje fuera del centro',
      format(
        '%s ha fichado %s a %s m de %s.',
        v_emp.nombre,
        replace(p_tipo, '_', ' '),
        round(v_dist)::text,
        coalesce(v_centro.nombre, 'su centro')
      )
    );
  end if;

  return v_row;
end $$;

-- Corrección manual por admin/encargado (queda trazada con quién y cuándo).
create or replace function fichaje_manual(
  p_empleado uuid,
  p_tipo     text,
  p_ts       timestamptz,
  p_nota     text
) returns fichajes
language plpgsql security definer set search_path = public as $$
declare v_row fichajes; v_centro uuid;
begin
  if not (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(p_empleado))) then
    raise exception 'No tienes permiso para corregir fichajes';
  end if;
  if p_nota is null or length(trim(p_nota)) < 3 then
    raise exception 'Una corrección manual necesita motivo';
  end if;

  select centro_id into v_centro from perfiles where id = p_empleado;

  insert into fichajes (empleado_id, centro_id, tipo, ts, origen, nota, editado_por, editado_en)
  values (p_empleado, v_centro, p_tipo, p_ts, 'manual', trim(p_nota), auth.uid(), now())
  returning * into v_row;

  perform avisar_empleado(
    p_empleado,
    v_row.id,
    'fichaje_corregido',
    'Se ha añadido un fichaje tuyo',
    format('%s del %s. Motivo: %s',
           initcap(replace(p_tipo, '_', ' ')),
           hora_local_txt(p_ts, v_centro),
           trim(p_nota))
  );

  return v_row;
end $$;

-- ----------------------------------------------------------------------------
-- Anular un fichaje. No lo borra: lo marca, deja de contar en las horas y
-- sigue apareciendo en el historial con quién lo anuló y por qué.
-- ----------------------------------------------------------------------------
create or replace function fichaje_anular(
  p_fichaje uuid,
  p_motivo  text
) returns fichajes
language plpgsql security definer set search_path = public as $$
declare v_row fichajes;
begin
  select * into v_row from fichajes where id = p_fichaje;
  if v_row.id is null then
    raise exception 'El fichaje no existe';
  end if;
  if not (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(v_row.empleado_id))) then
    raise exception 'No tienes permiso para anular este fichaje';
  end if;
  if v_row.anulado_en is not null then
    raise exception 'Ese fichaje ya estaba anulado';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Anular un fichaje necesita motivo';
  end if;

  update fichajes
  set anulado_por = auth.uid(),
      anulado_en = now(),
      motivo_anulacion = trim(p_motivo)
  where id = p_fichaje
  returning * into v_row;

  perform avisar_empleado(
    v_row.empleado_id,
    v_row.id,
    'fichaje_corregido',
    'Un fichaje tuyo ha sido anulado',
    format('Se ha anulado tu %s del %s. Motivo: %s',
           replace(v_row.tipo, '_', ' '),
           hora_local_txt(v_row.ts, v_row.centro_id),
           trim(p_motivo))
  );

  return v_row;
end $$;

-- ----------------------------------------------------------------------------
-- Corregir la hora (y si hace falta el tipo) de un fichaje: anula el original
-- y crea el corregido apuntando a él. Las dos cosas, o ninguna.
-- ----------------------------------------------------------------------------
create or replace function fichaje_corregir(
  p_fichaje   uuid,
  p_nuevo_ts  timestamptz,
  p_motivo    text,
  p_nuevo_tipo text default null
) returns fichajes
language plpgsql security definer set search_path = public as $$
declare v_orig fichajes; v_nuevo fichajes; v_tipo text;
begin
  select * into v_orig from fichajes where id = p_fichaje;
  if v_orig.id is null then
    raise exception 'El fichaje no existe';
  end if;
  if not (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(v_orig.empleado_id))) then
    raise exception 'No tienes permiso para corregir este fichaje';
  end if;
  if v_orig.anulado_en is not null then
    raise exception 'Ese fichaje está anulado; añade uno nuevo en su lugar';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Una corrección necesita motivo';
  end if;
  if p_nuevo_ts > now() + interval '2 minutes' then
    raise exception 'La hora corregida no puede estar en el futuro';
  end if;

  v_tipo := coalesce(p_nuevo_tipo, v_orig.tipo);
  if v_tipo not in ('entrada','salida','pausa_inicio','pausa_fin') then
    raise exception 'Tipo de fichaje no válido';
  end if;

  update fichajes
  set anulado_por = auth.uid(),
      anulado_en = now(),
      motivo_anulacion = trim(p_motivo)
  where id = p_fichaje;

  insert into fichajes (
    empleado_id, centro_id, tipo, ts, origen, nota,
    editado_por, editado_en, corrige_a
  ) values (
    v_orig.empleado_id, v_orig.centro_id, v_tipo, p_nuevo_ts, 'manual', trim(p_motivo),
    auth.uid(), now(), v_orig.id
  )
  returning * into v_nuevo;

  perform avisar_empleado(
    v_orig.empleado_id,
    v_nuevo.id,
    'fichaje_corregido',
    'Un fichaje tuyo ha sido corregido',
    format('Tu %s del %s pasa a las %s. Motivo: %s',
           replace(v_orig.tipo, '_', ' '),
           hora_local_txt(v_orig.ts, v_orig.centro_id),
           hora_local_txt(p_nuevo_ts, v_orig.centro_id),
           trim(p_motivo))
  );

  return v_nuevo;
end $$;

-- ----------------------------------------------------------------------------
-- Solicitar una ausencia (la persona, para sí misma) o registrarla ya decidida
-- (el responsable). Las faltas solo las puede poner un responsable.
-- ----------------------------------------------------------------------------
create or replace function ausencia_solicitar(
  p_tipo         text,
  p_desde        date,
  p_hasta        date,
  p_motivo       text default null,
  p_empleado     uuid default null,
  p_justificante text default null
) returns ausencias
language plpgsql security definer set search_path = public as $$
declare v_para uuid; v_row ausencias; v_gestor boolean;
begin
  v_para := coalesce(p_empleado, auth.uid());
  v_gestor := es_admin() or mi_rol() = 'encargado';

  if v_para <> auth.uid() and not (v_gestor and puedo_ver_empleado(v_para)) then
    raise exception 'No puedes pedir ausencias en nombre de otra persona';
  end if;
  if p_tipo = 'falta' and not v_gestor then
    raise exception 'Solo un responsable puede registrar una falta';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha de fin es anterior a la de inicio';
  end if;
  if p_hasta - p_desde > 180 then
    raise exception 'El periodo es demasiado largo (máximo 6 meses)';
  end if;

  -- Dos ausencias vigentes no pueden solaparse.
  if exists (
    select 1 from ausencias a
    where a.empleado_id = v_para
      and a.estado in ('pendiente','aprobada')
      and a.desde <= p_hasta and a.hasta >= p_desde
  ) then
    raise exception 'Ya hay una ausencia en esas fechas';
  end if;

  insert into ausencias (
    empleado_id, tipo, desde, hasta, motivo, justificante, creado_por,
    -- Lo que registra un responsable entra ya aprobado; lo que pide la
    -- persona queda pendiente de decisión.
    estado, decidido_por, decidido_en
  ) values (
    v_para, p_tipo, p_desde, p_hasta, nullif(trim(p_motivo), ''), p_justificante, auth.uid(),
    case when v_gestor then 'aprobada' else 'pendiente' end,
    case when v_gestor then auth.uid() end,
    case when v_gestor then now() end
  )
  returning * into v_row;

  -- Al responsable le llega el aviso de que hay algo que decidir.
  if v_row.estado = 'pendiente' then
    perform avisar_responsables(
      v_para, null, 'ausencia_pendiente',
      'Solicitud de ausencia',
      format('%s pide %s del %s al %s.',
             (select nombre from perfiles where id = v_para),
             replace(p_tipo, '_', ' '),
             to_char(p_desde, 'DD/MM/YYYY'),
             to_char(p_hasta, 'DD/MM/YYYY'))
    );
  end if;

  return v_row;
end $$;

-- Aprobar o rechazar. Solo responsables.
create or replace function ausencia_decidir(
  p_ausencia uuid,
  p_estado   text,
  p_nota     text default null
) returns ausencias
language plpgsql security definer set search_path = public as $$
declare v_row ausencias;
begin
  if p_estado not in ('aprobada','rechazada','cancelada') then
    raise exception 'Decisión no válida';
  end if;

  select * into v_row from ausencias where id = p_ausencia;
  if v_row.id is null then raise exception 'La ausencia no existe'; end if;

  -- La propia persona puede cancelar lo que aún está pendiente.
  if p_estado = 'cancelada' and v_row.empleado_id = auth.uid() then
    if v_row.estado <> 'pendiente' then
      raise exception 'Solo puedes cancelar una solicitud que siga pendiente';
    end if;
  elsif not (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(v_row.empleado_id))) then
    raise exception 'No tienes permiso para decidir esta ausencia';
  end if;

  if p_estado = 'rechazada' and (p_nota is null or length(trim(p_nota)) < 3) then
    raise exception 'Rechazar una solicitud necesita motivo';
  end if;

  update ausencias
  set estado = p_estado,
      decidido_por = auth.uid(),
      decidido_en = now(),
      nota_decision = nullif(trim(p_nota), '')
  where id = p_ausencia
  returning * into v_row;

  if v_row.empleado_id <> auth.uid() then
    perform avisar_empleado(
      v_row.empleado_id, null, 'ausencia_decidida',
      case when p_estado = 'aprobada' then 'Ausencia aprobada' else 'Ausencia rechazada' end,
      format('%s del %s al %s: %s.%s',
             initcap(replace(v_row.tipo, '_', ' ')),
             to_char(v_row.desde, 'DD/MM/YYYY'),
             to_char(v_row.hasta, 'DD/MM/YYYY'),
             p_estado,
             coalesce(' ' || v_row.nota_decision, ''))
    );
  end if;

  return v_row;
end $$;

-- Parte de trabajo del día: lo escribe la propia persona.
create or replace function parte_guardar(p_fecha date, p_texto text)
returns partes_trabajo
language plpgsql security definer set search_path = public as $$
declare v_row partes_trabajo;
begin
  if p_fecha > (current_date + 1) then
    raise exception 'No se puede escribir el parte de un día futuro';
  end if;

  if p_texto is null or length(trim(p_texto)) = 0 then
    delete from partes_trabajo where empleado_id = auth.uid() and fecha = p_fecha;
    return null;
  end if;

  insert into partes_trabajo (empleado_id, fecha, texto)
  values (auth.uid(), p_fecha, trim(p_texto))
  on conflict (empleado_id, fecha)
  do update set texto = excluded.texto, actualizado_en = now()
  returning * into v_row;

  return v_row;
end $$;

-- ----------------------------------------------------------------------------
-- Minimización de datos: el fichaje se conserva 4 años, pero las coordenadas
-- exactas no hacen falta tanto tiempo. Se borran a los 6 meses y se queda la
-- distancia y el "dentro/fuera", que es lo que tiene valor probatorio.
-- Llamar desde la tarea programada (ver netlify/functions).
-- ----------------------------------------------------------------------------
create or replace function purgar_ubicaciones(p_dias integer default 180)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update fichajes
  set lat = null, lon = null, precision_m = null
  where ts < now() - make_interval(days => p_dias)
    and (lat is not null or lon is not null);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Materializa turnos a partir del patrón semanal, sin pisar los existentes.
create or replace function generar_turnos(
  p_empleado uuid,
  p_desde    date,
  p_hasta    date
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_creados integer := 0;
begin
  if not (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(p_empleado))) then
    raise exception 'No tienes permiso para planificar turnos';
  end if;
  if p_hasta < p_desde or p_hasta - p_desde > 186 then
    raise exception 'Rango de fechas no válido (máximo 6 meses)';
  end if;

  with dias as (
    select d::date as fecha from generate_series(p_desde, p_hasta, interval '1 day') d
  ),
  nuevos as (
    insert into turnos (empleado_id, centro_id, fecha, hora_inicio, hora_fin, pausa_min)
    select pt.empleado_id, pt.centro_id, dias.fecha, pt.hora_inicio, pt.hora_fin, pt.pausa_min
    from plantillas_turno pt
    join dias on extract(dow from dias.fecha)::int = pt.dia_semana
    where pt.empleado_id = p_empleado and pt.activo
    on conflict (empleado_id, fecha, hora_inicio) do nothing
    returning 1
  )
  select count(*) into v_creados from nuevos;

  return v_creados;
end $$;

-- ----------------------------------------------------------------------------
-- Vista de estado actual (para el panel del responsable)
-- ----------------------------------------------------------------------------
create or replace view estado_actual
with (security_invoker = on) as
select
  p.id            as empleado_id,
  p.nombre,
  p.centro_id,
  c.nombre        as centro,
  f.tipo          as ultimo_tipo,
  f.ts            as ultimo_ts,
  f.dentro_radio  as ultimo_dentro_radio,
  case
    when f.tipo is null or f.tipo = 'salida' then 'fuera'
    when f.tipo = 'pausa_inicio'             then 'pausa'
    else 'dentro'
  end as estado
from perfiles p
left join centros c on c.id = p.centro_id
left join lateral (
  select tipo, ts, dentro_radio
  from fichajes
  where empleado_id = p.id and anulado_en is null
  order by ts desc, creado_en desc
  limit 1
) f on true
where p.activo;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table centros            enable row level security;
alter table perfiles           enable row level security;
alter table fichajes           enable row level security;
alter table plantillas_turno   enable row level security;
alter table turnos             enable row level security;
alter table push_suscripciones enable row level security;
alter table avisos             enable row level security;
alter table ausencias          enable row level security;
alter table partes_trabajo     enable row level security;

-- centros: los ve cualquiera autenticado; solo admin los toca.
drop policy if exists centros_select on centros;
create policy centros_select on centros for select to authenticated using (true);
drop policy if exists centros_admin on centros;
create policy centros_admin on centros for all to authenticated
  using (es_admin()) with check (es_admin());

-- perfiles: yo, o los que puedo ver por rol. Solo admin edita rol/centro/horas.
drop policy if exists perfiles_select on perfiles;
create policy perfiles_select on perfiles for select to authenticated
  using (puedo_ver_empleado(id));
drop policy if exists perfiles_update_propio on perfiles;
create policy perfiles_update_propio on perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists perfiles_admin on perfiles;
create policy perfiles_admin on perfiles for all to authenticated
  using (es_admin()) with check (es_admin());

-- fichajes: lectura según rol. Escritura SOLO vía las funciones de arriba.
drop policy if exists fichajes_select on fichajes;
create policy fichajes_select on fichajes for select to authenticated
  using (puedo_ver_empleado(empleado_id));
-- Sin políticas de insert/update/delete: el registro legal es inmutable desde
-- el cliente. Las correcciones dejan un fichaje nuevo con origen 'manual'.

-- plantillas y turnos: el empleado los ve; admin/encargado los gestionan.
drop policy if exists plantillas_select on plantillas_turno;
create policy plantillas_select on plantillas_turno for select to authenticated
  using (puedo_ver_empleado(empleado_id));
drop policy if exists plantillas_gestion on plantillas_turno;
create policy plantillas_gestion on plantillas_turno for all to authenticated
  using (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(empleado_id)))
  with check (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(empleado_id)));

drop policy if exists turnos_select on turnos;
create policy turnos_select on turnos for select to authenticated
  using (puedo_ver_empleado(empleado_id));
drop policy if exists turnos_gestion on turnos;
create policy turnos_gestion on turnos for all to authenticated
  using (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(empleado_id)))
  with check (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(empleado_id)));

-- ausencias: cada uno ve las suyas; el responsable las de su gente. La
-- escritura va solo por las funciones ausencia_solicitar / ausencia_decidir.
drop policy if exists ausencias_select on ausencias;
create policy ausencias_select on ausencias for select to authenticated
  using (puedo_ver_empleado(empleado_id));
-- Sin insert/update/delete: el historial de decisiones no se manipula a mano.

-- partes de trabajo: los escribe la persona, los lee su responsable.
drop policy if exists partes_select on partes_trabajo;
create policy partes_select on partes_trabajo for select to authenticated
  using (puedo_ver_empleado(empleado_id));

-- push: cada uno gestiona sus propios dispositivos.
drop policy if exists push_propio on push_suscripciones;
create policy push_propio on push_suscripciones for all to authenticated
  using (empleado_id = auth.uid()) with check (empleado_id = auth.uid());

-- avisos: cada uno lee los suyos (y el responsable los de su gente).
drop policy if exists avisos_select on avisos;
create policy avisos_select on avisos for select to authenticated
  using (
    coalesce(destinatario_id, empleado_id) = auth.uid()
    or puedo_ver_empleado(empleado_id)
  );
drop policy if exists avisos_marcar on avisos;
create policy avisos_marcar on avisos for update to authenticated
  using (coalesce(destinatario_id, empleado_id) = auth.uid())
  with check (coalesce(destinatario_id, empleado_id) = auth.uid());

-- ----------------------------------------------------------------------------
-- Justificantes: bucket PRIVADO
--
-- Un parte médico es dato de categoría especial (art. 9 RGPD). El bucket no es
-- público: se lee siempre por URL firmada de corta duración, generada en el
-- servidor. Cada persona solo puede subir dentro de su propia carpeta.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'justificantes', 'justificantes', false, 8388608,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','application/pdf'];

-- La primera carpeta de la ruta es el id de la persona: justificantes/<uid>/…
drop policy if exists justificantes_subir on storage.objects;
create policy justificantes_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'justificantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists justificantes_leer on storage.objects;
create policy justificantes_leer on storage.objects for select to authenticated
  using (
    bucket_id = 'justificantes'
    and puedo_ver_empleado(((storage.foldername(name))[1])::uuid)
  );

-- Nadie borra ni sobrescribe un justificante desde el cliente.

-- ----------------------------------------------------------------------------
-- Permisos de ejecución
-- ----------------------------------------------------------------------------
revoke all on function fichar(text, double precision, double precision, numeric, timestamptz, text) from public, anon;
grant execute on function fichar(text, double precision, double precision, numeric, timestamptz, text) to authenticated;
revoke all on function fichaje_manual(uuid, text, timestamptz, text) from public, anon;
grant execute on function fichaje_manual(uuid, text, timestamptz, text) to authenticated;
revoke all on function generar_turnos(uuid, date, date) from public, anon;
grant execute on function generar_turnos(uuid, date, date) to authenticated;
revoke all on function fichaje_anular(uuid, text) from public, anon;
grant execute on function fichaje_anular(uuid, text) to authenticated;
revoke all on function fichaje_corregir(uuid, timestamptz, text, text) from public, anon;
grant execute on function fichaje_corregir(uuid, timestamptz, text, text) to authenticated;
-- Estas dos las llaman otras funciones, nunca el cliente.
revoke all on function avisar_responsables(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function avisar_empleado(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function hora_local_txt(timestamptz, uuid) from public, anon, authenticated;
revoke all on function ausencia_solicitar(text, date, date, text, uuid, text) from public, anon;
grant execute on function ausencia_solicitar(text, date, date, text, uuid, text) to authenticated;
revoke all on function ausencia_decidir(uuid, text, text) from public, anon;
grant execute on function ausencia_decidir(uuid, text, text) to authenticated;
revoke all on function parte_guardar(date, text) from public, anon;
grant execute on function parte_guardar(date, text) to authenticated;
-- La purga la llama la tarea programada con service_role, no el cliente.
revoke all on function purgar_ubicaciones(integer) from public, anon, authenticated;
