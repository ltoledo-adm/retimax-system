import { EstadoAprobacion, EstadoIntervencion, IntervencionDto } from '@retimax/shared-types';

/** Trabajo enviado por el técnico y pendiente de validación del administrador. */
export function esPendienteAprobacion(i: IntervencionDto): boolean {
  if (i.estadoIntervencion === EstadoIntervencion.FINALIZADO) return true;
  if (
    i.estadoAprobacion === EstadoAprobacion.PENDIENTE &&
    i.fechaFinalizacion &&
    i.estadoIntervencion !== EstadoIntervencion.APROBADO
  ) {
    return true;
  }
  return false;
}

export function esTrabajoEnCurso(i: IntervencionDto): boolean {
  if (esPendienteAprobacion(i)) return false;
  if (i.estadoIntervencion === EstadoIntervencion.APROBADO) return false;
  return (
    i.estadoIntervencion === EstadoIntervencion.ASIGNADO ||
    i.estadoIntervencion === EstadoIntervencion.EN_PROCESO ||
    i.estadoIntervencion === EstadoIntervencion.RECHAZADO ||
    !i.estadoIntervencion
  );
}
