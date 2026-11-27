/**
 * Presença Perturbadora: quem vê a criatura testa Vontade contra a DT; quem falha sofre o dano mental.
 * Personagens com NEX igual ou maior que o indicado são imunes.
 * O cartão sai sozinho no início do combate e quando o mestre revela um token escondido (uma vez por
 * criatura em cada cena) e também pelo botão da ficha da ameaça. Nada rola sozinho: cada jogador
 * clica em Resistir no próprio cartão.
 */
import { SYSTEM_ID } from '../config.mjs';
import { atorDoAlvo, nomeDoAlvo } from './alvos.mjs';

const esc = (t) => foundry.utils.escapeHTML(String(t ?? ''));
const chaveFlag = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_');

export function registrarConfigPresenca() {
	game.settings.register(SYSTEM_ID, 'presencaAutomatica', {
		name: 'Presença Perturbadora automática',
		hint: 'Manda o cartão do teste de Vontade quando o combate começa ou quando o mestre revela uma criatura com Presença Perturbadora (uma vez por criatura em cada cena).',
		scope: 'world', config: true, type: Boolean, default: true
	});
}

const temPresenca = (actor) => actor?.type === 'ameaca' && (actor.system.presencaPerturbadora?.dt ?? 0) > 0;

/** NEX do agente (personagens sem NEX, como no sistema de Patentes, não ficam imunes). */
const nexDe = (actor) => actor?.system?.progressao?.nex ?? 0;

/** Agentes na cena que podem ver a criatura: tokens de agente visíveis. */
function agentesNaCena(scene = canvas?.scene) {
	const vistos = new Set();
	return (scene?.tokens ?? []).filter(t => t.actor?.type === 'agente' && !t.hidden && !vistos.has(t.actor.id) && vistos.add(t.actor.id));
}

/**
 * Manda o cartão da Presença Perturbadora de uma criatura.
 * @param {Actor} actor  a ameaça
 * @param {TokenDocument[]} [tokens]  tokens da criatura na cena (marcados para não repetir)
 */
