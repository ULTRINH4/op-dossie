/**
 * Dado de uso (regra da casa, opcional nas Regras da Mesa).
 * O item tem um dado: d12 → d10 → d8 → d6 → d4. Depois de usar, rola; 1 ou 2 desce um degrau.
 * Se o d4 cai em 1 ou 2, aquela unidade acaba: a quantidade baixa e a próxima começa no dado inicial.
 * Munição rola no fim de cada combate, uma vez por arma usada (fora de combate, logo após o ataque).
 * Os demais itens rolam ao serem usados.
 */
import { SYSTEM_ID } from '../config.mjs';
import { worldRules } from '../rules/table-rules.mjs';

export const ESCADA = [12, 10, 8, 6, 4];
const PADRAO = { municao: 10, medico: 6, gasto: 8, outro: 8 };
const NOME_TIPO = { municao: 'munição', medico: 'item médico', gasto: 'item de gasto', outro: 'item' };

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const RE_MUNICAO = /^(balas|cartucho|flecha|virote|dardo|caixa de dardos|caixa de cargas|combustivel|municao|pente)/;
const RE_MEDICO = /cicatrizante|antibiot|antidoto|antiemet|anti-?histamin|anti-?inflamat|antitermic|broncodilat|coagulante|medicament|curativo|primeiros socorros|analgesic|morfina|bandage|kit de medicina|soro/;
const RE_GASTO = /componentes ritualistic|bateria|galao|isqueiro|spray|alimento|racao|fosforo|vela|pilha|fita adesiva|sinalizador(?!a)/;

export function regraAtiva() {
	return !!worldRules().opcionais?.dadoDeUso;
}

/** Tipo do item para a regra: municao | medico | gasto | null (não usa por padrão). */
export function tipoDoItem(item) {
	if (item?.type !== 'equipamento') return null;
	const s = item.system;
	const nome = norm(item.name);
	const sub = norm(s.subtipo);
	if (/foguete/.test(nome)) return null;
	if (s.municao?.cenas > 0 || /municao/.test(sub) || RE_MUNICAO.test(nome)) return 'municao';
	if (RE_MEDICO.test(nome) || /medic/.test(sub)) return 'medico';
	if (RE_GASTO.test(nome)) return 'gasto';
	return null;
}

/** O item usa dado de uso? "sim"/"nao" na ficha do item vencem o automático. */
export function usaDadoUso(item) {
	if (!regraAtiva() || item?.type !== 'equipamento') return false;
	const modo = item.system.dadoUso?.modo ?? '';
	if (modo === 'nao') return false;
	if (modo === 'sim') return true;
	return !!tipoDoItem(item);
}

export function dadoInicial(item) {
	const d = item.system.dadoUso?.inicial;
	return ESCADA.includes(d) ? d : PADRAO[tipoDoItem(item) ?? 'outro'];
}

/** Dado atual da unidade em uso (0 no campo = ainda não rolou, vale o inicial). */
export function dadoAtual(item) {
	if ((item.system.quantidade ?? 0) <= 0) return 0;
	const d = item.system.dadoUso?.atual;
	return ESCADA.includes(d) ? d : dadoInicial(item);
}

/** Texto curto: "d8", "esgotado". */
export function rotuloDado(item) {
	const d = dadoAtual(item);
	return d ? `d${d}` : 'esgotado';
}

/**
 * Rola o dado de uso e atualiza o item.
 * @returns {Promise<{dado:number, total:number, desceu:boolean, acabou:boolean, restam:number}|null>}
 */
export async function rolarDadoUso(item, { motivo = '' } = {}) {
	const dado = dadoAtual(item);
	const actor = item.actor;
	if (!dado) {
		ui.notifications.warn(`${item.name}${actor ? ` de ${actor.name}` : ''} acabou.`);
		return null;
	}
	const roll = await new Roll(`1d${dado}`).evaluate();
	const desceu = roll.total <= 2;
	const i = ESCADA.indexOf(dado);
	const qtd = item.system.quantidade ?? 1;
	let acabou = false; let restam = qtd; let texto;
	if (!desceu) {
		texto = `continua em <strong>d${dado}</strong>`;
		if (item.system.dadoUso?.atual !== dado) await item.update({ 'system.dadoUso.atual': dado });
	} else if (i < ESCADA.length - 1) {
		texto = `cai para <strong>d${ESCADA[i + 1]}</strong>`;
		await item.update({ 'system.dadoUso.atual': ESCADA[i + 1] });
	} else {
		acabou = true; restam = Math.max(qtd - 1, 0);
		texto = restam ? `<strong>uma unidade acabou</strong> · restam ${restam}, a próxima começa em d${dadoInicial(item)}` : '<strong>acabou</strong>';
		await item.update({ 'system.quantidade': restam, 'system.dadoUso.atual': 0, 'system.municao.usadas': 0, 'system.municao.disparos': 0 });
	}
	const classe = acabou ? 'is-miss' : desceu ? 'is-warn' : 'is-hit';
	await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor: `<div class="op-dossie op-dado-uso ${classe}">
			<header><img src="${item.img}" alt=""><div><h3>${item.name}</h3><p>Dado de uso · d${dado}${motivo ? ` · ${motivo}` : ''}</p></div></header>
			<p class="op-dado-uso__res">${roll.total}: ${texto}</p></div>`,
		flags: { [SYSTEM_ID]: { dadoUso: { item: item.uuid, dado, total: roll.total } } }
	});
	return { dado, total: roll.total, desceu, acabou, restam };
}

/** Usar um item com dado de uso (ficha ou HUD): mostra o item e rola. */
export async function usarComDadoUso(item) {
	return rolarDadoUso(item, { motivo: `usou ${NOME_TIPO[tipoDoItem(item) ?? 'outro']}` });
}

/** Fim do combate: cada arma que atirou rola o dado do pacote uma vez. */
async function fimDoCombate(combat) {
	if (!regraAtiva()) return;
	const { pacoteDa, usaMunicao } = await import('./municao.mjs');
	const vistos = new Set();
	for (const c of combat.combatants) {
		const actor = c.actor;
		if (!actor || vistos.has(actor.uuid)) continue;
		vistos.add(actor.uuid);
		for (const arma of actor.items.filter(i => i.type === 'arma' && usaMunicao(i) && i.system.ultimaCena === combat.id)) {
			const pacote = pacoteDa(actor, arma);
			await arma.update({ 'system.ultimaCena': '' });
			if (pacote && usaDadoUso(pacote) && pacote.system.quantidade > 0) await rolarDadoUso(pacote, { motivo: `fim do combate (${arma.name})` });
		}
	}
}

export function registrarDadoUso() {
	Hooks.on('deleteCombat', (combat) => {
		if (game.user.isActiveGM) fimDoCombate(combat).catch(err => console.error(`${SYSTEM_ID} | dado de uso`, err));
	});
}

export const _teste = { fimDoCombate, tipoDoItem };
