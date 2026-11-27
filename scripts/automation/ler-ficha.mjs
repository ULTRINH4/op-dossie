/**
 * Lê o texto de uma ficha de ameaça (copiado de um PDF) e monta os dados da ameaça.
 * Funciona com o bloco "limpo" (pessoas e animais: tudo na mesma linha) e com o texto de duas colunas,
 * em que rótulos e valores saem separados ("PERCEPÇÃO / INICIATIVA / 3O+15 / 4O+15"): os valores são
 * casados com os rótulos pela ordem em que aparecem.
 * Sem dependências do Foundry: roda no navegador (Colar ficha) e no Node (ferramentas).
 *
 * @returns {{nome: string, system: object, itens: object[], avisos: string[]}}
 */
import { TIPOS_DANO, ELEMENTOS } from '../config.mjs';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** "2O+5" (O = d20 no livro), "O", "3O–2"; aceita também "2d20+5". */
// "–2O" = dados negativos (rola mais dados e fica com o pior).
const RE_TESTE = /(?<![A-Za-zÀ-ÿ])([-−–]?\d*)\s*(?:O|d20)\s*(?:([+\-−–])\s*(\d+))?(?![A-Za-zà-ú])/g;
const numDados = (t) => { const s = String(t ?? '').replace(/[−–]/g, '-'); return s === '' ? 1 : s === '-' ? -1 : Number(s); };
const teste = (m) => ({ dados: numDados(m[1]), bonus: m[3] ? Number(m[3]) * (/[-−–]/.test(m[2]) ? -1 : 1) : 0 });
const testes = (txt) => [...String(txt ?? '').matchAll(RE_TESTE)].map(teste);

const ACOES = { 'PADRÃO': 'padrao', 'PADRAO': 'padrao', 'MOVIMENTO': 'movimento', 'LIVRE': 'livre', 'REAÇÃO': 'reacao', 'REACAO': 'reacao', 'COMPLETA': 'completa' };
const RE_ACAO = /^(PADR[ÃA]O|MOVIMENTO|LIVRE|REA[ÇC][ÃA]O|COMPLETA)\s+(.+)$/;
const ROTULOS = ['PRESENÇA PERTURBADORA', 'SENTIDOS', 'DEFESA', 'PONTOS DE VIDA', 'IMUNIDADES', 'RESISTÊNCIAS', 'VULNERABILIDADES',
	'ATRIBUTOS', 'PERÍCIAS', 'DESLOCAMENTO', 'AÇÕES', 'ENIGMA DE MEDO'];
const TAMANHOS = { 'MINÚSCULO': 'minusculo', 'MINUSCULO': 'minusculo', 'PEQUENO': 'pequeno', 'MÉDIO': 'medio', 'MEDIO': 'medio', 'GRANDE': 'grande', 'ENORME': 'enorme', 'COLOSSAL': 'colossal' };
const ELEM = Object.fromEntries(Object.entries(ELEMENTOS).map(([k, e]) => [norm(e.nome), k]));
const DANO = Object.fromEntries(Object.entries(TIPOS_DANO).map(([k, n]) => [norm(n), k]));
DANO.paranormal = ['sangue', 'morte', 'conhecimento', 'energia', 'medo'];
const ARMA_FOGO = /pistola|revolver|fuzil|espingarda|escopeta|submetralhadora|metralhadora|rifle/;
const MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'à', 'no', 'na', 'com', 'para', 'por']);

