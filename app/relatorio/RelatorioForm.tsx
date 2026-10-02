'use client';

import {
  ArrowCounterClockwiseIcon,
  CalendarBlankIcon,
  FilePdfIcon,
  FileTextIcon,
  FloppyDiskIcon,
  ForkKnifeIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  UsersThreeIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fs } from '@/lib/calc-clamp';
import { hmHoras } from '../calculo/horas';
import { carregarRelatorio, salvarRelatorio } from './actions';
import {
  calcularRelatorio,
  diaSobreposto,
  formatCent,
  formatDataISO,
  formatPrecoCem,
  formatPrecoNormal,
  formatReais,
  hojeBR,
  HORARIO_MIN_JANTAR,
  jantarPermitido,
  MULTIPLICADOR_CEM,
  PARAMETROS_PADRAO,
  TIPO_DESLOCAMENTO_LABEL,
  type GrupoDeslocamento,
  type Parametros,
} from './calculo';
import { baixarRelatorioPdf } from './gerarPdf';
import Deslocamentos, {
  deslocamentosDoRelatorio,
  deslocamentosPadrao,
  deslocamentosValidos,
  viagemDoDeslocamento,
  type DeslocForm,
} from './Deslocamentos';
import DiasTrabalho, {
  diaDoRelatorio,
  diaNovo,
  novaKey,
  paraDiaInput,
  type DiaForm,
} from './DiasTrabalho';
import PreviaPdf from './PreviaPdf';
import SelectBusca from './SelectBusca';
import type { ColaboradorDTO, RelatorioDTO, RelatorioItemDTO } from './tipos';
import {
  Alerta,
  btnIconePerigo,
  btnSecundario,
  Card,
  checkboxClass,
  ConfirmarExclusao,
  Field,
  inputClass,
  SectionHead,
} from './ui';

// Na tela a linha só guarda o que muda por colaborador; os dias vêm do relatório.
// `diaKeys` são os dias em que o colaborador trabalhou (`DiaForm.key`); com um
// só dia no relatório eles não são usados, todos trabalham nesse dia.
type Linha = Omit<RelatorioItemDTO, 'dias'> & {
  key: string;
  diaKeys: string[];
};

// Distância e preços editáveis na tela. Horas de deslocamento (10h) e
// refeições são fixas.
type CampoPreco = 'kmQuantidade' | 'kmPreco' | 'deslocPrecoComum' | 'deslocPrecoTecnico';
type Precos = Record<CampoPreco, string>;

const CAMPOS_PRECO: { campo: CampoPreco; label: string; prefixo?: string; unidade: string }[] = [
  { campo: 'kmQuantidade', label: 'Distância', unidade: 'km' },
  { campo: 'kmPreco', label: 'Preço por km', prefixo: 'R$', unidade: '/km' },
  { campo: 'deslocPrecoComum', label: 'Deslocamento comum', prefixo: 'R$', unidade: '/h' },
  { campo: 'deslocPrecoTecnico', label: 'Deslocamento técnico', prefixo: 'R$', unidade: '/h' },
];

// Tudo o que o usuário preenche na tela. É o que fica guardado no navegador
// como rascunho, para não perder o trabalho ao recarregar a página.
interface Estado {
  diasForm: DiaForm[];
  descricao: string;
  precos: Precos;
  temMaterial: boolean;
  material: string;
  linhas: Linha[];
  deslocs: DeslocForm[];
  // Valor da alimentação digitado; `null` segue o das refeições marcadas.
  alimentacaoManual: string | null;
}

function valorParaCampo(reais: number): string {
  return reais.toFixed(2).replace('.', ',');
}

function estadoInicial(inicial: RelatorioDTO | null): Estado {
  const diasForm = inicial?.dias.length ? inicial.dias.map(diaDoRelatorio) : [diaNovo()];
  const p = inicial?.params ?? PARAMETROS_PADRAO;
  // Relatório antigo (horas fixas, sem viagens): ao editar, começa com o deslocamento padrão.
  const deslocs =
    inicial && p.deslocamentoHoras === 0
      ? deslocamentosDoRelatorio(inicial.deslocamentos, inicial.dias)
      : deslocamentosPadrao();
  return {
    diasForm,
    descricao: inicial?.descricao ?? '',
    precos: {
      kmQuantidade: String(p.kmQuantidade),
      kmPreco: String(p.kmPreco),
      deslocPrecoComum: String(p.deslocPrecoComum),
      deslocPrecoTecnico: String(p.deslocPrecoTecnico),
    },
    temMaterial: p.material > 0,
    material: p.material > 0 ? String(p.material) : '',
    deslocs,
    alimentacaoManual: p.alimentacaoManual != null ? valorParaCampo(p.alimentacaoManual) : null,
    linhas:
      inicial?.itens.map(({ dias: posicoes, ...i }) => ({
        ...i,
        key: novaKey(),
        diaKeys: posicoes.flatMap((n) => (diasForm[n] ? [diasForm[n].key] : [])),
      })) ?? [],
  };
}

