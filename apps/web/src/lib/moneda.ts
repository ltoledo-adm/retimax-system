import { Moneda } from '@retimax/shared-types';

export const MONEDA_OPCIONES: { value: Moneda; label: string }[] = [
  { value: Moneda.USD, label: 'Dólar (USD)' },
  { value: Moneda.EUR, label: 'Euro (EUR)' },
  { value: Moneda.BOB, label: 'Boliviano (Bs)' },
];

export function formatoPrecioCompra(monto?: string | null, moneda?: string | null) {
  if (!monto) return 'Pendiente';
  if (moneda === Moneda.EUR) return `€ ${monto}`;
  if (moneda === Moneda.BOB) return `Bs ${monto}`;
  return `$ ${monto} USD`;
}
