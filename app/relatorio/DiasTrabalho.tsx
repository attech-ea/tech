'use client';

import {
  ArrowCounterClockwiseIcon,
  CalendarBlankIcon,
  InfoIcon,
  PlusIcon,
  SunIcon,
  TrashIcon,
} from '@phosphor-icons/react/dist/ssr';
import { fs } from '@/lib/calc-clamp';
import { getFeriado, isFimDeSemana } from '../calculo/feriados';
import { dataSaidaAuto, diaSobreposto, hojeBR, somarDias, type DiaInput } from './calculo';
import { Alerta, btnIconePerigo, Card, checkboxClass, Field, inputClass, SectionHead } from './ui';

// Na tela a data de saída segue a de entrada (+1 dia quando o turno vira a
// noite) até ser editada à mão; `dataSaidaManual` guarda a edição.
export interface DiaForm {
  key: string;
  data: string;
  entrada: string;
  saida: string;
  dataSaidaManual: string | null;
  ignorarFeriado: boolean;
}

export function novaKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function dataSaidaDoDia(d: Pick<DiaForm, 'data' | 'entrada' | 'saida' | 'dataSaidaManual'>): string {
  return d.dataSaidaManual ?? dataSaidaAuto(d.data, d.entrada, d.saida);
}

export function paraDiaInput(d: DiaForm): DiaInput {
  return {
    data: d.data,
    dataSaida: dataSaidaDoDia(d),
    entrada: d.entrada,
    saida: d.saida,
    ignorarFeriado: d.ignorarFeriado,
  };
}

export function diaDoRelatorio(d: DiaInput): DiaForm {
  return {
    key: novaKey(),
    data: d.data,
    entrada: d.entrada,
    saida: d.saida,
    dataSaidaManual: d.dataSaida !== dataSaidaAuto(d.data, d.entrada, d.saida) ? d.dataSaida : null,
    ignorarFeriado: d.ignorarFeriado,
  };
}

// Novo dia: o dia seguinte ao último, com o mesmo horário.
export function diaNovo(ultimo?: DiaForm): DiaForm {
  return {
    key: novaKey(),
    data: ultimo?.data ? somarDias(ultimo.data, 1) : hojeBR(),
    entrada: ultimo?.entrada ?? '07:00',
    saida: ultimo?.saida ?? '17:00',
    dataSaidaManual: null,
    ignorarFeriado: false,
  };
}

function horarioInvalido(d: DiaForm): boolean {
  const dataSaida = dataSaidaDoDia(d);
  return !!(d.data && dataSaida && d.entrada && d.saida) && `${dataSaida}T${d.saida}` <= `${d.data}T${d.entrada}`;
}

interface DiaCardProps {
  dia: DiaForm;
  numero: number;
  removivel: boolean;
  onChange: (patch: Partial<DiaForm>) => void;
  onRemover: () => void;
}

function DiaCard({ dia, numero, removivel, onChange, onRemover }: DiaCardProps) {
  const dataSaida = dataSaidaDoDia(dia);
  const invalido = horarioInvalido(dia);
  const feriado = dia.data ? getFeriado(dia.data) : null;
  const fimDeSemana = dia.data ? isFimDeSemana(dia.data) : false;
  const id = (campo: string) => `${campo}-${dia.key}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span style={fs(12, 13)} className="font-semibold text-neutral-700">
          Dia {numero}
        </span>
        {removivel && (
          <button
            type="button"
            onClick={onRemover}
            aria-label={`Remover dia ${numero}`}
            title="Remover dia"
            className={btnIconePerigo}
          >
            <TrashIcon size={15} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
        <Field label="Data de entrada" htmlFor={id('data')}>
          <input
            id={id('data')}
            type="date"
            value={dia.data}
            onChange={(e) => onChange({ data: e.target.value, dataSaidaManual: null, ignorarFeriado: false })}
            className={`${inputClass} bg-white`}
          />
        </Field>
        <Field label="Entrada" htmlFor={id('entrada')}>
          <input
            id={id('entrada')}
            type="time"
            value={dia.entrada}
            onChange={(e) => onChange({ entrada: e.target.value })}
            className={`${inputClass} bg-white`}
          />
        </Field>
        <Field
          label="Data de saída"
          htmlFor={id('dataSaida')}
          labelAction={
            dia.dataSaidaManual && (
              <button
                type="button"
                onClick={() => onChange({ dataSaidaManual: null })}
                style={fs(11, 12)}
                className="inline-flex cursor-pointer items-center gap-1 font-medium text-attech hover:underline"
              >
                <ArrowCounterClockwiseIcon size={11} weight="bold" />
                Usar automático
              </button>
            )
          }
        >
          <input
            id={id('dataSaida')}
            type="date"
            value={dataSaida}
            min={dia.data}
            onChange={(e) => onChange({ dataSaidaManual: e.target.value })}
            className={`${inputClass} bg-white`}
          />
        </Field>
        <Field label="Saída" htmlFor={id('saida')}>
          <input
            id={id('saida')}
            type="time"
            value={dia.saida}
            onChange={(e) => onChange({ saida: e.target.value })}
            className={`${inputClass} bg-white ${invalido ? 'border-red-400 bg-red-50/50' : ''}`}
          />
        </Field>
      </div>

      {invalido && <Alerta tipo="erro" texto="A saída deve ser depois da entrada." />}

      {fimDeSemana && (
        <p
          style={fs(12, 13)}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-neutral-600"
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
            checked={dia.ignorarFeriado}
            onChange={(e) => onChange({ ignorarFeriado: e.target.checked })}
            className={`${checkboxClass} mt-0.5`}
          />
        </label>
      )}
    </div>
  );
}

interface Props {
  dias: DiaForm[];
  onChange: (dias: DiaForm[]) => void;
}

export default function DiasTrabalho({ dias, onChange }: Props) {
  const sobreposto = diaSobreposto(dias.map(paraDiaInput));

  return (
    <Card>
      <SectionHead
        icon={<CalendarBlankIcon size={14} />}
        title="Dias de trabalho"
        description="Data e horário de cada dia, iguais para toda a equipe"
      />
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {dias.map((dia, n) => (
          <DiaCard
            key={dia.key}
            dia={dia}
            numero={n + 1}
            removivel={dias.length > 1}
            onChange={(patch) => onChange(dias.map((d) => (d.key === dia.key ? { ...d, ...patch } : d)))}
            onRemover={() => onChange(dias.filter((d) => d.key !== dia.key))}
          />
        ))}

        {sobreposto >= 0 && (
          <Alerta tipo="erro" texto={`O dia ${sobreposto + 1} começa antes de outro dia terminar.`} />
        )}

        <button
          type="button"
          onClick={() => onChange([...dias, diaNovo(dias[dias.length - 1])])}
          style={fs(12, 13)}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-white px-3.5 py-2.5 font-medium text-neutral-600 transition-colors duration-150 hover:border-attech/40 hover:bg-attech/2 hover:text-attech focus-visible:ring-2 focus-visible:ring-attech/30 focus-visible:outline-none"
        >
          <PlusIcon size={14} weight="bold" />
          Adicionar dia
        </button>
      </div>
    </Card>
  );
}
