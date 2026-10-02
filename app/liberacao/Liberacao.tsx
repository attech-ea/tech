'use client';

import {
  AnchorIcon,
  CheckIcon,
  EnvelopeSimpleIcon,
  EyeIcon,
  FileDashedIcon,
  FilePdfIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  UsersThreeIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react/dist/ssr';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { fs } from '@/lib/calc-clamp';
import SelectBusca, { normalizar } from '../relatorio/SelectBusca';
import { formatDataISO } from '../relatorio/calculo';
import type { UsuarioDTO } from '../relatorio/tipos';
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
  useEscapeKey,
} from '../relatorio/ui';
import { enviarLiberacao, excluirDestinatario, salvarDestinatario } from './actions';
import { baixarLiberacaoPdf, gerarLiberacaoPdf } from './gerarPdf';
import { MODELO } from './modelo';
import type { DestinatarioDTO, LiberacaoDTO, PessoaLiberacao } from './tipos';

// Espera parar de digitar antes de regerar o PDF da pré-visualização.
const ATRASO_MS = 400;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// O e-mail costuma ser enviado na véspera; o dia é editável.
function amanhaISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Dados que o e-mail exige de cada integrante e que o cadastro pode não ter.
function dadosFaltando(u: UsuarioDTO): string[] {
  const falta: string[] = [];
  if (!u.rg) falta.push('RG');
  if (!u.cpf) falta.push('CPF');
  if (!u.dataNascimento) falta.push('nascimento');
  return falta;
}