function chaveRascunho(id: number | null): string {
  return `relatorio-rascunho:${id ?? 'novo'}`;
}

function lerRascunho(id: number | null): Estado | null {
  try {
    const bruto = localStorage.getItem(chaveRascunho(id));
    if (!bruto) return null;
    const e = JSON.parse(bruto) as Partial<Estado>;
    const valido =
      Array.isArray(e.diasForm) &&
      e.diasForm.length > 0 &&
      Array.isArray(e.linhas) &&
      typeof e.descricao === 'string' &&
      typeof e.temMaterial === 'boolean' &&
      typeof e.material === 'string' &&
      !!e.precos &&
      CAMPOS_PRECO.every(({ campo }) => typeof e.precos?.[campo] === 'string');
    if (!valido) return null;
    // Rascunhos de antes dos deslocamentos e da alimentação manual não têm esses campos.
    return {
      ...(e as Estado),
      deslocs: deslocamentosValidos(e.deslocs) ? e.deslocs : deslocamentosPadrao(),
      alimentacaoManual: typeof e.alimentacaoManual === 'string' ? e.alimentacaoManual : null,
    };
  } catch {
    return null;
  }
}

function guardarRascunho(id: number | null, estado: Estado) {
  try {
    localStorage.setItem(chaveRascunho(id), JSON.stringify(estado));
  } catch {
    // Sem armazenamento disponível (navegação privada, cota cheia): segue sem rascunho.
  }
}

