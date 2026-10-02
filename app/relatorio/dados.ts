import { prisma } from '@/lib/prisma';
import type { TipoDeslocamento } from './calculo';
import type { ColaboradorDTO, FuncaoDTO, RelatorioDTO, RelatorioResumoDTO, UsuarioDTO } from './tipos';

// Consultas de leitura usadas pelos Server Components e Server Actions.

function toFuncaoDTO(f: {
  id: number;
  nome: string;
  preco: { toNumber(): number };
  irata: boolean;
  tipoDeslocamento: TipoDeslocamento;
}): FuncaoDTO {
  return { id: f.id, nome: f.nome, preco: f.preco.toNumber(), irata: f.irata, tipoDeslocamento: f.tipoDeslocamento };
}

export async function listarFuncoes(): Promise<FuncaoDTO[]> {
  const funcoes = await prisma.funcao.findMany({ orderBy: { nome: 'asc' } });
  return funcoes.map(toFuncaoDTO);
}

export async function listarColaboradores(): Promise<ColaboradorDTO[]> {
  const colaboradores = await prisma.colaborador.findMany({
    orderBy: { nome: 'asc' },
    include: { funcoes: { orderBy: { nome: 'asc' } } },
  });
  return colaboradores.map((c) => ({
    id: c.id,
    nome: c.nome,
    funcoes: c.funcoes.map(toFuncaoDTO),
  }));
}

export async function listarUsuarios(): Promise<UsuarioDTO[]> {
  const colaboradores = await prisma.colaborador.findMany({
    orderBy: { nome: 'asc' },
    include: { funcoes: { orderBy: { nome: 'asc' } } },
  });
  return colaboradores.map((c) => ({
    id: c.id,
    nome: c.nome,
    cargo: c.cargo ?? '',
    cargoDocumento: c.cargoDocumento ?? '',
    email: c.email ?? '',
    dataCadastro: c.dataCadastro ?? '',
    dataNascimento: c.dataNascimento ?? '',
    rg: c.rg ?? '',
    cpf: c.cpf ?? '',
    treinamentos: c.treinamentos,
    funcoes: c.funcoes.map(toFuncaoDTO),
  }));
}

export async function listarRelatorios(): Promise<RelatorioResumoDTO[]> {
  const relatorios = await prisma.relatorio.findMany({
    orderBy: [{ data: 'desc' }, { id: 'desc' }],
    include: { _count: { select: { itens: true, dias: true } } },
  });
  return relatorios.map((r) => ({
    id: r.id,
    descricao: r.descricao,
    data: r.data,
    dias: r._count.dias,
    createdAt: r.createdAt.toISOString(),
    colaboradores: r._count.itens,
    total: r.total.toNumber(),
  }));
}

export async function buscarRelatorio(id: number): Promise<RelatorioDTO | null> {
  const r = await prisma.relatorio.findUnique({
    where: { id },
    include: {
      itens: { orderBy: { ordem: 'asc' } },
      dias: { orderBy: { ordem: 'asc' } },
      deslocamentos: { orderBy: { ordem: 'asc' } },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    descricao: r.descricao,
    dias: r.dias.map((d) => ({
      data: d.data,
      dataSaida: d.dataSaida,
      entrada: d.entrada,
      saida: d.saida,
      ignorarFeriado: d.ignorarFeriado,
    })),
    deslocamentos: r.deslocamentos.map((d) => ({
      rotulo: d.rotulo,
      data: d.data,
      dataSaida: d.dataSaida,
      entrada: d.entrada,
      saida: d.saida,
      ignorarFeriado: d.ignorarFeriado,
    })),
    createdAt: r.createdAt.toISOString(),
    params: {
      kmQuantidade: r.kmQuantidade.toNumber(),
      kmPreco: r.kmPreco.toNumber(),
      deslocamentoHoras: r.deslocamentoHoras.toNumber(),
      deslocPrecoComum: r.deslocPrecoComum.toNumber(),
      deslocPrecoTecnico: r.deslocPrecoTecnico.toNumber(),
      precoAlmoco: r.precoAlmoco.toNumber(),
      precoJantar: r.precoJantar.toNumber(),
      alimentacaoManual: r.alimentacaoManual?.toNumber() ?? null,
      material: r.material.toNumber(),
    },
    itens: r.itens.map((i) => ({
      colaboradorId: i.colaboradorId,
      funcaoId: i.funcaoId,
      colaboradorNome: i.colaboradorNome,
      funcaoNome: i.funcaoNome,
      preco: i.preco.toNumber(),
      irata: i.irata,
      tipoDeslocamento: i.tipoDeslocamento,
      dias: i.diasOrdem,
      almoco: i.almoco,
      jantar: i.jantar,
    })),
  };
}
