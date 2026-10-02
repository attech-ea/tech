import type { Metadata } from 'next';
import PedidoMesaApp from '../PedidoMesaApp';

export const metadata: Metadata = {
  title: 'Alimentação',
};

export default function Page() {
  return <PedidoMesaApp />;
}
