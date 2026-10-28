import { BadRequestException } from '@nestjs/common';

/** Fecha de calendario elegida por la persona. Se guarda al mediodía UTC para que no cambie de día. */
export function fechaCalendario(valor?: string | null): Date | undefined {
  if (valor == null || valor === '') return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new BadRequestException('Use una fecha válida');
  }
  return new Date(`${valor}T12:00:00.000Z`);
}

export function exigirFecha(valor?: string | null): Date {
  const fecha = fechaCalendario(valor);
  if (!fecha) throw new BadRequestException('Elija la fecha');
  return fecha;
}
