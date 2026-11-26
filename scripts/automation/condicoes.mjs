/**
 * Condições (Livro de Regras, Apêndice, pp. 310–311).
 * "–O" é perder um dado no teste. Condições com o mesmo efeito não se acumulam: vale a mais severa.
 * O que é número fixo entra na ficha; o resto vira lembrete.
 */
import { SYSTEM_ID, PERICIAS } from '../config.mjs';

const I = (n) => `icons/svg/${n}.svg`;
const ATR_FISICOS = ['agi', 'for', 'vig'];
const ATR_MENTAIS = ['int', 'pre'];

/**
 * dados: lista de penalidades em dados → { n, em: 'testes' | 'pericias' | 'ataque' | 'ataqueCaC' | atributos[] | perícias[] }
 * implica: condições que vêm junto. defesa: penalidade na Defesa. desloc: 'zero' | 'metade' | 'rastejar'.
 */
export const CONDICOES = [
	{ id: 'abalado', nome: 'Abalado', img: I('downgrade'), tipo: 'medo', dados: [{ n: 1, em: 'testes' }], piora: 'apavorado' },
	{ id: 'agarrado', nome: 'Agarrado', img: I('padlock'), tipo: 'paralisia', implica: ['desprevenido', 'imovel'], dados: [{ n: 1, em: 'ataque' }], lembrete: 'Só ataca com armas leves. Ataque à distância contra quem está na manobra tem 50% de chance de acertar o alvo errado.' },
	{ id: 'alquebrado', nome: 'Alquebrado', img: I('cancel'), tipo: 'mental', custoExtra: 1, lembrete: 'Habilidades e rituais custam +1 PE.' },
	{ id: 'apavorado', nome: 'Apavorado', img: I('terror'), tipo: 'medo', dados: [{ n: 2, em: 'pericias' }], lembrete: 'Deve fugir da fonte do medo; se não puder, não se aproxima dela voluntariamente.' },
	{ id: 'asfixiado', nome: 'Asfixiado', img: I('silenced'), lembrete: 'Prende a respiração por rodadas = Vigor; depois, Fortitude DT 5 (+5 por teste) por rodada ou cai inconsciente e perde 1d6 PV por rodada.' },
	{ id: 'atordoado', nome: 'Atordoado', img: I('daze'), tipo: 'mental', implica: ['desprevenido'], lembrete: 'Não pode fazer ações.' },
	{ id: 'caido', nome: 'Caído', img: I('falling'), dados: [{ n: 2, em: 'ataqueCaC' }], desloc: 'rastejar', lembrete: '–5 na Defesa contra corpo a corpo e +5 contra ataques à distância.' },
	{ id: 'cego', nome: 'Cego', img: I('blind'), tipo: 'sentidos', implica: ['desprevenido', 'lento'], dados: [{ n: 2, em: ['agi', 'for'] }], lembrete: 'Não faz Percepção para observar; seus alvos têm camuflagem total.' },
	{ id: 'confuso', nome: 'Confuso', img: I('clockwork'), tipo: 'mental', lembrete: 'Role 1d6 no início do turno: 1) move em direção aleatória (1d8); 2–3) não age; 4–5) ataca o ser mais próximo; 6) a condição termina.' },
	{ id: 'debilitado', nome: 'Debilitado', img: I('leg'), dados: [{ n: 2, em: ATR_FISICOS }], piora: 'inconsciente' },
	{ id: 'desprevenido', nome: 'Desprevenido', img: I('target'), defesa: 5, dados: [{ n: 1, em: ['reflexos'] }] },
	{ id: 'doente', nome: 'Doente', img: I('biohazard'), lembrete: 'Efeito conforme a doença.' },
	{ id: 'emChamas', nome: 'Em chamas', img: I('fire'), lembrete: 'Sofre 1d6 de fogo no início do turno. Ação padrão para apagar.' },
	{ id: 'enjoado', nome: 'Enjoado', img: I('pill'), lembrete: 'Só uma ação padrão ou de movimento por rodada.' },
	{ id: 'enlouquecendo', nome: 'Enlouquecendo', img: I('portal'), lembrete: 'Três turnos enlouquecendo na mesma cena: fica insano. Acalmar: Diplomacia DT 20 (+5 por vez na cena) ou recuperar 1 SAN.' },
	{ id: 'enredado', nome: 'Enredado', img: I('net'), tipo: 'paralisia', implica: ['lento', 'vulneravel'], dados: [{ n: 1, em: 'ataque' }] },
	{ id: 'envenenado', nome: 'Envenenado', img: I('poison'), lembrete: 'Efeito conforme o veneno; dano recorrente de veneno sempre acumula.' },
	{ id: 'esmorecido', nome: 'Esmorecido', img: I('light-off'), tipo: 'mental', dados: [{ n: 2, em: ATR_MENTAIS }] },
	{ id: 'exausto', nome: 'Exausto', img: I('sleep'), tipo: 'fadiga', implica: ['debilitado', 'lento', 'vulneravel'], piora: 'inconsciente' },
	{ id: 'fascinado', nome: 'Fascinado', img: I('eye'), tipo: 'mental', dados: [{ n: 2, em: ['percepcao'] }], lembrete: 'Só observa o que o fascinou. Ação hostil encerra.' },
	{ id: 'fatigado', nome: 'Fatigado', img: I('walk'), tipo: 'fadiga', implica: ['fraco', 'vulneravel'], piora: 'exausto' },
	{ id: 'fraco', nome: 'Fraco', img: I('down'), dados: [{ n: 1, em: ATR_FISICOS }], piora: 'debilitado' },
	{ id: 'frustrado', nome: 'Frustrado', img: I('hazard'), tipo: 'mental', dados: [{ n: 1, em: ATR_MENTAIS }], piora: 'esmorecido' },
	{ id: 'imovel', nome: 'Imóvel', img: I('anchor'), tipo: 'paralisia', desloc: 'zero' },
	{ id: 'inconsciente', nome: 'Inconsciente', img: I('unconscious'), implica: ['indefeso'], lembrete: 'Não pode fazer ações nem reações.' },
	{ id: 'indefeso', nome: 'Indefeso', img: I('mystery-man-black'), implica: ['desprevenido'], defesa: 10, lembrete: 'Falha automaticamente em Reflexos e pode sofrer golpe de misericórdia.' },
	{ id: 'lento', nome: 'Lento', img: I('stone-path'), tipo: 'paralisia', desloc: 'metade', lembrete: 'Não pode correr nem fazer investidas.' },
	{ id: 'machucado', nome: 'Machucado', img: I('bones'), lembrete: 'Metade ou menos dos PV.' },
	{ id: 'morrendo', nome: 'Morrendo', img: I('degen'), lembrete: 'Três turnos morrendo na mesma cena: morre. Estabilizar: Medicina DT 20 (+5 por vez na cena).' },
	{ id: 'ofuscado', nome: 'Ofuscado', img: I('sun'), tipo: 'sentidos', dados: [{ n: 1, em: 'ataque' }, { n: 1, em: ['percepcao'] }] },
	{ id: 'paralisado', nome: 'Paralisado', img: I('paralysis'), tipo: 'paralisia', implica: ['imovel', 'indefeso'], lembrete: 'Só ações puramente mentais.' },
	{ id: 'pasmo', nome: 'Pasmo', img: I('stoned'), tipo: 'mental', lembrete: 'Não pode fazer ações.' },
	{ id: 'perturbado', nome: 'Perturbado', img: I('cowled'), lembrete: 'Na primeira vez na cena, recebe um efeito de insanidade (p. 111).' },
	{ id: 'petrificado', nome: 'Petrificado', img: I('statue'), implica: ['inconsciente'], rd: 10 },
	{ id: 'sangrando', nome: 'Sangrando', img: I('blood'), lembrete: 'No início do turno, Vigor DT 20: passa e estabiliza; falha e perde 1d6 PV. Medicina DT 20 (ação completa) estabiliza.' },
	{ id: 'surdo', nome: 'Surdo', img: I('deaf'), tipo: 'sentidos', dados: [{ n: 2, em: ['iniciativa'] }], lembrete: 'Não faz Percepção para ouvir; condição ruim para conjurar rituais.' },
	{ id: 'surpreendido', nome: 'Surpreendido', img: I('jump'), implica: ['desprevenido'], lembrete: 'Não pode fazer ações.' },
	{ id: 'vulneravel', nome: 'Vulnerável', img: I('thrust'), defesa: 2 },
	{ id: 'dead', nome: 'Morto', img: I('skull') }
];
export const CONDICAO = Object.fromEntries(CONDICOES.map(c => [c.id, c]));

