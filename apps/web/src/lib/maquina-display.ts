import { MaquinaDto } from '@retimax/shared-types';

/** Título principal: nombre ingresado por el usuario */
export function maquinaNombrePrincipal(m: Pick<MaquinaDto, 'nombre'>): string {
  return m.nombre.trim();
}

/** Nombre más marca y modelo, para no confundir dos máquinas con el mismo nombre. */
export function maquinaNombreConMarca(
  m: { nombre: string; marca?: string | null; modelo?: string | null },
): string {
  const extra = [m.marca, m.modelo].filter((parte) => parte?.trim()).join(' · ');
  return extra ? `${m.nombre.trim()} · ${extra}` : m.nombre.trim();
}

/** Línea de detalle: tipo · marca · modelo · año */
export function maquinaDetalleLinea(
  m: Pick<MaquinaDto, 'tipo' | 'marca' | 'modelo' | 'anio'>,
): string {
  const parts = [m.tipo, m.marca, m.modelo].filter((p) => p?.trim());
  let line = parts.join(' · ');
  if (m.anio != null) {
    line = line ? `${line} · ${m.anio}` : String(m.anio);
  }
  return line || '—';
}

/** @deprecated usar maquinaNombrePrincipal + maquinaDetalleLinea */
export function maquinaTitulo(m: Pick<MaquinaDto, 'tipo' | 'marca' | 'nombre'>): string {
  return m.nombre?.trim() || `${m.tipo} ${m.marca}`.replace(/\s+/g, ' ').trim();
}

/** @deprecated usar maquinaDetalleLinea */
export function maquinaSubtitulo(m: Pick<MaquinaDto, 'modelo'>): string {
  return m.modelo;
}

export function maquinaEtiquetaCorta(
  m: Pick<MaquinaDto, 'nombre' | 'tipo' | 'marca' | 'modelo'>,
): string {
  return `${maquinaNombrePrincipal(m)} · ${m.modelo}`;
}
