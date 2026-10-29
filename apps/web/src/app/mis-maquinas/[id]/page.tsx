'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { EstadoMaquina, IntervencionDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { TrabajoEmpleadoPanel } from '@/components/TrabajoEmpleadoPanel';
import { apiFetch, imageUrl } from '@/lib/api';
import { fechaHoy } from '@/lib/dates';
import { maquinaDetalleLinea, maquinaNombrePrincipal } from '@/lib/maquina-display';
import { ESTADO_COLORS, ESTADO_LABELS } from '@/lib/labels';

type Ficha = {
  id: string;
  nombre: string;
  tipo: string;
  marca: string;
  modelo: string;
  estado: EstadoMaquina;
  imagenes: { id: string; url: string; thumbnailUrl: string }[];
  tomadaPor: { id: string; nombre: string } | null;
  esMia: boolean;
  puedoTomar: boolean;
  motivoBloqueo: string | null;
  miTrabajo: IntervencionDto | null;
};

const hoy = fechaHoy;

export default function MiMaquinaPage() {
  const params = useParams<{ id: string }>();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [inicio, setInicio] = useState(hoy());
  const [fin, setFin] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');

  async function load() {
    setError('');
    const data = await apiFetch<Ficha>(`/mis-trabajos/maquinas/${params.id}`);
    setFicha(data);
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function tomar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/mis-trabajos/tomar', {
        method: 'POST',
        body: JSON.stringify({
          maquinaId: params.id,
          fechaInicio: inicio,
          fechaFinEstimada: fin,
          descripcion: descripcion.trim(),
          precioMantenimientoEstimado: precio.trim() || undefined,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo tomar la máquina');
    } finally {
      setBusy(false);
    }
  }

  const trabajoAbierto =
    ficha?.miTrabajo &&
    ficha.miTrabajo.estadoIntervencion !== 'APROBADO' &&
    ficha.miTrabajo.estadoIntervencion !== 'CANCELADO';

  return (
    <AuthGuard empleadoOnly>
      <AppShell>
        <div className="max-w-3xl mx-auto space-y-4">
          {loading ? (
            <p className="text-[#6c757d]">Cargando...</p>
          ) : !ficha ? (
            <p className="text-red-600 text-sm">{error || 'Máquina no encontrada'}</p>
          ) : (
            <>
              <div className="rounded-xl bg-white border p-5 space-y-3">
                {ficha.imagenes[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(ficha.imagenes[0].url)}
                    alt={ficha.nombre}
                    className="w-full max-h-64 object-contain bg-gray-50 rounded-lg"
                  />
                )}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-bold">{maquinaNombrePrincipal(ficha)}</h2>
                    <p className="text-[#6c757d]">{maquinaDetalleLinea({ ...ficha, anio: null })}</p>
                  </div>
                  <span className={`text-xs text-white px-2 py-1 rounded-full ${ESTADO_COLORS[ficha.estado]}`}>
                    {ESTADO_LABELS[ficha.estado]}
                  </span>
                </div>
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              {ficha.motivoBloqueo && !ficha.esMia && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {ficha.motivoBloqueo} Usted puede ver la máquina, pero no puede empezar a trabajarla.
                </p>
              )}

              {trabajoAbierto && ficha.miTrabajo ? (
                <TrabajoEmpleadoPanel trabajo={ficha.miTrabajo} onChanged={load} />
              ) : ficha.puedoTomar ? (
                <form onSubmit={tomar} className="rounded-xl bg-white border p-5 space-y-3">
                  <p className="font-semibold">Empezar a trabajar esta máquina</p>
                  <p className="text-sm text-[#6c757d]">
                    Queda a su nombre. Otro empleado no podrá tomarla hasta que el administrador revise el trabajo.
                  </p>
                  <label className="block text-sm">
                    Qué va a hacer *
                    <textarea
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      required
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-sm">
                      Fecha de inicio *
                      <input
                        type="date"
                        value={inicio}
                        onChange={(e) => setInicio(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        required
                      />
                    </label>
                    <label className="text-sm">
                      Fecha estimada de fin *
                      <input
                        type="date"
                        value={fin}
                        onChange={(e) => setFin(e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        required
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    Precio estimado del mantenimiento (USD, opcional)
                    <span className="block text-xs text-[#6c757d] font-normal">
                      Si todavía no lo sabe, déjelo vacío. Puede cambiarlo hasta que el administrador apruebe.
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value)}
                      placeholder="Lo que estima que se cobre"
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-[#f5c842] px-4 py-2 font-semibold text-sm disabled:opacity-50"
                  >
                    {busy ? 'Guardando...' : 'Tomar máquina'}
                  </button>
                </form>
              ) : null}

              {ficha.miTrabajo && !trabajoAbierto && (
                <TrabajoEmpleadoPanel trabajo={ficha.miTrabajo} onChanged={load} />
              )}
            </>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