/** Texto curto do efeito, para dicas e para a ficha. */
export function resumoCondicao(c) {
	const partes = [];
	for (const d of c.dados ?? []) {
		const onde = d.em === 'testes' ? 'testes' : d.em === 'pericias' ? 'testes de perícia' : d.em === 'ataque' ? 'ataques'
			: d.em === 'ataqueCaC' ? 'ataques corpo a corpo'
				: d.em.map(k => PERICIAS[k]?.nome ?? { agi: 'Agilidade', for: 'Força', vig: 'Vigor', int: 'Intelecto', pre: 'Presença' }[k]).join(', ');
		partes.push(`–${d.n}d em ${onde}`);
	}
	if (c.defesa) partes.push(`–${c.defesa} na Defesa`);
	if (c.desloc) partes.push({ zero: 'deslocamento 0', metade: 'deslocamento pela metade', rastejar: 'deslocamento 1,5m' }[c.desloc]);
	if (c.rd) partes.push(`resistência a dano ${c.rd}`);
	if (c.implica?.length) partes.push(`fica ${c.implica.map(i => CONDICAO[i].nome.toLowerCase()).join(', ')}`);
	if (c.lembrete) partes.push(c.lembrete);
	if (c.piora) partes.push(`de novo: ${CONDICAO[c.piora].nome.toLowerCase()}`);
	return partes.join('. ').replace(/\.\./g, '.') + (partes.length ? '.' : '');
}

