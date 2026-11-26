/**
 * Regras de turno e as regras opcionais que dependem delas.
 * - Morrendo / enlouquecendo: conta os turnos iniciados na condição durante a cena (o combate);
 *   no terceiro, morre / fica insano (OPRPG pp. 88 e 310).
 * - Dano massivo (OPRPG p. 88): dano ≥ metade dos PV sem zerar pede Fortitude (DT 15 +2 por 10 de dano).
 * - Lesões (OPRPG p. 174), Inspiração Resoluta (pp. 174–175), Loucura não letal (p. 175) e
 *   Ferimentos Debilitantes (SaH p. 105), quando ligadas nas Regras da Mesa.
 * Testes do personagem viram um botão no chat para quem controla o personagem (ou o mestre).
 * Quem aplica o efeito é quem aperta o botão, que tem permissão no ator.
 */
import { SYSTEM_ID, ATRIBUTOS, PERICIAS } from '../config.mjs';
import { worldRules } from '../rules/table-rules.mjs';
import { rolarTeste, dadoMantido } from '../dice/testes.mjs';
import { CONDICOES, penalidadeDados } from './condicoes.mjs';
import { ATR_D6, INSANIDADE, INSPIRACAO, inspiracaoPorDado } from '../rules/opcionais-dados.mjs';

const regra = (id) => !!worldRules().opcionais?.[id];
const esc = (t) => foundry.utils.escapeHTML(String(t ?? ''));
const nomeAtr = (k) => ATRIBUTOS[k]?.nome ?? '';

/* --- mensagens ------------------------------------------------------------- */

function cartao({ img = 'icons/svg/d20-grey.svg', eyebrow, titulo, texto, extra = '' }) {
	return `<div class="op-dossie op-chatcard op-regra">
		<header class="op-chatcard__head"><img src="${img}" alt=""><div>${eyebrow ? `<p class="op-chatcard__eyebrow">${esc(eyebrow)}</p>` : ''}<h3>${esc(titulo)}</h3></div></header>
		${texto ? `<div class="op-chatcard__text">${texto}</div>` : ''}${extra}</div>`;
}

export async function aviso(actor, { img, eyebrow, titulo, texto, flags = {} }) {
	return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: cartao({ img, eyebrow, titulo, texto }), flags: { [SYSTEM_ID]: flags } });
}

/**
 * Cartão com um teste que o personagem precisa fazer (botão para o dono).
 * tipo: 'massivo' | 'lesao' | 'inspiracao'. O resultado vai na própria rolagem (flag respostaDe).
 */
export async function cartaoTeste(actor, { tipo, img, eyebrow, titulo, texto, rotulo, pericia = null, atributo = null, dt = null, dado = null, extra = {} }) {
	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: cartao({ img, eyebrow, titulo, texto, extra: `<div class="op-chatcard__btns" data-op-pendente-area><button type="button" class="op-btn-roll" data-op-pendente><i class="fa-solid fa-dice-d20" aria-hidden="true"></i> ${esc(rotulo)}</button></div>` }),
		flags: { [SYSTEM_ID]: { pendente: { tipo, actor: actor.uuid, pericia, atributo, dt, dado, ...extra } } }
	});
}

/** Teste do agente (perícia ou atributo), com penalidades de condição e ferimentos. */
async function testeDoAtor(actor, { pericia, atributo, dt, titulo, event, extraFlags }) {
	if (pericia) {
		const c = actor.system.periciasCalc?.[pericia];
		const pen = penalidadeDados(actor, { pericia });
		return rolarTeste({ actor, dados: (c?.dados ?? 1) - pen.n, bonus: c?.total ?? 0, titulo, event, dt, nota: pen.nota, extraFlags });
	}
	const valor = actor.system.atributos?.[atributo]?.valor ?? 0;
	const pen = penalidadeDados(actor, { atributo });
	return rolarTeste({ actor, dados: valor - pen.n, bonus: 0, titulo, event, dt, nota: pen.nota, extraFlags });
}

/* --- efeitos que ficam na ficha (aba Efeitos) ------------------------------ */

