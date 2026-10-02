'use client';

import {
  ArrowCounterClockwiseIcon,
  CarIcon,
  InfoIcon,
  PlusIcon,
  SunIcon,
  TrashIcon,
} from '@phosphor-icons/react/dist/ssr';
import type { ReactNode } from 'react';
import { fs } from '@/lib/calc-clamp';
import { getFeriado, isFimDeSemana } from '../calculo/feriados';
import { hmHoras } from '../calculo/horas';
import {
  dataSaidaAuto,
  DESLOCAMENTO_ENTRADA_PADRAO,
  DESLOCAMENTO_SAIDA_PADRAO,
  horasDeslocamento,
  ROTULO_IDA,
  ROTULO_VOLTA,
  somarDias,
  type DeslocamentoInput,
  type DiaInput,
} from './calculo';
import { novaKey } from './DiasTrabalho';
import { Alerta, btnIconePerigo, Card, checkboxClass, Field, inputClass, SectionHead } from './ui';

// Um trecho (ida ou volta) com data e hora de saída e de chegada. No primeiro
// deslocamento a saída da ida acompanha os dias de trabalho (dia anterior ao
// primeiro) e a da volta também (dia posterior ao último), até a data ser editada à
// mão; `dataPartidaManual` guarda a edição. Nos demais (`auto: null`) a data é
// sempre própria. A data de chegada segue a de saída (+1 dia quando a hora de
// chegada é antes da de saída) até ser editada.
export interface TrechoForm {
  auto: 'ida' | 'volta' | null;
  dataPartidaManual: string | null;
  horaPartida: string;
  dataChegadaManual: string | null;
  horaChegada: string;
  ignorarFeriado: boolean;
}

// Um deslocamento da equipe: a ida e a volta. Só o primeiro vem por padrão; os
// outros são para quando a equipe viaja várias vezes no mesmo serviço.
export interface DeslocForm {
  key: string;
  ida: TrechoForm;
  volta: TrechoForm;
}

export interface Viagem {
  ida: DeslocamentoInput;
  volta: DeslocamentoInput;
}

function dataAutoDaPartida(auto: 'ida' | 'volta', dias: DiaInput[]): string {
  const validos = dias.filter((d) => d.data && d.dataSaida);
  if (validos.length === 0) return '';
  if (auto === 'ida') return somarDias(validos.map((d) => d.data).sort()[0], -1);
  return somarDias(validos.map((d) => d.dataSaida).sort().at(-1)!, 1);
}

function trechoParaInput(t: TrechoForm, rotulo: string, dias: DiaInput[]): DeslocamentoInput {
  const data = t.dataPartidaManual ?? (t.auto ? dataAutoDaPartida(t.auto, dias) : '');
  return {
    rotulo,
    data,
    entrada: t.horaPartida,
    dataSaida: t.dataChegadaManual ?? dataSaidaAuto(data, t.horaPartida, t.horaChegada),
    saida: t.horaChegada,
    ignorarFeriado: t.ignorarFeriado,
  };
}

// Só o primeiro deslocamento se chama "Ida"/"Volta"; os outros levam o número.
function rotulos(posicao: number): { ida: string; volta: string } {
  const n = posicao === 0 ? '' : ` ${posicao + 1}`;
  return { ida: `${ROTULO_IDA}${n}`, volta: `${ROTULO_VOLTA}${n}` };
}

export function viagemDoDeslocamento(d: DeslocForm, posicao: number, dias: DiaInput[]): Viagem {
  const r = rotulos(posicao);
  return { ida: trechoParaInput(d.ida, r.ida, dias), volta: trechoParaInput(d.volta, r.volta, dias) };
}

function trechoNovo(auto: 'ida' | 'volta' | null, data: string | null): TrechoForm {
  return {
    auto,
    dataPartidaManual: data,
    horaPartida: DESLOCAMENTO_ENTRADA_PADRAO,
    dataChegadaManual: null,
    horaChegada: DESLOCAMENTO_SAIDA_PADRAO,
    ignorarFeriado: false,
  };
}

export function deslocamentosPadrao(): DeslocForm[] {
  return [{ key: novaKey(), ida: trechoNovo('ida', null), volta: trechoNovo('volta', null) }];
}

// Deslocamento adicional: começa na data do último trecho (a editar).
function deslocamentoNovo(ultimaData: string): DeslocForm {
  return { key: novaKey(), ida: trechoNovo(null, ultimaData), volta: trechoNovo(null, ultimaData) };
}

