'use client';

import { EstadoMaquina } from '@retimax/shared-types';
import { ESTADO_COLORS, ESTADO_LABELS } from '@/lib/labels';

const PIPELINE_COMPRA: EstadoMaquina[] = [
  EstadoMaquina.COMPRADA_ITALIA,
  EstadoMaquina.EN_TRANSITO,
  EstadoMaquina.RECIBIDA,
  EstadoMaquina.EN_DIAGNOSTICO,
  EstadoMaquina.EN_MANTENIMIENTO,
  EstadoMaquina.LISTA_PARA_VENTA,
];

const PIPELINE_RESERVA: EstadoMaquina[] = [
  EstadoMaquina.RESERVADA,
  EstadoMaquina.EN_TRANSITO,
  EstadoMaquina.RECIBIDA,
  EstadoMaquina.EN_DIAGNOSTICO,
  EstadoMaquina.EN_MANTENIMIENTO,
  EstadoMaquina.LISTA_PARA_VENTA,
];

type Props = {
  estadoActual: EstadoMaquina;
  esReserva?: boolean;
};

export function getPipelineForMaquina(estadoActual: EstadoMaquina, esReserva?: boolean): EstadoMaquina[] {
  if (esReserva || estadoActual === EstadoMaquina.RESERVADA) {
    return PIPELINE_RESERVA;
  }
  return PIPELINE_COMPRA;
}

export function EstadoPipeline({ estadoActual, esReserva }: Props) {
  const pipeline = getPipelineForMaquina(estadoActual, esReserva);
  const currentIdx = pipeline.indexOf(estadoActual);

  const hint: Partial<Record<EstadoMaquina, string>> = {
    [EstadoMaquina.COMPRADA_ITALIA]:
      'Máquina registrada. Confirma el despacho con fecha de salida.',
    [EstadoMaquina.RESERVADA]:
      'Máquina reservada para un cliente. Sigue el flujo cuando llegue al taller.',
    [EstadoMaquina.EN_TRANSITO]:
      'En camino. Al llegar al taller, marca como recibida.',
    [EstadoMaquina.RECIBIDA]:
      'Verifica cómo llegó vs. lo acordado y sube fotos de llegada.',
    [EstadoMaquina.EN_DIAGNOSTICO]:
      'Registra observaciones por área y asigna responsables. Finaliza cuando esté completo.',
    [EstadoMaquina.EN_MANTENIMIENTO]:
      'Supervisa los trabajos asignados en diagnóstico. Aprueba cuando finalicen.',
    [EstadoMaquina.LISTA_PARA_VENTA]:
      'Define precios y pasa al módulo de ventas para concretar la operación.',
    [EstadoMaquina.VENDIDA]: 'Venta registrada — consulta reportes.',
  };

  if (estadoActual === EstadoMaquina.VENDIDA) {
    return (
      <div className="rounded-xl bg-white border p-5">
        <h3 className="font-semibold mb-2">Estado de la máquina</h3>
        <span className={`inline-block px-3 py-1 rounded-full text-white text-sm ${ESTADO_COLORS.VENDIDA}`}>
          {ESTADO_LABELS.VENDIDA}
        </span>
        <p className="mt-3 text-sm text-[#6c757d]">{hint.VENDIDA}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border p-5">
      <h3 className="font-semibold mb-1">Estado de la máquina</h3>
      <p className="text-sm text-[#6c757d] mb-4">
        Flujo: {esReserva ? 'reserva' : 'compra'} → tránsito → recepción → diagnóstico → mantenimiento → venta
      </p>

      <div className="flex flex-wrap gap-1 mb-4">
        {pipeline.map((estado, idx) => {
          const isPast = currentIdx >= 0 && idx < currentIdx;
          const isCurrent = estado === estadoActual;
          const isFuture = currentIdx >= 0 && idx > currentIdx;
          return (
            <div key={estado} className="flex items-center gap-1">
              <div
                className={`px-2 py-1 rounded text-xs font-medium ${
                  isCurrent
                    ? `${ESTADO_COLORS[estado]} text-white ring-2 ring-[#f5c842] ring-offset-1`
                    : isPast
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-400'
                }`}
                title={ESTADO_LABELS[estado]}
              >
                {isFuture && !isCurrent ? '○' : isPast ? '✓' : '●'}{' '}
                <span className="hidden sm:inline">{ESTADO_LABELS[estado]}</span>
                <span className="sm:hidden">{idx + 1}</span>
              </div>
              {idx < pipeline.length - 1 && (
                <span className={`text-xs ${isPast ? 'text-green-500' : 'text-gray-300'}`}>→</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-[#f8f9fa] p-3 text-sm">
        <p>
          <span className="font-medium">Estado actual:</span>{' '}
          <span
            className={`inline-block px-2 py-0.5 rounded text-white text-xs ${ESTADO_COLORS[estadoActual]}`}
          >
            {ESTADO_LABELS[estadoActual]}
          </span>
        </p>
        <p className="mt-2 text-[#6c757d]">{hint[estadoActual]}</p>
      </div>
    </div>
  );
}