async function criarEfeito(actor, { name, img, description, changes = [], flags = {} }) {
	const [e] = await actor.createEmbeddedDocuments('ActiveEffect', [{ name, img, description, changes, flags: { [SYSTEM_ID]: flags } }]);
	return e;
}

/** Ferimento debilitante: 1d6 escolhe o atributo; fica como efeito até ser curado (SaH p. 105). */
export async function ferimentoDebilitante(actor) {
	const r = await new Roll('1d6').evaluate();
	const k = ATR_D6[r.total - 1];
	if (!k) return { texto: `1d6 = ${r.total}: ferimento superficial, nenhum atributo afetado.` };
	await criarEfeito(actor, {
		name: `Ferimento debilitante: ${nomeAtr(k)}`, img: 'icons/svg/blood.svg',
		description: `<p>–1 dado em testes de ${nomeAtr(k)}${k === 'vig' ? ' e –1 PV máximo por 5% de NEX (ou por nível)' : ''}. Curar: alguém treinado em Medicina gasta uma ação de interlúdio e passa em Medicina DT 20; o ferimento some na próxima vez que dormir no interlúdio. Remova este efeito quando curar.</p>`,
		flags: { ferimento: k }
	});
	return { texto: `1d6 = ${r.total}: <strong>ferimento debilitante em ${nomeAtr(k)}</strong> (–1 dado nos testes${k === 'vig' ? ', –1 PV máximo por 5% de NEX' : ''}).` };
}

/* --- resolução dos testes pendentes ---------------------------------------- */

const RESOLVER = {
	/** Dano massivo: falhou → 0 PV, ou ferimento debilitante com a regra ligada. */
	async massivo(actor, ok) {
		if (ok) return 'Aguentou o golpe.';
		if (regra('ferimentosDebilitantes')) {
			const f = await ferimentoDebilitante(actor);
			return `Falhou. Em vez de cair, sofre um ferimento. ${f.texto}`;
		}
		await actor.update({ 'system.recursos.pv.valor': 0 });
		return 'Falhou: cai a 0 PV (inconsciente e morrendo).';
	},
	/** Lesão: falhou → −1 permanente num atributo sorteado. */
	async lesao(actor, ok) {
		if (ok) return 'Resistiu: nenhuma lesão.';
		const r = await new Roll('1d6').evaluate();
		const k = ATR_D6[r.total - 1];
		if (!k) return `Falhou, mas 1d6 = ${r.total}: nenhum atributo perdido.`;
		const v = actor.system.atributos[k].valor;
		await actor.update({ [`system.atributos.${k}.valor`]: Math.max(v - 1, 0) });
		return `Falhou. 1d6 = ${r.total}: <strong>${nomeAtr(k)} cai de ${v} para ${Math.max(v - 1, 0)}</strong> para sempre.`;
	}
};

/* --- turnos: morrendo, enlouquecendo, inspiração ---------------------------- */