// Trechos salvos, em ordem cronológica, voltam a pares (ida, volta). O primeiro par
// continua acompanhando os dias de trabalho se as datas ainda são as automáticas.
export function deslocamentosDoRelatorio(trechos: DeslocamentoInput[], dias: DiaInput[]): DeslocForm[] {
  const doTrecho = (t: DeslocamentoInput, auto: 'ida' | 'volta' | null): TrechoForm => {
    const acompanha = auto !== null && t.data === dataAutoDaPartida(auto, dias);
    return {
      auto: acompanha ? auto : null,
      dataPartidaManual: acompanha ? null : t.data,
      horaPartida: t.entrada,
      dataChegadaManual: t.dataSaida !== dataSaidaAuto(t.data, t.entrada, t.saida) ? t.dataSaida : null,
      horaChegada: t.saida,
      ignorarFeriado: t.ignorarFeriado,
    };
  };
  const grupos: DeslocForm[] = [];
  for (let i = 0; i < trechos.length; i += 2) {
    const ida = trechos[i];
    const volta = trechos[i + 1];
    const primeiro = i === 0;
    grupos.push({
      key: novaKey(),
      ida: doTrecho(ida, primeiro ? 'ida' : null),
      volta: volta ? doTrecho(volta, primeiro ? 'volta' : null) : trechoNovo(null, ida.dataSaida),
    });
  }
  return grupos;
}

// Rascunho guardado antes deste formato (um trecho por item) não serve mais.
export function deslocamentosValidos(v: unknown): v is DeslocForm[] {
  return (
    Array.isArray(v) &&
    v.every((d) => typeof d?.key === 'string' && typeof d.ida?.horaPartida === 'string' && typeof d.volta?.horaPartida === 'string')
  );
}

function horarioInvalido(v: DeslocamentoInput): boolean {
  return !!(v.data && v.dataSaida && v.entrada && v.saida) && `${v.dataSaida}T${v.saida}` <= `${v.data}T${v.entrada}`;
}

interface TrechoProps {
  idBase: string;
  titulo: string;
  form: TrechoForm;
  viagem: DeslocamentoInput;
  onChange: (patch: Partial<TrechoForm>) => void;
}