export async function pedirPresenca(actor, tokens = []) {
	if (!temPresenca(actor)) return ui.notifications.warn(`${actor?.name ?? 'Esta ameaça'} não tem Presença Perturbadora.`);
	const pp = actor.system.presencaPerturbadora;
	const alvos = agentesNaCena().map(t => ({ uuid: t.uuid, nome: t.name, img: t.texture?.src ?? t.actor.img, imune: pp.nexImune > 0 && nexDe(t.actor) >= pp.nexImune }));
	for (const t of tokens) if (t.isOwner) await t.setFlag(SYSTEM_ID, 'presencaVista', true);
	const lista = alvos.length
		? `<ul class="op-targets">${alvos.map(a => `<li class="op-target" data-alvo="${a.uuid}" data-imune="${a.imune ? 1 : 0}"><img src="${esc(a.img)}" alt=""><span class="op-target__name">${esc(a.nome)}</span></li>`).join('')}</ul>`
		: '<p class="op-step__hint">Nenhum agente na cena. Quem vir a criatura depois testa pelo botão da ficha dela.</p>';
	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<div class="op-dossie op-chatcard op-presenca">
			<header class="op-chatcard__head"><img src="${esc(actor.img)}" alt=""><div><p class="op-chatcard__eyebrow">Presença Perturbadora</p><h3>${esc(actor.name)}</h3></div></header>
			<p class="op-presenca__regra">Vontade <strong>DT ${pp.dt}</strong> · falha: <strong>${esc(pp.dano)}</strong> de dano mental${pp.nexImune ? ` · NEX ${pp.nexImune}%+ é imune` : ''}</p>
			${lista}</div>`,
		flags: { [SYSTEM_ID]: { presenca: { ator: actor.uuid, dt: pp.dt, dano: pp.dano, nexImune: pp.nexImune, alvos: alvos.map(a => a.uuid) } } }
	});
}

/** Rola a Vontade de um agente contra a Presença; se falhar, rola e aplica o dano mental. */
async function resistir(card, uuid, botao) {
	const info = card.getFlag(SYSTEM_ID, 'presenca');
	const ator = atorDoAlvo(uuid);
	if (!ator?.isOwner) return ui.notifications.warn(`Só quem controla ${nomeDoAlvo(uuid) ?? 'o agente'} (ou o mestre) resiste.`);
	botao.disabled = true;
	const { formulaTeste } = await import('../dice/testes.mjs');
	const { mostrarDados, gravarNoCartao } = await import('../dice/no-cartao.mjs');
	const t = ator.dadosTeste('vontade') ?? { dados: 1, bonus: 0 };
	const roll = await new Roll(formulaTeste(t.dados, t.bonus), ator.getRollData()).evaluate();
	await mostrarDados(roll);
	const ok = roll.total >= info.dt;
	let dano = 0;
	if (!ok && info.dano) {
		const r = await new Roll(info.dano).evaluate();
		await mostrarDados(r);
		dano = r.total;
		await ator.aplicarDano(dano, 'mental');
	}
	await gravarNoCartao(card, `presenca.${chaveFlag(uuid)}`, { uuid, total: roll.total, ok, dano });
}

function renderCartao(message, html) {
	const info = message.getFlag(SYSTEM_ID, 'presenca');
	if (!info) return;
	html.classList.add('op-dossie', 'op-msg');
	const res = message.getFlag(SYSTEM_ID, 'resultados')?.presenca ?? {};
	for (const li of html.querySelectorAll('.op-target[data-alvo]')) {
		const uuid = li.dataset.alvo;
		const r = res[chaveFlag(uuid)];
		if (r) {
			li.insertAdjacentHTML('beforeend', `<span class="op-target__state ${r.ok ? 'is-hit' : 'is-miss'}">Vontade ${r.total} · ${r.ok ? 'resistiu' : `falhou · −${r.dano} mental`}</span>`);
			continue;
		}
		if (li.dataset.imune === '1') { li.insertAdjacentHTML('beforeend', '<span class="op-target__state is-hit">imune (NEX)</span>'); continue; }
		const ator = atorDoAlvo(uuid);
		const b = document.createElement('button');
		b.type = 'button'; b.className = 'op-target__btn';
		b.textContent = 'Resistir';
		if (!ator?.isOwner) { b.disabled = true; b.classList.add('is-locked'); b.title = `Só quem controla ${nomeDoAlvo(uuid) ?? 'o agente'} (ou o mestre) resiste.`; }
		b.addEventListener('click', (ev) => { ev.preventDefault(); resistir(message, uuid, b).catch(err => { console.error(err); b.disabled = false; }); });
		li.append(b);
	}
}

/** Criaturas com Presença entre os tokens dados, agrupadas por ator (cinco zumbis = um cartão). */
async function anunciar(tokens) {
	if (!game.user.isActiveGM || !game.settings.get(SYSTEM_ID, 'presencaAutomatica')) return;
	const porAtor = new Map();
	for (const t of tokens) {
		if (!t || t.hidden || t.getFlag(SYSTEM_ID, 'presencaVista') || !temPresenca(t.actor)) continue;
		const chave = t.actorLink ? t.actorId : `${t.actorId}:${t.actor.name}`;
		if (!porAtor.has(chave)) porAtor.set(chave, { actor: t.actor, tokens: [] });
		porAtor.get(chave).tokens.push(t);
	}
	for (const { actor, tokens: ts } of porAtor.values()) await pedirPresenca(actor, ts);
}

export function registrarPresenca() {
	Hooks.on('renderChatMessageHTML', renderCartao);
	// Início do combate: as criaturas visíveis.
	Hooks.on('combatStart', (combat) => anunciar(combat.combatants.map(c => c.token)).catch(err => console.error(`${SYSTEM_ID} | presença`, err)));
	// Mestre revela um token escondido.
	Hooks.on('updateToken', (doc, changes) => { if (changes.hidden === false) anunciar([doc]).catch(err => console.error(`${SYSTEM_ID} | presença`, err)); });
}
