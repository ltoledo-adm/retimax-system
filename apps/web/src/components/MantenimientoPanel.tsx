'use client';

import { useState } from 'react';
import { EstadoIntervencion, IntervencionDto } from '@retimax/shared-types';
import { ImagePicker } from '@/components/ImagePicker';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { AREA_LABELS } from '@/lib/labels';

type Props = {
  maquinaId: string;
  trabajos: IntervencionDto[];
  uploading: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onUpdated: () => void;
  onListaParaVenta: () => void;
  actionLoading: boolean;
  hayPendientesAprobacion: boolean;
  hayTrabajoAprobado: boolean;
  onAprobar: (id: string) => void;
  onRechazar: (id: string) => void;
};

export function MantenimientoPanel({
  maquinaId,
  trabajos,
  uploading,
  onUpload,
  onUpdated,
  onListaParaVenta,
  actionLoading,
  hayPendientesAprobacion,
  hayTrabajoAprobado,
  onAprobar,
  onRechazar,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [loading, setLoading] = useState(false);

  async function guardarEdicion(id: string) {
    setLoading(true);
    try {
      await apiFetch(`/maquinas/${maquinaId}/mantenimiento/trabajos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ descripcion: editDesc.trim() }),
      });
      setEditId(null);
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm text-[#6c757d]">
        Trabajos asignados en diagnóstico. Supervisa el avance y aprueba cuando finalicen.
      </p>
      <ImagePicker
        label="Fotos del trabajo"
        disabled={uploading}
        onUpload={onUpload}
        uploading={uploading}
      />

      {trabajos.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          No hay trabajos asignados. Regístrelos en el diagnóstico.
        </p>
      ) : (
        <div className="space-y-3">
          {trabajos.map((i) => (
            <div key={i.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {AREA_LABELS[i.area]} — {i.responsableNombre ?? i.responsable?.nombreCompleto}
              </p>
              {editId === i.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => guardarEdicion(i.id)}
                      disabled={loading}
                      className="text-xs bg-[#1a1a1a] text-white px-3 py-1 rounded-lg"
                    >
                      Guardar
                    </button>
                    <button type="button" onClick={() => setEditId(null)} className="text-xs underline">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[#6c757d] mt-1">{i.descripcion}</p>
                  {(i.estadoIntervencion === EstadoIntervencion.ASIGNADO ||
                    i.estadoIntervencion === EstadoIntervencion.EN_PROCESO ||
                    i.estadoIntervencion === EstadoIntervencion.RECHAZADO) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(i.id);
                        setEditDesc(i.descripcion);
                      }}
                      className="text-xs underline mt-1"
                    >
                      Editar observación
                    </button>
                  )}
                </>
              )}
              {i.detalleTrabajo && (
                <p className="mt-1 bg-gray-50 p-2 rounded">Realizado: {i.detalleTrabajo}</p>
              )}
              <div className="text-xs text-[#6c757d] mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                <p>Estado: {(i.estadoIntervencion ?? 'ASIGNADO').replace(/_/g, ' ')}</p>
                <p>Asignado: {formatDateTime(i.fechaAsignacion ?? i.createdAt)}</p>
                {i.fechaInicio && <p>Inicio: {formatDateTime(i.fechaInicio)}</p>}
                {i.fechaFinalizacion && <p>Finalizado: {formatDateTime(i.fechaFinalizacion)}</p>}
                {i.fechaAprobacion && <p>Aprobado: {formatDateTime(i.fechaAprobacion)}</p>}
              </div>
              {i.estadoIntervencion === EstadoIntervencion.FINALIZADO && (
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
            </div>
          ))}
        </div>
      )}

      {hayTrabajoAprobado && !hayPendientesAprobacion && (
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