function Trecho({ idBase, titulo, form, viagem, onChange }: TrechoProps) {
  const invalido = horarioInvalido(viagem);
  const feriado = viagem.data ? getFeriado(viagem.data) : null;
  const fimDeSemana = viagem.data ? isFimDeSemana(viagem.data) : false;
  const id = (campo: string) => `${campo}-${idBase}`;
  const horas =
    viagem.data && viagem.dataSaida && viagem.entrada && viagem.saida && !invalido ? horasDeslocamento(viagem) : null;
  const botaoAutomatico = (aoClicar: () => void) => (
    <button
      type="button"
      onClick={aoClicar}
      style={fs(11, 12)}
      className="inline-flex cursor-pointer items-center gap-1 font-medium text-attech hover:underline"
    >
      <ArrowCounterClockwiseIcon size={11} weight="bold" />
      Usar automático
    </button>
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span style={fs(12, 13)} className="font-semibold text-neutral-700">
          {titulo}
        </span>
        {horas && (
          <div style={fs(12, 13)} className="flex gap-3 text-neutral-500">
            <span>
              Normal <strong className="font-semibold text-neutral-800 tabular-nums">{hmHoras(horas.normalMin)}</strong>
            </span>
            <span>
              100% <strong className="font-semibold text-neutral-800 tabular-nums">{hmHoras(horas.cemMin)}</strong>
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
        <Field
          label="Data de saída"
          htmlFor={id('partida')}
          labelAction={
            form.auto &&
            form.dataPartidaManual !== null &&
            botaoAutomatico(() => onChange({ dataPartidaManual: null, dataChegadaManual: null }))
          }
        >
          <input
            id={id('partida')}
            type="date"
            value={viagem.data}
            onChange={(e) => onChange({ dataPartidaManual: e.target.value, dataChegadaManual: null, ignorarFeriado: false })}
            className={`${inputClass} bg-neutral-50`}
          />
        </Field>
        <Field label="Hora de saída" htmlFor={id('horaPartida')}>
          <input
            id={id('horaPartida')}
            type="time"
            value={form.horaPartida}
            onChange={(e) => onChange({ horaPartida: e.target.value })}
            className={`${inputClass} bg-neutral-50`}
          />
        </Field>
        <Field
          label="Data de chegada"
          htmlFor={id('chegada')}
          labelAction={form.dataChegadaManual && botaoAutomatico(() => onChange({ dataChegadaManual: null }))}
        >
          <input
            id={id('chegada')}
            type="date"
            value={viagem.dataSaida}
            min={viagem.data}
            onChange={(e) => onChange({ dataChegadaManual: e.target.value })}
            className={`${inputClass} bg-neutral-50`}
          />
        </Field>
        <Field label="Hora de chegada" htmlFor={id('horaChegada')}>
          <input
            id={id('horaChegada')}
            type="time"
            value={form.horaChegada}
            onChange={(e) => onChange({ horaChegada: e.target.value })}
            className={`${inputClass} bg-neutral-50 ${invalido ? 'border-red-400 bg-red-50/50' : ''}`}
          />
        </Field>
      </div>

      {invalido && <Alerta tipo="erro" texto="A chegada deve ser depois da saída." />}

      {fimDeSemana && (
        <p
          style={fs(12, 13)}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-600"
        >
          <InfoIcon size={14} className="shrink-0 text-neutral-400" />
          Fim de semana: todas as horas contam como 100%.
        </p>
      )}

      {feriado && (
        <label
          style={fs(12, 13)}
          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-neutral-700"
        >
          <SunIcon size={16} weight="fill" className="mt-px shrink-0 text-primary" />
          <span className="flex-1">
            <span className="font-semibold text-neutral-900">Feriado: {feriado.nome}.</span> As horas contam como 100%.
            Marque para calcular como dia normal.
          </span>
          <input
            type="checkbox"
            checked={form.ignorarFeriado}
            onChange={(e) => onChange({ ignorarFeriado: e.target.checked })}
            className={`${checkboxClass} mt-0.5`}
          />
        </label>
      )}
    </div>
  );
}

interface Props {
  deslocs: DeslocForm[];
  // Acompanha `deslocs` (mesma ordem), já com as datas resolvidas.
  viagens: Viagem[];
  onChange: (deslocs: DeslocForm[]) => void;
  // Quilometragem e preços: ficam na mesma seção, abaixo dos deslocamentos.
  children?: ReactNode;
}

export default function Deslocamentos({ deslocs, viagens, onChange, children }: Props) {
  function alterarTrecho(key: string, trecho: 'ida' | 'volta', patch: Partial<TrechoForm>) {
    onChange(deslocs.map((d) => (d.key === key ? { ...d, [trecho]: { ...d[trecho], ...patch } } : d)));
  }

  return (
    <Card>
      <SectionHead
        icon={<CarIcon size={14} />}
        title="Deslocamento"
        description="Ida e volta da equipe, quilometragem e preços. Normal em dia útil das 07:00 às 17:00; fora disso, 100%"
      />
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {deslocs.length === 0 && (
          <p style={fs(12, 14)} className="py-2 text-center text-neutral-400">
            Nenhum deslocamento neste relatório.
          </p>
        )}

        {deslocs.map((d, n) => {
          const r = rotulos(n);
          return (
            <div key={d.key} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span style={fs(12, 13)} className="font-semibold text-neutral-700">
                  {n === 0 ? 'Deslocamento' : `Deslocamento ${n + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(deslocs.filter((x) => x.key !== d.key))}
                  aria-label={`Remover deslocamento ${n + 1}`}
                  title="Remover deslocamento"
                  className={btnIconePerigo}
                >
                  <TrashIcon size={15} />
                </button>
              </div>
              <Trecho
                idBase={`${d.key}-ida`}
                titulo={r.ida}
                form={d.ida}
                viagem={viagens[n].ida}
                onChange={(patch) => alterarTrecho(d.key, 'ida', patch)}
              />
              <Trecho
                idBase={`${d.key}-volta`}
                titulo={r.volta}
                form={d.volta}
                viagem={viagens[n].volta}
                onChange={(patch) => alterarTrecho(d.key, 'volta', patch)}
              />
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            const ultima = viagens.at(-1)?.volta.dataSaida ?? '';
            onChange([...deslocs, deslocamentoNovo(ultima)]);
          }}
          style={fs(12, 13)}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-white px-3.5 py-2.5 font-medium text-neutral-600 transition-colors duration-150 hover:border-attech/40 hover:bg-attech/2 hover:text-attech focus-visible:ring-2 focus-visible:ring-attech/30 focus-visible:outline-none"
        >
          <PlusIcon size={14} weight="bold" />
          {deslocs.length === 0 ? 'Adicionar deslocamento' : 'Adicionar outro deslocamento (nova viagem da equipe)'}
        </button>
      </div>
      {children && <div className="border-t border-neutral-100 p-4 sm:p-5">{children}</div>}
    </Card>
  );
}
