'use client';

import { EstadoIntervencion, ImagenMaquinaDto, IntervencionDto } from '@retimax/shared-types';
import { formatDateTime } from '@/lib/dates';
import { esPendienteAprobacion, esTrabajoEnCurso } from '@/lib/intervencion-status';
import { AREA_LABELS } from '@/lib/labels';

type Props = {
  trabajos: IntervencionDto[];
  imagenes: ImagenMaquinaDto[];
  onListaParaVenta: () => void;
  actionLoading: boolean;
  todosTrabajosAprobados: boolean;
  onAprobar: (id: string) => void;
  onRechazar: (id: string) => void;
};

function fotosDeTrabajo(imagenes: ImagenMaquinaDto[], intervencionId: string) {
  return imagenes.filter((img) => img.intervencionId === intervencionId);
}

function TrabajoCard({
  i,
  imagenes,
  onAprobar,
  onRechazar,
  modo,
}: {
  i: IntervencionDto;
  imagenes: ImagenMaquinaDto[];
  onAprobar: (id: string) => void;
  onRechazar: (id: string) => void;
  modo: 'pendiente' | 'curso' | 'aprobado';
}) {
  const fotos = fotosDeTrabajo(imagenes, i.id);

  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="font-medium">
        {AREA_LABELS[i.area]} — {i.responsableNombre ?? i.responsable?.nombreCompleto}
      </p>
      <p className="text-[#6c757d] mt-1 text-xs">Orden (diagnóstico): {i.descripcion}</p>

      {modo === 'pendiente' && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
          Trabajo enviado. Esperando aprobación del administrador.
        </p>
      )}

      {i.detalleTrabajo && (
        <p className="mt-2 bg-gray-50 p-2 rounded text-sm">
          <span className="font-medium">Trabajo realizado:</span> {i.detalleTrabajo}
        </p>
      )}
      {i.observaciones && (
        <p className="mt-1 text-[#6c757d] text-xs">Observaciones del técnico: {i.observaciones}</p>
      )}

      {fotos.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium mb-1">Fotos del trabajo</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {fotos.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.thumbnailUrl || f.url}
                  alt=""
                  className="h-16 w-full object-cover rounded border"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-[#6c757d] mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
        <p>Estado: {(i.estadoIntervencion ?? 'ASIGNADO').replace(/_/g, ' ')}</p>
        <p>Asignado: {formatDateTime(i.fechaAsignacion ?? i.createdAt)}</p>
        {i.fechaInicio && <p>Inicio: {formatDateTime(i.fechaInicio)}</p>}
        {i.fechaFinalizacion && <p>Finalizado: {formatDateTime(i.fechaFinalizacion)}</p>}
        {i.fechaAprobacion && <p>Aprobado: {formatDateTime(i.fechaAprobacion)}</p>}
      </div>

      {modo === 'pendiente' && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => onAprobar(i.id)}
            className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg font-semibold"
          >
            Validar trabajo
          </button>
          <button
            type="button"
            onClick={() => onRechazar(i.id)}
            className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
          >
            Rechazar
          </button>
        </div>
      )}

      {modo === 'curso' && esPendienteAprobacion(i) && (
        <div className="flex flex-wrap gap-2 mt-3">
          <p className="w-full text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Trabajo enviado. Esperando aprobación del administrador.
          </p>
          <button
            type="button"
            onClick={() => onAprobar(i.id)}
            className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg font-semibold"
          >
            Validar trabajo
          </button>
          <button
            type="button"
            onClick={() => onRechazar(i.id)}
            className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
          >
            Rechazar
          </button>
        </div>
      )}

      {modo === 'aprobado' && (
        <p className="text-xs text-green-700 mt-2 font-medium">Trabajo aprobado y registrado.</p>
      )}
    </div>
  );
}

export function MantenimientoPanel({
  trabajos,
  imagenes,
  onListaParaVenta,
  actionLoading,
  todosTrabajosAprobados,
  onAprobar,
  onRechazar,
}: Props) {
  const pendientes = trabajos.filter((i) => esPendienteAprobacion(i));
  const aprobados = trabajos.filter((i) => i.estadoIntervencion === EstadoIntervencion.APROBADO);
  const enCurso = trabajos.filter((i) => esTrabajoEnCurso(i));

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm text-[#6c757d]">
        Supervise los trabajos asignados en diagnóstico: avance del técnico, fotos de respaldo y
        aprobación cuando envíen el trabajo.
      </p>

      {pendientes.length > 0 && (
        <div
          className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 space-y-1"
          role="alert"
        >
          <p className="text-base font-bold text-amber-900">
            Aprobación pendiente ({pendientes.length})
          </p>
          <p className="text-sm text-amber-900">
            Un técnico finalizó su trabajo. Revise el detalle abajo y pulse &quot;Validar
            trabajo&quot;.
          </p>
        </div>
      )}

      {trabajos.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            No hay trabajos asignados por área. Puede continuar a lista para venta si no aplica
            mantenimiento.
          </p>
          <button
            type="button"
            disabled={actionLoading}
            onClick={onListaParaVenta}
            className="rounded-lg bg-green-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Continuar → Lista para venta
          </button>
        </div>
      ) : (
        <>
          {pendientes.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Pendientes de aprobación</p>
              {pendientes.map((i) => (
                <TrabajoCard
                  key={i.id}
                  i={i}
                  imagenes={imagenes}
                  onAprobar={onAprobar}
                  onRechazar={onRechazar}
                  modo="pendiente"
                />
              ))}
            </div>
          )}

          {enCurso.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">En curso</p>
              {enCurso.map((i) => (
                <TrabajoCard
                  key={i.id}
                  i={i}
                  imagenes={imagenes}
                  onAprobar={onAprobar}
                  onRechazar={onRechazar}
                  modo="curso"
                />
              ))}
            </div>
          )}

          {aprobados.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Trabajos aprobados</p>
              {aprobados.map((i) => (
                <TrabajoCard
                  key={i.id}
                  i={i}
                  imagenes={imagenes}
                  onAprobar={onAprobar}
                  onRechazar={onRechazar}
                  modo="aprobado"
                />
              ))}
            </div>
          )}
        </>
      )}

      {todosTrabajosAprobados && trabajos.length > 0 && (
        <button
          type="button"
          disabled={actionLoading}
          onClick={onListaParaVenta}
          className="rounded-lg bg-green-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Trabajo terminado → Lista para venta
        </button>
      )}
    </div>
  );
}
