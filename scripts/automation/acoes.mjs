/**
 * Ações do turno (padrão, movimento, reação) com limite, durante o combate iniciado.
 * Na vez: padrão e completa exigem as ações livres; movimento pode usar a ação padrão (troca);
 * andar além do deslocamento gasta a próxima ação, e não passa de duas ações de movimento.
 * Fora da vez: só ações livres e reações. O mestre não é bloqueado (só avisado).
 * O que foi gasto fica no combatente (flags), igual para todos e válido só no turno atual.
 */
import { SYSTEM_ID } from '../config.mjs';
import { usaDadoUso } from './dado-uso.mjs';

export function registrarConfigAcoes() {
	game.settings.register(SYSTEM_ID, 'limiteAcoes', {
		name: 'Limite de ações no combate',
		hint: 'Com o combate iniciado, os jogadores só usam o que as ações do turno permitem (padrão, movimento e a troca de padrão por movimento) e, fora da vez, só ações livres e reações.',
		scope: 'world', config: true, type: Boolean, default: true
	});
}

const ativo = () => game.settings.get(SYSTEM_ID, 'limiteAcoes');
const vazio = () => ({ padrao: null, movimento: null, reacao: false });

/** Combatente do ator (ou token) no combate iniciado desta cena. */
export function combatenteDe(actorOuToken) {
	const combat = game.combat;
	if (!combat?.started) return null;
	const tokenId = actorOuToken?.documentName === 'Token' ? actorOuToken.id : actorOuToken?.object?.document?.id;
	if (tokenId) return combat.combatants.find(c => c.tokenId === tokenId) ?? null;
	const actor = actorOuToken;
	return combat.combatants.find(c => c.actor === actor) ?? (actor?.isToken ? null : combat.combatants.find(c => c.actorId === actor?.id && c.token?.actorLink)) ?? null;
}

const chave = (combat) => `${combat.round}:${combat.turn}`;

/** Ações gastas no turno atual por este combatente. */
export function acoesDoTurno(c) {
	const f = c?.getFlag(SYSTEM_ID, 'acoes');
	return f && f.chave === chave(c.combat) ? { ...vazio(), ...f } : vazio();
}

async function salvar(c, acoes) {
	await c.setFlag(SYSTEM_ID, 'acoes', { ...acoes, chave: chave(c.combat) });
}

const naVez = (c) => c.combat.combatant?.id === c.id;
const NOME = { padrao: 'ação padrão', movimento: 'ação de movimento', completa: 'ação completa' };

/**
 * Plano para gastar uma execução: { ok, motivo, novo } (novo = ações depois do gasto).
 * Sem combate, sem limite ou execução livre: ok sem mudanças.
 */
export function planejar(c, execucao) {
	const ex = execucao || 'livre';
	if (!c || ex === 'livre') return { ok: true, novo: null };
	const a = acoesDoTurno(c);
	const novo = { ...a };
	if (ex === 'reacao') { novo.reacao = true; return { ok: true, novo }; }
	if (!naVez(c)) return { ok: false, motivo: `Não é a vez de ${c.name}: fora da vez, só ações livres e reações.` };
	if (ex === 'padrao') {
		if (a.padrao) return { ok: false, motivo: `${c.name} já gastou a ação padrão neste turno${a.padrao === 'mov' ? ' (andando)' : ''}.` };
		novo.padrao = 'acao';
	} else if (ex === 'movimento') {
		if (!a.movimento) novo.movimento = 'acao';
		else if (!a.padrao) novo.padrao = 'acao';
		else return { ok: false, motivo: `${c.name} não tem mais ação de movimento neste turno.` };
	} else if (ex === 'completa') {
		if (a.padrao || a.movimento) return { ok: false, motivo: `${c.name} precisa das ações padrão e de movimento livres para uma ação completa.` };
		novo.padrao = 'acao'; novo.movimento = 'acao';
	}
	return { ok: true, novo };
}

/**
 * Confere e (se der) registra o gasto. Jogador fora do limite: avisa e devolve false.
 * O mestre sempre pode; só recebe o aviso.
 */
export async function gastarAcao(actor, execucao, { item = null, apenasConferir = false } = {}) {
	if (!ativo()) return true;
	const c = combatenteDe(actor);
	const p = planejar(c, execucao);
	if (!p.ok) {
		if (!game.user.isGM) { ui.notifications.warn(p.motivo); return false; }
		ui.notifications.info(`${p.motivo} (Mestre: liberado.)`);
		return true;
	}
	if (!apenasConferir && p.novo && c) await salvar(c, p.novo);
	return true;
}

