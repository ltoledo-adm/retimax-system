'use client';

import { FormEvent, useEffect, useState } from 'react';
import { HerramientaDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { apiFetch, imageUrl } from '@/lib/api';

const vacio = {
  nombre: '',
  precioCompraUsd: '',
  medida: '',
  dimensiones: '',
  cantidad: '1',
};

export default function HerramientasPage() {
  const [items, setItems] = useState<HerramientaDto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await apiFetch<HerramientaDto[]>('/herramientas');
    setItems(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'));
  }, []);

  function empezarEdicion(item: HerramientaDto) {
    setEditId(item.id);
    setForm({
      nombre: item.nombre,
      precioCompraUsd: item.precioCompraUsd,
      medida: item.medida ?? '',
      dimensiones: item.dimensiones ?? '',
      cantidad: String(item.cantidad),
    });
    setFoto(null);
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const precio = Number(form.precioCompraUsd);
      const cantidad = Number(form.cantidad);
      if (!form.nombre.trim()) throw new Error('El nombre es obligatorio');
      if (!Number.isFinite(precio) || precio <= 0) throw new Error('El precio debe ser mayor a 0');
      if (!Number.isInteger(cantidad) || cantidad < 0) throw new Error('La cantidad no es válida');
      if (!editId && cantidad < 1) throw new Error('Indique al menos 1 unidad');

      const body = {
        nombre: form.nombre.trim(),
        precioCompraUsd: precio.toFixed(2),
        medida: form.medida.trim(),
        dimensiones: form.dimensiones.trim(),
        cantidad,
      };

      const saved = editId
        ? await apiFetch<HerramientaDto>(`/herramientas/${editId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await apiFetch<HerramientaDto>('/herramientas', {
            method: 'POST',
            body: JSON.stringify(body),
          });

      if (foto) {
        const data = new FormData();
        data.append('file', foto);
        await apiFetch(`/herramientas/${saved.id}/foto`, { method: 'POST', body: data });
      }

      setShowForm(false);
      setEditId(null);
      setForm(vacio);
      setFoto(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  const stockTotal = items.reduce((sum, item) => sum + item.cantidad, 0);

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-wrap justify-between gap-3 items-center">
            <div>
              <h2 className="text-2xl font-bold">Herramientas</h2>
              <p className="text-sm text-[#6c757d]">
                Inventario de depósito — {items.length} tipo(s), {stockTotal} en stock
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setForm(vacio);
                setFoto(null);
                setShowForm((v) => !v);
              }}
              className="rounded-lg bg-[#f5c842] px-4 py-2 font-semibold text-sm"
            >
              + Registrar herramienta
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-xl bg-white border p-6 space-y-4">
              <h3 className="font-semibold">{editId ? 'Editar herramienta' : 'Nueva herramienta'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre *</label>
                  <input
                    value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Precio USD *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.precioCompraUsd}
                    onChange={(e) => setForm((p) => ({ ...p, precioCompraUsd: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Medida</label>
                  <input
                    value={form.medida}
                    onChange={(e) => setForm((p) => ({ ...p, medida: e.target.value }))}
                    placeholder="Ej. 19 mm, 1/2 pulgada"
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Dimensiones</label>
                  <input
                    value={form.dimensiones}
                    onChange={(e) => setForm((p) => ({ ...p, dimensiones: e.target.value }))}
                    placeholder="Ej. 20 x 8 x 5 cm"
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cantidad en stock</label>
                  <input
                    type="number"
                    min={editId ? 0 : 1}
                    step={1}
                    value={form.cantidad}
                    onChange={(e) => setForm((p) => ({ ...p, cantidad: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Foto</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                    className="w-full text-sm"
                  />
                </div>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {items.length === 0 ? (
            <div className="rounded-xl bg-white border p-8 text-center text-[#6c757d]">
              No hay herramientas registradas.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl bg-white border p-4 flex gap-3">
                  {item.thumbnailUrl || item.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(item.thumbnailUrl || item.fotoUrl || '')}
                      alt=""
                      className="h-20 w-20 rounded object-cover border"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded bg-gray-100 border flex items-center justify-center text-xs text-[#6c757d]">
                      Sin foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.nombre}</p>
                    <p className="text-sm">${item.precioCompraUsd} USD</p>
                    <p className="text-sm text-[#6c757d]">
                      Stock: <strong className={item.cantidad === 0 ? 'text-red-700' : ''}>{item.cantidad}</strong>
                    </p>
                    {(item.medida || item.dimensiones) && (
                      <p className="text-xs text-[#6c757d] mt-1">
                        {[item.medida, item.dimensiones].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => empezarEdicion(item)}
                      className="text-xs underline mt-2"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