/** "GARRA DA MORTE" → "Garra da Morte". */
export function titulo(s) {
	return String(s ?? '').toLowerCase().split(/\s+/).filter(Boolean)
		.map((w, i) => (i && MINUSC.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const ehCaixaAlta = (l) => /[A-ZÀ-Ý]/.test(l) && !/[a-zà-ÿ]/.test(l) && /^[A-ZÀ-Ý0-9 ,'’()\-–&/]+$/.test(l);
const ehRotulo = (l) => ROTULOS.some(r => norm(l).startsWith(norm(r)));
const juntar = (linhas) => linhas.join(' ').replace(/(\p{L})-\s+(\p{Ll})/gu, '$1$2').replace(/\s+/g, ' ').trim();

/** Chaves de dano de um texto ("Corte, impacto e perfuração" → [corte, impacto, perfuracao]). */
function chavesDano(txt) {
	const out = []; const resto = [];
	for (const parte of String(txt).split(/,|\se\s/)) {
		const p = norm(parte).replace(/\b(dano|de|a)\b/g, ' ').trim();
		if (!p) continue;
		const k = DANO[p] ?? DANO[p.split(/\s+/).pop()] ?? Object.entries(DANO).find(([n]) => p.includes(n))?.[1];
		if (k) out.push(...[k].flat()); else resto.push(parte.trim());
	}
	return { chaves: [...new Set(out)], resto };
}

/** Texto entre um rótulo e o próximo rótulo conhecido. */
function trecho(texto, rotulo) {
	const i = norm(texto).indexOf(norm(rotulo));
	if (i < 0) return null;
	const depois = texto.slice(i + rotulo.length);
	const fim = ROTULOS.concat(['AGI ', 'VD ']).map(r => { const j = norm(depois).search(new RegExp(`\\b${norm(r).trim()}\\b`)); return j < 0 ? Infinity : j; });
	return depois.slice(0, Math.min(...fim)).trim();
}

export function lerFicha(textoBruto, { nome = null } = {}) {
	const avisos = [];
	// O PDF usa glifos de uma fonte de ícones (área de uso privado) como separadores: viram espaço.
	const texto = String(textoBruto ?? '').replace(/\r/g, '').replace(/[-​-‍﻿]/g, ' ').replace(/[^\S\n]+/g, ' ');
	// "VD 180 LIVRE ACORRENTAR": o VD da coluna ao lado gruda na linha seguinte; separa.
	const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)
		.flatMap(l => { const m = l.match(/^(VD\s+\d+)\s+(.+)$/); return m ? [m[1], m[2]] : [l]; });
	const plano = linhas.join('\n');
	const s = { tipo: 'criatura', enxame: false, elemento: '', descritores: [], tamanho: 'medio', vd: 0, atributos: {}, pv: { valor: 1, max: 1 },
		defesa: 10, deslocamento: '9m', sentidos: '', percepcao: { dados: 1, bonus: 0 }, iniciativa: { dados: 1, bonus: 0 },
		fortitude: { dados: 1, bonus: 0 }, reflexos: { dados: 1, bonus: 0 }, vontade: { dados: 1, bonus: 0 }, pericias: [],
		resistencias: {}, imunidades: [], vulnerabilidades: [], presencaPerturbadora: { dt: 0, dano: '', nexImune: 0 }, enigma: '', descricao: '' };

	// VD e nome
	const vd = plano.match(/\bVD\s+(\d+)/);
	if (vd) s.vd = Number(vd[1]); else avisos.push('VD não encontrado.');
	if (!nome) {
		const linhaVd = linhas.findIndex(l => /\bVD\s+\d+/.test(l));
		const antes = linhaVd >= 0 ? linhas[linhaVd].replace(/\s*\bVD\s+\d+.*$/, '').trim() : '';
		if (antes && ehCaixaAlta(antes)) {
			const anterior = linhas[linhaVd - 1];
			nome = anterior && ehCaixaAlta(anterior) && anterior.length < 30 && !ehRotulo(anterior) && !RE_ACAO.test(anterior) ? `${anterior} ${antes}` : antes;
		} else nome = linhas.find(l => ehCaixaAlta(l) && !ehRotulo(l) && !RE_ACAO.test(l)) ?? linhas[0] ?? 'Ameaça';
		nome = titulo(nome);
	}

	// Descritores: elementos + CRIATURA/PESSOA/ANIMAL + tamanho
	const iTipo = linhas.findIndex(l => /\b(CRIATURA|PESSOA|ANIMAL|RELÍQUIA|RELIQUIA)\b/.test(l) && ehCaixaAlta(l));
	if (iTipo >= 0) {
		let desc = linhas[iTipo];
		const ant = linhas[iTipo - 1];
		if (ant && ehCaixaAlta(ant) && ant.split(/\s+/).every(w => ELEM[norm(w)])) desc = `${ant} ${desc}`;
		const t = desc.match(/\b(CRIATURA|PESSOA|ANIMAL|RELÍQUIA|RELIQUIA)\b/)[1];
		s.tipo = t === 'PESSOA' ? 'pessoa' : t === 'ANIMAL' ? 'animal' : 'criatura';
		s.enxame = /ENXAME/.test(desc);
		const tam = desc.match(/\b(MINÚSCULO|MINUSCULO|PEQUENO|MÉDIO|MEDIO|GRANDE|ENORME|COLOSSAL)\b/);
		if (tam) s.tamanho = TAMANHOS[tam[1]];
		// Elementos: na linha do tipo e em linhas só de elementos perto do nome ("KERBEROS / SANGUE / VD 340").
		const soltos = linhas.filter(l => ehCaixaAlta(l) && l.split(/\s+/).every(w => ELEM[norm(w)])).flatMap(l => l.split(/\s+/).map(w => ELEM[norm(w)]));
		const els = [...new Set([...soltos, ...desc.split(/\s+/).map(w => ELEM[norm(w)]).filter(Boolean)])];
		s.elemento = els[0] ?? ''; s.descritores = els;
	} else avisos.push('Tipo e tamanho não encontrados (CRIATURA/PESSOA/ANIMAL).');

	// Presença perturbadora
	const pp = plano.replace(/\n/g, ' ').match(/PRESENÇA PERTURBADORA\s*DT\s*(\d+)\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s*mental(?:\s*NEX\s*(\d+)%)?/i);
	if (pp) s.presencaPerturbadora = { dt: Number(pp[1]), dano: pp[2].replace(/\s/g, ''), nexImune: Number(pp[3] ?? 0) };

	// Sentidos: Percepção e Iniciativa (ordem), e sentidos especiais
	const sent = trecho(plano, 'SENTIDOS');
	if (sent != null) {
		const ts = testes(sent);
		if (ts[0]) s.percepcao = ts[0];
		if (ts[1]) s.iniciativa = ts[1];
		if (ts.length < 2) avisos.push('Percepção/Iniciativa incompletas.');
		const especiais = sent.split('\n').map(l => l.replace(/\|/g, ' ').trim())
			.filter(l => l && /[a-zà-ÿ]/.test(l) && !testes(l).length && !/^(percep[çc][ãa]o|iniciativa)$/i.test(l));
		s.sentidos = especiais.join(', ').replace(/\s+/g, ' ');
	}

	// Defesa e testes de resistência (ordem: Fortitude, Reflexos, Vontade)
	const def = plano.match(/DEFESA\s+(\d+)/);
	if (def) s.defesa = Number(def[1]); else avisos.push('Defesa não encontrada.');
	const iDef = plano.search(/DEFESA\s+\d+/); const iPv = plano.search(/PONTOS DE VIDA/);
	if (iDef >= 0 && iPv > iDef) {
		const ts = testes(plano.slice(iDef, iPv).replace(/DEFESA\s+\d+/, ''));
		[s.fortitude, s.reflexos, s.vontade] = [ts[0] ?? s.fortitude, ts[1] ?? s.reflexos, ts[2] ?? s.vontade];
		if (ts.length < 3) avisos.push('Fortitude/Reflexos/Vontade incompletos.');
	}

	// Pontos de vida
	const pv = plano.match(/PONTOS DE VIDA\s+(\d+)/);
	if (pv) s.pv = { valor: Number(pv[1]), max: Number(pv[1]) }; else avisos.push('Pontos de vida não encontrados.');

	// Imunidades, resistências, vulnerabilidades
	const notas = [];
	const imu = trecho(plano, 'IMUNIDADES');
	if (imu) { const r = chavesDano(imu.replace(/\n/g, ' ')); s.imunidades = r.chaves; if (r.resto.length) notas.push(`Imune a: ${r.resto.join(', ')}.`); }
	const vul = trecho(plano, 'VULNERABILIDADES');
	if (vul) { const r = chavesDano(vul.replace(/\n/g, ' ')); s.vulnerabilidades = r.chaves; if (r.resto.length) notas.push(`Vulnerável a: ${r.resto.join(', ')}.`); }
	const res = trecho(plano, 'RESISTÊNCIAS');
	if (res) {
		for (const m of res.replace(/\n/g, ' ').matchAll(/([^\d,][^\d]*?)\s+(\d+)/g)) {
			const r = chavesDano(m[1]);
			for (const k of r.chaves) s.resistencias[k] = Number(m[2]);
			if (r.resto.length) notas.push(`Resistência ${m[2]}: ${r.resto.join(', ')}.`);
		}
	}

	// Atributos
	const at = plano.replace(/\n/g, ' ').match(/AGI\s+(-?\d+)\s+FOR\s+(-?\d+)\s+INT\s+(-?\d+)\s+PRE\s+(-?\d+)\s+VIG\s+(-?\d+)/);
	if (at) s.atributos = { agi: { valor: +at[1] }, for: { valor: +at[2] }, int: { valor: +at[3] }, pre: { valor: +at[4] }, vig: { valor: +at[5] } };
	else avisos.push('Atributos não encontrados.');

	// Perícias
	const per = trecho(plano, 'PERÍCIAS');
	if (per) for (const m of per.replace(/\n/g, ' ').matchAll(/([A-Za-zÀ-ÿ()][A-Za-zÀ-ÿ() ]*?)\s+(\d*)(?<![A-Za-zÀ-ÿ])O\s*(?:([+\-−–])\s*(\d+))?(?![A-Za-zà-ú])/g)) {
		s.pericias.push({ nome: titulo(m[1].trim()), ...teste([null, m[2], m[3], m[4]]) });
	}

	// Deslocamento
	const desl = plano.match(/DESLOCAMENTO\s+([^\n]+)/);
	if (desl) s.deslocamento = desl[1].replace(/\s*\|\s*\d+/g, '').replace(/\s+/g, ' ').trim();

	// Ações e habilidades
	const itens = [];
	const stats = new Set();
	const ignorar = (l) => ehRotulo(l) || /^(AGI|PERÍCIAS|PERICIAS)\b/.test(l) || /\bVD\s+\d+/.test(l) || l === 'ATRIBUTOS' || /^\|/.test(l) || /^\d+$/.test(l);
	let atual = null;
	const fechar = () => {
		if (!atual) return;
		const corpo = juntar(atual.corpo);
		if (atual.tipo === 'acao' && /^AGREDIR/.test(atual.nome)) itens.push(...ataques(atual.corpoBruto, atual.execucao, avisos));
		else if (atual.tipo === 'enigma') s.enigma = corpo ? `<p>${corpo}</p>` : '';
		else itens.push({ name: titulo(atual.nome), type: 'poder', system: { execucao: atual.execucao ?? '', tipo: 'outro', descricao: corpo ? `<p>${corpo}</p>` : '' } });
		atual = null;
	};
	const iAcoes = linhas.findIndex(l => /^AÇÕES$|^ACOES$/.test(l));
	for (let i = 0; i < linhas.length; i++) {
		const l = linhas[i];
		const a = l.match(RE_ACAO);
		if (a && (iAcoes < 0 || i > iAcoes || atual)) { fechar(); atual = { tipo: 'acao', execucao: ACOES[a[1].normalize('NFC')] ?? ACOES[a[1]], nome: a[2].trim(), corpo: [], corpoBruto: [] }; continue; }
		if (/^ENIGMA DE MEDO/.test(l)) { fechar(); atual = { tipo: 'enigma', corpo: [], corpoBruto: [] }; continue; }
		// Cabeçalho de habilidade: linha em caixa alta seguida de texto comum, fora dos rótulos.
		const prox = linhas[i + 1] ?? '';
		const nomeDeAtaque = /^(Corpo a corpo|À distância|A distância|Distância)\b/i.test(prox);
		if (ehCaixaAlta(l) && !ignorar(l) && !nomeDeAtaque && /[a-zà-ÿ]/.test(prox) && l.length <= 40 && !/\b(CRIATURA|PESSOA|ANIMAL|RELÍQUIA|RELIQUIA)\b/.test(l) && !ELEM[norm(l)] && !(nome && norm(l).replace(/\s/g, '') === norm(nome).replace(/\s/g, ''))) {
			fechar(); atual = { tipo: 'hab', execucao: '', nome: l, corpo: [], corpoBruto: [] }; continue;
		}
		// Cabeçalho na mesma linha do texto: "ZUMBIDO NAUSEANTE Um ser que sofra dano..."
		const inline = !ignorar(l) && l.match(/^([A-ZÀ-Ý][A-ZÀ-Ý' ]{3,}?)\s+([A-ZÀ-Ý][a-zà-ÿ].*)$/);
		if (inline && !RE_ACAO.test(l) && !/^(Corpo a corpo|À distância|A distância|Distância)\b/i.test(inline[2]) && !/\b(CRIATURA|PESSOA|ANIMAL|RELÍQUIA|RELIQUIA)\b/.test(inline[1])) {
			fechar(); atual = { tipo: 'hab', execucao: '', nome: inline[1].trim(), corpo: [inline[2]], corpoBruto: [inline[2]] }; continue;
		}
		if (atual && (ignorar(l) || /\b(CRIATURA|PESSOA|ANIMAL|RELÍQUIA|RELIQUIA)\b/.test(l) && ehCaixaAlta(l))) { fechar(); continue; }
		if (atual) { atual.corpo.push(l); atual.corpoBruto.push(l); }
	}
	fechar();
	// Mesmo nome para o ataque corpo a corpo e o à distância (ex.: arma que também é arremessada): distingue.
	const armas = itens.filter(i => i.type === 'arma');
	for (const a of armas) if (a.system.tipo !== 'corpo a corpo' && armas.some(b => b !== a && b.name === a.name)) a.name = `${a.name} (à distância)`;
	if (notas.length) s.descricao = `<p>${notas.join(' ')}</p>`;
	if (!itens.some(i => i.type === 'arma')) avisos.push('Nenhum ataque encontrado.');
	return { nome, system: s, itens, avisos };
}

/** Ataques de um "AGREDIR": linha "NOME Corpo a corpo x2" (ou "À distância CURTO") e linha "TESTE 2O+5 | DANO 1d6+5 corte". */
function ataques(linhas, execucao, avisos) {
	const out = [];
	for (let i = 0; i < linhas.length; i++) {
		const l = linhas[i];
		let m = l.match(/^(.+?)\s+(Corpo a corpo|À distância|A distância|Distância)\b\s*(.*)$/i);
		// Nome numa linha e "Corpo a corpo x2" na seguinte.
		const so = !m && l.match(/^(Corpo a corpo|À distância|A distância|Distância)\b\s*(.*)$/i);
		if (so && i > 0) m = [l, linhas[i - 1], so[1], so[2]];
		if (!m) continue;
		// O teste pode vir na mesma linha ou nas seguintes.
		const resto = [m[3], linhas[i + 1] ?? '', linhas[i + 2] ?? ''].join(' ');
		const t = resto.match(/TESTE\s+(\d*)\s*O\s*(?:([+\-−–])\s*(\d+))?/i);
		const d = resto.match(/DANO\s+(\d+d\d+(?:\s*[+\-]\s*\d+)*)\s*([A-Za-zÀ-ÿ]+)/i);
		// "crítico 19", "crítico 19/x3" ou só "crítico x3".
		const crit = resto.match(/cr[íi]tico\s+(?:(\d+)\s*)?(?:\/?\s*x\s*(\d))?/i);
		const x = m[3].match(/x\s*(\d)/i);
		const alcance = m[3].match(/\b(CURTO|MÉDIO|MEDIO|LONGO|EXTREMO)\b/i);
		const nomeAtq = titulo(m[1].replace(/^AGREDIR\s+/i, ''));
		const corpo = /corpo/i.test(m[2]);
		const tipoDano = d ? (DANO[norm(d[2])] ?? '') : '';
		if (!t || !d) avisos.push(`Ataque "${nomeAtq}": teste ou dano não encontrado.`);
		out.push({ name: nomeAtq, type: 'arma', system: {
			tipo: corpo ? 'corpo a corpo' : (ARMA_FOGO.test(norm(nomeAtq)) ? 'fogo' : 'disparo'),
			testeDados: t ? Number(t[1] || 1) : 1, bonusAtaque: t?.[3] ? Number(t[3]) * (/[-−–]/.test(t[2]) ? -1 : 1) : 0,
			ataques: x ? Number(x[1]) : 1,
			dano: { formula: d ? d[1].replace(/\s/g, '') : '1d6', tipo: tipoDano },
			critico: { margem: crit?.[1] ? Number(crit[1]) : 20, multiplicador: crit?.[2] ? Number(crit[2]) : 2 },
			alcance: alcance ? titulo(alcance[1]) : (corpo ? '' : 'Curto')
		} });
	}
	if (!out.length) avisos.push('Agredir sem ataque reconhecido.');
	return out;
}
