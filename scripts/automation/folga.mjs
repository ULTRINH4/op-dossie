/**
 * Vida Além da Ordem (Sobrevivendo ao Horror pp. 94–97): interesses pessoais e folgas da Ordem.
 * Cada folga, o agente cuida de um interesse: dois testes (DT 20; busca pessoal DT 25),
 * +2 por ação de interlúdio gasta com o interesse durante a missão (Agente Atencioso).
 * Os resultados com número entram na ficha; o resto vira efeito-lembrete na aba Efeitos.
 */
import { SYSTEM_ID, PERICIAS } from '../config.mjs';
import { rolarTeste, dadoMantido } from '../dice/testes.mjs';
import { penalidadeDados } from './condicoes.mjs';
import { INTERESSES } from '../rules/opcionais-dados.mjs';

const { DialogV2 } = foundry.applications.api;
const esc = (t) => foundry.utils.escapeHTML(String(t ?? ''));

export const interessesDe = (actor) => foundry.utils.deepClone(actor.getFlag(SYSTEM_ID, 'interesses') ?? []);

export async function adicionarInteresse(actor, tipo, nome) {
	if (!INTERESSES[tipo]) return;
	const lista = interessesDe(actor);
	lista.push({ id: foundry.utils.randomID(), tipo, nome: String(nome ?? '').trim() });
	await actor.setFlag(SYSTEM_ID, 'interesses', lista);
}

export async function removerInteresse(actor, id) {
	await actor.setFlag(SYSTEM_ID, 'interesses', interessesDe(actor).filter(i => i.id !== id));
}

/** Teste de perícia sem a janela de ajustes (a folga já pergunta o bônus). */
async function teste(actor, pericia, dt, bonusExtra, titulo) {
	const c = actor.system.periciasCalc?.[pericia];
	const pen = penalidadeDados(actor, { pericia });
	return rolarTeste({ actor, dados: (c?.dados ?? 1) - pen.n, bonus: (c?.total ?? 0) + bonusExtra, titulo, event: { shiftKey: true }, dt, nota: pen.nota });
}

