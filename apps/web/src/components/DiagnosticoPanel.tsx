'use client';

import { FormEvent, useState } from 'react';
import {
  AreaIntervencion,
  EmpleadoDto,
  EstadoIntervencion,
  IntervencionDto,
} from '@retimax/shared-types';
import { apiFetch } from '@/lib/api';
import { AREA_LABELS } from '@/lib/labels';

const AREAS: AreaIntervencion[] = [
  AreaIntervencion.MECANICA,
  AreaIntervencion.ELECTRICA,
  AreaIntervencion.PINTADO,
  AreaIntervencion.MANTENIMIENTO_GENERAL,
];

type Props = {
  maquinaId: string;
  empleados: EmpleadoDto[];
  asignaciones: IntervencionDto[];
  onUpdated: () => void;
  onListaParaVenta: (nombre: string) => void;
  maquinaNombre: string;
};

export function DiagnosticoPanel({
  maquinaId,
  empleados,
  asignaciones,
  onUpdated,
  onListaParaVenta,
  maquinaNombre,
}: Props) {
  const [area, setArea] = useState<AreaIntervencion>(AreaIntervencion.MECANICA);
  const [descripcion, setDescripcion] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editResp, setEditResp] = useState('');
  const [noRequiere, setNoRequiere] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const areasOcupadas = new Set(asignaciones.map((a) => a.area));
  const hayAsignaciones = asignaciones.length > 0;

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${maquinaId}/diagnostico/asignaciones`, {
        method: 'POST',
        body: JSON.stringify({ area, descripcion: descripcion.trim(), responsableId }),
      });
      setDescripcion('');
      setResponsableId('');
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar');
    } finally {
      setLoading(false);
    }
  }

  async function guardarEdicion(id: string) {
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${maquinaId}/diagnostico/asignaciones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          descripcion: editDesc.trim(),
          responsableId: editResp || undefined,
        }),
      });
      setEditId(null);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al editar');
    } finally {
      setLoading(false);
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta asignación?')) return;
    setLoading(true);
    try {
      await apiFetch(`/maquinas/${maquinaId}/diagnostico/asignaciones/${id}/eliminar`, {
        method: 'POST',
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  }

  async function finalizar() {
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${maquinaId}/diagnostico/finalizar`, {
        method: 'POST',
        body: JSON.stringify(
          hayAsignaciones
            ? {}
            : {
                requiereMantenimiento: false,
                motivoSinMantenimiento: motivo.trim(),
              },
        ),
      });
      if (!hayAsignaciones) onListaParaVenta(maquinaNombre);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al finalizar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm text-[#6c757d]">
        Agrega observaciones por área y asigna un responsable. Cada área se registra una sola vez.
      </p>

      {asignaciones.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Asignaciones registradas</p>
          {asignaciones.map((a) => (
            <div key={a.id} className="rounded-lg border p-3 text-sm space-y-2">
              {editId === a.id ? (
                <>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                  <select
                    value={editResp}
                    onChange={(e) => setEditResp(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  >
                    {empleados.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombreCompleto}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => guardarEdicion(a.id)}
                      disabled={loading}
                      className="text-xs bg-[#1a1a1a] text-white px-3 py-1 rounded-lg"
                    >
                      Guardar
                    </button>
                    <button type="button" onClick={() => setEditId(null)} className="text-xs underline">
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    {AREA_LABELS[a.area]} — {a.responsableNombre ?? a.responsable?.nombreCompleto}
                  </p>
                  <p className="text-[#6c757d]">{a.descripcion}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(a.id);
                        setEditDesc(a.descripcion);
                        setEditResp(a.responsableId ?? '');
                      }}
                      className="text-xs underline"
                    >
                      Editar
                    </button>
                    <button type="button" onClick={() => eliminar(a.id)} className="text-xs text-red-600 underline">
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={agregar} className="rounded-lg bg-gray-50 border p-4 space-y-3">
        <p className="text-sm font-medium">Nueva observación por área</p>
        <select
          value={area}
          onChange={(e) => setArea(e.target.value as AreaIntervencion)}
          className="w-full rounded-lg border px-3 py-2"
        >
          {AREAS.map((a) => (
            <option key={a} value={a} disabled={areasOcupadas.has(a)}>
              {AREA_LABELS[a]}
              {areasOcupadas.has(a) ? ' (ya asignada)' : ''}
            </option>
          ))}
        </select>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          placeholder="Observación del diagnóstico"
          className="w-full rounded-lg border px-3 py-2"
          required
        />
        <select
          value={responsableId}
          onChange={(e) => setResponsableId(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          required
        >
          <option value="">Responsable *</option>
          {empleados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombreCompleto} — {e.especialidad.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || areasOcupadas.has(area)}
          className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          Agregar asignación
        </button>
      </form>

      {!hayAsignaciones && (
        <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={noRequiere} onChange={(e) => setNoRequiere(e.target.checked)} />
            No requiere mantenimiento
          </label>
          {noRequiere && (
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Describa por qué no requiere mantenimiento"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            />
          )}
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="button"
        disabled={loading || (!hayAsignaciones && (!noRequiere || !motivo.trim()))}
        onClick={finalizar}
        className="rounded-lg bg-[#f5c842] px-4 py-2 font-semibold text-sm disabled:opacity-50"
      >
        {loading
          ? 'Guardando...'
          : hayAsignaciones
            ? 'Finalizar diagnóstico → Mantenimiento'
            : 'Finalizar → Lista para venta'}
      </button>
    </div>
  );
}
