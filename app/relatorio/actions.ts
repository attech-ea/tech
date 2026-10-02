'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import {
  calcularRelatorio,
  diaSobreposto,
  PARAMETROS_PADRAO,
  ROTULO_DESLOCAMENTO,
  type DeslocamentoInput,
  type DiaInput,
  type Parametros,
  type TipoDeslocamento,
} from './calculo';
import { buscarRelatorio } from './dados';
import { formatarFuncao, formatarNome, limparEspacos } from './formatacao';
import type { ActionResult, RelatorioDTO, RelatorioItemDTO, UsuarioInput } from './tipos';

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function revalidar() {
  revalidatePath('/relatorio', 'layout');
  revalidatePath('/usuarios', 'layout');
  revalidatePath('/funcoes', 'layout');
}

function numeroValido(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function tipoValido(t: unknown): t is TipoDeslocamento {
  return t === 'COMUM' || t === 'TECNICO';
}

function mensagemErro(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return 'Já existe um cadastro com esse nome.';
  }
  console.error(e);
  return 'Erro ao salvar no banco de dados.';
}

// ---------- Funções ----------

export async function salvarFuncao(input: {
  id: number | null;
  nome: string;
  preco: number;
  irata: boolean;
  tipoDeslocamento: TipoDeslocamento;
}): Promise<ActionResult> {
  const nome = formatarFuncao(input.nome);
  if (!nome) return { ok: false, error: 'Informe o nome da função.' };
  if (!numeroValido(input.preco)) return { ok: false, error: 'Preço inválido.' };
  if (!tipoValido(input.tipoDeslocamento)) return { ok: false, error: 'Tipo de deslocamento inválido.' };

  const data = { nome, preco: input.preco, irata: !!input.irata, tipoDeslocamento: input.tipoDeslocamento };
  try {
    if (input.id) await prisma.funcao.update({ where: { id: input.id }, data });
    else await prisma.funcao.create({ data });
  } catch (e) {
    return { ok: false, error: mensagemErro(e) };
  }
  revalidar();
  return { ok: true, data: undefined };
}

export async function excluirFuncao(id: number): Promise<ActionResult> {
  try {
    await prisma.funcao.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: mensagemErro(e) };
  }
  revalidar();
  return { ok: true, data: undefined };
}

// ---------- Colaboradores ----------

// Cadastro completo do colaborador (aba Usuários). Aceita colaborador sem função (ex.: diretoria).
export async function salvarUsuario(input: { id: number | null } & UsuarioInput): Promise<ActionResult> {
  const nome = formatarNome(input.nome);
  if (!nome) return { ok: false, error: 'Informe o nome do colaborador.' };
  for (const [campo, valor] of [
    ['cadastro', input.dataCadastro],
    ['nascimento', input.dataNascimento],
  ] as const) {
    if (valor && !DATA_RE.test(valor)) return { ok: false, error: `Data de ${campo} inválida.` };
  }
  const email = limparEspacos(input.email);
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: 'E-mail inválido.' };

  const treinamentos = [...new Set((input.treinamentos ?? []).map(limparEspacos).filter(Boolean))];
  const data = {
    nome,
    cargo: limparEspacos(input.cargo) || null,
    cargoDocumento: limparEspacos(input.cargoDocumento) || null,
    email: email || null,
    dataCadastro: input.dataCadastro || null,
    dataNascimento: input.dataNascimento || null,
    rg: limparEspacos(input.rg) || null,
    cpf: limparEspacos(input.cpf) || null,
    treinamentos,
  };
  const funcoes = (input.funcaoIds ?? []).map((id) => ({ id }));

  try {
    if (input.id) {
      await prisma.colaborador.update({ where: { id: input.id }, data: { ...data, funcoes: { set: funcoes } } });
    } else {
      await prisma.colaborador.create({ data: { ...data, funcoes: { connect: funcoes } } });
    }
  } catch (e) {
    return { ok: false, error: mensagemErro(e) };
  }
  revalidar();
  return { ok: true, data: undefined };
}

export async function excluirColaborador(id: number): Promise<ActionResult> {
  try {
    await prisma.colaborador.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: mensagemErro(e) };
  }
  revalidar();
  return { ok: true, data: undefined };
}