/** Registra as condições como efeitos de status do Foundry. */
export function registrarCondicoes() {
	CONFIG.statusEffects = CONDICOES.map(c => ({ id: c.id, name: c.nome, img: c.img, description: resumoCondicao(c) }));
	CONFIG.specialStatusEffects.DEFEATED = 'dead';
	CONFIG.specialStatusEffects.BLIND = 'cego';
}

/** Condições ativas, já com as que vêm junto (exausto → debilitado, lento, vulnerável...). */
export function condicoesAtivas(actor) {
	const out = new Set();
	const add = (id) => {
		if (out.has(id) || !CONDICAO[id]) return;
		out.add(id);
		for (const i of CONDICAO[id].implica ?? []) add(i);
	};
	for (const id of actor?.statuses ?? []) add(id);
	return out;
}

/** Modificadores que as condições dão à ficha. */
export function modsCondicoes(actor) {
	const ativas = condicoesAtivas(actor);
	const lista = [...ativas].map(id => CONDICAO[id]);
	const defesa = Math.max(0, ...lista.map(c => c.defesa ?? 0));
	const desloc = lista.some(c => c.desloc === 'zero') ? 'zero' : lista.some(c => c.desloc === 'rastejar') ? 'rastejar' : lista.some(c => c.desloc === 'metade') ? 'metade' : null;
	const rd = Math.max(0, ...lista.map(c => c.rd ?? 0));
	const custoExtra = Math.max(0, ...lista.map(c => c.custoExtra ?? 0));
	return { ativas, lista, defesa, desloc, rd, custoExtra };
}