async function contarTurno(actor, combat) {
	const cena = foundry.utils.deepClone(actor.getFlag(SYSTEM_ID, 'cena') ?? {});
	if (cena.combate !== combat.id) Object.assign(cena, { combate: combat.id, morrendo: 0, enlouquecendo: 0 });
	const st = actor.statuses;
	const morto = st.has('dead');
	if (st.has('morrendo') && !morto) {
		cena.morrendo += 1;
		const n = cena.morrendo;
		if (n >= 3) {
			await actor.setFlag(SYSTEM_ID, 'cena', cena);
			await actor.toggleStatusEffect('dead', { active: true, overlay: true });
			const insp = regra('inspiracaoResoluta');
			if (insp) await actor.setFlag(SYSTEM_ID, 'inspiracao', { combate: combat.id });
			return aviso(actor, { img: 'icons/svg/skull.svg', eyebrow: 'Morrendo · 3 de 3', titulo: `${actor.name} morre`,
				texto: `<p>Terceiro turno morrendo nesta cena.</p>${insp ? '<p><strong>Inspiração Resoluta:</strong> no início de cada rodada até o fim da cena, quem jogava com este agente rola 1d10 e dá o bônus a outro personagem.</p>' : ''}` });
		}
		await aviso(actor, { img: 'icons/svg/degen.svg', eyebrow: `Morrendo · ${n} de 3`, titulo: `${actor.name} começa o turno morrendo`,
			texto: `<p>${n === 2 ? 'Mais um turno morrendo nesta cena e o agente morre.' : 'No terceiro turno morrendo nesta cena, o agente morre.'} Estabilizar: Medicina DT 20.</p>` });
		if (n === 2 && regra('lesoes')) {
			await cartaoTeste(actor, { tipo: 'lesao', img: 'icons/svg/bones.svg', eyebrow: 'Regra opcional · Lesões', titulo: 'Teste contra lesão',
				texto: '<p>Segundo turno morrendo nesta cena: Vigor DT 10. Se falhar, perde 1 ponto de um atributo para sempre (1d6).</p>', rotulo: 'Rolar Vigor (DT 10)', atributo: 'vig', dt: 10 });
		}
	}
	if (st.has('enlouquecendo') && !actor.getFlag(SYSTEM_ID, 'insano')) {
		cena.enlouquecendo += 1;
		const n = cena.enlouquecendo;
		if (n >= 3) {
			await actor.setFlag(SYSTEM_ID, 'cena', cena);
			return ficarInsano(actor);
		}
		await aviso(actor, { img: 'icons/svg/portal.svg', eyebrow: `Enlouquecendo · ${n} de 3`, titulo: `${actor.name} começa o turno enlouquecendo`,
			texto: `<p>${n === 2 ? 'Mais um turno enlouquecendo nesta cena e a mente sucumbe.' : 'No terceiro turno enlouquecendo nesta cena, fica insano.'} Acalmar: Diplomacia DT 20 (+5 por vez na cena) ou recuperar 1 SAN.</p>` });
	}
	await actor.setFlag(SYSTEM_ID, 'cena', cena);
}

/** Insano: vira NPC do mestre, ou sorteia um efeito com Loucura não letal. */
export async function ficarInsano(actor) {
	await actor.setFlag(SYSTEM_ID, 'insano', true);
	if (!regra('loucuraNaoLetal')) {
		return aviso(actor, { img: 'icons/svg/terror.svg', eyebrow: 'Enlouquecendo · 3 de 3', titulo: `${actor.name} fica insano`,
			texto: '<p>A mente sucumbe à loucura: o agente passa a ser um NPC sob controle do mestre.</p>' });
	}
	const r = await new Roll('1d6').evaluate();
	const ef = INSANIDADE[r.total - 1];
	await criarEfeito(actor, { name: `Insano: ${ef.nome}`, img: 'icons/svg/terror.svg', description: `<p>${ef.texto}</p><p>Severo e irreversível (Loucura não letal, OPRPG p. 175).</p>`, flags: { insanidade: ef.id } });
	return aviso(actor, { img: 'icons/svg/terror.svg', eyebrow: `Loucura não letal · 1d6 = ${r.total}`, titulo: `${actor.name} fica insano: ${ef.nome}`,
		texto: `<p>${ef.texto}</p><p>O jogador continua com o agente, que tem a chance de um último ato heroico.</p>` });
}

/** Início de rodada: quem morreu nesta cena (com Inspiração Resoluta) rola o 1d10. */
async function inspiracoes(combat) {
	if (!regra('inspiracaoResoluta')) return;
	for (const c of combat.combatants) {
		const a = c.actor;
		if (!a || a.type !== 'agente' || a.getFlag(SYSTEM_ID, 'inspiracao')?.combate !== combat.id) continue;
		await cartaoTeste(a, { tipo: 'inspiracao', img: 'icons/svg/angel.svg', eyebrow: 'Regra opcional · Inspiração Resoluta', titulo: `A memória de ${a.name}`,
			texto: '<p>Role 1d10 e dê o bônus a outro personagem.</p>', rotulo: 'Rolar 1d10', dado: '1d10', extra: { combate: combat.id } });
	}
}

