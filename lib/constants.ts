// Fuente única de verdad: tipos de fichaje, transiciones, roles y umbrales.
// Si cambias algo aquí, replica el CHECK / la transición en db/schema.sql.

export const ROLES = ['admin', 'encargado', 'empleado'] as const
export type Rol = (typeof ROLES)[number]

export const TIPOS_FICHAJE = ['entrada', 'pausa_inicio', 'pausa_fin', 'salida'] as const
export type TipoFichaje = (typeof TIPOS_FICHAJE)[number]

export const ETIQUETA_TIPO: Record<TipoFichaje, string> = {
  entrada: 'Entrada',
  pausa_inicio: 'Inicio de pausa',
  pausa_fin: 'Fin de pausa',
  salida: 'Salida',
}

/** Qué puede fichar alguien según su último movimiento. Espeja fichar() en SQL. */
export const SIGUIENTES: Record<'ninguno' | TipoFichaje, readonly TipoFichaje[]> = {
  ninguno: ['entrada'],
  salida: ['entrada'],
  entrada: ['pausa_inicio', 'salida'],
  pausa_inicio: ['pausa_fin'],
  pausa_fin: ['pausa_inicio', 'salida'],
}

export type EstadoPresencia = 'dentro' | 'pausa' | 'fuera'

export const ETIQUETA_ESTADO: Record<EstadoPresencia, string> = {
  dentro: 'Trabajando',
  pausa: 'En pausa',
  fuera: 'Fuera',
}

export function estadoDesdeUltimo(ultimo: TipoFichaje | null): EstadoPresencia {
  if (!ultimo || ultimo === 'salida') return 'fuera'
  if (ultimo === 'pausa_inicio') return 'pausa'
  return 'dentro'
}

export const ANOMALIAS = [
  'sin_salida',
  'pausa_abierta',
  'fuera_de_radio',
  'sin_ubicacion',
  'turno_sin_fichar',
  'corregido',
] as const
export type Anomalia = (typeof ANOMALIAS)[number]

export const ETIQUETA_ANOMALIA: Record<Anomalia, string> = {
  sin_salida: 'Sin salida',
  pausa_abierta: 'Pausa sin cerrar',
  fuera_de_radio: 'Fuera del centro',
  sin_ubicacion: 'Sin ubicación',
  turno_sin_fichar: 'Turno sin fichar',
  corregido: 'Corregido a mano',
}

export const ETIQUETA_AVISO = {
  sin_entrada: 'Falta la entrada',
  jornada_abierta: 'Jornada abierta',
  turno_sin_fichar: 'Turno sin fichar',
  fichaje_fuera_radio: 'Fichaje fuera del centro',
  fichaje_corregido: 'Fichaje corregido',
  resumen_encargado: 'Resumen',
} as const

export const ETIQUETA_ORIGEN = {
  app: 'App',
  offline: 'Sin cobertura',
  manual: 'Alta manual',
} as const

// --- Umbrales de negocio -----------------------------------------------------

/** Minutos de cortesía tras el inicio del turno antes de avisar. */
export const TOLERANCIA_ENTRADA_MIN = 10
/** Minutos tras el fin del turno antes de avisar de jornada abierta. */
export const TOLERANCIA_SALIDA_MIN = 20
/** Radio por defecto de un centro nuevo, en metros. */
export const RADIO_DEFECTO_M = 150
/** Por encima de esta precisión el GPS no es fiable: se pide reintento. */
export const PRECISION_ACEPTABLE_M = 200
/** Zona horaria de referencia para agrupar por día natural. */
export const TZ = 'Europe/Madrid'
/** Años de conservación obligatoria del registro (art. 34.9 ET). */
export const ANIOS_CONSERVACION = 4

export const DIAS_SEMANA = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
] as const
export const DIAS_SEMANA_CORTO = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const