function apagarRascunho(id: number | null) {
  try {
    localStorage.removeItem(chaveRascunho(id));
  } catch {
    // Ver `guardarRascunho`.
  }
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

// Refeição/dia como chip alternável; o checkbox fica visualmente oculto mas acessível.
function Chip({
  marcado,
  onChange,
  icone: Icone,
  disabled = false,
  title,
  children,
}: {
  marcado: boolean;
  icone: typeof ForkKnifeIcon;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <label
      title={title}
      style={fs(12, 13)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-attech/30 ${
        disabled
          ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-300'
          : marcado
            ? 'cursor-pointer border-attech bg-attech text-white'
            : 'cursor-pointer border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
      }`}
    >
      <input
        type="checkbox"
        checked={marcado}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <Icone size={12} weight={marcado ? 'fill' : 'regular'} />
      {children}
    </label>
  );
}

function parseNum(s: string): number {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) || n < 0 ? NaN : n;
}

// "2 × (10:00 normal × R$ 400,00 + 0:00 a 100% × R$ 800,00)": horas de cada pessoa do grupo.
function contaDeslocamento(g: GrupoDeslocamento): string {
  const pessoas = g.colaboradores;
  const normal = pessoas ? g.normalMin / pessoas : 0;
  const cem = pessoas ? g.cemMin / pessoas : 0;
  const preco = g.precoHora || 0;
  return `${pessoas} × (${hmHoras(normal)} normal × ${formatReais(preco)} + ${hmHoras(cem)} a 100% × ${formatReais(preco * MULTIPLICADOR_CEM)})`;
}

function linhaVazia(): Linha {
  return {
    key: novaKey(),
    colaboradorId: null,
    funcaoId: null,
    colaboradorNome: '',
    funcaoNome: '',
    preco: 0,
    irata: false,
    tipoDeslocamento: 'COMUM',
    diaKeys: [],
    almoco: true,
    jantar: true,
  };
}

interface Props {
  colaboradores: ColaboradorDTO[];
  inicial: RelatorioDTO | null;
}

export default function RelatorioForm({ colaboradores, inicial }: Props) {
  const router = useRouter();
  const [estado0] = useState(() => estadoInicial(inicial));
  const [diasForm, setDiasForm] = useState<DiaForm[]>(estado0.diasForm);
  const [descricao, setDescricao] = useState(estado0.descricao);
  const [precos, setPrecos] = useState<Precos>(estado0.precos);
  const [temMaterial, setTemMaterial] = useState(estado0.temMaterial);
  const [material, setMaterial] = useState(estado0.material);
  const [linhas, setLinhas] = useState<Linha[]>(estado0.linhas);
  const [deslocs, setDeslocs] = useState<DeslocForm[]>(estado0.deslocs);
  const [alimentacaoManual, setAlimentacaoManual] = useState<string | null>(estado0.alimentacaoManual);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);
  // O rascunho só pode ser lido depois da montagem (o servidor não tem `localStorage`);
  // até lá nada é gravado, para não sobrescrever o rascunho com o estado inicial.
  const [rascunhoLido, setRascunhoLido] = useState(false);
  const [restaurado, setRestaurado] = useState(false);
  const idRascunho = inicial?.id ?? null;

  function aplicarEstado(e: Estado) {
    setDiasForm(e.diasForm);
    setDescricao(e.descricao);
    setPrecos(e.precos);
    setTemMaterial(e.temMaterial);
    setMaterial(e.material);
    setLinhas(e.linhas);
    setDeslocs(e.deslocs);
    setAlimentacaoManual(e.alimentacaoManual);
  }

  useEffect(() => {
    const rascunho = lerRascunho(idRascunho);
    if (rascunho) {
      aplicarEstado(rascunho);
      setRestaurado(true);
    }
    setRascunhoLido(true);
  }, [idRascunho]);

  useEffect(() => {
    if (!rascunhoLido) return;
    guardarRascunho(idRascunho, { diasForm, descricao, precos, temMaterial, material, linhas, deslocs, alimentacaoManual });
  }, [rascunhoLido, idRascunho, diasForm, descricao, precos, temMaterial, material, linhas, deslocs, alimentacaoManual]);

  // Volta ao estado de um relatório novo (ou ao que está salvo, ao editar) e apaga o rascunho.
  function limparDados() {
    apagarRascunho(idRascunho);
    aplicarEstado(estadoInicial(inicial));
    setRestaurado(false);
    setConfirmandoLimpar(false);
    setErro('');
    setAviso('');
  }

  const dias = useMemo(() => diasForm.map(paraDiaInput), [diasForm]);
  const datasCompletas = dias.every((d) => d.data && d.entrada && d.saida);
  // Sobreposição e saída antes da entrada aparecem na tela; aqui só bloqueiam o salvamento.
  const diasInvalidos =
    !datasCompletas ||
    dias.some((d) => `${d.dataSaida}T${d.saida}` <= `${d.data}T${d.entrada}`) ||
    diaSobreposto(dias) >= 0;
  const varios = diasForm.length > 1;

  // Datas da ida e da volta seguem os dias de trabalho; trechos com data ou horário
  // incompletos ficam fora das prévias e bloqueiam o salvamento.
  const viagens = useMemo(() => deslocs.map((d, n) => viagemDoDeslocamento(d, n, dias)), [deslocs, dias]);
  const deslocInputs = useMemo(() => viagens.flatMap((v) => [v.ida, v.volta]), [viagens]);
  const deslocsCompletos = useMemo(
    () => deslocInputs.filter((d) => d.data && d.dataSaida && d.entrada && d.saida),
    [deslocInputs],
  );
  const deslocInvalidos =
    deslocsCompletos.length < deslocInputs.length ||
    deslocsCompletos.some((d) => `${d.dataSaida}T${d.saida}` <= `${d.data}T${d.entrada}`);

  const params = useMemo<Parametros>(
    () => ({
      ...PARAMETROS_PADRAO,
      kmQuantidade: parseNum(precos.kmQuantidade),
      kmPreco: parseNum(precos.kmPreco),
      deslocPrecoComum: parseNum(precos.deslocPrecoComum),
      deslocPrecoTecnico: parseNum(precos.deslocPrecoTecnico),
      material: temMaterial ? parseNum(material) : 0,
      alimentacaoManual: alimentacaoManual === null ? null : parseNum(alimentacaoManual),
    }),
    [precos, temMaterial, material, alimentacaoManual],
  );
  const precosValidos = CAMPOS_PRECO.every(({ campo }) => !Number.isNaN(params[campo]));
  const materialInvalido = Number.isNaN(params.material);
  const alimentacaoInvalida = params.alimentacaoManual !== null && Number.isNaN(params.alimentacaoManual);

  const itens = useMemo<RelatorioItemDTO[]>(
    () =>
      linhas.map(({ key: _key, diaKeys, ...l }) => ({
        ...l,
        dias: varios ? diasForm.flatMap((d, n) => (diaKeys.includes(d.key) ? [n] : [])) : [0],
      })),
    [linhas, diasForm, varios],
  );

  // Pendências: colaborador sem dia marcado e dia em que ninguém trabalhou.
  const linhasPendentes = varios ? itens.filter((i) => i.dias.length === 0).length : 0;
  const diaSemColaborador =
    varios && linhas.length > 0 ? diasForm.findIndex((_, n) => !itens.some((i) => i.dias.includes(n))) : -1;

  // O jantar vale nos dias em que a saída é tarde; sem nenhum deles a opção fica bloqueada.
  function podeJantarNosDias(posicoes: number[]): boolean {
    return (posicoes.length ? posicoes : dias.map((_, n) => n)).some((n) =>
      jantarPermitido(dias[n].data, dias[n].dataSaida, dias[n].saida),
    );
  }

  // Preço inválido conta como zero só nas prévias; salvar é bloqueado.
  const paramsPrevia = useMemo<Parametros>(() => {
    const seguro = { ...params };
    for (const campo of [...CAMPOS_PRECO.map((c) => c.campo), 'material' as const]) {
      if (Number.isNaN(seguro[campo])) seguro[campo] = 0;
    }
    if (alimentacaoInvalida) seguro.alimentacaoManual = 0;
    return seguro;
  }, [params, alimentacaoInvalida]);

  const calc = useMemo(
    () => calcularRelatorio(datasCompletas ? itens : [], dias, paramsPrevia, deslocsCompletos),
    [itens, dias, paramsPrevia, datasCompletas, deslocsCompletos],
  );

  function mudou() {
    setAviso('');
  }

  function atualizarLinha(key: string, patch: Partial<Linha>) {
    mudou();
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function escolherColaborador(key: string, id: number) {
    const c = colaboradores.find((x) => x.id === id);
    if (!c) return;
    const f = c.funcoes.length === 1 ? c.funcoes[0] : null;
    atualizarLinha(key, {
      colaboradorId: c.id,
      colaboradorNome: c.nome,
      funcaoId: f?.id ?? null,
      funcaoNome: f?.nome ?? '',
      preco: f?.preco ?? 0,
      irata: f?.irata ?? false,
      tipoDeslocamento: f?.tipoDeslocamento ?? 'COMUM',
    });
  }

  function escolherFuncao(l: Linha, id: number) {
    const f = colaboradores.find((c) => c.id === l.colaboradorId)?.funcoes.find((x) => x.id === id);
    if (!f) return;
    atualizarLinha(l.key, {
      funcaoId: f.id,
      funcaoNome: f.nome,
      preco: f.preco,
      irata: f.irata,
      tipoDeslocamento: f.tipoDeslocamento,
    });
  }

  // Ao passar de um para vários dias, quem já estava na equipe trabalhou no dia
  // que existia até então; ao remover um dia ele sai das escolhas.
  function alterarDias(novos: DiaForm[]) {
    mudou();
    const chaves = new Set(novos.map((d) => d.key));
    const passouParaVarios = diasForm.length === 1 && novos.length > 1;
    setLinhas((prev) =>
      prev.map((l) => ({
        ...l,
        diaKeys: passouParaVarios ? [diasForm[0].key] : l.diaKeys.filter((k) => chaves.has(k)),
      })),
    );
    setDiasForm(novos);
  }

  function alternarDia(linhaKey: string, diaKey: string, marcado: boolean) {
    mudou();
    setLinhas((prev) =>
      prev.map((l) =>
        l.key === linhaKey
          ? { ...l, diaKeys: marcado ? [...l.diaKeys, diaKey] : l.diaKeys.filter((k) => k !== diaKey) }
          : l,
      ),
    );
  }

  function alterarDeslocs(novos: DeslocForm[]) {
    mudou();
    setDeslocs(novos);
  }

  // O colaborador novo já vem no último dia (o que se estava montando); dá para trocar nos chips.
  function adicionarLinha() {
    mudou();
    const ultimoDia = diasForm[diasForm.length - 1];
    setLinhas((prev) => [...prev, { ...linhaVazia(), diaKeys: ultimoDia ? [ultimoDia.key] : [] }]);
  }

  function removerLinha(key: string) {
    mudou();
    setLinhas((prev) => prev.filter((l) => l.key !== key));
  }

  async function salvar(baixar: boolean) {
    setErro('');
    setAviso('');
    if (materialInvalido) {
      setErro('Informe o valor do material.');
      return;
    }
    if (alimentacaoInvalida) {
      setErro('Informe o valor da alimentação.');
      return;
    }
    if (!precosValidos) {
      setErro('Confira a distância e os preços da quilometragem e do deslocamento.');
      return;
    }
    if (diasInvalidos) {
      setErro('Confira as datas e os horários dos dias de trabalho.');
      return;
    }
    if (deslocInvalidos) {
      setErro('Confira as datas e os horários dos deslocamentos.');
      return;
    }
    if (linhasPendentes > 0) {
      setErro('Selecione os dias trabalhados de cada colaborador.');
      return;
    }
    if (diaSemColaborador >= 0) {
      setErro(`Nenhum colaborador trabalhou no dia ${diaSemColaborador + 1}.`);
      return;
    }
    setSalvando(true);
    // Se o banco falhar, o PDF ainda sai com os dados que estão na tela.
    async function baixarSemSalvar(motivo: string) {
      if (!baixar || !previa) {
        setErro(motivo);
        return;
      }
      try {
        await baixarRelatorioPdf(previa);
        setErro(`${motivo} O PDF foi baixado mesmo assim, mas o relatório não foi salvo.`);
      } catch {
        setErro(motivo);
      }
    }
    try {
      const res = await salvarRelatorio({
        id: inicial?.id ?? null,
        dias,
        deslocamentos: deslocInputs,
        descricao,
        params,
        itens,
      });
      if (!res.ok) {
        await baixarSemSalvar(res.error);
        return;
      }
      apagarRascunho(idRascunho);
      setRestaurado(false);
      if (baixar) {
        const rel = await carregarRelatorio(res.data.id);
        await baixarRelatorioPdf(rel.ok ? rel.data : { ...previa!, id: res.data.id });
      }
      if (inicial) setAviso('Relatório salvo.');
      else router.push(`/relatorio/${res.data.id}`);
    } catch {
      await baixarSemSalvar('Não foi possível salvar o relatório.');
    } finally {
      setSalvando(false);
    }
  }

  const semCadastro = colaboradores.length === 0;
  const opcoesColaborador = useMemo(() => colaboradores.map((c) => ({ value: c.id, label: c.nome })), [colaboradores]);

  // O que a pré-visualização mostra: o mesmo formato do relatório salvo.
  const previa = useMemo<RelatorioDTO | null>(
    () =>
      datasCompletas
        ? {
            id: inicial?.id ?? null,
            descricao: descricao.trim() || null,
            dias,
            deslocamentos: deslocsCompletos,
            createdAt: inicial?.createdAt ?? '',
            params: paramsPrevia,
            itens: itens.filter((i) => i.colaboradorNome && i.funcaoNome && i.dias.length > 0),
          }
        : null,
    [inicial, descricao, dias, deslocsCompletos, datasCompletas, paramsPrevia, itens],
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Card>
          <SectionHead
            icon={<FileTextIcon size={14} />}
            title={inicial ? `Relatório nº ${inicial.id}` : 'Novo relatório'}
            description={restaurado ? 'Rascunho restaurado deste navegador' : 'Serviço realizado'}
            action={
              <button
                type="button"
                onClick={() => setConfirmandoLimpar(true)}
                style={fs(12, 13)}
                className={`${btnSecundario} shrink-0 py-1.5`}
              >
                <ArrowCounterClockwiseIcon size={14} />
                {inicial ? 'Descartar alterações' : 'Limpar dados'}
              </button>
            }
          />
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <Field label="Descrição (opcional)" htmlFor="descricao">
              <textarea
                id="descricao"
                rows={3}
                value={descricao}
                onChange={(e) => {
                  mudou();
                  setDescricao(e.target.value);
                }}
                placeholder="Ex.: embarcação, cliente, serviço"
                className={`${inputClass} h-auto resize-y py-2`}
              />
            </Field>

            <div className="flex flex-col gap-3">
              <label
                style={fs(13, 14)}
                className="flex w-fit cursor-pointer items-center gap-2 font-medium text-neutral-700"
              >
                <input
                  type="checkbox"
                  checked={temMaterial}
                  onChange={(e) => {
                    mudou();
                    setTemMaterial(e.target.checked);
                  }}
                  className={checkboxClass}
                />
                Material
              </label>
              {temMaterial && (
                <Field
                  label="Valor do material"
                  htmlFor="material"
                  error={materialInvalido ? 'Informe um valor válido' : undefined}
                  className="sm:max-w-60"
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-neutral-400">
                      R$
                    </span>
                    <input
                      id="material"
                      inputMode="decimal"
                      value={material}
                      onChange={(e) => {
                        mudou();
                        setMaterial(e.target.value);
                      }}
                      placeholder="0,00"
                      className={`${inputClass} pl-8 tabular-nums ${materialInvalido ? 'border-red-400 bg-red-50/50' : ''}`}
                    />
                  </div>
                </Field>
              )}
            </div>
          </div>
        </Card>

        <DiasTrabalho
          dias={diasForm}
          onChange={alterarDias}
        />

        <Card>
          <SectionHead
            icon={<UsersThreeIcon size={14} />}
            title="Equipe"
            description={`Jantar só com saída depois das ${HORARIO_MIN_JANTAR}`}
            action={
              <span
                style={fs(11, 12)}
                className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-neutral-500"
              >
                Subtotal{' '}
                <strong className="font-semibold text-neutral-900 tabular-nums">
                  {formatCent(calc.subtotalColaboradoresCent)}
                </strong>
              </span>
            }
          />

          <div className="flex flex-col gap-3 p-4 sm:p-5">
            {semCadastro && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <UsersThreeIcon size={32} className="text-neutral-200" />
                <p style={fs(12, 14)} className="text-neutral-500">
                  Nenhum colaborador cadastrado.{' '}
                  <Link href="/usuarios" className="font-medium text-attech hover:underline">
                    Cadastrar colaboradores
                  </Link>
                </p>
              </div>
            )}

            {!semCadastro && linhas.length === 0 && (
              <p style={fs(12, 14)} className="py-2 text-center text-neutral-400">
                Adicione quem trabalhou neste serviço.
              </p>
            )}

            {linhas.map((l, n) => {
              const c = calc.itens[n];
              const diasDaLinha = itens[n].dias;
              const podeJantar = podeJantarNosDias(diasDaLinha);
              const colab = colaboradores.find((x) => x.id === l.colaboradorId);
              const funcoesDisponiveis = colab?.funcoes ?? [];
              const funcaoNaLista = funcoesDisponiveis.some((f) => f.id === l.funcaoId);
              return (
                <div key={l.key} className="rounded-xl border border-neutral-200 bg-neutral-50/60">
                  <div className="flex items-start gap-3 p-3.5">
                    <div className="mt-6 hidden size-8 shrink-0 items-center justify-center rounded-full border border-attech/10 bg-attech/5 sm:flex">
                      <span style={fs(11, 12)} className="font-semibold text-attech">
                        {l.colaboradorNome ? iniciais(l.colaboradorNome) : '–'}
                      </span>
                    </div>

                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <Field label="Colaborador" htmlFor={`colab-${l.key}`}>
                        <SelectBusca
                          id={`colab-${l.key}`}
                          opcoes={opcoesColaborador}
                          value={colab ? l.colaboradorId : null}
                          onChange={(id) => escolherColaborador(l.key, id)}
                          textoAtual={l.colaboradorNome}
                          placeholder="Buscar colaborador…"
                          className={`${inputClass} bg-white`}
                        />
                      </Field>
                      <Field label="Função neste trabalho" htmlFor={`funcao-${l.key}`}>
                        <SelectBusca
                          id={`funcao-${l.key}`}
                          opcoes={funcoesDisponiveis.map((f) => ({ value: f.id, label: f.nome }))}
                          value={funcaoNaLista ? l.funcaoId : null}
                          onChange={(id) => escolherFuncao(l, id)}
                          textoAtual={l.funcaoNome}
                          placeholder={colab ? 'Selecione a função' : 'Escolha o colaborador'}
                          disabled={!colab}
                          className={`${inputClass} bg-white`}
                        />
                      </Field>
                    </div>

                    <button
                      type="button"
                      onClick={() => removerLinha(l.key)}
                      aria-label={`Remover ${l.colaboradorNome || 'colaborador'}`}
                      title="Remover"
                      className={`${btnIconePerigo} mt-6 shrink-0`}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </div>

                  {varios && (
                    <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3 sm:pl-14.5">
                      <span style={fs(11, 12)} className="font-medium text-neutral-500">
                        Dias trabalhados
                      </span>
                      {diasForm.map((d, i) => (
                        <Chip
                          key={d.key}
                          icone={CalendarBlankIcon}
                          marcado={l.diaKeys.includes(d.key)}
                          onChange={(v) => alternarDia(l.key, d.key, v)}
                        >
                          Dia {i + 1}
                          {d.data && ` · ${formatDataISO(d.data).slice(0, 5)}`}
                        </Chip>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3 sm:pl-14.5">
                    <Chip icone={ForkKnifeIcon} marcado={l.almoco} onChange={(v) => atualizarLinha(l.key, { almoco: v })}>
                      Almoço
                    </Chip>
                    <Chip
                      icone={ForkKnifeIcon}
                      marcado={l.jantar && podeJantar}
                      disabled={!podeJantar}
                      title={podeJantar ? undefined : `Jantar só com saída depois das ${HORARIO_MIN_JANTAR}`}
                      onChange={(v) => atualizarLinha(l.key, { jantar: v })}
                    >
                      Jantar
                    </Chip>
                    {l.funcaoNome && (
                      <span style={fs(11, 12)} className="text-neutral-400">
                        {l.irata ? 'Regra Irata' : 'Regra normal'}, {formatPrecoNormal(l)}, 100% {formatPrecoCem(l)},
                        deslocamento {TIPO_DESLOCAMENTO_LABEL[l.tipoDeslocamento].toLowerCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-neutral-200 bg-white px-3.5 py-2.5 sm:pl-14.5">
                    {diasDaLinha.length === 0 ? (
                      <span
                        style={fs(12, 13)}
                        className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 font-medium text-neutral-700"
                      >
                        <WarningCircleIcon size={13} weight="fill" className="text-primary" />
                        Pendente: selecione os dias trabalhados
                      </span>
                    ) : c ? (
                      <>
                        <div style={fs(12, 13)} className="flex gap-4 text-neutral-500">
                          <span>
                            Normal <strong className="font-semibold text-neutral-800 tabular-nums">{hmHoras(c.normalMin)}</strong>
                          </span>
                          <span>
                            100% <strong className="font-semibold text-neutral-800 tabular-nums">{hmHoras(c.cemMin)}</strong>
                          </span>
                        </div>
                        <strong style={fs(13, 14)} className="font-semibold text-neutral-900 tabular-nums">
                          {formatCent(c.totalCent)}
                        </strong>
                      </>
                    ) : (
                      <span style={fs(12, 13)} className="flex items-center gap-1.5 text-red-600">
                        <WarningCircleIcon size={13} weight="fill" />
                        Horário inválido
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={adicionarLinha}
              disabled={semCadastro}
              style={fs(12, 13)}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-white px-3.5 py-2.5 font-medium text-neutral-600 transition-colors duration-150 hover:border-attech/40 hover:bg-attech/2 hover:text-attech focus-visible:ring-2 focus-visible:ring-attech/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon size={14} weight="bold" />
              Adicionar colaborador
            </button>

            {diaSemColaborador >= 0 && (
              <Alerta tipo="erro" texto={`Nenhum colaborador trabalhou no dia ${diaSemColaborador + 1}.`} />
            )}

            {linhas.length > 0 && (
              <dl style={fs(12, 13)} className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 font-medium text-neutral-500">
                  <ForkKnifeIcon size={13} />
                  Alimentação
                </div>
                {[
                  {
                    label: 'Almoço',
                    conta: `${calc.alimentacao.almocos} × ${formatReais(calc.alimentacao.precoAlmoco)}`,
                    total: calc.alimentacao.almocoCent,
                  },
                  {
                    label: 'Jantar',
                    conta: `${calc.alimentacao.jantares} × ${formatReais(calc.alimentacao.precoJantar)}`,
                    total: calc.alimentacao.jantarCent,
                  },
                ].map((r) => (
                  <div key={r.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-2.5">
                    <dt className="flex flex-col">
                      <span className="font-medium text-neutral-800">{r.label}</span>
                      <span className="text-neutral-400 tabular-nums">{r.conta}</span>
                    </dt>
                    <dd className="font-semibold text-neutral-900 tabular-nums">{formatCent(r.total)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {linhas.length > 0 && (
              <Field
                label="Valor da alimentação"
                htmlFor="alimentacao"
                error={alimentacaoInvalida ? 'Informe um valor válido' : undefined}
                hint={
                  alimentacaoManual === null
                    ? 'Calculado pelas refeições marcadas. Edite para informar outro valor, como o de uma nota fiscal.'
                    : `Valor informado. Pelas refeições marcadas: ${formatCent(calc.alimentacao.automaticoCent)}`
                }
                labelAction={
                  alimentacaoManual !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        mudou();
                        setAlimentacaoManual(null);
                      }}
                      style={fs(11, 12)}
                      className="inline-flex cursor-pointer items-center gap-1 font-medium text-attech hover:underline"
                    >
                      <ArrowCounterClockwiseIcon size={11} weight="bold" />
                      Usar automático
                    </button>
                  )
                }
                className="sm:max-w-72"
              >
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-neutral-400">
                    R$
                  </span>
                  <input
                    id="alimentacao"
                    inputMode="decimal"
                    value={alimentacaoManual ?? valorParaCampo(calc.alimentacao.automaticoCent / 100)}
                    onChange={(e) => {
                      mudou();
                      setAlimentacaoManual(e.target.value);
                    }}
                    className={`${inputClass} pl-8 tabular-nums ${alimentacaoInvalida ? 'border-red-400 bg-red-50/50' : ''}`}
                  />
                </div>
              </Field>
            )}
          </div>
        </Card>

        <Deslocamentos deslocs={deslocs} viagens={viagens} onChange={alterarDeslocs}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAMPOS_PRECO.map(({ campo, label, prefixo, unidade }) => {
                const invalido = Number.isNaN(params[campo]);
                return (
                  <Field key={campo} label={label} htmlFor={campo} error={invalido ? 'Informe um valor válido' : undefined}>
                    <div className="relative">
                      {prefixo && (
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-neutral-400">
                          {prefixo}
                        </span>
                      )}
                      <input
                        id={campo}
                        inputMode="decimal"
                        value={precos[campo]}
                        onChange={(e) => {
                          mudou();
                          setPrecos((prev) => ({ ...prev, [campo]: e.target.value }));
                        }}
                        className={`${inputClass} pr-10 ${prefixo ? 'pl-8' : ''} tabular-nums ${invalido ? 'border-red-400 bg-red-50/50' : ''}`}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-neutral-400">
                        {unidade}
                      </span>
                    </div>
                  </Field>
                );
              })}
            </div>

            <dl style={fs(12, 13)} className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {[
                {
                  label: 'Quilometragem',
                  conta: `${calc.km.quantidade || 0} km × ${formatReais(calc.km.preco || 0)}`,
                  total: calc.km.totalCent,
                },
                {
                  label: 'Deslocamento comum',
                  conta: contaDeslocamento(calc.deslocamento.comum),
                  total: calc.deslocamento.comum.totalCent,
                },
                {
                  label: 'Deslocamento técnico',
                  conta: contaDeslocamento(calc.deslocamento.tecnico),
                  total: calc.deslocamento.tecnico.totalCent,
                },
              ].map((r) => (
                <div key={r.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-2.5">
                  <dt className="flex flex-col">
                    <span className="font-medium text-neutral-800">{r.label}</span>
                    <span className="text-neutral-400 tabular-nums">{r.conta}</span>
                  </dt>
                  <dd className="font-semibold text-neutral-900 tabular-nums">{formatCent(r.total)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Deslocamentos>

        <section className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl bg-attech px-4 py-4 text-white shadow-xl shadow-attech/20 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-col">
            <span style={fs(11, 12)} className="text-white/60">
              Total do relatório
            </span>
            <strong style={fs(22, 28)} className="leading-tight font-semibold tracking-tight text-primary tabular-nums">
              {formatCent(calc.totalCent)}
            </strong>
            {(aviso || erro) && (
              <span
                role={erro ? 'alert' : 'status'}
                style={fs(11, 12)}
                className={`mt-0.5 font-medium ${erro ? 'text-red-300' : 'text-green-300'}`}
              >
                {erro || aviso}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={() => salvar(false)}
              style={fs(12, 13)}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/20 px-3.5 py-2 font-medium text-white transition-colors duration-150 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <FloppyDiskIcon size={15} />
              Salvar
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => salvar(true)}
              style={fs(12, 13)}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 font-semibold text-attech transition-colors duration-150 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-attech focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {salvando ? <SpinnerIcon size={15} className="animate-spin" /> : <FilePdfIcon size={15} weight="bold" />}
              Salvar e baixar PDF
            </button>
          </div>
        </section>
      </div>

      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] lg:block">
        <PreviaPdf relatorio={previa} />
      </aside>

      <ConfirmarExclusao
        aberto={confirmandoLimpar}
        titulo={inicial ? 'Descartar alterações?' : 'Limpar todos os dados?'}
        descricao={
          inicial
            ? 'O relatório volta ao que está salvo e o rascunho deste navegador é apagado.'
            : 'Tudo o que foi preenchido neste relatório será apagado, inclusive o rascunho guardado no navegador.'
        }
        rotulo={inicial ? 'Descartar' : 'Limpar'}
        onFechar={() => setConfirmandoLimpar(false)}
        onConfirmar={limparDados}
      />
    </div>
  );
}
