/**
 * Reações de defesa (Livro de Regras, p. 88): Bloqueio (treinado em Fortitude, contra corpo a corpo),
 * Esquiva (treinado em Reflexos, contra qualquer ataque) e Contra-ataque (treinado em Luta, quando um
 * ataque corpo a corpo erra). Só uma destas por rodada; Bloqueio e Esquiva antes do ataque ser rolado.
 * As demais reações não têm limite. O mestre não é bloqueado.
 * A escolha fica no cartão do ataque (resultados.defesa) e o uso na rodada fica no combatente.
 */
import { SYSTEM_ID } from '../config.mjs';
import { atorDoAlvo, nomeDoAlvo } from './alvos.mjs';
import { combatenteDe } from './acoes.mjs';

export const REACOES = {
	esquiva: { nome: 'Esquiva', verbo: 'Esquivar', pericia: 'reflexos', icone: 'fa-person-running' },
	bloqueio: { nome: 'Bloqueio', verbo: 'Bloquear', pericia: 'fortitude', icone: 'fa-shield-halved' },
	contra: { nome: 'Contra-ataque', verbo: 'Contra-atacar', pericia: 'luta', icone: 'fa-hand-fist' }
};

const chaveFlag = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_');

/** Bônus da perícia (agente: total calculado; ameaça: bônus do teste). */
export function bonusPericia(actor, pericia) {
	if (!actor) return 0;
	if (actor.type === 'agente') return actor.system.periciasCalc?.[pericia]?.total ?? 0;
	return actor.system[pericia]?.bonus ?? 0;
}

/** Treinado na perícia? Ameaças: sim para Fortitude e Reflexos (estão no bloco); Luta se tiver ataque corpo a corpo. */
export function treinado(actor, pericia) {
	if (!actor) return false;
	if (actor.type === 'agente') return (actor.system.pericias?.[pericia]?.grau ?? 0) > 0;
	if (pericia === 'luta') return actor.items.some(i => i.type === 'arma' && i.system.tipo === 'corpo a corpo');
	return true;
}

/** Reação de defesa escolhida por um alvo neste cartão. */
export function defesaNoCartao(card, uuid) {
	return card?.getFlag(SYSTEM_ID, 'resultados')?.defesa?.[chaveFlag(uuid)] ?? null;
}

/** Defesa somando a Esquiva escolhida no cartão. */
export function bonusEsquiva(card, uuid) {
	const d = defesaNoCartao(card, uuid);
	return d?.tipo === 'esquiva' ? d.valor : 0;
}

/** RD do Bloqueio escolhido no cartão. */
export function rdBloqueio(card, uuid) {
	const d = defesaNoCartao(card, uuid);
	return d?.tipo === 'bloqueio' ? d.valor : 0;
}

const chaveRodada = () => `${game.combat?.id}:${game.combat?.round}`;

/** Já usou uma reação de defesa nesta rodada? (fora do combate não há limite) */
export function jaReagiu(actor, tokenUuid) {
	const doc = tokenUuid ? fromUuidSync(tokenUuid) : null;
	const c = combatenteDe(doc?.documentName === 'Token' ? doc : actor);
	if (!c) return false;
	return c.getFlag(SYSTEM_ID, 'reacaoDefesa') === chaveRodada();
}

/**
 * Pode usar esta reação de defesa agora? { ok, motivo }.
 * @param {string} tipo esquiva | bloqueio | contra
 */
export function podeReagir(card, uuid, tipo, { corpoACorpo = false, ataqueFeito = false, errou = false } = {}) {
	const ator = atorDoAlvo(uuid);
	const r = REACOES[tipo];
	const nome = nomeDoAlvo(uuid) ?? ator?.name ?? 'o alvo';
	if (!ator || !r) return { ok: false, motivo: 'Alvo não encontrado.' };
	if (!ator.isOwner) return { ok: false, motivo: `Só quem controla ${nome} (ou o mestre) reage.` };
	if (defesaNoCartao(card, uuid)) return { ok: false, motivo: `${nome} já reagiu a este ataque.` };
	if ((tipo === 'bloqueio' || tipo === 'contra') && !corpoACorpo) return { ok: false, motivo: `${r.nome} só contra ataque corpo a corpo.` };
	if (tipo !== 'contra' && ataqueFeito) return { ok: false, motivo: `${r.nome} tem de ser usado antes de o ataque ser rolado.` };
	if (tipo === 'contra' && !(ataqueFeito && errou)) return { ok: false, motivo: 'Contra-ataque só quando o ataque erra.' };
	if (game.user.isGM) return { ok: true };
	if (!treinado(ator, r.pericia)) return { ok: false, motivo: `${nome} precisa ser treinado em ${r.pericia === 'luta' ? 'Luta' : r.pericia === 'reflexos' ? 'Reflexos' : 'Fortitude'}.` };
	if (jaReagiu(ator, uuid)) return { ok: false, motivo: `${nome} já usou uma reação de defesa nesta rodada.` };
	return { ok: true };
}

/** Registra a reação no cartão e no combatente (uso na rodada). */
export async function reagir(card, uuid, tipo) {
	const ator = atorDoAlvo(uuid);
	const r = REACOES[tipo];
	const valor = tipo === 'contra' ? 0 : bonusPericia(ator, r.pericia);
	const { gravarNoCartao } = await import('../dice/no-cartao.mjs');
	await gravarNoCartao(card, `defesa.${chaveFlag(uuid)}`, { uuid, tipo, valor });
	const doc = fromUuidSync(uuid);
	const c = combatenteDe(doc?.documentName === 'Token' ? doc : ator);
	if (c?.isOwner) await c.setFlag(SYSTEM_ID, 'reacaoDefesa', chaveRodada());
	return valor;
}

/** Texto curto da reação escolhida, para a lista de alvos. */
export function rotuloDefesa(d) {
	if (!d) return '';
	if (d.tipo === 'esquiva') return `Esquiva +${d.valor} Defesa`;
	if (d.tipo === 'bloqueio') return `Bloqueio RD ${d.valor}`;
	return 'Contra-atacou';
}

/**
 * Contra-ataque: abre o ataque corpo a corpo de quem reagiu contra o atacante, sem gastar ação.
 */
export async function contraAtacar(card, uuid) {
	const ator = atorDoAlvo(uuid);
	const arma = ator?.items.find(i => i.type === 'arma' && i.system.tipo === 'corpo a corpo' && i.system.equipado !== false)
		?? ator?.items.find(i => i.type === 'arma' && i.system.tipo === 'corpo a corpo');
	if (!arma) { ui.notifications.warn(`${ator?.name ?? 'O alvo'} não tem arma corpo a corpo para contra-atacar.`); return false; }
	await reagir(card, uuid, 'contra');
	// Mira o atacante (token que fala no cartão) e manda o cartão do contra-ataque.
	const atacante = card.speaker?.token && canvas?.tokens?.get(card.speaker.token);
	if (atacante) atacante.setTarget(true, { releaseOthers: true, groupSelection: false });
	const { rolarAtaque } = await import('../dice/testes.mjs');
	await rolarAtaque({ actor: ator, item: arma, contraAtaque: true });
	return true;
}
