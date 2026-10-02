'use client';

import type { Icon } from '@phosphor-icons/react';
import {
	CalculatorIcon,
	CalendarBlankIcon,
	CalendarStarIcon,
	ClockIcon,
	ForkKnifeIcon,
	InfoIcon,
	ListBulletsIcon,
	MoonIcon,
	PlusIcon,
	ProhibitIcon,
	TrashIcon,
} from '@phosphor-icons/react/dist/ssr';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fs } from '@/lib/calc-clamp';
import {
	Alerta,
	btnIconePerigo,
	btnPrimario,
	btnSecundario,
	Card,
	ConfirmarExclusao,
	Field,
	inputClass,
	SectionHead,
} from '../relatorio/ui';
import { calcularHoras, decHoras, hmHoras, jantaAutomatica, type ResultadoHoras, type TipoTrabalho } from './horas';
import { getFeriado, isFimDeSemana } from './feriados';

const STORAGE_KEY = 'ch_entries';

interface Entry {
	id: string;
	nome: string;
	tipo: TipoTrabalho;
	data: string;
	dataSaida: string;
	entrada: string;
	saida: string;
	result: ResultadoHoras;
}

type Totais = Pick<ResultadoHoras, 'brutoMin' | 'descontoMin' | 'normalMin' | 'cinquentaMin' | 'cemMin' | 'totalPagoMin'>;