/**
 * Penalidade em dados de um teste e as condições que a causam (vale a mais severa).
 * @param {Actor} actor
 * @param {object} t { pericia, atributo, ataque, corpoACorpo }
 */
export function penalidadeDados(actor, { pericia = null, atributo = null, ataque = false, corpoACorpo = false } = {}) {
	let n = 0; let fontes = [];
	const attr = atributo ?? PERICIAS[pericia]?.atributo ?? null;
	for (const c of modsCondicoes(actor).lista) {
		for (const d of c.dados ?? []) {
			const vale = d.em === 'testes'
				|| (d.em === 'pericias' && pericia)
				|| (d.em === 'ataque' && ataque)
				|| (d.em === 'ataqueCaC' && ataque && corpoACorpo)
				|| (Array.isArray(d.em) && (d.em.includes(attr) || (pericia && d.em.includes(pericia))));
			if (!vale) continue;
			if (d.n > n) { n = d.n; fontes = [c.nome]; } else if (d.n === n) fontes.push(c.nome);
		}
	}
	// Ferimentos debilitantes acumulam entre si e com as condições (SaH p. 105).
	// Efeitos com flag bonusDados ({ vontade: 1 }) dão dados extras (ex.: Busca pessoal).
	const notas = n ? [`–${n}d (${[...new Set(fontes)].join(', ').toLowerCase()})`] : [];
	let feridas = 0; let bonus = 0;
	for (const e of actor.effects ?? []) {
		if (e.disabled) continue;
		const f = e.getFlag?.(SYSTEM_ID, 'ferimento');
		if (f && attr === f) feridas += 1;
		const da = e.getFlag?.(SYSTEM_ID, 'dadosAtributo');
		if (da && attr && da[attr]) feridas += da[attr];
		const b = e.getFlag?.(SYSTEM_ID, 'bonusDados');
		if (b && pericia && b[pericia]) bonus += b[pericia];
	}
	if (feridas) notas.push(`–${feridas}d (efeito)`);
	if (bonus) notas.push(`+${bonus}d (efeito)`);
	return { n: n + feridas - bonus, nota: notas.join(' · ') };
}

/** Deslocamento com condições (em metros, incrementos de 1,5m). */
export function deslocamentoComCondicoes(base, desloc) {
	if (desloc === 'zero') return 0;
	if (desloc === 'rastejar') return Math.min(base, 1.5);
	if (desloc === 'metade') return Math.floor(base / 2 / 1.5) * 1.5;
	return base;
}

/**
 * Morrendo, machucado e enlouquecendo entram e saem sozinhos.
 * Roda só no cliente que fez a alteração (ele tem permissão no ator).
 */
export function registrarCondicoesAutomaticas() {
	Hooks.on('updateActor', async (actor, changes, options, userId) => {
		if (userId !== game.user.id) return;
		const s = actor.system;
		const pv = actor.type === 'ameaca' ? s.pv : s.recursos?.pv;
		if (!pv) return;
		const pvMax = pv.max ?? 0;
		const tocouPV = foundry.utils.hasProperty(changes, actor.type === 'ameaca' ? 'system.pv' : 'system.recursos.pv');
		const tocouSAN = foundry.utils.hasProperty(changes, 'system.recursos.san');
		const quer = async (id, ativo) => {
			if (actor.statuses.has(id) === ativo) return;
			await actor.toggleStatusEffect(id, { active: ativo });
		};
		if (tocouPV && pvMax > 0) {
			if (actor.type === 'ameaca') await quer('dead', pv.valor <= 0);
			else await quer('morrendo', pv.valor <= 0);
			await quer('machucado', pv.valor > 0 && pv.valor <= Math.floor(pvMax / 2));
		}
		if (tocouSAN && actor.type === 'agente' && !s.semSanidade && s.recursos.san.max > 0) {
			await quer('enlouquecendo', s.recursos.san.valor <= 0);
		}
	});
}

export { SYSTEM_ID };
