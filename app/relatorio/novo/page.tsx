import { connection } from 'next/server';
import { listarColaboradores } from '../dados';
import RelatorioForm from '../RelatorioForm';

export default async function Page() {
  await connection();
  const colaboradores = await listarColaboradores();
  return <RelatorioForm colaboradores={colaboradores} inicial={null} />;
}
