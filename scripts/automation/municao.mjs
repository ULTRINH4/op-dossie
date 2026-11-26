/**
 * Munição (Livro de Regras, p. 59): um pacote dura um número de cenas, não importa quantos ataques.
 * Aqui "cena" é o combate em andamento. Com a regra opcional de contagem concreta (p. 174),
 * cada pacote tem 20 ataques e armas de fogo têm carregador.
 */
import { worldRules } from '../rules/table-rules.mjs';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const POR_PACOTE = 20;
/** Capacidade do carregador na contagem concreta (p. 174). */
const CAPACIDADE = { pistola: 12, revolver: 6, 'fuzil de caca': 4, submetralhadora: 20, espingarda: 6, 'fuzil de assalto': 30, 'fuzil de precisao': 1, metralhadora: 50 };

export function usaMunicao(arma) {
	return !!arma.system.municao && ['fogo', 'disparo'].includes(arma.system.tipo);
}

/** Pacote do inventário que serve na arma ("balas curtas" acha "Balas curtas"). */
export function pacoteDa(actor, arma) {
	const alvo = norm(arma.system.municao);
	const serve = (i) => i.type === 'equipamento' && (norm(i.name).startsWith(alvo) || norm(i.system.subtipo) === alvo || norm(i.name).includes(alvo));
	return actor.items.find(i => serve(i) && i.system.quantidade > 0) ?? actor.items.find(serve) ?? null;
}

/** Cenas que um pacote dura; itens antigos sem o campo usam o livro (balas curtas: 2; demais: 1). */
function cenasDo(pacote) {
	return pacote.system.municao?.cenas || (/^balas curtas/.test(norm(pacote.name)) ? 2 : 1);
}

function capacidade(arma) {
	if (arma.system.carregador.max) return arma.system.carregador.max;
	const n = norm(arma.name);
	return Object.entries(CAPACIDADE).find(([k]) => n.startsWith(k))?.[1] ?? 0;
}

/**
 * Gasta a munição de um ataque.
 * @returns {Promise<{ok: boolean, nota: string}>} ok=false bloqueia o ataque (sem munição ou descarregada).
 */
export async function gastarMunicao(actor, arma) {
	const regras = worldRules();
	if (!usaMunicao(arma) || regras.automacao?.municao === false) return { ok: true, nota: '' };
	// Regra padrão: o pacote já foi contado nesta cena e vale até o fim dela.
	const cena = game.combat?.started ? game.combat.id : null;
	const padrao = !regras.opcionais?.municao && !/foguete/.test(norm(arma.system.municao));
	if (padrao && cena && arma.system.ultimaCena === cena) return { ok: true, nota: '' };
	const pacote = pacoteDa(actor, arma);
	const nome = arma.system.municao;
	if (!pacote || pacote.system.quantidade <= 0) {
		ui.notifications.warn(`${actor.name} está sem ${nome}.`);
		return { ok: false, nota: '' };
	}
	const p = pacote.system;

	// Foguete: um por ataque.
	if (/foguete/.test(norm(nome))) {
		await pacote.update({ 'system.quantidade': p.quantidade - 1 });
		return { ok: true, nota: `${pacote.name}: restam ${p.quantidade - 1}` };
	}

	// Contagem concreta: carregador e 20 ataques por pacote.
	if (regras.opcionais?.municao) {
		const cap = capacidade(arma);
		if (cap) {
			const c = arma.system.carregador;
			if (c.valor <= 0) {
				ui.notifications.warn(`${arma.name} está descarregada. Recarregue (ação de movimento).`);
				return { ok: false, nota: '' };
			}
			await arma.update({ 'system.carregador.valor': c.valor - 1, 'system.carregador.max': cap });
			return { ok: true, nota: `Carregador: ${c.valor - 1}/${cap}` };
		}
		return { ok: true, nota: await tirarDisparos(pacote, 1) };
	}

	// Regra padrão: o pacote conta a cena uma vez só.
	if (!cena) return { ok: true, nota: 'Fora de combate: munição não contada' };
	const cenas = cenasDo(pacote);
	const usadas = p.municao.usadas + 1;
	await arma.update({ 'system.ultimaCena': cena });
	if (usadas >= cenas) {
		await pacote.update({ 'system.quantidade': p.quantidade - 1, 'system.municao.usadas': 0 });
		return { ok: true, nota: `${pacote.name}: um pacote gasto nesta cena (restam ${p.quantidade - 1})` };
	}
	await pacote.update({ 'system.municao.usadas': usadas });
	return { ok: true, nota: `${pacote.name}: cena ${usadas} de ${cenas} deste pacote` };
}

async function tirarDisparos(pacote, n) {
	const p = pacote.system;
	let disparos = p.municao.disparos + n;
	let qtd = p.quantidade;
	while (disparos >= POR_PACOTE && qtd > 0) { disparos -= POR_PACOTE; qtd -= 1; }
	await pacote.update({ 'system.quantidade': qtd, 'system.municao.disparos': disparos });
	const restam = qtd > 0 ? qtd * POR_PACOTE - disparos : 0;
	return `${pacote.name}: ${restam} ataques restantes`;
}

/** Recarregar (contagem concreta): enche o carregador com o que houver nos pacotes. */
export async function recarregar(actor, arma) {
	const cap = capacidade(arma);
	const pacote = pacoteDa(actor, arma);
	if (!cap) return ui.notifications.info(`${arma.name} não usa carregador.`);
	if (!pacote || pacote.system.quantidade <= 0) return ui.notifications.warn(`${actor.name} está sem ${arma.system.municao}.`);
	const falta = cap - arma.system.carregador.valor;
	if (falta <= 0) return ui.notifications.info(`${arma.name} já está carregada.`);
	const p = pacote.system;
	const disponivel = p.quantidade * POR_PACOTE - p.municao.disparos;
	const pega = Math.min(falta, disponivel);
	await tirarDisparos(pacote, pega);
	await arma.update({ 'system.carregador.valor': arma.system.carregador.valor + pega, 'system.carregador.max': cap });
	ui.notifications.info(`${arma.name} recarregada (${arma.system.carregador.valor}/${cap}).`);
}

/** Texto curto para a ficha: "2 pacotes · cena 1/2" ou "carregador 5/6". */
export function resumoMunicao(actor, arma) {
	if (!usaMunicao(arma)) return '';
	const regras = worldRules();
	if (regras.automacao?.municao === false) return arma.system.municao;
	const pacote = pacoteDa(actor, arma);
	const qtd = pacote?.system.quantidade ?? 0;
	if (regras.opcionais?.municao && capacidade(arma)) return `${arma.system.carregador.valor}/${capacidade(arma)} · ${qtd} pct.`;
	if (!qtd) return 'sem munição';
	const cenas = cenasDo(pacote);
	return `${qtd} pct.${cenas > 1 ? ` · ${pacote.system.municao.usadas}/${cenas} cenas` : ''}`;
}
