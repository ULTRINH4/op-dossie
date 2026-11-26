/**
 * Conjuração de rituais (Livro de Regras pp. 120–121).
 * Forma (normal/discente/verdadeira) → custo; desconta PE ou PD. O Custo do Paranormal (Ocultismo DT 20 + custo;
 * falha: perde SAN = custo; falha por 5+: −1 SAN permanente) é um botão no cartão. Medo: sem teste, perde SAN e SAN permanente.
 * O cartão segue a ordem da mesa: custo do conjurador → resistência dos alvos → dano/efeito.
 */
import { SYSTEM_ID, ELEMENTOS, EXECUCAO, ALCANCE, DURACAO } from '../config.mjs';
import { rolarTeste, botaoDano, botaoCura, controlaFalante, formulaTeste } from '../dice/testes.mjs';
import { mostrarDados, gravarNoCartao, resultados } from '../dice/no-cartao.mjs';
import { alvosAtuais, htmlAlvos } from './alvos.mjs';
import { modsCondicoes } from './condicoes.mjs';

const PERM_MEDO = { normal: 1, discente: 2, verdadeiro: 3 };

export function formasDoRitual(item) {
	const s = item.system;
	const base = s.custoBase;
	const formas = [{ id: 'normal', nome: 'Normal', custo: base, texto: s.descricao, dano: s.dano, req: '' }];
	for (const [id, nome] of [['discente', 'Discente'], ['verdadeiro', 'Verdadeiro']]) {
		const f = s[id];
		if (!f) continue;
		const req = [f.circuloMin ? `requer ${f.circuloMin}º círculo` : '', f.afinidade ? 'requer afinidade' : ''].filter(Boolean).join(' e ');
		formas.push({ id, nome, custo: base + (f.custoExtra || 0), texto: f.texto, dano: f.dano ?? s.dano, req });
	}
	return formas;
}

