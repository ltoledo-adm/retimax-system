'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AreaIntervencion,
  EmpleadoDto,
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

type Accion = 'edit' | 'detalle' | 'reasignar';

type Props = {
  maquinaId: string;
  empleados: EmpleadoDto[];
  asignaciones: IntervencionDto[];
  notaGeneral?: IntervencionDto | null;
  onUpdated: () => void;
  onListaParaVenta: (nombre: string) => void;
  maquinaNombre: string;
};

export function DiagnosticoPanel({
  maquinaId,
  empleados,
  asignaciones,
  notaGeneral,
  onUpdated,
  onListaParaVenta,
  maquinaNombre,
}: Props) {
  const asignacionPorArea = useMemo(() => {
    const map = new Map<AreaIntervencion, IntervencionDto>();
    for (const a of asignaciones) map.set(a.area, a);
    return map;
  }, [asignaciones]);

  const [activas, setActivas] = useState<Record<string, boolean>>({});
  const [descArea, setDescArea] = useState<Record<string, string>>({});
  const [respArea, setRespArea] = useState<Record<string, string>>({});
  const [accion, setAccion] = useState<{ id: string; tipo: Accion } | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editResp, setEditResp] = useState('');
  const [detalleExtra, setDetalleExtra] = useState('');
  const [nota, setNota] = useState(notaGeneral?.descripcion ?? '');
  const [noRequiere, setNoRequiere] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNota(notaGeneral?.descripcion ?? '');
  }, [notaGeneral?.descripcion]);

  const hayAsignaciones = asignaciones.length > 0;

  function abrir(id: string, tipo: Accion, actual: IntervencionDto) {
    setAccion({ id, tipo });
    setEditDesc(actual.descripcion);
    setEditResp(actual.responsableId ?? '');
    setDetalleExtra('');
    setError('');
  }

  async function guardarArea(e: FormEvent, area: AreaIntervencion) {
    e.preventDefault();
    const descripcion = (descArea[area] ?? '').trim();
    const responsableId = respArea[area] ?? '';
    if (!descripcion || !responsableId) {
      setError('Complete la observación y el responsable del área');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${maquinaId}/diagnostico/asignaciones`, {
        method: 'POST',
        body: JSON.stringify({ area, descripcion, responsableId }),
      });
      setDescArea((p) => ({ ...p, [area]: '' }));
      setRespArea((p) => ({ ...p, [area]: '' }));
      setActivas((p) => ({ ...p, [area]: false }));
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar');
    } finally {
      setLoading(false);
    }
  }

  async function guardarEdicion(id: string, tipo: Accion) {
    setLoading(true);
    setError('');
    try {
      const body =
        tipo === 'detalle'
          ? { detalleAdicional: detalleExtra.trim() }
          : tipo === 'reasignar'
            ? { responsableId: editResp }
            : { descripcion: editDesc.trim(), responsableId: editResp || undefined };

      if (tipo === 'detalle' && !detalleExtra.trim()) {
        setError('Escriba el detalle adicional');
        setLoading(false);
        return;
      }
      if (tipo === 'edit' && !editDesc.trim()) {
        setError('La observación no puede quedar vacía');
        setLoading(false);
        return;
      }
      if ((tipo === 'reasignar' || tipo === 'edit') && !editResp) {
        setError('Seleccione el responsable');
        setLoading(false);
        return;
      }

      await apiFetch(`/maquinas/${maquinaId}/diagnostico/asignaciones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setAccion(null);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
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
      setAccion(null);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  }

  async function guardarNota() {
    const texto = nota.trim();
    if (!texto) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${maquinaId}/diagnostico/nota`, {
        method: 'POST',
        body: JSON.stringify({ descripcion: texto }),
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar nota');
    } finally {
      setLoading(false);
    }
  }

  async function pasarAMantenimiento() {
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${maquinaId}/diagnostico/finalizar`, {
        method: 'POST',
        body: JSON.stringify(hayAsignaciones ? {} : { pasarAMantenimiento: true }),
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al pasar a mantenimiento');
    } finally {
      setLoading(false);
    }
  }

  async function finalizarListaVenta() {
    setLoading(true);
    setError('');
    try {
      await apiFetch(`/maquinas/${maquinaId}/diagnostico/finalizar`, {
        method: 'POST',
        body: JSON.stringify({
          requiereMantenimiento: false,
          motivoSinMantenimiento: motivo.trim(),
        }),
      });
      onListaParaVenta(maquinaNombre);
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
        Marque las áreas que aplican. Si ya hay alguien asignado, se muestra aquí aunque vuelva
        desde mantenimiento: puede editar, agregar detalle, cambiar de responsable o eliminar.
      </p>

      <div className="space-y-3">
        {AREAS.map((area) => {
          const asignada = asignacionPorArea.get(area);

          if (asignada) {
            const abierta = accion && accion.id === asignada.id ? accion.tipo : null;
            const responsable =
              asignada.responsableNombre ?? asignada.responsable?.nombreCompleto ?? 'Sin responsable';
            return (
              <div key={area} className="rounded-lg border border-green-200 bg-green-50/60 p-3 space-y-2">
                <p className="text-sm font-semibold">
                  {AREA_LABELS[area]} — asignada a {responsable}
                </p>
                <p className="text-sm text-[#1a1a1a]">{asignada.descripcion}</p>
                {asignada.observaciones && (
                  <p className="text-xs text-[#6c757d] whitespace-pre-wrap">
                    Detalle adicional: {asignada.observaciones}
                  </p>
                )}

                {abierta === 'edit' && (
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
                  />
                )}
                {abierta === 'detalle' && (
                  <textarea
                    value={detalleExtra}
                    onChange={(e) => setDetalleExtra(e.target.value)}
                    rows={2}
                    placeholder="Detalle que se agrega a esta asignación"
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
                  />
                )}
                {abierta === 'reasignar' && (
                  <select
                    value={editResp}
                    onChange={(e) => setEditResp(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Responsable</option>
                    {empleados.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombreCompleto} — {emp.especialidad.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex flex-wrap gap-2">
                  {abierta ? (
                    <>
                      <button
                        type="button"
                        onClick={() => guardarEdicion(asignada.id, abierta)}
                        disabled={loading}
                        className="text-xs bg-[#1a1a1a] text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button type="button" onClick={() => setAccion(null)} className="text-xs underline">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => abrir(asignada.id, 'edit', asignada)}
                        className="text-xs rounded-lg border bg-white px-3 py-1.5"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => abrir(asignada.id, 'detalle', asignada)}
                        className="text-xs rounded-lg border bg-white px-3 py-1.5"
                      >
                        Agregar detalle
                      </button>
                      <button
                        type="button"
                        onClick={() => abrir(asignada.id, 'reasignar', asignada)}
                        className="text-xs rounded-lg border bg-white px-3 py-1.5"
                      >
                        Asignar a otro
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminar(asignada.id)}
                        className="text-xs text-red-700 underline px-1"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          }

          const checked = !!activas[area];
          return (
            <div key={area} className="rounded-lg border p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setActivas((p) => ({ ...p, [area]: e.target.checked }))}
                />
                {AREA_LABELS[area]}
              </label>
              {checked && (
                <form onSubmit={(e) => guardarArea(e, area)} className="pl-6 space-y-2">
                  <textarea
                    value={descArea[area] ?? ''}
                    onChange={(e) => setDescArea((p) => ({ ...p, [area]: e.target.value }))}
                    rows={2}
                    placeholder="Escribe el diagnóstico de esta área"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <select
                    value={respArea[area] ?? ''}
                    onChange={(e) => setRespArea((p) => ({ ...p, [area]: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">Responsable</option>
                    {empleados.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombreCompleto} — {emp.especialidad.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-[#1a1a1a] text-white px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Guardar asignación
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-gray-50 border p-4 space-y-2">
        <label className="block text-sm font-medium">Otras observaciones (opcional)</label>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder="Notas generales del diagnóstico"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={loading || !nota.trim()}
          onClick={guardarNota}
          className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
        >
          Guardar nota
        </button>
      </div>

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
            />
          )}
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={pasarAMantenimiento}
          className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Pasar a mantenimiento'}
        </button>

        {!hayAsignaciones && (
          <button
            type="button"
            disabled={loading || !noRequiere || !motivo.trim()}
            onClick={finalizarListaVenta}
            className="rounded-lg bg-[#f5c842] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Finalizar → Lista para venta
          </button>
        )}
      </div>

      {hayAsignaciones && (
        <p className="text-xs text-[#6c757d]">
          Con observaciones por área registradas, use &quot;Pasar a mantenimiento&quot; para continuar el
          flujo. Si regresa a diagnóstico, las asignaciones siguen visibles.
        </p>
      )}
    </div>
  );
}
