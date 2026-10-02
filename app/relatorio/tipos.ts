import type { DeslocamentoInput, DiaInput, ItemInput, Parametros, TipoDeslocamento } from './calculo';

// Formatos serializáveis trocados entre Server Components, Server Actions e
// os componentes client (Decimal do Prisma vira number).

export interface FuncaoDTO {
  id: number;
  nome: string;
  preco: number;
  irata: boolean;
  tipoDeslocamento: TipoDeslocamento;
}

export interface ColaboradorDTO {
  id: number;
  nome: string;
  funcoes: FuncaoDTO[];
}

// Cadastro completo (aba Usuários). Fica separado de `ColaboradorDTO` para não
// levar RG/CPF aos componentes client do relatório.
export interface UsuarioInput {
  nome: string;
  cargo: string;
  cargoDocumento: string;
  email: string;
  // "YYYY-MM-DD" ou vazio.
  dataCadastro: string;
  dataNascimento: string;
  rg: string;
  cpf: string;
  treinamentos: string[];
  funcaoIds: number[];
}

export interface UsuarioDTO extends ColaboradorDTO, Omit<UsuarioInput, 'nome' | 'funcaoIds'> {}

export interface RelatorioResumoDTO {
  id: number;
  descricao: string | null;
  // Primeiro dia de trabalho; `dias` é a quantidade de dias do relatório.
  data: string;
  dias: number;
  createdAt: string;
  colaboradores: number;
  total: number;
}

export interface RelatorioItemDTO extends ItemInput {
  colaboradorId: number | null;
  funcaoId: number | null;
  colaboradorNome: string;
  funcaoNome: string;
}

export interface RelatorioDTO {
  // `null` na pré-visualização de um relatório ainda não salvo.
  id: number | null;
  descricao: string | null;
  // Ao menos um dia, em ordem cronológica.
  dias: DiaInput[];
  // Viagens da equipe, em ordem cronológica; vazio nos relatórios antigos (ver `Parametros.deslocamentoHoras`).
  deslocamentos: DeslocamentoInput[];
  createdAt: string;
  params: Parametros;
  itens: RelatorioItemDTO[];
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