// ---------- Relatórios ----------

function validarParametros(p: Parametros): string | null {
  const campos: (keyof Parametros)[] = ['kmQuantidade', 'kmPreco', 'deslocPrecoComum', 'deslocPrecoTecnico', 'material'];
  for (const c of campos) if (!numeroValido(p?.[c])) return 'Valores da quilometragem, deslocamento ou material inválidos.';
  if (p.alimentacaoManual != null && !numeroValido(p.alimentacaoManual)) return 'Valor da alimentação inválido.';
  return null;
}

function validarItem(i: RelatorioItemDTO, n: number, qtdDias: number): string | null {
  if (!i.colaboradorNome?.trim() || !i.funcaoNome?.trim()) return `Linha ${n}: escolha colaborador e função.`;
  if (!numeroValido(i.preco)) return `Linha ${n}: preço inválido.`;
  if (!tipoValido(i.tipoDeslocamento)) return `Linha ${n}: tipo de deslocamento inválido.`;
  if (!Array.isArray(i.dias) || i.dias.length === 0) return `Linha ${n}: selecione os dias trabalhados.`;
  if (new Set(i.dias).size !== i.dias.length || !i.dias.every((p) => Number.isInteger(p) && p >= 0 && p < qtdDias)) {
    return `Linha ${n}: dias trabalhados inválidos.`;
  }
  return null;
}

// `nome` é como o dia (ou a viagem) aparece na mensagem, ex.: "Dia 2".
function validarDia(d: DiaInput, nome: string): string | null {
  if (!DATA_RE.test(d?.data ?? '')) return `${nome}: informe a data de entrada.`;
  if (!DATA_RE.test(d.dataSaida ?? '')) return `${nome}: informe a data de saída.`;
  if (!HORA_RE.test(d.entrada ?? '') || !HORA_RE.test(d.saida ?? '')) {
    return `${nome}: informe os horários de entrada e saída.`;
  }
  if (`${d.dataSaida}T${d.saida}` <= `${d.data}T${d.entrada}`) return `${nome}: a saída deve ser depois da entrada.`;
  return null;
}