export async function conjurarRitual(actor, item) {
	const s = item.system;
	const a = actor.system;
	// Ameaças conjuram sem PE e sem Custo do Paranormal (não têm esses recursos).
	const npc = actor.type !== 'agente';
	const pool = a.semSanidade ? 'pd' : 'pe';
	const POOL = pool.toUpperCase();
	const atual = npc ? Infinity : actor.recursoDisponivel(pool);
	const limite = npc ? 0 : a.limitePE ?? 0;
	const medo = s.elemento === 'medo';
	const formas = formasDoRitual(item);
	const alquebrado = modsCondicoes(actor).custoExtra;
	for (const f of formas) f.custo += alquebrado;

	const opcoes = formas.map((f, i) => {
		const acima = limite && f.custo > limite;
		const falta = f.custo > atual;
		const notas = [npc ? '' : f.req, acima ? `acima do seu limite por turno (${limite})` : '', falta ? `você tem ${atual} ${POOL}` : ''].filter(Boolean).join(' · ');
		return `<label class="op-cast__opt ${falta ? 'is-blocked' : ''}">
			<input type="radio" name="forma" value="${f.id}" ${i === 0 && !falta ? 'checked' : ''} ${falta ? 'disabled' : ''}>
			<span class="op-cast__name">${f.nome}</span><span class="op-cast__cost">${npc ? '' : `${f.custo} ${POOL}`}</span>
			${notas ? `<span class="op-cast__note">${notas}</span>` : ''}</label>`;
	}).join('');

	const escolha = await foundry.applications.api.DialogV2.wait({
		window: { title: `Conjurar ${item.name}`, icon: 'fa-solid fa-hand-sparkles' },
		classes: ['op-dossie', 'op-cast-dialog'],
		content: `<div class="op-cast">
			<p class="op-cast__meta"><span class="op-cast__el op-el--${s.elemento}">${ELEMENTOS[s.elemento]?.nome ?? ''}</span>
			${s.circulo}º círculo · ${EXECUCAO[s.execucao] ?? ''} · ${s.alcance.texto || ALCANCE[s.alcance.chave] || ''}</p>
			<fieldset class="op-cast__forms"><legend>Forma</legend>${opcoes}</fieldset>
			${alquebrado ? '<p class="op-cond-note">Alquebrado: +1 de custo em cada forma.</p>' : ''}
			${npc ? '<p class="op-cast__hint">Ameaças conjuram sem gastar PE e sem Custo do Paranormal.</p>' : medo
				? (a.semSanidade
					? '<p class="op-note op-note--warn">Ritual de Medo: sem teste, mas você perde PD igual ao custo (além do custo do ritual).</p>'
					: '<p class="op-note op-note--warn">Ritual de Medo: sem teste, mas você perde Sanidade igual ao custo e Sanidade permanente.</p>')
				: '<p class="op-cast__hint">Depois de conjurar, role o Custo do Paranormal no cartão (Ocultismo, DT 20 + custo).</p>'}
			${npc ? '' : `<p class="op-cast__pool">${POOL} atual: <strong>${atual}</strong></p>`}</div>`,
		buttons: [
			{ action: 'cast', label: 'Conjurar', icon: 'fa-solid fa-hand-sparkles', default: true,
				callback: (ev, btn) => ({ forma: new FormData(btn.form).get('forma') }) },
			{ action: 'cancel', label: 'Cancelar' }
		],
		rejectClose: false
	});
	if (!escolha || escolha === 'cancel' || !escolha.forma) return null;

	const forma = formas.find(f => f.id === escolha.forma);
	if (npc) {
		await cartao({ actor, item, forma, POOL, medoRes: null, npc: true });
		return { forma, medoRes: null };
	}
	const agora = actor.recursoDisponivel(pool);
	if (forma.custo > agora) {
		ui.notifications.warn(`${actor.name} não tem ${POOL} suficiente (${agora}/${forma.custo}).`);
		return null;
	}

	// Paga o custo. Medo cobra a perda na hora (não há teste); os demais rolam no cartão.
	const updates = actor.gastoDe(pool, forma.custo);
	let medoRes = null;
	if (medo) {
		const perda = forma.custo;
		const permanente = a.semSanidade ? 0 : (PERM_MEDO[forma.id] ?? 1);
		if (pool === 'pd') updates['system.recursos.pd.valor'] = Math.max(updates['system.recursos.pd.valor'] - perda, 0);
		else updates['system.recursos.san.valor'] = Math.max(a.recursos.san.valor - perda, 0);
		if (permanente) updates['system.sanPermanente'] = a.sanPermanente + permanente;
		medoRes = { medo: true, perda, permanente, pool: sanNome(actor) };
	}
	await actor.update(updates);
	await cartao({ actor, item, forma, POOL, medoRes });
	return { forma, medoRes };
}

const sanNome = (actor) => actor.system.semSanidade ? 'PD' : 'SAN';

/** Linha de resultado do Custo do Paranormal. */
function htmlResultadoCusto(r) {
	const perm = r.permanente ? ` e −${r.permanente} SAN permanente` : '';
	if (r.medo) return `<div class="op-card__test is-fail"><span>Ritual de Medo, sem teste</span><span>−${r.perda} ${r.pool}${perm}</span></div>`;
	return `<div class="op-card__test ${r.ok ? 'is-ok' : 'is-fail'}"><span>Ocultismo <strong>${r.total}</strong> vs DT ${r.dt}</span>
		<span>${r.ok ? 'Sem custo extra' : `Falhou: −${r.perda} ${r.pool}${perm}`}</span></div>`;
}

