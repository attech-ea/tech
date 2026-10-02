'use client';

import {
  BriefcaseIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react/dist/ssr';
import { useState, type FormEvent } from 'react';
import { fs } from '@/lib/calc-clamp';
import { excluirFuncao, salvarFuncao } from '../relatorio/actions';
import {
  formatPrecoCem,
  formatPrecoNormal,
  TIPO_DESLOCAMENTO_LABEL,
  type TipoDeslocamento,
} from '../relatorio/calculo';
import { normalizar } from '../relatorio/SelectBusca';
import type { FuncaoDTO } from '../relatorio/tipos';
import {
  Alerta,
  btnIcone,
  btnIconePerigo,
  btnPrimario,
  btnSecundario,
  Card,
  checkboxClass,
  ConfirmarExclusao,
  Field,
  inputClass,
  SectionHead,
} from '../relatorio/ui';

function Formulario({ editando, onConcluir }: { editando: FuncaoDTO | null; onConcluir: () => void }) {
  const [nome, setNome] = useState(editando?.nome ?? '');
  const [preco, setPreco] = useState(editando ? String(editando.preco) : '');
  const [irata, setIrata] = useState(editando?.irata ?? false);
  const [tipo, setTipo] = useState<TipoDeslocamento>(editando?.tipoDeslocamento ?? 'COMUM');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const precoNum = Number(preco.replace(',', '.'));

  // Irata sempre usa deslocamento técnico.
  function mudarIrata(valor: boolean) {
    setIrata(valor);
    if (valor) setTipo('TECNICO');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const res = await salvarFuncao({ id: editando?.id ?? null, nome, preco: precoNum, irata, tipoDeslocamento: tipo });
    setSalvando(false);
    if (res.ok) onConcluir();
    else setErro(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
        <Field label="Nome" htmlFor="funcao-nome">
          <input
            id="funcao-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Encanador, Irata N1"
            className={inputClass}
          />
        </Field>
        <Field label={irata ? 'Diária 12h' : 'Preço/hora'} htmlFor="funcao-preco">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-neutral-400">
              R$
            </span>
            <input
              id="funcao-preco"
              inputMode="decimal"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="0,00"
              className={`${inputClass} pl-8 tabular-nums`}
            />
          </div>
        </Field>
      </div>

      <label
        style={fs(12, 13)}
        className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-neutral-600"
      >
        <input
          type="checkbox"
          checked={irata}
          onChange={(e) => mudarIrata(e.target.checked)}
          className={`${checkboxClass} mt-0.5`}
        />
        <span>
          <span className="font-medium text-neutral-900">Função Irata.</span> Diária fixa de 12h; depois disso, hora
          100%.
          {preco.trim() !== '' && Number.isFinite(precoNum) && (
            <span className="mt-0.5 block text-neutral-500">
              Hora 100%:{' '}
              <strong className="font-semibold text-neutral-900 tabular-nums">
                {formatPrecoCem({ preco: precoNum, irata })}
              </strong>
              {irata && ' (diária ÷ 12, arredondada ao múltiplo de 50, × 2)'}
            </span>
          )}
        </span>
      </label>

      <Field label="Deslocamento">
        <div
          role="radiogroup"
          aria-label="Deslocamento"
          className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
        >
          {(['COMUM', 'TECNICO'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => setTipo(t)}
              style={fs(12, 13)}
              className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-attech/30 focus-visible:outline-none ${
                tipo === t
                  ? 'bg-attech text-white shadow-sm ring-1 ring-attech'
                  : 'text-neutral-500 hover:bg-white hover:text-neutral-800'
              }`}
            >
              {tipo === t && <CheckIcon size={12} weight="bold" />}
              {TIPO_DESLOCAMENTO_LABEL[t]}
            </button>
          ))}
        </div>
      </Field>

      <div className="flex gap-2 w-full">
        <button type="submit" disabled={salvando} style={fs(12, 13)} className={btnPrimario}>
          {editando ? <CheckIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
          {editando ? 'Salvar alterações' : 'Adicionar função'}
        </button>
        {editando && (
          <button type="button" onClick={onConcluir} style={fs(12, 13)} className={btnSecundario}>
            Cancelar
          </button>
        )}
      </div>
      <Alerta tipo="erro" texto={erro} />
    </form>
  );
}

function LinhaFuncao({
  funcao,
  editando,
  onEditar,
  onExcluir,
}: {
  funcao: FuncaoDTO;
  editando: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors sm:px-5 ${
        editando ? 'bg-attech/5' : 'hover:bg-neutral-50'
      }`}
    >
      <div className="min-w-0">
        <div style={fs(13, 15)} className="flex items-center gap-2 font-medium text-neutral-900">
          <span className="truncate">{funcao.nome}</span>
          {funcao.irata && (
            <span
              style={fs(10, 11)}
              className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 leading-none font-semibold text-attech"
            >
              Irata
            </span>
          )}
        </div>
        <div style={fs(11, 12)} className="text-neutral-400">
          <span className="tabular-nums">{formatPrecoNormal(funcao)}</span>, 100%{' '}
          <span className="tabular-nums">{formatPrecoCem(funcao)}</span>, deslocamento{' '}
          {TIPO_DESLOCAMENTO_LABEL[funcao.tipoDeslocamento].toLowerCase()}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={onEditar} aria-label="Editar" title="Editar" className={btnIcone}>
          <PencilSimpleIcon size={15} />
        </button>
        <button type="button" onClick={onExcluir} aria-label="Excluir" title="Excluir" className={btnIconePerigo}>
          <TrashIcon size={15} />
        </button>
      </div>
    </li>
  );
}

export default function Funcoes({ funcoes }: { funcoes: FuncaoDTO[] }) {
  // `editando`: função em edição; `null` = formulário de cadastro novo.
  const [editando, setEditando] = useState<FuncaoDTO | null>(null);
  // Muda a cada troca de função para remontar o formulário com os dados novos.
  const [chaveForm, setChaveForm] = useState(0);
  const [busca, setBusca] = useState('');
  const [aExcluir, setAExcluir] = useState<FuncaoDTO | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState('');

  const termo = normalizar(busca.trim());
  const filtradas = termo ? funcoes.filter((f) => normalizar(f.nome).includes(termo)) : funcoes;

  function trocarFormulario(f: FuncaoDTO | null) {
    setEditando(f);
    setChaveForm((k) => k + 1);
  }

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setExcluindo(true);
    const res = await excluirFuncao(aExcluir.id);
    setExcluindo(false);
    if (!res.ok) setErro(res.error);
    else if (editando?.id === aExcluir.id) trocarFormulario(null);
    setAExcluir(null);
  }

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <Card>
        <SectionHead
          icon={<BriefcaseIcon size={14} />}
          title={editando ? 'Editar função' : 'Nova função'}
          description="Preço, tipo de deslocamento e regra Irata"
        />
        <Formulario key={chaveForm} editando={editando} onConcluir={() => trocarFormulario(null)} />
      </Card>

      <Card>
        <SectionHead icon={<BriefcaseIcon size={14} />} title="Funções" description={`${funcoes.length} cadastradas`} />
        <div className="border-b border-neutral-100 p-3 sm:px-5">
          <div className="relative">
            <MagnifyingGlassIcon
              size={14}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar função…"
              aria-label="Buscar funções"
              className={`${inputClass} pl-8`}
            />
          </div>
        </div>
        {erro && (
          <div className="p-3 sm:px-5">
            <Alerta tipo="erro" texto={erro} />
          </div>
        )}
        {filtradas.length === 0 ? (
          <p style={fs(12, 13)} className="px-5 py-10 text-center text-neutral-400">
            {funcoes.length === 0 ? 'Nenhuma função cadastrada.' : `Nada encontrado para “${busca.trim()}”.`}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {filtradas.map((f) => (
              <LinhaFuncao
                key={f.id}
                funcao={f}
                editando={editando?.id === f.id}
                onEditar={() => trocarFormulario(f)}
                onExcluir={() => setAExcluir(f)}
              />
            ))}
          </ul>
        )}
      </Card>

      <ConfirmarExclusao
        aberto={!!aExcluir}
        titulo={`Excluir a função "${aExcluir?.nome ?? ''}"?`}
        descricao="Ela será removida dos colaboradores. Relatórios já salvos não mudam."
        excluindo={excluindo}
        onFechar={() => setAExcluir(null)}
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