export async function salvarRelatorio(input: {
  id: number | null;
  dias: DiaInput[];
  deslocamentos: DeslocamentoInput[];
  descricao: string;
  params: Parametros;
  itens: RelatorioItemDTO[];
}): Promise<ActionResult<{ id: number }>> {
  if (!Array.isArray(input.dias) || input.dias.length === 0) return { ok: false, error: 'Adicione ao menos um dia.' };
  for (let n = 0; n < input.dias.length; n++) {
    const erro = validarDia(input.dias[n], `Dia ${n + 1}`);
    if (erro) return { ok: false, error: erro };
  }
  if (!Array.isArray(input.deslocamentos)) return { ok: false, error: 'Deslocamentos inválidos.' };
  for (let n = 0; n < input.deslocamentos.length; n++) {
    const erro = validarDia(input.deslocamentos[n], `Deslocamento ${n + 1}`);
    if (erro) return { ok: false, error: erro };
  }
  const deslocamentos: DeslocamentoInput[] = input.deslocamentos
    .map((d) => ({
      rotulo: limparEspacos(d.rotulo ?? '') || ROTULO_DESLOCAMENTO,
      data: d.data,
      dataSaida: d.dataSaida,
      entrada: d.entrada,
      saida: d.saida,
      ignorarFeriado: !!d.ignorarFeriado,
    }))
    .sort((a, b) => `${a.data}T${a.entrada}`.localeCompare(`${b.data}T${b.entrada}`));
  const sobreposto = diaSobreposto(input.dias);
  if (sobreposto >= 0) return { ok: false, error: `Dia ${sobreposto + 1}: começa antes de outro dia terminar.` };
  // Os dias são gravados em ordem cronológica; `novaPosicao` leva a posição enviada pela tela à gravada.
  const ordenados = input.dias
    .map((d, posicao) => ({
      posicao,
      data: d.data,
      dataSaida: d.dataSaida,
      entrada: d.entrada,
      saida: d.saida,
      ignorarFeriado: !!d.ignorarFeriado,
    }))
    .sort((a, b) => `${a.data}T${a.entrada}`.localeCompare(`${b.data}T${b.entrada}`));
  const novaPosicao = new Map(ordenados.map((d, n) => [d.posicao, n]));
  const dias: DiaInput[] = ordenados.map(({ posicao: _posicao, ...d }) => d);

  const erroParams = validarParametros(input.params);
  if (erroParams) return { ok: false, error: erroParams };
  if (!Array.isArray(input.itens) || input.itens.length === 0) {
    return { ok: false, error: 'Adicione ao menos um colaborador.' };
  }
  for (let n = 0; n < input.itens.length; n++) {
    const erro = validarItem(input.itens[n], n + 1, dias.length);
    if (erro) return { ok: false, error: erro };
  }
  const itensOrdenados = input.itens.map((i) => ({
    ...i,
    dias: i.dias.map((p) => novaPosicao.get(p)!).sort((a, b) => a - b),
  }));
  const semColaborador = dias.findIndex((_, n) => !itensOrdenados.some((i) => i.dias.includes(n)));
  if (semColaborador >= 0) return { ok: false, error: `Dia ${semColaborador + 1}: nenhum colaborador trabalhou nesse dia.` };

  // Preços das refeições são fixos (as horas de deslocamento vêm das viagens); distância,
  // preços de km e deslocamento, material e alimentação manual vêm da tela.
  const params: Parametros = {
    ...PARAMETROS_PADRAO,
    kmQuantidade: input.params.kmQuantidade,
    kmPreco: input.params.kmPreco,
    deslocPrecoComum: input.params.deslocPrecoComum,
    deslocPrecoTecnico: input.params.deslocPrecoTecnico,
    alimentacaoManual: input.params.alimentacaoManual ?? null,
    material: input.params.material,
  };
  const calc = calcularRelatorio(itensOrdenados, dias, params, deslocamentos);
  if (calc.itens.some((c) => c === null)) return { ok: false, error: 'Horário inválido em algum dia.' };

  const itens = itensOrdenados.map((i, n) => {
    const c = calc.itens[n]!;
    return {
      ordem: n,
      colaboradorId: i.colaboradorId,
      funcaoId: i.funcaoId,
      colaboradorNome: i.colaboradorNome.trim(),
      funcaoNome: i.funcaoNome.trim(),
      irata: !!i.irata,
      tipoDeslocamento: i.tipoDeslocamento,
      preco: i.preco,
      diasOrdem: i.dias,
      almoco: !!i.almoco,
      jantar: !!i.jantar,
      normalMin: c.normalMin,
      cemMin: c.cemMin,
      total: c.totalCent / 100,
    };
  });

  const dados = {
    data: dias[0].data,
    descricao: input.descricao?.trim() || null,
    ...params,
    total: calc.totalCent / 100,
  };
  const diasCriar = dias.map((d, ordem) => ({ ordem, ...d }));
  const deslocamentosCriar = deslocamentos.map((d, ordem) => ({ ordem, ...d }));
  const filhos = {
    itens: { create: itens },
    dias: { create: diasCriar },
    deslocamentos: { create: deslocamentosCriar },
  };

  try {
    const id = await prisma.$transaction(async (tx) => {
      if (input.id) {
        await tx.relatorioItem.deleteMany({ where: { relatorioId: input.id } });
        await tx.relatorioDia.deleteMany({ where: { relatorioId: input.id } });
        await tx.relatorioDeslocamento.deleteMany({ where: { relatorioId: input.id } });
        await tx.relatorio.update({ where: { id: input.id }, data: { ...dados, ...filhos } });
        return input.id;
      }
      const r = await tx.relatorio.create({ data: { ...dados, ...filhos } });
      return r.id;
    });
    revalidar();
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: mensagemErro(e) };
  }
}

export async function carregarRelatorio(id: number): Promise<ActionResult<RelatorioDTO>> {
  const r = await buscarRelatorio(id);
  if (!r) return { ok: false, error: 'Relatório não encontrado.' };
  return { ok: true, data: r };
}

export async function excluirRelatorio(id: number): Promise<ActionResult> {
  try {
    await prisma.relatorio.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: mensagemErro(e) };
  }
  revalidar();
  return { ok: true, data: undefined };
}
