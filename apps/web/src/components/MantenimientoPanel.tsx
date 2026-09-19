'use client';

import { EstadoIntervencion, ImagenMaquinaDto, IntervencionDto } from '@retimax/shared-types';
import { formatDateTime } from '@/lib/dates';
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
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => onAprobar(i.id)}
            className="text-xs bg-green-700 text-white px-3 py-1 rounded-lg"
          >
            Validar trabajo
          </button>
          <button
            type="button"
            onClick={() => onRechazar(i.id)}
            className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg"
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
  const pendientes = trabajos.filter((i) => i.estadoIntervencion === EstadoIntervencion.FINALIZADO);
  const enCurso = trabajos.filter((i) =>
    [
      EstadoIntervencion.ASIGNADO,
      EstadoIntervencion.EN_PROCESO,
      EstadoIntervencion.RECHAZADO,
    ].includes(i.estadoIntervencion as EstadoIntervencion),
  );
  const aprobados = trabajos.filter((i) => i.estadoIntervencion === EstadoIntervencion.APROBADO);

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm text-[#6c757d]">
        Supervise los trabajos asignados en diagnóstico: avance del técnico, fotos de respaldo y
        aprobación cuando envíen el trabajo.
      </p>

      {pendientes.length > 0 && (
        <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {pendientes.length} trabajo(s) enviado(s) — esperando su aprobación.
        </p>
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
