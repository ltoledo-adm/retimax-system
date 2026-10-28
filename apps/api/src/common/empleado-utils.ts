import { AreaIntervencion, Especialidad } from '@prisma/client';

export function areaPrincipal(especialidad: Especialidad): AreaIntervencion {
  switch (especialidad) {
    case Especialidad.MECANICO:
      return AreaIntervencion.MECANICA;
    case Especialidad.ELECTRICO:
      return AreaIntervencion.ELECTRICA;
    case Especialidad.PINTOR:
      return AreaIntervencion.PINTADO;
    default:
      return AreaIntervencion.MANTENIMIENTO_GENERAL;
  }
}

export function areasForEspecialidad(especialidad: Especialidad): AreaIntervencion[] {
  switch (especialidad) {
    case Especialidad.MECANICO:
      return [AreaIntervencion.MECANICA];
    case Especialidad.ELECTRICO:
      return [AreaIntervencion.ELECTRICA];
    case Especialidad.PINTOR:
      return [AreaIntervencion.PINTADO];
    case Especialidad.MANTENIMIENTO_GENERAL:
    case Especialidad.OTRO:
    default:
      return [
        AreaIntervencion.MECANICA,
        AreaIntervencion.ELECTRICA,
        AreaIntervencion.PINTADO,
        AreaIntervencion.MANTENIMIENTO_GENERAL,
      ];
  }
}

export function buildMaquinaNombre(tipo: string, marca: string, modelo: string): string {
  return `${tipo} ${marca} ${modelo}`.replace(/\s+/g, ' ').trim();
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function suggestUsernameFromEmpleado(
  carnet: string | undefined,
  nombre: string,
  apellido: string,
): string {
  if (carnet?.trim()) return normalizeUsername(carnet);
  const base = `${nombre.charAt(0)}${apellido}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return base || 'empleado';
}
