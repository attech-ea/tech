import { connection } from 'next/server';
import { listarRelatorios } from './dados';
import ListaRelatorios from './ListaRelatorios';

export default async function Page() {
  await connection();
  const relatorios = await listarRelatorios();
  return <ListaRelatorios relatorios={relatorios} />;
}
