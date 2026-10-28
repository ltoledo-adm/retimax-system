'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatFecha } from '@/lib/dates';
import { AREA_LABELS } from '@/lib/labels';
import { AreaIntervencion } from '@retimax/shared-types';

type Resumen = {
  desde: string;
  hasta: string;
  enCurso: {
    maquinaId: string;
    maquinaNombre: string;
    empleadoNombre: string;
    desde: string | null;
  }[];
  empleados: {
    empleadoId: string;
    nombre: string;
    maquinas: {
      maquinaId: string;
      nombre: string;
      estado: string;
      area: string;
      fechaInicio: string | null;
      fechaFinEstimada: string | null;
      fechaFinalizacion: string | null;
      precioMantenimientoEstimado: string | null;
      marcas: { id: string; tipo: string; fecha: string; motivo: string }[];
      avances: number;
    }[];
  }[];
};

function semanaActual() {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const utc = new Date(`${hoy}T12:00:00.000Z`);
  const day = utc.getUTCDay();
  const monday = new Date(utc);
  monday.setUTCDate(utc.getUTCDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { desde: iso(monday), hasta: iso(sunday) };
}

export function ResumenSemana() {
  const inicial = semanaActual();
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [data, setData] = useState<Resumen | null>(null);
  const [error, setError] = useState('');

  async function load(inicio = desde, fin = hasta) {
    setError('');
    try {
      setData(
        await apiFetch<Resumen>(
          `/reportes/semana?desde=${encodeURIComponent(inicio)}&hasta=${encodeURIComponent(fin)}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen');
    }
  }

  useEffect(() => {
    load(inicial.desde, inicial.hasta);
  }, []);

  return (
    <div className="rounded-xl bg-white border p-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">Resumen de la semana por trabajador</h3>
          <p className="text-sm text-[#6c757d]">
            Quién está en cada máquina y qué se hizo, incluidas las pausas.
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label className="text-xs text-[#6c757d]">
            Desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="mt-1 block rounded-lg border px-2 py-1 text-sm text-[#1a1a1a]"
            />
          </label>
          <label className="text-xs text-[#6c757d]">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="mt-1 block rounded-lg border px-2 py-1 text-sm text-[#1a1a1a]"
            />
          </label>
          <button type="submit" className="rounded-lg border px-3 py-1.5 text-sm">
            Ver
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <p className="text-sm font-medium mb-2">En curso ahora</p>
        {!data?.enCurso.length ? (
          <p className="text-sm text-[#6c757d]">Nadie tiene una máquina tomada.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.enCurso.map((item) => (
              <li key={item.maquinaId}>
                <Link href={`/maquinas/${item.maquinaId}`} className="font-medium hover:underline">
                  {item.maquinaNombre}
                </Link>
                <span className="text-[#6c757d]"> — {item.empleadoNombre}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!data?.empleados.length ? (
        <p className="text-sm text-[#6c757d]">No hay trabajo registrado en estas fechas.</p>
      ) : (
        <div className="space-y-4">
          {data.empleados.map((empleado) => (
            <div key={empleado.empleadoId} className="border-t pt-3">
              <p className="font-medium">{empleado.nombre}</p>
              <ul className="mt-2 space-y-2">
                {empleado.maquinas.map((m) => (
                  <li key={`${empleado.empleadoId}-${m.maquinaId}-${m.fechaInicio}`} className="text-sm">
                    <Link href={`/maquinas/${m.maquinaId}`} className="font-medium hover:underline">
                      {m.nombre}
                    </Link>
                    <span className="text-[#6c757d]">
                      {' '}
                      · {AREA_LABELS[m.area as AreaIntervencion] ?? m.area} · {m.estado.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-[#6c757d]">
                      Inicio {formatFecha(m.fechaInicio)} · Fin estimado {formatFecha(m.fechaFinEstimada)} · Fin{' '}
                      {formatFecha(m.fechaFinalizacion)} · Avances: {m.avances}
                      {m.precioMantenimientoEstimado
                        ? ` · Estimado $${m.precioMantenimientoEstimado} USD`
                        : ''}
                    </p>
                    {m.marcas.map((marca) => (
                      <p key={marca.id} className="text-xs text-[#6c757d]">
                        {formatFecha(marca.fecha)} · {marca.tipo === 'PAUSA' ? 'Pausa' : 'Retoma'}: {marca.motivo}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
