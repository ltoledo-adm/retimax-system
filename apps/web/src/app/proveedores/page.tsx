'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ProveedorDto } from '@retimax/shared-types';
import { AppShell } from '@/components/AppShell';
import { AuthGuard } from '@/components/AuthGuard';
import { apiFetch } from '@/lib/api';

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<ProveedorDto[]>([]);
  const [nombre, setNombre] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setProveedores(await apiFetch<ProveedorDto[]>('/proveedores'));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/proveedores', {
        method: 'POST',
        body: JSON.stringify({ nombre }),
      });
      setNombre('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setError('');
    try {
      await apiFetch(`/proveedores/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({ nombre: editNombre }),
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el proveedor "${nombre}"?`)) return;
    setError('');
    try {
      await apiFetch(`/proveedores/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  }

  return (
    <AuthGuard adminOnly>
      <AppShell>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Proveedores</h2>
          <form onSubmit={handleSubmit} className="rounded-xl bg-white border p-6 mb-6 flex gap-2">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del proveedor"
              className="flex-1 rounded-lg border px-3 py-2"
              required
            />
            <button type="submit" className="rounded-lg bg-[#f5c842] px-4 py-2 font-semibold text-sm">
              Agregar
            </button>
          </form>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <div className="space-y-2">
            {proveedores.map((p) => (
              <div key={p.id} className="rounded-lg bg-white border p-4">
                {editId === p.id ? (
                  <form onSubmit={saveEdit} className="flex gap-2">
                    <input
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      className="flex-1 rounded-lg border px-3 py-2"
                      required
                    />
                    <button type="submit" className="rounded-lg bg-[#1a1a1a] text-white px-3 py-1.5 text-sm">
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="rounded-lg border px-3 py-1.5 text-sm"
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className="flex justify-between items-center gap-2">
                    <p className="font-medium">{p.nombre}</p>
                    <div className="flex gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(p.id);
                          setEditNombre(p.nombre);
                        }}
                        className="text-sm text-[#6c757d] hover:text-[#1a1a1a]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id, p.nombre)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
