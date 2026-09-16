-- El administrador puede anular cualquier ausencia ya decidida (no solo las
-- pendientes de la propia persona), con motivo obligatorio. Es lo más
-- parecido a "eliminarla" que se permite sin perder el rastro: deja de contar
-- para las horas, pero sigue en el historial.

create or replace function ausencia_decidir(
  p_ausencia uuid,
  p_estado   text,
  p_nota     text default null
) returns ausencias
language plpgsql security definer set search_path = public as $$
declare v_row ausencias; v_autocancela boolean;
begin
  if p_estado not in ('aprobada','rechazada','cancelada') then
    raise exception 'Decisión no válida';
  end if;

  select * into v_row from ausencias where id = p_ausencia;
  if v_row.id is null then raise exception 'La ausencia no existe'; end if;

  v_autocancela := p_estado = 'cancelada' and v_row.empleado_id = auth.uid() and v_row.estado = 'pendiente';

  if v_autocancela then
    null;
  elsif p_estado = 'cancelada' then
    if not es_admin() then
      raise exception 'Solo un administrador puede anular esta ausencia';
    end if;
  elsif not (es_admin() or (mi_rol() = 'encargado' and puedo_ver_empleado(v_row.empleado_id))) then
    raise exception 'No tienes permiso para decidir esta ausencia';
  end if;

  if p_estado = 'rechazada' and (p_nota is null or length(trim(p_nota)) < 3) then
    raise exception 'Rechazar una solicitud necesita motivo';
  end if;
  if p_estado = 'cancelada' and not v_autocancela and (p_nota is null or length(trim(p_nota)) < 3) then
    raise exception 'Anular una ausencia necesita un motivo';
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
      case p_estado
        when 'aprobada' then 'Ausencia aprobada'
        when 'rechazada' then 'Ausencia rechazada'
        else 'Ausencia anulada'
      end,
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