/** Aplica o bônus da Inspiração Resoluta no alvo (quem aperta tem permissão no alvo). */
export async function aplicarInspiracao(alvo, id, de, { origem = null } = {}) {
	const ef = INSPIRACAO.find(i => i.id === id);
	if (!ef || !alvo) return;
	const fim = { fimDaCena: true, inspiracao: id };
	let detalhe = ef.texto;
	if (id === 'odio') await criarEfeito(alvo, { name: `Inspiração: ${ef.nome}`, img: 'icons/svg/fire.svg', description: `<p>${ef.texto}</p>`, flags: fim, changes: [{ key: 'system.atributos.for.valor', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: '2' }] });
	else if (id === 'luto') await criarEfeito(alvo, { name: `Inspiração: ${ef.nome}`, img: 'icons/svg/aura.svg', description: `<p>${ef.texto}</p>`, flags: fim, changes: [{ key: 'system.resistencias.mental', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: '10' }] });
	else if (id === 'vinganca') await criarEfeito(alvo, { name: `Inspiração: ${ef.nome}`, img: 'icons/svg/sword.svg', description: `<p>+5 em ataques contra quem matou ${esc(de)}, até o fim da cena.</p>`, flags: fim });
	else if (id === 'resoluto') {
		const pv = await new Roll('4d8+4').evaluate();
		const pe = await new Roll('2d6').evaluate();
		const k = alvo.system.semSanidade ? 'pd' : 'pe';
		const r = alvo.system.recursos;
		await alvo.update({ 'system.recursos.pv.valor': Math.min(r.pv.valor + pv.total, r.pv.max), [`system.recursos.${k}.valor`]: Math.min(r[k].valor + pe.total, r[k].max) });
		detalhe = `Recupera ${pv.total} PV (4d8+4) e ${pe.total} ${k.toUpperCase()} (2d6).`;
	} else if (id === 'selvagem') {
		const paralisia = CONDICOES.filter(c => c.tipo === 'paralisia').map(c => c.id);
		for (const s of paralisia) if (alvo.statuses.has(s)) await alvo.toggleStatusEffect(s, { active: false });
		detalhe = 'Efeitos de paralisia terminam; ganha uma ação padrão adicional no próximo turno.';
	}
	return aviso(alvo, { img: 'icons/svg/angel.svg', eyebrow: `Inspiração Resoluta · por ${de}`, titulo: `${alvo.name}: ${ef.nome}`, texto: `<p>${detalhe}</p>`, flags: origem ? { inspiracaoDe: origem } : {} });
}

/** Fim da cena (combate encerrado): limpa contadores e efeitos "até o fim da cena". */
async function fimDaCena(combat) {
	for (const c of combat.combatants) {
		const a = c.actor;
		if (!a) continue;
		if (a.getFlag(SYSTEM_ID, 'cena')) await a.unsetFlag(SYSTEM_ID, 'cena');
		if (a.getFlag(SYSTEM_ID, 'inspiracao')) await a.unsetFlag(SYSTEM_ID, 'inspiracao');
		const fim = a.effects.filter(e => e.getFlag(SYSTEM_ID, 'fimDaCena')).map(e => e.id);
		if (fim.length) await a.deleteEmbeddedDocuments('ActiveEffect', fim);
	}
}

/* --- dano massivo ----------------------------------------------------------- */

/** Chamado pelo aplicarDano do agente. */
export async function verificarDanoMassivo(actor, dano, pvDepois) {
	const max = actor.system.recursos.pv.max;
	if (!max || dano < Math.ceil(max / 2) || pvDepois <= 0) return;
	const dt = 15 + 2 * Math.floor(dano / 10);
	await cartaoTeste(actor, {
		tipo: 'massivo', img: 'icons/svg/explosion.svg', eyebrow: 'Dano massivo', titulo: `${actor.name} sofre ${dano} de uma vez`,
		texto: `<p>Metade ou mais dos PV num só golpe: Fortitude DT ${dt}. Se falhar, ${regra('ferimentosDebilitantes') ? 'sofre um ferimento debilitante (Ferimentos Debilitantes).' : 'cai a 0 PV.'}</p>`,
		rotulo: `Rolar Fortitude (DT ${dt})`, pericia: 'fortitude', dt
	});
}

