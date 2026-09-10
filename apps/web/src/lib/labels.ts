import {
  AreaIntervencion,
  EstadoMaquina,
  TipoIntervencion,
} from '@retimax/shared-types';

export const ESTADO_LABELS: Record<EstadoMaquina, string> = {
  COMPRADA_ITALIA: 'Comprada',
  EN_TRANSITO: 'En tránsito',
  RECIBIDA: 'Recibida',
  EN_DIAGNOSTICO: 'En diagnóstico',
  EN_MANTENIMIENTO: 'En mantenimiento',
  LISTA_PARA_VENTA: 'Lista para venta',
  RESERVADA: 'Reservada',
  VENDIDA: 'Vendida',
};

export const ESTADO_COLORS: Record<EstadoMaquina, string> = {
  COMPRADA_ITALIA: 'bg-slate-600',
  EN_TRANSITO: 'bg-blue-600',
  RECIBIDA: 'bg-cyan-600',
  EN_DIAGNOSTICO: 'bg-amber-600',
  EN_MANTENIMIENTO: 'bg-orange-600',
  LISTA_PARA_VENTA: 'bg-green-600',
  RESERVADA: 'bg-purple-600',
  VENDIDA: 'bg-neutral-500',
};

export const TIPO_INTERVENCION_LABELS: Record<TipoIntervencion, string> = {
  DIAGNOSTICO_INICIAL: 'Diagnóstico inicial',
  TRABAJO_REALIZADO: 'Trabajo realizado',
  OBSERVACION_ADICIONAL: 'Observación adicional',
};

export const AREA_LABELS: Record<AreaIntervencion, string> = {
  MECANICA: 'Mecánica',
  ELECTRICA: 'Eléctrica',
  PINTADO: 'Pintado',
  MANTENIMIENTO_GENERAL: 'Mantenimiento general',
};

export const ETAPA_LABELS: Record<string, string> = {
  EMBARQUE: 'Embarque',
  LLEGADA: 'Llegada (contenedor)',
  OTRA: 'Otras',
};

export function groupImagenesPorEtapa(imagenes: { etapa: string; id: string; thumbnailUrl: string; url: string }[]) {
  return imagenes.reduce<Record<string, typeof imagenes>>((acc, img) => {
    if (!acc[img.etapa]) acc[img.etapa] = [];
    acc[img.etapa].push(img);
    return acc;
  }, {});
}

export const NEXT_ESTADOS: Partial<Record<EstadoMaquina, EstadoMaquina[]>> = {
  COMPRADA_ITALIA: [EstadoMaquina.EN_TRANSITO],
  EN_TRANSITO: [EstadoMaquina.RECIBIDA],
  RECIBIDA: [EstadoMaquina.EN_DIAGNOSTICO],
  EN_DIAGNOSTICO: [EstadoMaquina.EN_MANTENIMIENTO],
  EN_MANTENIMIENTO: [EstadoMaquina.LISTA_PARA_VENTA],
  LISTA_PARA_VENTA: [],
  RESERVADA: [EstadoMaquina.EN_TRANSITO],
};