function FormularioDestinatario({ editando, onConcluir }: { editando: DestinatarioDTO | null; onConcluir: () => void }) {
  const [nome, setNome] = useState(editando?.nome ?? '');
  const [email, setEmail] = useState(editando?.email ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const res = await salvarDestinatario({ id: editando?.id ?? null, nome, email });
    setSalvando(false);
    if (res.ok) onConcluir();
    else setErro(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" htmlFor="d-nome">
          <input
            id="d-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: OPSRIO CBO"
            className={inputClass}
          />
        </Field>
        <Field label="E-mail" htmlFor="d-email">
          <input
            id="d-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="opsrio.cbo@solana.com.br"
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} style={fs(12, 13)} className={btnPrimario}>
          {editando ? <CheckIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
          {editando ? 'Salvar alterações' : 'Adicionar destinatário'}
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

// Confirma o envio: o e-mail sai de verdade e não dá para desfazer.
function ConfirmarEnvio({
  liberacao,
  enviando,
  onFechar,
  onConfirmar,
}: {
  liberacao: LiberacaoDTO | null;
  enviando: boolean;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  useEscapeKey(onFechar, !!liberacao && !enviando);
  if (!liberacao) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={enviando ? undefined : onFechar} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-envio-titulo"
        className="relative z-10 flex w-full max-w-md flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-attech/10">
            <PaperPlaneTiltIcon size={20} weight="fill" className="text-attech" />
          </div>
          <div className="min-w-0">
            <p id="confirmar-envio-titulo" className="text-base font-semibold text-neutral-900">
              Enviar a solicitação por e-mail?
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {liberacao.equipe.length} {liberacao.equipe.length === 1 ? 'colaborador' : 'colaboradores'} a bordo da{' '}
              {liberacao.embarcacao} no dia {formatDataISO(liberacao.data)}.
            </p>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              <dt className="text-neutral-400">De</dt>
              <dd className="truncate text-neutral-800">{MODELO.de.email}</dd>
              <dt className="text-neutral-400">Para</dt>
              <dd className="truncate text-neutral-800">{liberacao.destinatario.email}</dd>
              <dt className="text-neutral-400">Cc</dt>
              <dd className="truncate text-neutral-800">{MODELO.cc}</dd>
            </dl>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" autoFocus onClick={onFechar} disabled={enviando} className={`${btnSecundario} text-sm`}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} disabled={enviando} className={`${btnPrimario} text-sm`}>
            {enviando ? <SpinnerIcon size={15} className="animate-spin" /> : <PaperPlaneTiltIcon size={15} weight="bold" />}
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Vazio({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      {icone}
      <p style={fs(12, 14)} className="max-w-60 text-neutral-400">
        {texto}
      </p>
    </div>
  );
}

function Previa({ liberacao }: { liberacao: LiberacaoDTO | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!liberacao) return;
    let cancelado = false;
    let urlGerada: string | null = null;

    const timer = setTimeout(async () => {
      try {
        const blob = await gerarLiberacaoPdf(liberacao);
        if (cancelado) return;
        urlGerada = URL.createObjectURL(blob);
        setUrl(urlGerada);
        setErro(false);
      } catch {
        if (!cancelado) setErro(true);
      }
    }, ATRASO_MS);

    return () => {
      cancelado = true;
      clearTimeout(timer);
      // Libera o PDF anterior só depois que o próximo já estiver no iframe.
      if (urlGerada) setTimeout(() => URL.revokeObjectURL(urlGerada!), 2000);
    };
  }, [liberacao]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-3.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-600">
          <EyeIcon size={14} />
        </div>
        <p style={fs(14, 16)} className="font-semibold tracking-tight text-neutral-800">
          Pré-visualização
        </p>
        {liberacao && !url && !erro && <SpinnerIcon size={14} className="ml-auto animate-spin text-neutral-400" />}
      </div>
      {erro ? (
        <Vazio
          icone={<WarningCircleIcon size={32} className="text-red-300" />}
          texto="Não foi possível gerar a pré-visualização."
        />
      ) : !liberacao ? (
        <Vazio
          icone={<FileDashedIcon size={32} className="text-neutral-200" />}
          texto="Escolha o destinatário, o dia e a equipe para ver o e-mail."
        />
      ) : url ? (
        <iframe
          title="Pré-visualização da solicitação"
          src={`${url}#toolbar=0&navpanes=0&view=FitH`}
          className="h-full w-full flex-1 bg-neutral-100"
        />
      ) : (
        <div className="flex-1 animate-pulse bg-neutral-50 p-8">
          <div className="mx-auto flex h-full max-w-md flex-col gap-3 rounded-lg bg-white p-6 shadow-sm">
            <div className="h-4 w-1/2 rounded bg-neutral-200" />
            <div className="h-3 w-1/3 rounded bg-neutral-100" />
            <div className="mt-4 h-24 rounded bg-neutral-100" />
            <div className="h-3 w-2/3 rounded bg-neutral-100" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Liberacao({
  destinatarios,
  usuarios,
}: {
  destinatarios: DestinatarioDTO[];
  usuarios: UsuarioDTO[];
}) {
  const [destinatarioId, setDestinatarioId] = useState<number | null>(null);
  const [embarcacao, setEmbarcacao] = useState(MODELO.embarcacaoPadrao);
  // Preenchido no navegador: o servidor e o navegador podem estar em dias diferentes.
  const [data, setData] = useState('');
  const [marcados, setMarcados] = useState<number[]>([]);
  const [busca, setBusca] = useState('');
  const [baixando, setBaixando] = useState(false);
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Cadastro de destinatários.
  const [editando, setEditando] = useState<DestinatarioDTO | null>(null);
  const [chaveForm, setChaveForm] = useState(0);
  const [aExcluir, setAExcluir] = useState<DestinatarioDTO | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState('');

  useEffect(() => setData((d) => d || amanhaISO()), []);

  const destinatario = destinatarios.find((d) => d.id === destinatarioId) ?? null;
  const embarcacaoLimpa = embarcacao.trim();

  const termo = normalizar(busca.trim());
  const filtrados = termo ? usuarios.filter((u) => normalizar(`${u.nome} ${u.cargo}`).includes(termo)) : usuarios;
  const equipe = useMemo(() => usuarios.filter((u) => marcados.includes(u.id)), [usuarios, marcados]);
  const incompletos = equipe.filter((u) => dadosFaltando(u).length > 0);

  const pendencia = !destinatario
    ? 'Escolha o destinatário.'
    : !embarcacaoLimpa
      ? 'Informe a embarcação.'
      : !data
        ? 'Informe o dia do acesso.'
        : equipe.length === 0
          ? 'Marque ao menos um colaborador.'
          : incompletos.length > 0
            ? `Complete o cadastro (RG, CPF e nascimento) de: ${incompletos.map((u) => u.nome).join(', ')}.`
            : '';

  // Só fica pronto quando não há pendência; alimenta a pré-visualização e o download.
  const liberacao = useMemo<LiberacaoDTO | null>(() => {
    if (pendencia || !destinatario) return null;
    const pessoas: PessoaLiberacao[] = equipe.map((u) => ({
      nome: u.nome,
      rg: u.rg,
      cpf: u.cpf,
      dataNascimento: u.dataNascimento,
    }));
    return { destinatario, embarcacao: embarcacaoLimpa, data, equipe: pessoas };
  }, [pendencia, destinatario, embarcacaoLimpa, data, equipe]);

  function alternar(id: number) {
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function baixar() {
    if (!liberacao) return;
    setBaixando(true);
    setErro('');
    try {
      await baixarLiberacaoPdf(liberacao);
    } catch {
      setErro('Não foi possível gerar o PDF.');
    }
    setBaixando(false);
  }

  async function enviar() {
    if (!liberacao || !destinatario) return;
    setEnviando(true);
    setErro('');
    setSucesso('');
    const res = await enviarLiberacao({
      destinatarioId: destinatario.id,
      embarcacao: liberacao.embarcacao,
      data: liberacao.data,
      colaboradorIds: marcados,
    });
    setEnviando(false);
    setConfirmandoEnvio(false);
    if (res.ok) setSucesso(`E-mail enviado para ${destinatario.email}.`);
    else setErro(res.error);
  }

  function trocarFormulario(d: DestinatarioDTO | null) {
    setEditando(d);
    setChaveForm((k) => k + 1);
  }

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setExcluindo(true);
    const res = await excluirDestinatario(aExcluir.id);
    setExcluindo(false);
    if (!res.ok) setErroExcluir(res.error);
    else {
      if (editando?.id === aExcluir.id) trocarFormulario(null);
      if (destinatarioId === aExcluir.id) setDestinatarioId(null);
    }
    setAExcluir(null);
  }

  // Dados incompletos ganham destaque próprio; as demais pendências ficam sob o botão.
  const equipeIncompleta = equipe.length > 0 && incompletos.length > 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <SectionHead
            icon={<EnvelopeSimpleIcon size={14} />}
            title="Solicitação"
            description="Para quem enviar, quando e quem vai a bordo"
          />
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <Field
              label="Destinatário"
              htmlFor="lib-dest"
              hint={destinatarios.length === 0 ? 'Cadastre um destinatário abaixo.' : undefined}
            >
              <SelectBusca
                id="lib-dest"
                opcoes={destinatarios.map((d) => ({ value: d.id, label: `${d.nome} — ${d.email}` }))}
                value={destinatarioId}
                onChange={setDestinatarioId}
                placeholder="Buscar destinatário…"
                className={`${inputClass} bg-white`}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Embarcação" htmlFor="lib-embarcacao">
                <div className="relative">
                  <AnchorIcon
                    size={14}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
                  />
                  <input
                    id="lib-embarcacao"
                    value={embarcacao}
                    onChange={(e) => setEmbarcacao(e.target.value)}
                    className={`${inputClass} pl-8`}
                  />
                </div>
              </Field>
              <Field label="Dia do acesso" htmlFor="lib-data">
                <input
                  id="lib-data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field
              label="Equipe a bordo"
              labelAction={
                <span style={fs(11, 12)} className="text-neutral-400">
                  {equipe.length} {equipe.length === 1 ? 'marcado' : 'marcados'}
                  {equipe.length > 0 && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        onClick={() => setMarcados([])}
                        className="cursor-pointer font-medium text-attech hover:underline"
                      >
                        limpar
                      </button>
                    </>
                  )}
                </span>
              }
            >
              <div className="overflow-hidden rounded-lg border border-neutral-200">
                <div className="relative border-b border-neutral-100">
                  <MagnifyingGlassIcon
                    size={14}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400"
                  />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar colaborador…"
                    aria-label="Buscar colaborador"
                    className="h-9 w-full bg-white pr-3 pl-8 text-[13px] text-neutral-900 placeholder-neutral-400 outline-none"
                  />
                </div>
                {filtrados.length === 0 ? (
                  <p style={fs(12, 13)} className="px-4 py-6 text-center text-neutral-400">
                    {usuarios.length === 0 ? 'Nenhum colaborador cadastrado.' : `Nada encontrado para “${busca.trim()}”.`}
                  </p>
                ) : (
                  <ul className="flex max-h-72 flex-col divide-y divide-neutral-100 overflow-y-auto">
                    {filtrados.map((u) => {
                      const marcado = marcados.includes(u.id);
                      const falta = dadosFaltando(u);
                      return (
                        <li key={u.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-neutral-50 ${
                              marcado ? 'bg-attech/5' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternar(u.id)}
                              className={checkboxClass}
                            />
                            <span className="min-w-0 flex-1">
                              <span style={fs(13, 14)} className="block truncate font-medium text-neutral-900">
                                {u.nome}
                              </span>
                              {u.cargo && (
                                <span style={fs(11, 12)} className="block truncate text-neutral-400">
                                  {u.cargo}
                                </span>
                              )}
                            </span>
                            {falta.length > 0 && (
                              <span
                                style={fs(10, 11)}
                                title={`Falta no cadastro: ${falta.join(', ')}`}
                                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 font-medium text-red-700"
                              >
                                <WarningCircleIcon size={11} weight="fill" />
                                Falta {falta.join(', ')}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Field>

            {equipeIncompleta && <Alerta tipo="erro" texto={pendencia} />}
            <Alerta tipo="erro" texto={erro} />
            <Alerta tipo="sucesso" texto={sucesso} />
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setSucesso('');
                  setConfirmandoEnvio(true);
                }}
                disabled={!liberacao || enviando}
                style={fs(12, 13)}
                className={btnPrimario}
              >
                <PaperPlaneTiltIcon size={15} weight="bold" />
                Enviar e-mail
              </button>
              <button
                type="button"
                onClick={baixar}
                disabled={!liberacao || baixando}
                style={fs(12, 13)}
                className={btnSecundario}
              >
                {baixando ? <SpinnerIcon size={15} className="animate-spin" /> : <FilePdfIcon size={15} weight="bold" />}
                Baixar PDF
              </button>
            </div>
            {pendencia && !equipeIncompleta && (
              <p style={fs(11, 12)} className="-mt-2 text-center text-neutral-400">
                {pendencia}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <SectionHead
            icon={<UsersThreeIcon size={14} />}
            title="Destinatários"
            description={editando ? 'Editando destinatário' : `${destinatarios.length} cadastrados`}
          />
          <FormularioDestinatario key={chaveForm} editando={editando} onConcluir={() => trocarFormulario(null)} />
          {erroExcluir && (
            <div className="p-3 sm:px-5">
              <Alerta tipo="erro" texto={erroExcluir} />
            </div>
          )}
          {destinatarios.length === 0 ? (
            <p style={fs(12, 13)} className="px-5 py-8 text-center text-neutral-400">
              Nenhum destinatário cadastrado.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-100">
              {destinatarios.map((d) => (
                <li
                  key={d.id}
                  className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${editando?.id === d.id ? 'bg-attech/5' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span style={fs(13, 15)} className="block truncate font-medium text-neutral-900">
                      {d.nome}
                    </span>
                    <span style={fs(11, 12)} className="block truncate text-neutral-400">
                      {d.email}
                    </span>
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => trocarFormulario(d)}
                      aria-label="Editar"
                      title="Editar"
                      className={btnIcone}
                    >
                      <PencilSimpleIcon size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAExcluir(d)}
                      aria-label="Excluir"
                      title="Excluir"
                      className={btnIconePerigo}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] lg:block">
        <Previa liberacao={liberacao} />
      </aside>

      <ConfirmarEnvio
        liberacao={confirmandoEnvio ? liberacao : null}
        enviando={enviando}
        onFechar={() => setConfirmandoEnvio(false)}
        onConfirmar={enviar}
      />

      <ConfirmarExclusao
        aberto={!!aExcluir}
        titulo={`Excluir o destinatário "${aExcluir?.nome ?? ''}"?`}
        descricao="Os PDFs já gerados não mudam."
        excluindo={excluindo}
        onFechar={() => setAExcluir(null)}
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