/** Execução de um item para o limite (arma: padrão; equipamento só quando gasta algo). */
export function execucaoDo(item) {
	if (item.type === 'arma') return 'padrao';
	if (item.type === 'ritual') return item.system.execucao || 'padrao';
	if (item.type === 'poder') return item.system.execucao || 'livre';
	if (item.type === 'equipamento' && usaDadoUso(item)) return 'padrao';
	return 'livre';
}

/* --- movimento ---------------------------------------------------------------- */

function deslocamento(actor) {
	const s = actor.system;
	return actor.type === 'agente' ? (s.deslocamentoTotal ?? 9) : (Number.parseFloat(s.deslocamento) || 9);
}

/** Quantas ações de movimento uma distância total no turno exige (0, 1, 2 ou mais). */
function acoesParaAndar(distancia, desloc) {
	if (distancia <= 0.01) return 0;
	return Math.ceil(distancia / desloc - 1e-6);
}

/** Ações depois de andar `distancia` no turno, ou null se não há ações para isso. */
export function planoDeMovimento(c, distancia) {
	const a = acoesDoTurno(c);
	const precisa = acoesParaAndar(distancia, deslocamento(c.actor));
	const vagas = ['movimento', 'padrao'].filter(k => a[k] !== 'acao');
	if (precisa > vagas.length) return { ok: false, precisa, vagas: vagas.length };
	const novo = { ...a };
	for (const k of ['movimento', 'padrao']) if (novo[k] === 'mov') novo[k] = null;
	vagas.slice(0, precisa).forEach(k => { novo[k] = 'mov'; });
	return { ok: true, novo, precisa };
}

export function registrarAcoes() {
	// Antes de andar: há ações para essa distância?
	Hooks.on('preMoveToken', (tokenDoc, move) => {
		if (!ativo() || game.user.isGM) return;
		const c = combatenteDe(tokenDoc);
		if (!c || !naVez(c)) return; // fora da vez quem barra é o "Movimento só na vez"
		const total = (move.history?.distance ?? 0) + (move.passed?.distance ?? 0) + (move.pending?.distance ?? 0);
		const p = planoDeMovimento(c, total);
		if (p.ok) return;
		ui.notifications.warn(p.vagas === 0
			? `${c.name} não tem mais ações para andar neste turno.`
			: `${c.name} só pode andar ${p.vagas}× o deslocamento neste turno (${deslocamento(c.actor) * p.vagas} m).`);
		return false;
	});
	// Depois de andar: marca as ações usadas no movimento.
	Hooks.on('moveToken', async (tokenDoc, movement, operation, user) => {
		// Só quem moveu registra (evita gravar duas vezes).
		if ((user?.id ?? user) !== game.user.id) return;
		const c = combatenteDe(tokenDoc);
		if (!c || !c.isOwner || !naVez(c)) return;
		let andou = 0;
		try { const h = tokenDoc.movementHistory ?? []; if (h.length > 1) andou = tokenDoc.measureMovementPath(h).distance ?? 0; } catch { andou = 0; }
		const p = planoDeMovimento(c, andou);
		const novo = p.ok ? p.novo : { ...acoesDoTurno(c), movimento: acoesDoTurno(c).movimento ?? 'mov', padrao: acoesDoTurno(c).padrao ?? 'mov' };
		const antes = acoesDoTurno(c);
		if (novo.padrao !== antes.padrao || novo.movimento !== antes.movimento) await salvar(c, novo);
	});
}

/**
 * Quadrados que ainda dá para andar no turno: { nestaAcao, total, quadrado } ou null fora do combate.
 * nestaAcao = sem gastar outra ação; total = trocando também a ação padrão.
 */
export function quadradosLivres(token, andou) {
	const c = combatenteDe(token.document);
	const quadrado = canvas.scene?.grid?.distance || 1.5;
	const desloc = deslocamento(token.actor);
	if (!c || !ativo()) return null;
	const a = acoesDoTurno(c);
	const vagas = ['movimento', 'padrao'].filter(k => a[k] !== 'acao').length;
	const usadas = acoesParaAndar(andou, desloc);
	const fimDaAcao = Math.min(Math.max(usadas, 1), vagas) * desloc;
	const sq = (m) => Math.max(Math.floor((m - andou) / quadrado + 1e-6), 0);
	return { nestaAcao: vagas ? sq(fimDaAcao) : 0, total: sq(vagas * desloc), vagas, naVez: naVez(c), quadrado };
}

export const _teste ={ planejar, planoDeMovimento, acoesDoTurno, salvar };
