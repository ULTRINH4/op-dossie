/**
 * Rolagens que atualizam o próprio cartão, em vez de mandar uma mensagem nova ao chat.
 * 1. Os dados 3D do Dice So Nice rolam para todos e quem rolou espera parar.
 * 2. O resultado (total, fórmula e faces) vai para flags.op-dossie.resultados do cartão. A rolagem
 *    não é anexada ao cartão: o Dice So Nice animaria de novo as rolagens somadas a uma mensagem.
 * Quem não pode editar o cartão (ex.: o jogador resistindo num cartão do mestre) pede ao mestre
 * conectado pelo socket do sistema. Sem mestre, devolve false e quem chamou faz a mensagem antiga.
 */
import { SYSTEM_ID } from '../config.mjs';

const CANAL = `system.${SYSTEM_ID}`;

/** Chave segura para usar num caminho de flag (sem pontos). */
export const chaveFlag = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_');

/** Mostra os dados 3D para todos (Dice So Nice) e espera parar neste computador. */
export async function mostrarDados(roll) {
	if (!game.dice3d?.showForRoll || !roll) return;
	try { await game.dice3d.showForRoll(roll, game.user, true); } catch (err) { console.warn(`${SYSTEM_ID} | Dice So Nice`, err); }
}

/** Monta a atualização: resultado no caminho dado. */
function dadosDaAtualizacao(card, caminho, valor) {
	return { [`flags.${SYSTEM_ID}.resultados.${caminho}`]: valor };
}

/**
 * Grava o resultado no cartão.
 * @returns {Promise<boolean>} false se ninguém pôde gravar (sem permissão e sem mestre conectado)
 */
export async function gravarNoCartao(card, caminho, valor, roll = null) {
	const data = dadosDaAtualizacao(card, caminho, valor);
	if (card.canUserModify(game.user, 'update')) { await card.update(data); return true; }
	const gm = game.users.activeGM;
	if (!gm) return false;
	game.socket.emit(CANAL, { acao: 'atualizarCartao', id: card.id, data, de: game.user.id });
	return true;
}

/** O mestre conectado faz as atualizações pedidas pelos jogadores. */
export function registrarSocketCartoes() {
	game.socket.on(CANAL, async (msg) => {
		if (msg?.acao !== 'atualizarCartao' || !game.user.isActiveGM) return;
		const card = game.messages.get(msg.id);
		if (!card) return;
		// Pelo socket só passa a resistência ou a reação de defesa de um alvo, e só de quem controla esse alvo.
		const user = game.users.get(msg.de);
		const chaves = Object.keys(msg.data ?? {});
		const resist = chaves.filter(k => ['resist', 'defesa', 'presenca'].some(p => k.startsWith(`flags.${SYSTEM_ID}.resultados.${p}.`)));
		if (!user || !resist.length || chaves.some(k => !resist.includes(k))) return;
		for (const k of resist) {
			const alvo = msg.data[k]?.uuid && fromUuidSync(msg.data[k].uuid);
			const ator = alvo?.actor ?? alvo;
			if (!ator?.testUserPermission?.(user, 'OWNER')) return;
		}
		await card.update(msg.data);
	});
}

/** Resultados gravados no cartão. */
export const resultados = (card) => card?.getFlag(SYSTEM_ID, 'resultados') ?? {};
