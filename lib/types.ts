import type { Rol, TipoFichaje } from './constants'

export type Centro = {
  id: string
  nombre: string
  direccion: string | null
  lat: number | null
  lon: number | null
  radio_m: number
  tz: string
  activo: boolean
}

export type Perfil = {
  id: string
  nombre: string
  email: string | null
  rol: Rol
  centro_id: string | null
  horas_semana: number
  activo: boolean
}

export type Fichaje = {
  id: string
  empleado_id: string
  centro_id: string | null
  tipo: TipoFichaje
  ts: string
  lat: number | null
  lon: number | null
  precision_m: number | null
  distancia_m: number | null
  dentro_radio: boolean | null
  origen: 'app' | 'offline' | 'manual'
  nota: string | null
  editado_por: string | null
  editado_en: string | null
  anulado_por: string | null
  anulado_en: string | null
  motivo_anulacion: string | null
  /** Si es una corrección, el id del fichaje que sustituye. */
  corrige_a: string | null
  /** Cuándo llegó a la base (distinto de `ts` en fichajes offline o manuales). */
  creado_en: string
}

export type Turno = {
  id: string
  empleado_id: string
  centro_id: string | null
  fecha: string
  hora_inicio: string
  hora_fin: string
  pausa_min: number
  estado: 'planificado' | 'confirmado' | 'cancelado'
  nota: string | null
}

export type PlantillaTurno = {
  id: string
  empleado_id: string
  centro_id: string | null
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  pausa_min: number
  activo: boolean
}

export type TipoAviso =
  | 'sin_entrada'
  | 'jornada_abierta'
  | 'turno_sin_fichar'
  | 'fichaje_fuera_radio'
  | 'fichaje_corregido'
  | 'resumen_encargado'

export type Aviso = {
  id: string
  /** Persona a la que se refiere el aviso. */
  empleado_id: string
  /** Persona que lo recibe. Null = el propio empleado. */
  destinatario_id: string | null
  turno_id: string | null
  fichaje_id: string | null
  tipo: TipoAviso
  titulo: string
  cuerpo: string
  enviado_en: string
  leido_en: string | null
}

export type EstadoActual = {
  empleado_id: string
  nombre: string
  centro_id: string | null
  centro: string | null
  ultimo_tipo: TipoFichaje | null
  ultimo_ts: string | null
  ultimo_dentro_radio: boolean | null
  estado: 'dentro' | 'pausa' | 'fuera'
}