const opcoesPericias = (sel) => Object.entries(PERICIAS).map(([k, p]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${p.nome}</option>`).join('');

/** Pergunta as perícias e as ações de interlúdio, rola e aplica. */
export async function fazerFolga(actor, interesse) {
	const def = INTERESSES[interesse.tipo];
	if (!def) return;
	const campos = def.pericias === 'duas'
		? `<label>Primeira perícia <select name="p1">${opcoesPericias('diplomacia')}</select></label><label>Segunda perícia (diferente) <select name="p2">${opcoesPericias('atualidades')}</select></label>`
		: def.pericias === 'jogadorMestre'
			? `<label>Perícia do jogador <select name="p1">${opcoesPericias('investigacao')}</select></label><label>Perícia do desafio (o mestre escolhe) <select name="p2">${opcoesPericias('percepcao')}</select></label>`
			: `<label>Perícia (dois testes) <select name="p1">${opcoesPericias(def.padrao ?? 'atletismo')}</select></label>`;
	const dados = await DialogV2.input({
		window: { title: `Folga: ${def.nome}${interesse.nome ? ` · ${interesse.nome}` : ''}`, icon: 'fa-solid fa-mug-hot' },
		classes: ['op-dossie', 'op-folga'],
		content: `<p class="op-folga__texto">${esc(def.texto)}</p>
			<div class="op-folga__campos">${campos}
			<label>Ações de interlúdio gastas com o interesse na missão <input type="number" name="acoes" value="0" min="0" max="10" step="1"></label></div>`,
		ok: { label: 'Rolar a folga', icon: 'fa-solid fa-dice-d20' }
	}).catch(() => null);
	if (!dados) return;
	const p1 = dados.p1;
	const p2 = def.pericias === 'uma' ? p1 : dados.p2;
	if (def.pericias === 'duas' && p1 === p2) return ui.notifications.warn('Relacionamento usa duas perícias diferentes.');
	const bonus = 2 * Math.max(Number(dados.acoes) || 0, 0);
	const r1 = await teste(actor, p1, def.dt, bonus, `Folga · ${def.nome} (${PERICIAS[p1].nome})`);
	const r2 = await teste(actor, p2, def.dt, bonus, `Folga · ${def.nome} (${PERICIAS[p2].nome})`);
	if (!r1 || !r2) return;
	const sucessos = [r1, r2].filter(r => r.total >= def.dt).length;
	const vinte = [r1, r2].some(r => dadoMantido(r) === 20);
	return aplicarResultado(actor, interesse, sucessos, vinte);
}

async function lembrete(actor, name, texto, flags = {}) {
	await actor.createEmbeddedDocuments('ActiveEffect', [{ name, img: 'icons/svg/tankard.svg', description: `<p>${texto}</p>`, flags: { [SYSTEM_ID]: { folga: true, ...flags } } }]);
}

/** Resultado por interesse (SaH pp. 95–97). */
export async function aplicarResultado(actor, interesse, sucessos, vinte) {
	const def = INTERESSES[interesse.tipo];
	const nome = interesse.nome ? ` (${interesse.nome})` : '';
	let texto;
	const s = actor.system;
	switch (interesse.tipo) {
		case 'relacionamento':
			if (sucessos === 2) {
				const n = vinte ? 3 : 1;
				await lembrete(actor, `Folga: ${n}d6 de bônus${nome}`, `${n === 3 ? 'Três d6, usados separadamente' : 'Um d6'} como bônus num teste de perícia na próxima missão. Remova quando usar.`);
				texto = `Dois sucessos${vinte ? ' e um 20 natural' : ''}: ${n}d6 de bônus para a próxima missão.`;
			} else if (sucessos === 0) {
				await lembrete(actor, `Folga: desentendimento${nome}`, 'Não pode fazer ações de relaxar até gastar uma ação de interlúdio resolvendo o problema. Remova quando resolver.');
				texto = 'Nenhum sucesso: um desentendimento. Não pode relaxar até resolver com uma ação de interlúdio.';
			} else texto = 'Um sucesso: tudo segue como estava.';
			break;
		case 'trabalho':
			if (sucessos === 2) {
				await lembrete(actor, `Folga: item extra de categoria ${vinte ? 'II' : 'I'}${nome}`, `Um item adicional de categoria ${vinte ? 'II' : 'I'} na próxima missão. Remova quando pegar o equipamento.`);
				texto = `Dois sucessos${vinte ? ' e um 20 natural' : ''}: item adicional de categoria ${vinte ? 'II' : 'I'} na próxima missão.`;
			} else if (sucessos === 0) {
				await lembrete(actor, `Folga: problema no trabalho${nome}`, 'No início de cada interlúdio da próxima missão, role 1d4. No primeiro 1, gaste uma ação daquele interlúdio resolvendo; se não puder, perde o interesse.');
				texto = 'Nenhum sucesso: um problema complexo para a próxima missão (1d4 em cada interlúdio).';
			} else texto = 'Um sucesso: tudo segue como estava.';
			break;
		case 'lazer': {
			const pe = sucessos === 2 ? (vinte ? 5 : 2) : sucessos === 0 ? -(s.limitePEBase ?? s.limitePE ?? 1) : 0;
			if (pe) await actor.setFlag(SYSTEM_ID, 'folga', { peMax: pe, origem: def.nome });
			texto = pe > 0 ? `Dois sucessos${vinte ? ' e um 20 natural' : ''}: PE máximos +${pe} na próxima missão.`
				: pe < 0 ? `Nenhum sucesso: desanimado. PE máximos ${pe} durante a próxima sessão.` : 'Um sucesso: tudo segue como estava.';
			break;
		}
		case 'busca':
			if (sucessos === 2) {
				if (vinte) await lembrete(actor, 'Folga: +1 dado em Vontade', '+1 dado em testes de Vontade na próxima missão. Remova quando a missão acabar.', { bonusDados: { vontade: 1 } });
				texto = `Dois sucessos: uma pista sobre a busca${vinte ? ' e +1 dado em Vontade na próxima missão' : ''}.`;
			} else if (sucessos === 0) {
				if (!actor.statuses.has('frustrado')) await actor.toggleStatusEffect('frustrado', { active: true });
				texto = 'Nenhum sucesso: fica frustrado até gastar duas ações de interlúdio.';
			} else texto = 'Um sucesso: nenhuma pista desta vez.';
			break;
	}
	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<div class="op-dossie op-chatcard"><header class="op-chatcard__head"><img src="icons/svg/tankard.svg" alt=""><div><p class="op-chatcard__eyebrow">Folga da Ordem · ${sucessos} de 2 sucessos</p><h3>${esc(def.nome)}${esc(nome)}</h3></div></header><div class="op-chatcard__text"><p>${texto}</p></div></div>`
	});
}

/** Encerra o bônus/penalidade de PE da folga (fim da próxima missão ou sessão). */
export async function encerrarFolga(actor) {
	await actor.unsetFlag(SYSTEM_ID, 'folga');
}
