-- Migración: días libres planificados.
--
-- Un día de descanso se guarda como una fila de `turnos` con estado 'libre' y
-- hora_inicio = hora_fin, para que el trabajador lo vea en su calendario y
-- para que la app no espere ningún fichaje ese día.
--
-- Se puede pasar tantas veces como quieras. Editor SQL de Supabase → Run.

alter table turnos drop constraint if exists turnos_estado_check;
alter table turnos add constraint turnos_estado_check
  check (estado in ('planificado','confirmado','cancelado','libre'));

create unique index if not exists turnos_libre_unico
  on turnos (empleado_id, fecha) where estado = 'libre';

-- Comprobación: debe devolver 'libre' entre los estados permitidos.
select pg_get_constraintdef(oid) as estados_permitidos
from pg_constraint
where conrelid = 'turnos'::regclass and conname = 'turnos_estado_check';
