'use client';

import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react/dist/ssr';
import { useState, type FormEvent, type ReactNode } from 'react';
import { fs } from '@/lib/calc-clamp';
import { excluirColaborador, salvarUsuario } from '../relatorio/actions';
import { formatDataISO } from '../relatorio/calculo';
import { normalizar } from '../relatorio/SelectBusca';
import type { FuncaoDTO, UsuarioDTO } from '../relatorio/tipos';
import {
  Alerta,
  btnIcone,
  btnIconePerigo,
  btnPrimario,
  btnSecundario,
  Card,
  ConfirmarExclusao,
  Field,
  inputClass,
  SectionHead,
} from '../relatorio/ui';

interface FormState {
  nome: string;
  cargo: string;
  cargoDocumento: string;
  email: string;
  dataCadastro: string;
  dataNascimento: string;
  rg: string;
  cpf: string;
  treinamentos: string;
  funcaoIds: number[];
}

const FORM_VAZIO: FormState = {
  nome: '',
  cargo: '',
  cargoDocumento: '',
  email: '',
  dataCadastro: '',
  dataNascimento: '',
  rg: '',
  cpf: '',
  treinamentos: '',
  funcaoIds: [],
};

function daForm(u: UsuarioDTO): FormState {
  return {
    nome: u.nome,
    cargo: u.cargo,
    cargoDocumento: u.cargoDocumento,
    email: u.email,
    dataCadastro: u.dataCadastro,
    dataNascimento: u.dataNascimento,
    rg: u.rg,
    cpf: u.cpf,
    treinamentos: u.treinamentos.join(', '),
    funcaoIds: u.funcoes.map((f) => f.id),
  };
}

function Dado({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt style={fs(10, 11)} className="font-semibold tracking-wider text-neutral-400 uppercase">
        {rotulo}
      </dt>
      <dd style={fs(12, 14)} className="truncate text-neutral-800">
        {valor || <span className="text-neutral-300">—</span>}
      </dd>
    </div>
  );
}

function Chip({ children, destaque = false }: { children: ReactNode; destaque?: boolean }) {
  return (
    <span
      style={fs(10, 11)}
      className={`shrink-0 rounded-full border px-2 py-0.5 leading-none font-medium ${
        destaque
          ? 'border-primary/40 bg-primary/15 text-attech'
          : 'border-neutral-200 bg-neutral-50 text-neutral-600'
      }`}
    >
      {children}
    </span>
  );
}

