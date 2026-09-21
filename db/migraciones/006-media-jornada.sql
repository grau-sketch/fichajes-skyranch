-- Nuevo tipo de ausencia "media_jornada": una nota del administrador de que
-- esa persona trabajó solo medio día por algún motivo. A propósito, no reduce
-- el objetivo de horas ni descuenta días de vacaciones/permisos, y no bloquea
-- otras ausencias en las mismas fechas — es solo un apunte para el registro.

alter table ausencias drop constraint if exists ausencias_tipo_check;
alter table ausencias add constraint ausencias_tipo_check check (tipo in (
  'vacaciones',
  'baja',
  'permiso',
  'asuntos_propios',
  'falta',
  'media_jornada'
));

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
  if p_tipo = 'media_jornada' and not v_gestor then
    raise exception 'Solo un responsable puede anotar una media jornada';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha de fin es anterior a la de inicio';
  end if;
  if p_hasta - p_desde > 180 then
    raise exception 'El periodo es demasiado largo (máximo 6 meses)';
  end if;

  if exists (
    select 1 from ausencias a
    where a.empleado_id = v_para
      and a.estado in ('pendiente','aprobada')
      and a.tipo <> 'media_jornada'
      and a.desde <= p_hasta and a.hasta >= p_desde
  ) then
    raise exception 'Ya hay una ausencia en esas fechas';
  end if;

  insert into ausencias (
    empleado_id, tipo, desde, hasta, motivo, justificante, creado_por,
    estado, decidido_por, decidido_en
  ) values (
    v_para, p_tipo, p_desde, p_hasta, nullif(trim(p_motivo), ''), p_justificante, auth.uid(),
    case when v_gestor then 'aprobada' else 'pendiente' end,
    case when v_gestor then auth.uid() end,
    case when v_gestor then now() end
  )
  returning * into v_row;

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
      and a.tipo <> 'media_jornada'
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
