'use client';

import {
	DownloadSimpleIcon,
	FilePdfIcon,
	MapPinIcon,
	MoonIcon,
	ReceiptIcon,
	ShuffleIcon,
	SpinnerIcon,
} from '@phosphor-icons/react/dist/ssr';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fs } from '@/lib/calc-clamp';
import { btnIcone, btnPrimario, Card, Field, inputClass, SectionHead } from '../relatorio/ui';
import { drawRecibo, type ReciboImages, type ReciboLink } from './drawRecibo';
import { jpegBlobToPdfBlob } from './pdfFromJpeg';
import {
	type ReciboData,
	type ReciboRandom,
	addDaysISO,
	computePricing,
	diffDaysISO,
	formatMoneyBRL,
	generateRandomFields,
	pickRandomQuartoSrc,
	plural,
	sanitizeFileName,
} from './reciboData';

const CANVAS_W = 1275;
const CANVAS_H = 1650;

function todayStr(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const VIAJANTE = 'Tatiana Castello';

export default function ReciboAirbnbApp() {
	const [cidade, setCidade] = useState('Campos dos Goytacazes');
	const [checkinISO, setCheckinISO] = useState('');
	const [checkoutISO, setCheckoutISO] = useState('');
	const [hospedes, setHospedes] = useState('2');
	const [valorTotal, setValorTotal] = useState('');
	const [random, setRandom] = useState<ReciboRandom | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [images, setImages] = useState<ReciboImages>({ logo: null, quarto: null });

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const linksRef = useRef<ReciboLink[]>([]);

	useEffect(() => {
		const inicio = todayStr();
		setCheckinISO((prev) => prev || inicio);
		setCheckoutISO((prev) => prev || addDaysISO(inicio, 1));
		setRandom(generateRandomFields());

		const logo = new Image();
		logo.onload = () => setImages((prev) => ({ ...prev, logo }));
		logo.src = '/airbnb-logo.png';

		loadRandomQuarto();
	}, []);

	function loadRandomQuarto() {
		const quarto = new Image();
		quarto.onload = () => setImages((prev) => ({ ...prev, quarto }));
		quarto.src = pickRandomQuartoSrc();
	}

	useEffect(() => {
		if (!checkinISO) return;
		setCheckoutISO((prev) => (prev && diffDaysISO(checkinISO, prev) >= 1 ? prev : addDaysISO(checkinISO, 1)));
	}, [checkinISO]);

	const noitesNum = checkinISO && checkoutISO ? Math.max(1, diffDaysISO(checkinISO, checkoutISO)) : 1;
	const hospedesNum = Math.max(1, parseInt(hospedes, 10) || 0);
	const valorTotalNum = parseFloat(valorTotal.replace(',', '.')) || 0;

	const data: ReciboData | null = useMemo(() => {
		if (!random || !checkinISO) return null;
		return {
			cidade: cidade.trim() || 'Cidade não informada',
			viajante: VIAJANTE,
			checkinISO,
			noites: noitesNum,
			hospedes: hospedesNum,
			valorTotal: valorTotalNum,
			...random,
		};
	}, [cidade, checkinISO, noitesNum, hospedesNum, valorTotalNum, random]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !data) return;
		canvas.width = CANVAS_W;
		canvas.height = CANVAS_H;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		linksRef.current = drawRecibo(ctx, data, CANVAS_W, CANVAS_H, images);
	}, [data, images]);

	const pricing = computePricing(valorTotalNum, noitesNum);
	const ready = !!data && !!cidade.trim() && !!checkinISO && valorTotalNum > 0;

	const checkinFile = checkinISO ? checkinISO.split('-').reverse().join('-') : '';
	const filename = cidade.trim() ? `Recibo Airbnb - ${sanitizeFileName(cidade)} - ${checkinFile}.pdf` : '';

	function sortearNovamente() {
		setRandom(generateRandomFields());
		loadRandomQuarto();
	}

	async function handleDownload() {
		const canvas = canvasRef.current;
		if (!canvas || !data) return;
		setDownloading(true);
		try {
			const jpegBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.95));
			const pdfBlob = await jpegBlobToPdfBlob(jpegBlob, canvas.width, canvas.height, linksRef.current);
			const url = URL.createObjectURL(pdfBlob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} finally {
			setDownloading(false);
		}
	}

	return (
		<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
			<div className="flex flex-col gap-6 lg:sticky lg:top-6">
				<Card>
					<SectionHead icon={<MapPinIcon size={14} />} title="Hospedagem" description="Localidade, período e hóspedes" />
					<div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
						<Field label="Localidade" htmlFor="cidade">
							<input
								id="cidade"
								type="text"
								placeholder="Ex: Campos dos Goytacazes"
								value={cidade}
								onChange={(e) => setCidade(e.target.value)}
								className={inputClass}
							/>
						</Field>

						<div className="flex flex-col gap-1.5">
							<div className="grid grid-cols-2 gap-3">
								<Field label="Data de chegada" htmlFor="checkin">
									<input
										id="checkin"
										type="date"
										value={checkinISO}
										onChange={(e) => setCheckinISO(e.target.value)}
										className={inputClass}
									/>
								</Field>
								<Field label="Data de saída" htmlFor="checkout">
									<input
										id="checkout"
										type="date"
										min={checkinISO ? addDaysISO(checkinISO, 1) : undefined}
										value={checkoutISO}
										onChange={(e) => setCheckoutISO(e.target.value)}
										className={inputClass}
									/>
								</Field>
							</div>
							<span
								style={fs(11, 12)}
								className="inline-flex w-fit items-center gap-1 rounded-full border border-attech/20 bg-attech/5 px-2.5 py-0.5 font-medium text-attech tabular-nums"
							>
								<MoonIcon size={12} weight="fill" />
								{noitesNum} {plural(noitesNum, 'noite', 'noites')}
							</span>
						</div>

						<Field label="Hóspedes" htmlFor="hospedes" hint="O número de camas acompanha o de hóspedes.">
							<input
								id="hospedes"
								type="number"
								min="1"
								step="1"
								value={hospedes}
								onChange={(e) => setHospedes(e.target.value)}
								className={`${inputClass} tabular-nums`}
							/>
						</Field>
					</div>
				</Card>

				<Card>
					<SectionHead icon={<ReceiptIcon size={14} />} title="Valores" description="Taxas calculadas sobre o total" />
					<div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
						<Field
							label="Valor total (R$)"
							htmlFor="valorTotal"
							hint="Taxa de serviço (10%) e impostos (5%) são calculados automaticamente sobre esse valor."
						>
							<input
								id="valorTotal"
								type="text"
								inputMode="decimal"
								placeholder="Ex: 867,00"
								value={valorTotal}
								onChange={(e) => setValorTotal(e.target.value)}
								className={`${inputClass} tabular-nums`}
							/>
						</Field>

						{valorTotalNum > 0 && (
							<div className="flex flex-col gap-3">
								<dl style={fs(12, 13)} className="flex flex-col gap-1.5 text-neutral-500">
									<LinhaValor rotulo="Por noite" valor={formatMoneyBRL(pricing.perNoite)} />
									<LinhaValor rotulo="Taxa de serviço" valor={formatMoneyBRL(pricing.taxaServico)} />
									<LinhaValor rotulo="Impostos" valor={formatMoneyBRL(pricing.impostos)} />
								</dl>
								<div className="flex items-center justify-between gap-3 rounded-xl bg-attech px-3.5 py-3 text-white">
									<span style={fs(12, 13)} className="text-white/60">
										Total
									</span>
									<span style={fs(18, 22)} className="leading-tight font-semibold tracking-tight text-primary tabular-nums">
										{formatMoneyBRL(pricing.total)}
									</span>
								</div>
							</div>
						)}
					</div>
				</Card>

				{random && (
					<Card>
						<SectionHead
							icon={<ShuffleIcon size={14} />}
							title="Dados sorteados"
							description="Anfitrião, códigos e foto do quarto"
							action={
								<button
									type="button"
									onClick={sortearNovamente}
									aria-label="Sortear novamente"
									title="Sortear novamente"
									className={btnIcone}
								>
									<ShuffleIcon size={16} />
								</button>
							}
						/>
						<dl style={fs(12, 13)} className="flex flex-col gap-1.5 px-4 py-4 text-neutral-500 sm:px-5">
							<LinhaValor rotulo="Anfitrião" valor={random.anfitriao} />
							<LinhaValor rotulo="Identificação" valor={random.idCode} />
							<LinhaValor rotulo="Confirmação" valor={random.confirmCode} />
						</dl>
					</Card>
				)}

				<div className="flex flex-col gap-2">
					<button
						type="button"
						style={fs(13, 14)}
						className={`${btnPrimario} py-2.5`}
						disabled={!ready || downloading}
						onClick={handleDownload}
					>
						{downloading ? (
							<SpinnerIcon size={16} className="animate-spin" />
						) : (
							<DownloadSimpleIcon size={16} weight="bold" />
						)}
						{downloading ? 'Gerando…' : 'Baixar PDF'}
					</button>
					{filename && (
						<p style={fs(11, 12)} className="break-all text-center text-neutral-400">
							{filename}
						</p>
					)}
				</div>
			</div>

			<Card className="min-w-0">
				<SectionHead icon={<FilePdfIcon size={14} />} title="Prévia" description="Visualização do recibo que será baixado" />
				<div className="flex justify-center bg-neutral-50 p-4 sm:p-6">
					<canvas
						ref={canvasRef}
						className="h-auto w-full max-w-[720px] rounded-lg border border-neutral-200 bg-white shadow-sm"
					/>
				</div>
			</Card>
		</div>
	);
}

function LinhaValor({ rotulo, valor }: { rotulo: string; valor: string }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<dt>{rotulo}</dt>
			<dd className="font-medium text-neutral-800 tabular-nums">{valor}</dd>
		</div>
	);
}