function Formulario({
  funcoes,
  editando,
  onConcluir,
}: {
  funcoes: FuncaoDTO[];
  editando: UsuarioDTO | null;
  onConcluir: () => void;
}) {
  const [form, setForm] = useState<FormState>(editando ? daForm(editando) : FORM_VAZIO);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const campo = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function toggleFuncao(id: number) {
    campo('funcaoIds', form.funcaoIds.includes(id) ? form.funcaoIds.filter((x) => x !== id) : [...form.funcaoIds, id]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const res = await salvarUsuario({
      id: editando?.id ?? null,
      ...form,
      treinamentos: form.treinamentos.split(','),
    });
    setSalvando(false);
    if (res.ok) onConcluir();
    else setErro(res.error);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4 sm:p-5">
      <Field label="Nome" htmlFor="u-nome">
        <input id="u-nome" value={form.nome} onChange={(e) => campo('nome', e.target.value)} className={inputClass} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cargo" htmlFor="u-cargo">
          <input
            id="u-cargo"
            value={form.cargo}
            onChange={(e) => campo('cargo', e.target.value)}
            placeholder="Ex.: Soldador Irata N1"
            className={inputClass}
          />
        </Field>
        <Field label="Cargo no documento" htmlFor="u-cargo-doc">
          <input
            id="u-cargo-doc"
            value={form.cargoDocumento}
            onChange={(e) => campo('cargoDocumento', e.target.value)}
            placeholder="Ex.: CEO"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="E-mail" htmlFor="u-email">
        <input
          id="u-email"
          type="email"
          value={form.email}
          onChange={(e) => campo('email', e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Data de cadastro" htmlFor="u-cadastro">
          <input
            id="u-cadastro"
            type="date"
            value={form.dataCadastro}
            onChange={(e) => campo('dataCadastro', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Data de nascimento" htmlFor="u-nasc">
          <input
            id="u-nasc"
            type="date"
            value={form.dataNascimento}
            onChange={(e) => campo('dataNascimento', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="RG" htmlFor="u-rg">
          <input id="u-rg" value={form.rg} onChange={(e) => campo('rg', e.target.value)} className={inputClass} />
        </Field>
        <Field label="CPF" htmlFor="u-cpf">
          <input id="u-cpf" value={form.cpf} onChange={(e) => campo('cpf', e.target.value)} className={inputClass} />
        </Field>
      </div>

      <Field label="Treinamentos" htmlFor="u-trein" hint="Separe por vírgula.">
        <input
          id="u-trein"
          value={form.treinamentos}
          onChange={(e) => campo('treinamentos', e.target.value)}
          placeholder="Trabalho em Altura, IRATA N1, Solda"
          className={inputClass}
        />
      </Field>

      <Field label="Funções PRIO">
        {funcoes.length === 0 ? (
          <p style={fs(12, 13)} className="text-neutral-400">
            Nenhuma função cadastrada.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {funcoes.map((f) => {
              const marcada = form.funcaoIds.includes(f.id);
              return (
                <label
                  key={f.id}
                  style={fs(12, 13)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-attech/30 ${
                    marcada
                      ? 'border-attech bg-attech text-white'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <input type="checkbox" checked={marcada} onChange={() => toggleFuncao(f.id)} className="sr-only" />
                  {marcada && <CheckIcon size={12} weight="bold" />}
                  {f.nome}
                </label>
              );
            })}
          </div>
        )}
      </Field>

      <div className="flex gap-2">
        <button type="submit" disabled={salvando} style={fs(12, 13)} className={btnPrimario}>
          {editando ? <CheckIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
          {editando ? 'Salvar alterações' : 'Adicionar usuário'}
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

function LinhaUsuario({
  usuario,
  aberto,
  editando,
  onAlternar,
  onEditar,
  onExcluir,
}: {
  usuario: UsuarioDTO;
  aberto: boolean;
  editando: boolean;
  onAlternar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <li className={editando ? 'bg-attech/5' : undefined}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberto}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:outline-none"
        >
          <CaretDownIcon
            size={13}
            className={`shrink-0 text-neutral-400 transition-transform duration-150 ${aberto ? 'rotate-180' : ''}`}
          />
          <span className="min-w-0">
            <span style={fs(13, 15)} className="block truncate font-medium text-neutral-900">
              {usuario.nome}
            </span>
            <span style={fs(11, 12)} className="block truncate text-neutral-400">
              {usuario.cargo || 'Sem cargo'}
            </span>
          </span>
        </button>
        <div className="hidden shrink-0 flex-wrap justify-end gap-1 sm:flex">
          {usuario.funcoes.map((f) => (
            <Chip key={f.id} destaque={f.irata}>
              {f.nome}
            </Chip>
          ))}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" onClick={onEditar} aria-label="Editar" title="Editar" className={btnIcone}>
            <PencilSimpleIcon size={15} />
          </button>
          <button type="button" onClick={onExcluir} aria-label="Excluir" title="Excluir" className={btnIconePerigo}>
            <TrashIcon size={15} />
          </button>
        </div>
      </div>

      {aberto && (
        <div className="flex flex-col gap-4 border-t border-neutral-100 bg-neutral-50/60 px-4 py-4 sm:px-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-3">
            <Dado rotulo="CPF" valor={usuario.cpf} />
            <Dado rotulo="RG" valor={usuario.rg} />
            <Dado rotulo="Nascimento" valor={usuario.dataNascimento && formatDataISO(usuario.dataNascimento)} />
            <Dado rotulo="Cadastro" valor={usuario.dataCadastro && formatDataISO(usuario.dataCadastro)} />
            <Dado rotulo="Cargo no documento" valor={usuario.cargoDocumento} />
            <Dado rotulo="E-mail" valor={usuario.email} />
          </dl>
          <div className="flex flex-col gap-1.5">
            <p style={fs(10, 11)} className="font-semibold tracking-wider text-neutral-400 uppercase">
              Funções PRIO
            </p>
            <div className="flex flex-wrap gap-1">
              {usuario.funcoes.length ? (
                usuario.funcoes.map((f) => (
                  <Chip key={f.id} destaque={f.irata}>
                    {f.nome}
                  </Chip>
                ))
              ) : (
                <span style={fs(12, 13)} className="text-neutral-300">
                  Sem função
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p style={fs(10, 11)} className="font-semibold tracking-wider text-neutral-400 uppercase">
              Treinamentos
            </p>
            <div className="flex flex-wrap gap-1">
              {usuario.treinamentos.length ? (
                usuario.treinamentos.map((t) => <Chip key={t}>{t}</Chip>)
              ) : (
                <span style={fs(12, 13)} className="text-neutral-300">
                  Nenhum
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export default function Usuarios({ funcoes, usuarios }: { funcoes: FuncaoDTO[]; usuarios: UsuarioDTO[] }) {
  // `editando`: usuário em edição; `null` = formulário de cadastro novo.
  const [editando, setEditando] = useState<UsuarioDTO | null>(null);
  // Muda a cada troca de usuário para remontar o formulário com os dados novos.
  const [chaveForm, setChaveForm] = useState(0);
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [aExcluir, setAExcluir] = useState<UsuarioDTO | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState('');

  const termo = normalizar(busca.trim());
  const filtrados = termo
    ? usuarios.filter((u) =>
        normalizar(
          [u.nome, u.cargo, u.cpf, u.rg, u.email, ...u.treinamentos, ...u.funcoes.map((f) => f.nome)].join(' '),
        ).includes(termo),
      )
    : usuarios;

  function trocarFormulario(u: UsuarioDTO | null) {
    setEditando(u);
    setChaveForm((k) => k + 1);
  }

  async function confirmarExclusao() {
    if (!aExcluir) return;
    setExcluindo(true);
    const res = await excluirColaborador(aExcluir.id);
    setExcluindo(false);
    if (!res.ok) setErro(res.error);
    else if (editando?.id === aExcluir.id) trocarFormulario(null);
    setAExcluir(null);
  }

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <Card>
        <SectionHead
          icon={<UserPlusIcon size={14} />}
          title={editando ? 'Editar usuário' : 'Novo usuário'}
          description="Dados cadastrais, treinamentos e funções"
        />
        <Formulario key={chaveForm} funcoes={funcoes} editando={editando} onConcluir={() => trocarFormulario(null)} />
      </Card>

      <Card>
        <SectionHead
          icon={<UsersThreeIcon size={14} />}
          title="Usuários"
          description={`${usuarios.length} cadastrados`}
        />
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
              placeholder="Buscar por nome, cargo, CPF, função ou treinamento…"
              aria-label="Buscar usuários"
              className={`${inputClass} pl-8`}
            />
          </div>
        </div>
        {erro && (
          <div className="p-3 sm:px-5">
            <Alerta tipo="erro" texto={erro} />
          </div>
        )}
        {filtrados.length === 0 ? (
          <p style={fs(12, 13)} className="px-5 py-10 text-center text-neutral-400">
            {usuarios.length === 0 ? 'Nenhum usuário cadastrado.' : `Nada encontrado para “${busca.trim()}”.`}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {filtrados.map((u) => (
              <LinhaUsuario
                key={u.id}
                usuario={u}
                aberto={abertoId === u.id}
                editando={editando?.id === u.id}
                onAlternar={() => setAbertoId(abertoId === u.id ? null : u.id)}
                onEditar={() => trocarFormulario(u)}
                onExcluir={() => setAExcluir(u)}
              />
            ))}
          </ul>
        )}
      </Card>

      <ConfirmarExclusao
        aberto={!!aExcluir}
        titulo={`Excluir o usuário "${aExcluir?.nome ?? ''}"?`}
        descricao="Relatórios já salvos não mudam."
        excluindo={excluindo}
        onFechar={() => setAExcluir(null)}
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
