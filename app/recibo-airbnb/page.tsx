import type { Metadata } from 'next';
import ReciboAirbnbApp from './ReciboAirbnbApp';

export const metadata: Metadata = {
  title: 'Recibo Airbnb',
};

export default function Page() {
  return <ReciboAirbnbApp />;
}
