-- El administrador puede corregir una ausencia ya decidida (fecha, tipo o
-- motivo equivocados), sin borrar el historial: queda quién la corrigió,
-- cuándo y por qué, igual que las correcciones de fichajes.

alter table ausencias add column if not exists editado_por uuid references perfiles(id) on delete set null;
alter table ausencias add column if not exists editado_en timestamptz;
alter table ausencias add column if not exists nota_edicion text;

alter table avisos drop constraint if exists avisos_tipo_check;
alter table avisos add constraint avisos_tipo_check check (tipo in (
  'sin_entrada',
  'jornada_abierta',
  'turno_sin_fichar',
  'fichaje_fuera_radio',
  'fichaje_corregido',
  'ausencia_pendiente',
  'ausencia_decidida',
  'ausencia_editada',
  'resumen_encargado'
));

create or replace function ausencia_editar(
  p_ausencia uuid,
  p_tipo     text,
  p_desde    date,
  p_hasta    date,
  p_motivo   text,
  p_nota     text
) returns ausencias
language plpgsql security definer set search_path = public as $$
declare v_row ausencias;
begin
  select * into v_row from ausencias where id = p_ausencia;
  if v_row.id is null then raise exception 'La ausencia no existe'; end if;

  if not es_admin() then
    raise exception 'Solo un administrador puede editar esta ausencia';
  end if;
  if v_row.estado = 'cancelada' then
    raise exception 'No se puede editar una ausencia cancelada';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha de fin es anterior a la de inicio';
  end if;
  if p_hasta - p_desde > 180 then
    raise exception 'El periodo es demasiado largo (máximo 6 meses)';
  end if;
  if p_nota is null or length(trim(p_nota)) < 3 then
    raise exception 'Editar una ausencia necesita un motivo';
  end if;

  if exists (
    select 1 from ausencias a
    where a.id <> p_ausencia
      and a.empleado_id = v_row.empleado_id
      and a.estado in ('pendiente','aprobada')
      and a.desde <= p_hasta and a.hasta >= p_desde
  ) then
    raise exception 'Ya hay otra ausencia en esas fechas';
  end if;

  update ausencias
  set tipo = p_tipo,
      desde = p_desde,
      hasta = p_hasta,
      motivo = nullif(trim(p_motivo), ''),
      editado_por = auth.uid(),
      editado_en = now(),
      nota_edicion = trim(p_nota)
  where id = p_ausencia
  returning * into v_row;

  if v_row.empleado_id <> auth.uid() then
    perform avisar_empleado(
      v_row.empleado_id, null, 'ausencia_editada',
      'Se corrigió tu ausencia',
      format('%s del %s al %s. Motivo: %s',
             initcap(replace(v_row.tipo, '_', ' ')),
             to_char(v_row.desde, 'DD/MM/YYYY'),
             to_char(v_row.hasta, 'DD/MM/YYYY'),
             v_row.nota_edicion)
    );
  end if;

  return v_row;
end $$;

revoke all on function ausencia_editar(uuid, text, date, date, text, text) from public, anon;
grant execute on function ausencia_editar(uuid, text, date, date, text, text) to authenticated;

-- Comprobación: deben aparecer las 3 columnas nuevas.
select column_name from information_schema.columns
where table_name = 'ausencias' and column_name in ('editado_por','editado_en','nota_edicion');