/* --- botões dos cartões ------------------------------------------------------ */

const respostaDe = (card) => game.messages.contents.findLast(m => m.getFlag(SYSTEM_ID, 'respostaDe') === card.id) ?? null;

function renderPendente(message, html) {
	const p = message.getFlag(SYSTEM_ID, 'pendente');
	const area = html.querySelector('[data-op-pendente-area]');
	if (!p || !area) return;
	const actor = fromUuidSync(p.actor);
	const resp = respostaDe(message);
	if (resp) {
		const res = resp.getFlag(SYSTEM_ID, 'resultado');
		if (p.tipo === 'inspiracao') return renderInspiracao(message, area, actor, resp);
		area.innerHTML = `<div class="op-card__test ${resp.getFlag(SYSTEM_ID, 'ok') ? 'is-ok' : 'is-fail'}"><span>${res ?? 'Rolado.'}</span></div>`;
		return;
	}
	const btn = area.querySelector('[data-op-pendente]');
	if (!actor?.isOwner) { btn.disabled = true; btn.classList.add('is-locked'); btn.title = `Só quem controla ${actor?.name ?? 'o personagem'} (ou o mestre) rola isto.`; return; }
	btn.addEventListener('click', async (ev) => {
		ev.preventDefault();
		if (respostaDe(message)) return;
		btn.disabled = true;
		try {
			if (p.tipo === 'inspiracao') {
				const r = await new Roll(p.dado).evaluate();
				const ef = inspiracaoPorDado(r.total);
				await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `<span class="op-flavor">Inspiração Resoluta · ${ef.nome}</span>`,
					flags: { [SYSTEM_ID]: { respostaDe: message.id, inspiracao: ef.id, resultado: `${r.total}: ${ef.nome}` } } });
				return;
			}
			const titulo = { massivo: 'Dano massivo (Fortitude)', lesao: 'Lesão (Vigor)' }[p.tipo] ?? 'Teste';
			const roll = await testeDoAtor(actor, { pericia: p.pericia, atributo: p.atributo, dt: p.dt, titulo, event: ev, extraFlags: { respostaDe: message.id } });
			if (!roll) { btn.disabled = false; return; }
			const ok = roll.total >= p.dt;
			const texto = await RESOLVER[p.tipo]?.(actor, ok, roll);
			const msg = respostaDe(message);
			await msg?.update({ [`flags.${SYSTEM_ID}.resultado`]: `${ok ? 'Sucesso' : 'Falha'} (${roll.total} contra DT ${p.dt}). ${texto ?? ''}`, [`flags.${SYSTEM_ID}.ok`]: ok });
		} catch (err) {
			console.error(`${SYSTEM_ID} | teste pendente`, err);
			btn.disabled = false;
		}
	});
}

