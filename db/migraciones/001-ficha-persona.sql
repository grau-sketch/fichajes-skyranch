-- Migración: ficha de persona (fecha de nacimiento, teléfono, vacaciones).
--
-- Se puede pasar tantas veces como quieras: no borra ni sobrescribe nada, solo
-- añade las columnas si faltan. Editor SQL de Supabase → pegar → Run.

alter table perfiles add column if not exists dias_vacaciones smallint not null default 30;
alter table perfiles add column if not exists fecha_nacimiento date;
alter table perfiles add column if not exists telefono text;

-- El check del rango solo si no está ya puesto.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'perfiles'::regclass and conname = 'perfiles_dias_vacaciones_check'
  ) then
    alter table perfiles
      add constraint perfiles_dias_vacaciones_check
      check (dias_vacaciones between 0 and 60);
  end if;
end $$;

-- Comprobación: las tres columnas y tu rol de administrador.
select
  (select count(*) from information_schema.columns
     where table_name = 'perfiles'
       and column_name in ('dias_vacaciones','fecha_nacimiento','telefono')) as columnas_de_3,
  (select rol from perfiles where nombre ilike 'carlos%') as rol_de_carlos;
