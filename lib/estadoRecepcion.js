export const EstadoRecepcion = {
  PENDIENTE: 'PENDIENTE',
  EN_PROCESO: 'EN_PROCESO',
  COMPLETADA: 'COMPLETADA',
  ELIMINADA: 'ELIMINADA'
};

export function determineStateFromContent(recepcion) {
  if (recepcion.eliminado) return EstadoRecepcion.ELIMINADA;
  if (recepcion.estado === EstadoRecepcion.COMPLETADA) return EstadoRecepcion.COMPLETADA;
  if (recepcion.bitacoras && recepcion.bitacoras.length > 0) return EstadoRecepcion.EN_PROCESO;
  return EstadoRecepcion.CREADA;
}

export function isEditable(estado) {
  return estado === EstadoRecepcion.CREADA || estado === EstadoRecepcion.EN_PROCESO;
}