/** Depois do 1d10: botões "Dar para" com os outros agentes da cena. */
function renderInspiracao(message, area, morto, resp) {
	const id = resp.getFlag(SYSTEM_ID, 'inspiracao');
	const ef = INSPIRACAO.find(i => i.id === id);
	// "Dar para" fica na rolagem do 1d10, que é de quem jogava com o agente.
	const dado = resp.getFlag(SYSTEM_ID, 'dadoPara');
	if (dado) { area.innerHTML = `<div class="op-card__test is-ok"><span>${esc(resp.getFlag(SYSTEM_ID, 'resultado'))} → ${esc(dado)}</span></div>`; return; }
	const combat = game.combats.get(message.getFlag(SYSTEM_ID, 'pendente').combate) ?? game.combat;
	const vivos = [...(combat?.combatants ?? [])].map(c => c.actor).filter(a => a && a.type === 'agente' && a.id !== morto?.id && !a.statuses.has('dead'));
	const pode = morto?.isOwner;
	area.innerHTML = `<p class="op-step__hint">${esc(resp.getFlag(SYSTEM_ID, 'resultado'))}: ${esc(ef?.texto)}</p>`
		+ (vivos.length ? vivos.map(a => `<button type="button" class="op-btn-roll" data-op-dar="${a.uuid}" ${pode ? '' : 'disabled title="Só quem jogava com o agente escolhe."'}><i class="fa-solid fa-hand-holding-heart" aria-hidden="true"></i> Dar para ${esc(a.name)}</button>`).join('') : '<p class="op-step__hint">Nenhum outro agente na cena.</p>');
	for (const b of area.querySelectorAll('[data-op-dar]')) {
		b.addEventListener('click', async () => {
			const alvo = fromUuidSync(b.dataset.opDar);
			if (!alvo) return;
			for (const x of area.querySelectorAll('button')) x.disabled = true;
			// O dono do morto escolhe; quem tem permissão no alvo aplica. Sem permissão, o cartão pede ao dono do alvo.
			if (alvo.isOwner) await aplicarInspiracao(alvo, id, morto?.name ?? '');
			else {
				await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: alvo }),
					content: cartao({ img: 'icons/svg/angel.svg', eyebrow: `Inspiração Resoluta · de ${morto?.name}`, titulo: `${alvo.name} recebe: ${ef.nome}`, texto: `<p>${ef.texto}</p>`,
						extra: `<div class="op-chatcard__btns"><button type="button" class="op-btn-roll" data-op-receber>Receber</button></div>` }),
					flags: { [SYSTEM_ID]: { receber: { alvo: alvo.uuid, id, de: morto?.name ?? '' } } } });
			}
			if (resp.isOwner) await resp.setFlag(SYSTEM_ID, 'dadoPara', alvo.name);
		});
	}
}

function renderReceber(message, html) {
	const r = message.getFlag(SYSTEM_ID, 'receber');
	const b = html.querySelector('[data-op-receber]');
	if (!r || !b) return;
	if (game.messages.some(m => m.getFlag(SYSTEM_ID, 'inspiracaoDe') === message.id)) { b.closest('.op-chatcard__btns').innerHTML = '<div class="op-card__test is-ok"><span>Recebido.</span></div>'; return; }
	const alvo = fromUuidSync(r.alvo);
	if (!alvo?.isOwner) { b.disabled = true; b.title = `Só quem controla ${alvo?.name ?? 'o alvo'} (ou o mestre) recebe.`; return; }
	b.addEventListener('click', async () => {
		b.disabled = true;
		await aplicarInspiracao(alvo, r.id, r.de, { origem: message.id });
	});
}

/* --- registro ---------------------------------------------------------------- */

export function registrarRegrasDeTurno() {
	Hooks.on('updateCombat', async (combat, changes, options) => {
		if (!game.user.isActiveGM || !combat.started) return;
		if (!('turn' in changes) && !('round' in changes)) return;
		if ((options?.direction ?? 1) < 0) return;
		try {
			if ('round' in changes) await inspiracoes(combat);
			const actor = combat.combatant?.actor;
			if (actor?.type === 'agente') await contarTurno(actor, combat);
		} catch (err) { console.error(`${SYSTEM_ID} | início de turno`, err); }
	});
	Hooks.on('deleteCombat', (combat) => { if (game.user.isActiveGM) fimDaCena(combat).catch(err => console.error(`${SYSTEM_ID} | fim da cena`, err)); });
	Hooks.on('renderChatMessageHTML', (message, html) => {
		renderPendente(message, html);
		renderReceber(message, html);
	});
	// Rolagem de resposta chegou ou mudou: redesenha o cartão do teste.
	const redesenhar = (m) => {
		for (const k of ['respostaDe', 'inspiracaoDe']) {
			const card = game.messages.get(m.getFlag(SYSTEM_ID, k));
			if (card) ui.chat?.updateMessage?.(card);
		}
	};
	Hooks.on('createChatMessage', redesenhar);
	Hooks.on('updateChatMessage', redesenhar);
}

export const _teste = { contarTurno, ficarInsano, ferimentoDebilitante, verificarDanoMassivo, aplicarInspiracao, fimDaCena, inspiracoes };