function todayStr(): string {
	const d = new Date();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatDataBR(iso: string): string {
	if (!iso) return '';
	const [y, m, d] = iso.split('-');
	return `${d}/${m}/${y}`;
}

function formatDataRangeBR(dataIni: string, dataFim: string): string {
	if (!dataFim || dataFim === dataIni) return formatDataBR(dataIni);
	return `${formatDataBR(dataIni)} → ${formatDataBR(dataFim)}`;
}

function addDaysStr(iso: string, dias: number): string {
	const [y, m, d] = iso.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	dt.setUTCDate(dt.getUTCDate() + dias);
	const yy = dt.getUTCFullYear();
	const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(dt.getUTCDate()).padStart(2, '0');
	return `${yy}-${mm}-${dd}`;
}

function minutosDe(hhmm: string): number {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
}

function emptyTotals(): Totais {
	return { brutoMin: 0, descontoMin: 0, normalMin: 0, cinquentaMin: 0, cemMin: 0, totalPagoMin: 0 };
}

export default function CalculoHorasApp() {
	const [tipo, setTipo] = useState<TipoTrabalho>('normal');
	const [data, setData] = useState('');
	const [dataSaida, setDataSaida] = useState('');
	const [dataSaidaTouched, setDataSaidaTouched] = useState(false);
	const [entrada, setEntrada] = useState('07:00');
	const [saida, setSaida] = useState('17:00');
	const [nome, setNome] = useState('');
	const [ignorarFeriado, setIgnorarFeriado] = useState(false);
	const [descontarAlmoco, setDescontarAlmoco] = useState(true);
	// null = automático (marca sozinha quando a saída passa das 22:00).
	const [jantaManual, setJantaManual] = useState<boolean | null>(null);
	const [entries, setEntries] = useState<Entry[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);

	const feriadoInfo = useMemo(() => getFeriado(data), [data]);
	const fimDeSemanaAtivo = useMemo(() => isFimDeSemana(data), [data]);

	useEffect(() => {
		setIgnorarFeriado(false);
		setDataSaidaTouched(false);
		setJantaManual(null);
	}, [data]);

	// Enquanto o usuário não editar a data de saída manualmente, ela segue a
	// data de entrada — avançando um dia sozinha quando a saída for antes ou
	// igual à entrada (turno vira a noite).
	useEffect(() => {
		if (dataSaidaTouched || !data) return;
		const cruza = !!entrada && !!saida && minutosDe(saida) <= minutosDe(entrada);
		setDataSaida(addDaysStr(data, cruza ? 1 : 0));
	}, [data, entrada, saida, dataSaidaTouched]);

	function handleDataSaidaChange(value: string) {
		setDataSaida(value);
		setDataSaidaTouched(true);
	}

	function resetDataSaidaAuto() {
		setDataSaidaTouched(false);
	}

	useEffect(() => {
		setData((prev) => prev || todayStr());
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (raw) setEntries(JSON.parse(raw));
		} catch {
			// ignora localStorage indisponível
		}
		setLoaded(true);
	}, []);

	useEffect(() => {
		if (!loaded) return;
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
		} catch {
			// ignora localStorage indisponível
		}
	}, [entries, loaded]);

	const jantaAuto = useMemo(
		() => !!(entrada && saida && data && dataSaida) && jantaAutomatica({ entrada, saida, data, dataSaida }),
		[entrada, saida, data, dataSaida],
	);
	const descontarJanta = jantaManual ?? jantaAuto;

	const resultado = useMemo<ResultadoHoras | null>(() => {
		if (!entrada || !saida || !data || !dataSaida) return null;
		try {
			return calcularHoras({
				tipo,
				entrada,
				saida,
				data,
				dataSaida,
				ignorarFeriado,
				descontarAlmoco,
				descontarJanta,
				jantaManual: jantaManual !== null,
			});
		} catch {
			return null;
		}
	}, [tipo, entrada, saida, data, dataSaida, ignorarFeriado, descontarAlmoco, descontarJanta, jantaManual]);

	const rangeInvalido = !!(entrada && saida && data && dataSaida) && !resultado;

	const totais = useMemo(() => {
		return entries.reduce<Totais>((acc, e) => {
			acc.brutoMin += e.result.brutoMin;
			acc.descontoMin += e.result.descontoMin;
			acc.normalMin += e.result.normalMin;
			acc.cinquentaMin += e.result.cinquentaMin;
			acc.cemMin += e.result.cemMin;
			acc.totalPagoMin += e.result.totalPagoMin;
			return acc;
		}, emptyTotals());
	}, [entries]);

	function adicionar() {
		if (!resultado) return;
		const entry: Entry = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			nome: nome.trim(),
			tipo,
			data,
			dataSaida,
			entrada,
			saida,
			result: resultado,
		};
		setEntries((prev) => [...prev, entry]);
	}

	function remover(id: string) {
		setEntries((prev) => prev.filter((e) => e.id !== id));
	}

	function limparTudo() {
		setEntries([]);
		setConfirmandoLimpar(false);
	}

	const th = 'px-3 py-2.5 text-left font-medium whitespace-nowrap';
	const td = 'px-3 py-2.5 whitespace-nowrap';

	return (
		<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
			<Card>
				<SectionHead icon={<ClockIcon size={14} />} title="Lançamento" description="Tipo de trabalho, datas e horários do turno" />
				<div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
					<Field label="Tipo de trabalho">
						<div
							role="radiogroup"
							aria-label="Tipo de trabalho"
							className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1"
						>
							{(['normal', 'irata'] as const).map((t) => (
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
									{t === 'irata' ? 'Irata' : 'Normal'}
								</button>
							))}
						</div>
					</Field>

					<Field label="Funcionário (opcional)" htmlFor="nome">
						<input
							id="nome"
							type="text"
							value={nome}
							onChange={(e) => setNome(e.target.value)}
							placeholder="Nome"
							className={inputClass}
						/>
					</Field>

					<div className="flex flex-col gap-2">
						<div className="grid grid-cols-2 gap-3">
							<Field label="Data de entrada" htmlFor="data">
								<input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputClass} />
							</Field>
							<Field
								label="Data de saída"
								htmlFor="dataSaida"
								labelAction={
									dataSaidaTouched && (
										<button
											type="button"
											onClick={resetDataSaidaAuto}
											title="Voltar a calcular a data de saída pelo horário"
											style={fs(11, 12)}
											className="cursor-pointer font-medium text-attech hover:underline"
										>
											Automático
										</button>
									)
								}
							>
								<input
									id="dataSaida"
									type="date"
									value={dataSaida}
									onChange={(e) => handleDataSaidaChange(e.target.value)}
									className={inputClass}
								/>
							</Field>
						</div>

						{(fimDeSemanaAtivo || feriadoInfo) && (
							<div className="flex flex-wrap items-center gap-1.5">
								{fimDeSemanaAtivo && (
									<span
										style={fs(11, 12)}
										className="inline-flex items-center gap-1 rounded-full border border-attech/20 bg-attech/5 px-2.5 py-0.5 font-medium text-attech"
									>
										<CalendarBlankIcon size={12} weight="fill" />
										Final de semana
									</span>
								)}
								{feriadoInfo && (
									<span
										style={fs(11, 12)}
										className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${
											ignorarFeriado
												? 'border-neutral-200 bg-neutral-100 text-neutral-400 line-through'
												: 'border-primary/40 bg-primary/10 text-amber-800'
										}`}
									>
										<CalendarStarIcon size={12} weight="fill" />
										Feriado: {feriadoInfo.nome}
									</span>
								)}
								{feriadoInfo && (
									<Chip marcado={ignorarFeriado} onChange={setIgnorarFeriado} icone={ProhibitIcon}>
										Desconsiderar feriado
									</Chip>
								)}
							</div>
						)}
					</div>

					<div className="grid grid-cols-2 gap-3">
						<Field label="Entrada" htmlFor="entrada">
							<input
								id="entrada"
								type="time"
								value={entrada}
								onChange={(e) => setEntrada(e.target.value)}
								className={`${inputClass} tabular-nums`}
							/>
						</Field>
						<Field label="Saída" htmlFor="saida">
							<input
								id="saida"
								type="time"
								value={saida}
								onChange={(e) => setSaida(e.target.value)}
								className={`${inputClass} tabular-nums`}
							/>
						</Field>
					</div>

					<Field
						label="Refeições realizadas"
						hint="Só desconta se o horário cair dentro do turno. A janta marca sozinha com saída depois das 22:00; marque à mão para descontar num turno que termina antes."
						labelAction={
							jantaManual !== null && (
								<button
									type="button"
									onClick={() => setJantaManual(null)}
									title="Voltar a marcar a janta pela saída depois das 22:00"
									style={fs(11, 12)}
									className="cursor-pointer font-medium text-attech hover:underline"
								>
									Janta automática
								</button>
							)
						}
					>
						<div className="flex flex-wrap gap-2">
							<Chip marcado={descontarAlmoco} onChange={setDescontarAlmoco} icone={ForkKnifeIcon}>
								Almoço (11:30)
							</Chip>
							<Chip marcado={descontarJanta} onChange={setJantaManual} icone={ForkKnifeIcon}>
								Janta (20:30)
							</Chip>
						</div>
					</Field>

					{resultado?.cruzaMeiaNoite && (
						<p style={fs(12, 13)} className="flex items-center gap-2 text-neutral-500">
							<MoonIcon size={14} className="shrink-0 text-attech" />
							Turno atravessa a meia-noite (saída em {formatDataBR(dataSaida)}).
						</p>
					)}
					<Alerta tipo="erro" texto={rangeInvalido ? 'A saída deve ser depois da entrada — confira as datas e horários.' : ''} />

					<button type="button" style={fs(13, 14)} className={btnPrimario} onClick={adicionar} disabled={!resultado}>
						<PlusIcon size={15} weight="bold" />
						Adicionar à lista
					</button>

					<p style={fs(11, 12)} className="flex gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-neutral-400">
						<InfoIcon size={14} className="mt-px shrink-0" />
						Final de semana ou feriado: o turno inteiro vira 100%, tanto para Normal quanto para Irata (que deixa de lado a lógica das
						12h fixas nesse dia).
					</p>
				</div>
			</Card>

			<Card className="min-w-0">
				<SectionHead icon={<CalculatorIcon size={14} />} title="Resultado" description="Cálculo do turno informado" />
				{resultado ? (
					<div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
						{resultado.diaEspecial && (
							<p
								style={fs(12, 13)}
								className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 font-medium text-amber-800"
							>
								<CalendarStarIcon size={14} weight="fill" className="shrink-0" />
								{resultado.fimDeSemana ? 'Final de semana' : `Feriado: ${resultado.feriado?.nome}`} — turno integral calculado em
								100%.
							</p>
						)}
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<Stat rotulo="Normal" minutos={resultado.normalMin} />
							<Stat rotulo="50%" minutos={resultado.cinquentaMin} />
							<Stat rotulo="100%" minutos={resultado.cemMin} />
							<div className="flex flex-col gap-0.5 rounded-xl bg-attech p-3.5 text-white">
								<span style={fs(11, 12)} className="text-white/60">
									Total pago
								</span>
								<span style={fs(20, 26)} className="leading-tight font-semibold tracking-tight text-primary tabular-nums">
									{decHoras(resultado.totalPagoMin)}h
								</span>
								<span style={fs(11, 12)} className="text-white/60 tabular-nums">
									{hmHoras(resultado.totalPagoMin)}
								</span>
							</div>
						</div>
						<dl style={fs(12, 13)} className="flex flex-wrap gap-x-6 gap-y-1 border-t border-neutral-100 pt-3 text-neutral-500">
							<div className="flex gap-1.5">
								<dt>Bruto</dt>
								<dd className="font-medium text-neutral-800 tabular-nums">{decHoras(resultado.brutoMin)}h</dd>
							</div>
							<div className="flex gap-1.5">
								<dt>Descontos</dt>
								<dd className="font-medium text-neutral-800 tabular-nums">
									{decHoras(resultado.descontoMin)}h
									<span className="font-normal text-neutral-400">
										{resultado.descontos.almoco ? ' · almoço' : ''}
										{resultado.descontos.janta ? ' · janta' : ''}
									</span>
								</dd>
							</div>
						</dl>
					</div>
				) : (
					<div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
						<ClockIcon size={44} className="text-neutral-200" />
						<p style={fs(12, 14)} className="max-w-xs text-neutral-500">
							{rangeInvalido ? 'A saída deve ser depois da entrada.' : 'Informe entrada e saída para ver o cálculo.'}
						</p>
					</div>
				)}
			</Card>

			<Card className="min-w-0 lg:col-span-2">
				<SectionHead
					icon={<ListBulletsIcon size={14} />}
					title="Lançamentos"
					description={
						entries.length === 0
							? 'Salvos neste navegador'
							: `${entries.length} ${entries.length === 1 ? 'turno' : 'turnos'} · salvos neste navegador`
					}
					action={
						entries.length > 0 && (
							<button
								type="button"
								style={fs(12, 13)}
								className={`${btnSecundario} shrink-0 whitespace-nowrap hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
								onClick={() => setConfirmandoLimpar(true)}
							>
								<TrashIcon size={14} />
								Limpar tudo
							</button>
						)
					}
				/>

				{entries.length === 0 ? (
					<div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
						<ListBulletsIcon size={44} className="text-neutral-200" />
						<p style={fs(12, 14)} className="max-w-xs text-neutral-500">
							Nenhum lançamento ainda. Calcule um turno e clique em &quot;Adicionar à lista&quot; para somar as horas aqui.
						</p>
					</div>
				) : (
					<div className="relative overflow-x-auto">
						<table style={fs(12, 13)} className="w-full border-collapse text-neutral-700">
							<thead className="bg-neutral-50 text-neutral-400">
								<tr style={fs(10, 11)} className="tracking-wider uppercase">
									<th className={th}>Funcionário</th>
									<th className={th}>Tipo</th>
									<th className={th}>Data</th>
									<th className={th}>Entrada</th>
									<th className={th}>Saída</th>
									<th className={`${th} text-right`}>Normal</th>
									<th className={`${th} text-right`}>50%</th>
									<th className={`${th} text-right`}>100%</th>
									<th className={`${th} text-right`}>Total</th>
									<th className={th}>
										<span className="sr-only">Ações</span>
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-100">
								{entries.map((e) => (
									<tr key={e.id} className="transition-colors hover:bg-neutral-50/60">
										<td className={`${td} font-medium text-neutral-900`}>{e.nome || <span className="text-neutral-300">—</span>}</td>
										<td className={td}>
											<span
												style={fs(11, 12)}
												className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-medium text-neutral-600"
											>
												{e.tipo === 'irata' ? 'Irata' : 'Normal'}
											</span>
										</td>
										<td className={`${td} tabular-nums`}>
											{formatDataRangeBR(e.data, e.dataSaida)}
											{e.result.fimDeSemana && (
												<span style={fs(10, 11)} className="ml-1.5 font-semibold tracking-wider text-attech uppercase">
													FDS
												</span>
											)}
											{e.result.feriado && (
												<span
													style={fs(10, 11)}
													className={`ml-1.5 font-semibold tracking-wider uppercase ${
														e.result.feriadoIgnorado ? 'text-neutral-400 line-through' : 'text-amber-700'
													}`}
												>
													{e.result.feriadoIgnorado ? 'feriado ignorado' : 'feriado'}
												</span>
											)}
										</td>
										<td className={`${td} tabular-nums`}>{e.entrada}</td>
										<td className={`${td} tabular-nums`}>{e.saida}</td>
										<td className={`${td} text-right tabular-nums`}>{decHoras(e.result.normalMin)}h</td>
										<td className={`${td} text-right tabular-nums`}>{decHoras(e.result.cinquentaMin)}h</td>
										<td className={`${td} text-right tabular-nums`}>{decHoras(e.result.cemMin)}h</td>
										<td className={`${td} text-right font-semibold text-neutral-900 tabular-nums`}>
											{decHoras(e.result.totalPagoMin)}h
										</td>
										<td className={`${td} text-right`}>
											<button
												type="button"
												aria-label="Remover lançamento"
												title="Remover"
												className={btnIconePerigo}
												onClick={() => remover(e.id)}
											>
												<TrashIcon size={14} />
											</button>
										</td>
									</tr>
								))}
							</tbody>
							<tfoot className="border-t border-neutral-200 bg-neutral-50 font-semibold text-neutral-900">
								<tr>
									<td className={td} colSpan={5}>
										Total
									</td>
									<td className={`${td} text-right tabular-nums`}>{decHoras(totais.normalMin)}h</td>
									<td className={`${td} text-right tabular-nums`}>{decHoras(totais.cinquentaMin)}h</td>
									<td className={`${td} text-right tabular-nums`}>{decHoras(totais.cemMin)}h</td>
									<td className={`${td} text-right text-attech tabular-nums`}>{decHoras(totais.totalPagoMin)}h</td>
									<td className={td}></td>
								</tr>
							</tfoot>
						</table>
					</div>
				)}
			</Card>

			<ConfirmarExclusao
				aberto={confirmandoLimpar}
				titulo="Limpar todos os lançamentos?"
				descricao="A lista inteira de turnos será apagada deste navegador."
				rotulo="Limpar"
				onFechar={() => setConfirmandoLimpar(false)}
				onConfirmar={limparTudo}
			/>
		</div>
	);
}

function Stat({ rotulo, minutos }: { rotulo: string; minutos: number }) {
	return (
		<div className="flex flex-col gap-0.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
			<span style={fs(10, 11)} className="font-medium tracking-wider text-neutral-400 uppercase">
				{rotulo}
			</span>
			<span style={fs(20, 26)} className="leading-tight font-semibold tracking-tight text-neutral-900 tabular-nums">
				{decHoras(minutos)}h
			</span>
			<span style={fs(11, 12)} className="text-neutral-400 tabular-nums">
				{hmHoras(minutos)}
			</span>
		</div>
	);
}

function Chip({
	marcado,
	onChange,
	icone: Icone,
	children,
}: {
	marcado: boolean;
	onChange: (v: boolean) => void;
	icone: Icon;
	children: ReactNode;
}) {
	return (
		<label
			style={fs(12, 13)}
			className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-attech/30 ${
				marcado ? 'border-attech bg-attech text-white' : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
			}`}
		>
			<input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
			<Icone size={12} weight={marcado ? 'fill' : 'regular'} />
			{children}
		</label>
	);
}
