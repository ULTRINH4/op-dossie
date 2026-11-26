/**
 * Usar poderes: gasta PE (ou PD), respeita "uma vez por cena/rodada/interlúdio" e manda o cartão para o chat.
 * Contadores voltam no fim do combate (cena), na virada de rodada e no botão Interlúdio do mestre.
 */
import { SYSTEM_ID, ELEMENTOS, EXECUCAO, TIPOS_PODER } from '../config.mjs';
import { modsCondicoes } from './condicoes.mjs';

export const LIMITES = { rodada: 'nesta rodada', cena: 'nesta cena', interludio: 'neste interlúdio', missao: 'nesta missão' };

export async function usarPoder(actor, item) {
	const s = item.system;
	const a = actor.system;
	const pool = a.semSanidade ? 'pd' : 'pe';
	const POOL = pool.toUpperCase();
	const extra = s.custo ? modsCondicoes(actor).custoExtra : 0;
	const custo = (s.custo || 0) + extra;
	const limitado = s.limite && s.usos.max > 0;
	if (limitado && s.usos.valor <= 0) {
		return ui.notifications.warn(`${item.name} já foi usado ${LIMITES[s.limite] ?? ''}.`);
	}
	if (custo && actor.type === 'agente') {
		const atual = actor.recursoDisponivel(pool);
		if (custo > atual) return ui.notifications.warn(`${actor.name} não tem ${POOL} suficiente (${atual}/${custo}).`);
		await actor.update(actor.gastoDe(pool, custo));
	}
	if (limitado) await item.update({ 'system.usos.valor': s.usos.valor - 1 });

	const TE = foundry.applications.ux.TextEditor.implementation;
	const texto = await TE.enrichHTML(s.descricao ?? '', { relativeTo: item });
	const el = s.elemento && ELEMENTOS[s.elemento] ? s.elemento : '';
	const meta = [TIPOS_PODER[s.tipo] ?? 'Poder', EXECUCAO[s.execucao]].filter(Boolean).join(' · ');
	const restam = limitado ? `<p class="op-chatcard__limit">Restam ${s.usos.valor - 1}/${s.usos.max} ${LIMITES[s.limite] ?? ''}</p>` : '';
	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor, token: actor.token }),
		content: `<div class="op-dossie op-chatcard ${el ? `op-el--${el}` : ''}">
			<header class="op-chatcard__head"><img src="${item.img}" alt="">
				<div><p class="op-chatcard__eyebrow">${meta}</p><h3>${item.name}</h3></div>
				${custo ? `<span class="op-chatcard__cost">−${custo} ${POOL}</span>` : ''}</header>
			${extra ? '<p class="op-cond-note">+1 de custo (alquebrado)</p>' : ''}
			<div class="op-chatcard__text">${texto}</div>${restam}</div>`,
		flags: { [SYSTEM_ID]: { poder: { itemId: item.id, elemento: el, custo } } }
	});
}

/** Devolve os usos dos poderes com os limites dados. */
export async function zerarUsos(actors, limites) {
	for (const actor of actors) {
		const upd = actor.items.filter(i => i.type === 'poder' && limites.includes(i.system.limite) && i.system.usos.valor < i.system.usos.max)
			.map(i => ({ _id: i.id, 'system.usos.valor': i.system.usos.max }));
		if (upd.length) await actor.updateEmbeddedDocuments('Item', upd);
	}
}

const atoresDoCombate = (combat) => [...new Set(combat.combatants.map(c => c.actor).filter(Boolean))];

/** Interlúdio: zera os contadores de cena, rodada e interlúdio de todos os personagens. */
export async function interludio() {
	const atores = new Set(game.actors.filter(a => a.type === 'agente'));
	for (const t of canvas?.scene?.tokens ?? []) if (t.actor) atores.add(t.actor);
	await zerarUsos([...atores], ['rodada', 'cena', 'interludio']);
	await ChatMessage.create({
		content: '<div class="op-dossie op-chatcard"><header class="op-chatcard__head"><img src="icons/svg/tankard.svg" alt=""><div><p class="op-chatcard__eyebrow">Mestre</p><h3>Interlúdio</h3></div></header><div class="op-chatcard__text"><p>Poderes de uma vez por cena e por interlúdio estão disponíveis de novo.</p></div></div>'
	});
}

export function registrarPoderes() {
	// Fim do combate = fim da cena. Só o mestre ativo faz as alterações.
	Hooks.on('deleteCombat', (combat) => {
		if (game.user.isActiveGM) zerarUsos(atoresDoCombate(combat), ['rodada', 'cena']);
	});
	Hooks.on('updateCombat', (combat, changes) => {
		if (game.user.isActiveGM && 'round' in changes) zerarUsos(atoresDoCombate(combat), ['rodada']);
	});
	// Botão Interlúdio no rastreador de combate (só mestre).
	Hooks.on('renderCombatTracker', (app, html) => {
		if (!game.user.isGM || html.querySelector('.op-interludio')) return;
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'op-interludio';
		btn.innerHTML = '<i class="fa-solid fa-mug-hot" aria-hidden="true"></i> Interlúdio';
		btn.dataset.tooltip = 'Devolve os usos de poderes de uma vez por cena e por interlúdio';
		btn.addEventListener('click', () => interludio());
		(html.querySelector('.combat-tracker-header') ?? html.querySelector('header') ?? html).append(btn);
	});
}
