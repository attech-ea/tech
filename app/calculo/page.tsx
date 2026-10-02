import type { Metadata } from 'next';
import CalculoHorasApp from './CalculoHorasApp';

export const metadata: Metadata = {
  title: 'Cálculo de Horas',
};

export default function Page() {
  return <CalculoHorasApp />;
}
