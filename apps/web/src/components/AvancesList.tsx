'use client';

import { AvanceDiarioDto } from '@retimax/shared-types';
import { formatDateTime } from '@/lib/dates';

export function AvancesList({ avances }: { avances?: AvanceDiarioDto[] | null }) {
  if (!avances?.length) return null;

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-semibold">Avances por día</p>
      {avances.map((a) => (
        <div key={a.id} className="rounded-lg bg-white border px-3 py-2 text-sm">
          <p className="text-xs text-[#6c757d]">
            {formatDateTime(a.registradoEn)}
            {a.registradoPorNombre ? ` — ${a.registradoPorNombre}` : ''}
          </p>
          <p className="mt-1">{a.descripcion}</p>
          {a.observaciones && (
            <p className="text-xs text-[#6c757d] mt-1">Observaciones: {a.observaciones}</p>
          )}
        </div>
      ))}
    </div>
  );
}
