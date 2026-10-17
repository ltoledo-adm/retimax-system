'use client';

interface ReciboPrintProps {
  title: string;
  numero: string;
  fechaEmision: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function ReciboPrint({ title, numero, fechaEmision, children, onClose }: ReciboPrintProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8 no-print-ui">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm underline">
            Cerrar
          </button>
        </div>
        <div className="print-area text-[#1a1a1a]">
          <div className="flex items-start justify-between gap-6 text-[10px] uppercase tracking-wide leading-snug text-[#6c757d]">
            <p className="max-w-[48%] text-left">Radial 13, entre cuarto y quinto anillo</p>
            <p className="max-w-[48%] text-right">Calle Viborita Chis Chis</p>
          </div>
          <div className="text-center border-b border-[#1a1a1a] pb-4 mb-4 mt-2">
            <div className="mx-auto flex h-28 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="IMPORTA & S"
                className="h-full w-auto max-w-full object-contain"
              />
            </div>
            <p className="text-sm font-semibold tracking-[0.14em] uppercase mt-1">{title}</p>
            <p className="font-mono font-semibold mt-2">{numero}</p>
            <p className="text-xs text-[#6c757d] mt-1">
              {new Date(fechaEmision).toLocaleString('es-BO')}
            </p>
          </div>
          {children}
          <div className="mt-14 grid grid-cols-2 gap-10 text-center text-xs">
            <div>
              <div className="h-12" />
              <div className="border-t border-[#1a1a1a] pt-2 font-medium">Firma del comprador</div>
            </div>
            <div>
              <div className="h-12" />
              <div className="border-t border-[#1a1a1a] pt-2 font-medium">Firma del vendedor</div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-[#1a1a1a] text-white px-4 py-2 text-sm font-semibold"
          >
            Imprimir
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