async function cartao({ actor, item, forma, POOL, medoRes, npc = false }) {
	const s = item.system;
	const TE = foundry.applications.ux.TextEditor.implementation;
	const texto = await TE.enrichHTML(forma.texto ?? '', { relativeTo: item });
	const dt = actor.system.dtRitual;
	const dtCusto = 20 + forma.custo;
	const alvos = alvosAtuais();
	const stats = [
		['Execução', EXECUCAO[s.execucao]], ['Alcance', s.alcance.texto || ALCANCE[s.alcance.chave]], ['Alvo', s.alvo], ['Área', s.area],
		['Duração', s.duracao.texto || DURACAO[s.duracao.chave]]
	].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

	const etapas = [];
	if (!npc) etapas.push(`<li class="op-step" data-op-step="custo">
		<p class="op-step__label">Custo do Paranormal${medoRes ? '' : ` <small>Ocultismo · DT ${dtCusto} (20 + ${forma.custo})</small>`}</p>
		<div class="op-step__body">${medoRes ? htmlResultadoCusto(medoRes)
			: '<button type="button" class="op-step__btn" data-op-custo><i class="fa-solid fa-dice-d20"></i> Rolar Ocultismo</button>'}</div></li>`);
	if (s.resistencia.texto) {
		etapas.push(`<li class="op-step">
			<p class="op-step__label">Resistência dos alvos <small>${s.resistencia.texto} · DT ${dt}</small></p>
			<div class="op-step__body">${alvos.length ? htmlAlvos(alvos, { pericia: s.resistencia.pericia, dt })
				: '<p class="op-step__hint">Nenhum alvo marcado. Marque com T antes de conjurar para rolar daqui.</p>'}</div></li>`);
	} else if (alvos.length) {
		etapas.push(`<li class="op-step"><p class="op-step__label">Alvos</p><div class="op-step__body">${htmlAlvos(alvos)}</div></li>`);
	}
	const botoes = [];
	if (forma.dano?.formula) botoes.push(botaoDano(forma.dano.formula, `${item.name}: dano`, forma.dano.tipo, 'Dano', alvos));
	const curaF = String(s.cura ?? '').match(/\d+d\d+(?:\s*[+-]\s*\d+)?/)?.[0];
	if (curaF) botoes.push(botaoCura(curaF, `${item.name}: cura`, alvos));
	if (botoes.length) {
		const meia = s.resistencia.efeito === 'parcial' && forma.dano?.formula ? ' <small>quem passar na resistência sofre metade</small>' : '';
		etapas.push(`<li class="op-step"><p class="op-step__label">${forma.dano?.formula ? 'Dano' : 'Efeito'}${meia}</p>
			<div class="op-step__body op-chatcard__btns">${botoes.join('')}</div></li>`);
	}

	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: `<div class="op-dossie op-chatcard op-el--${s.elemento}">
			<header class="op-chatcard__head"><img src="${item.img}" alt="">
				<div><p class="op-chatcard__eyebrow">${ELEMENTOS[s.elemento]?.nome ?? ''} · ${s.circulo}º círculo${forma.id !== 'normal' ? ` · ${forma.nome}` : ''}</p><h3>${item.name}</h3></div>
				${npc ? '' : `<span class="op-chatcard__cost">−${forma.custo} ${POOL}</span>`}</header>
			<dl class="op-chatcard__stats">${stats}</dl>
			<div class="op-chatcard__text">${texto}</div>
			<ol class="op-steps">${etapas.join('')}</ol></div>`,
		flags: { [SYSTEM_ID]: { ritual: { itemId: item.id, forma: forma.id, custo: forma.custo, dtCusto, alvos: alvos.map(a => a.uuid), custoResultado: medoRes } } }
	});
}

/**
 * Resultado do Custo do Paranormal de um cartão. Fica na mensagem da rolagem (flag custoDe),
 * assim qualquer um que role grava o resultado, mesmo sem poder editar o cartão do mestre.
 */
