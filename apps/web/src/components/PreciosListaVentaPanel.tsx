'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

type Props = {
  precioCompraUsd?: string | null;
  precioVentaUsd?: string | null;
  maquinaNombre: string;
  onSave: (compra: string, venta: string) => Promise<void>;
};

export function PreciosListaVentaPanel({
  precioCompraUsd,
  precioVentaUsd,
  maquinaNombre,
  onSave,
}: Props) {
  const [editando, setEditando] = useState(!precioCompraUsd && !precioVentaUsd);
  const [compra, setCompra] = useState(precioCompraUsd ?? '');
  const [venta, setVenta] = useState(precioVentaUsd ?? '');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const tienePrecios = Boolean(precioCompraUsd || precioVentaUsd);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(compra, venta);
      setEditando(false);
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  }

  if (!editando && tienePrecios) {
    return (
      <>
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">Precios registrados (USD)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <p>
              <span className="text-[#6c757d]">Compra:</span>{' '}
              <strong>${precioCompraUsd ?? '—'}</strong>
            </p>
            <p>
              <span className="text-[#6c757d]">Venta:</span>{' '}
              <strong>${precioVentaUsd ?? '—'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCompra(precioCompraUsd ?? '');
              setVenta(precioVentaUsd ?? '');
              setEditando(true);
            }}
            className="text-sm underline"
          >
            Editar precios
          </button>
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            La máquina <strong>{maquinaNombre}</strong> está lista para la venta. Puede pasar al{' '}
            <Link href="/ventas" className="underline font-medium">
              módulo de Ventas
            </Link>{' '}
            para realizar la operación.
          </p>
        </div>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
              <h3 className="font-bold text-lg mb-2">Lista para venta</h3>
              <p className="text-sm text-[#6c757d] mb-4">
                La máquina <strong>{maquinaNombre}</strong> está lista para la venta. Puede pasar al
                módulo de Ventas para realizar la operación.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/ventas"
                  className="rounded-lg bg-[#f5c842] px-4 py-2 text-sm font-semibold"
                >
                  Ir a Ventas
                </Link>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border-t pt-4 space-y-3">
      <p className="text-sm font-medium">Precios (USD)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#6c757d] mb-1">Precio de compra USD</label>
          <input
            value={compra}
            onChange={(e) => setCompra(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs text-[#6c757d] mb-1">Precio de venta USD</label>
          <input
            value={venta}
            onChange={(e) => setVenta(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#f5c842] px-4 py-2 font-semibold text-sm disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar precios'}
        </button>
        {tienePrecios && (
          <button type="button" onClick={() => setEditando(false)} className="rounded-lg border px-4 py-2 text-sm">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
