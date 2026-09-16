-- El administrador puede añadir una nota interna a un fichaje (normalmente
-- uno fuera de radio) explicando por qué pasó. No cambia el registro legal
-- (ts, distancia, dentro_radio siguen igual) y no avisa a la persona: es un
-- apunte de gestión, no una corrección.

alter table fichajes add column if not exists justificacion text;
alter table fichajes add column if not exists justificado_por uuid references perfiles(id) on delete set null;
alter table fichajes add column if not exists justificado_en timestamptz;

create or replace function fichaje_justificar(
  p_fichaje uuid,
  p_nota    text
) returns fichajes
language plpgsql security definer set search_path = public as $$
declare v_row fichajes;
begin
  select * into v_row from fichajes where id = p_fichaje;
  if v_row.id is null then raise exception 'El fichaje no existe'; end if;
  if not es_admin() then
    raise exception 'Solo un administrador puede justificar un fichaje';
  end if;
  if p_nota is null or length(trim(p_nota)) < 3 then
    raise exception 'Justificar un fichaje necesita una nota';
  end if;

  update fichajes
  set justificado_por = auth.uid(),
      justificado_en = now(),
      justificacion = trim(p_nota)
  where id = p_fichaje
  returning * into v_row;

  return v_row;
end $$;

revoke all on function fichaje_justificar(uuid, text) from public, anon;
grant execute on function fichaje_justificar(uuid, text) to authenticated;

select column_name from information_schema.columns
where table_name = 'fichajes' and column_name in ('justificacion','justificado_por','justificado_en');
