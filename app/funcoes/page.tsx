import { connection } from 'next/server';
import { listarFuncoes } from '../relatorio/dados';
import Funcoes from './Funcoes';

export default async function Page() {
  await connection();
  const funcoes = await listarFuncoes();
  return <Funcoes funcoes={funcoes} />;
}
