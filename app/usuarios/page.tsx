import { connection } from 'next/server';
import { listarFuncoes, listarUsuarios } from '../relatorio/dados';
import Usuarios from './Usuarios';

export default async function Page() {
  await connection();
  const [funcoes, usuarios] = await Promise.all([listarFuncoes(), listarUsuarios()]);
  return <Usuarios funcoes={funcoes} usuarios={usuarios} />;
}