function resultadoDoCusto(card) {
	const r = card.getFlag(SYSTEM_ID, 'ritual');
	if (r?.custoResultado) return r.custoResultado;
	if (resultados(card).custo) return resultados(card).custo;
	const m = game.messages.contents.findLast(x => x.getFlag(SYSTEM_ID, 'custoDe') === card.id);
	const info = m?.getFlag(SYSTEM_ID, 'custoInfo');
	if (!m?.rolls?.length || !info) return null;
	const total = m.rolls[0].total;
	const ok = total >= info.dt;
	return { total, dt: info.dt, ok, perda: ok ? 0 : info.custo, permanente: !ok && !info.semSan && info.dt - total >= 5 ? 1 : 0, pool: info.semSan ? 'PD' : 'SAN' };
}

/** Rola de novo o cartão quando a rolagem dele chega ou some (em todos os clientes). */
function atualizarCartao(m) {
	const card = game.messages.get(m.getFlag(SYSTEM_ID, 'custoDe'));
	if (card) ui.chat?.updateMessage?.(card);
}

/** Botão "Rolar Ocultismo" do cartão: rola e cobra a perda de quem conjurou. */
export function registrarCustoParanormal() {
	Hooks.on('createChatMessage', atualizarCartao);
	Hooks.on('deleteChatMessage', atualizarCartao);
	Hooks.on('renderChatMessageHTML', (message, html) => {
		const r = message.getFlag(SYSTEM_ID, 'ritual');
		const passo = html.querySelector('[data-op-step="custo"] .op-step__body');
		if (!r || !passo) return;
		const feito = resultadoDoCusto(message);
		if (feito) { passo.innerHTML = htmlResultadoCusto(feito); return; }
		const btn = passo.querySelector('[data-op-custo]');
		if (!btn) return;
		if (!controlaFalante(message)) {
			btn.disabled = true; btn.classList.add('is-locked');
			btn.title = `Só ${message.speaker?.alias ?? 'quem conjurou'} (ou o mestre) rola o Custo do Paranormal.`;
		}
		btn.addEventListener('click', async (ev) => {
			ev.preventDefault();
			const actor = ChatMessage.getSpeakerActor(message.speaker);
			if (!actor?.isOwner) return ui.notifications.warn('Só quem conjurou (ou o mestre) rola o Custo do Paranormal.');
			if (resultadoDoCusto(message)) return;
			btn.disabled = true;
			const oc = actor.system.periciasCalc?.ocultismo ?? actor.system.ocultismo ?? { dados: 1, total: 0 };
			const dt = r.dtCusto ?? 20 + r.custo;
			const semSan = !!actor.system.semSanidade;
			// Rola, mostra os dados 3D e grava o resultado no próprio cartão.
			const roll = await new Roll(formulaTeste(oc.dados, oc.total ?? oc.bonus ?? 0), actor.getRollData()).evaluate();
			const ok = roll.total >= dt;
			const resultado = { total: roll.total, dt, ok, perda: ok ? 0 : r.custo, permanente: !ok && !semSan && dt - roll.total >= 5 ? 1 : 0, pool: semSan ? 'PD' : 'SAN' };
			await mostrarDados(roll);
			const gravou = await gravarNoCartao(message, 'custo', resultado, roll);
			if (!gravou) {
				const r2 = await rolarTeste({ actor, dados: oc.dados, bonus: oc.total ?? oc.bonus ?? 0, titulo: 'Custo do Paranormal (Ocultismo)', event: { shiftKey: true }, dt,
					extraFlags: { custoDe: message.id, custoInfo: { dt, custo: r.custo, semSan } } });
				if (!r2) { btn.disabled = false; return; }
				if (r2.total >= dt) return;
			} else if (ok) return;
			const k = semSan ? 'pd' : 'san';
			const upd = { [`system.recursos.${k}.valor`]: Math.max(actor.system.recursos[k].valor - r.custo, 0) };
			if (!semSan && dt - roll.total >= 5) upd['system.sanPermanente'] = actor.system.sanPermanente + 1;
			await actor.update(upd);
		});
	});
}
