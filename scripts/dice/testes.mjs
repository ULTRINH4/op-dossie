/**
 * Rolagens de Ordem Paranormal.
 * Teste: rola um d20 por ponto do atributo e fica com o maior; com 0, rola 2d20 e fica com o menor.
 */
import { SYSTEM_ID, TIPOS_DANO } from '../config.mjs';
import { penalidadeDados } from '../automation/condicoes.mjs';
import { gastarMunicao, resumoMunicao } from '../automation/municao.mjs';
import { alvosAtuais, atorDoAlvo, nomeDoAlvo, htmlAlvos, attrAlvos } from '../automation/alvos.mjs';
import { mostrarDados, gravarNoCartao, resultados, chaveFlag } from './no-cartao.mjs';
const esc = (t) => foundry.utils.escapeHTML(String(t ?? ''));

export function formulaTeste(dados, bonus = 0) {
	const d = Number(dados) || 0;
	// Abaixo de 1 dado: rola 2 (mais um por dado faltando) e fica com o pior (Livro de Regras, p. 15).
	const base = d > 0 ? `${d}d20kh` : `${2 - d}d20kl`;
	const b = Number(bonus) || 0;
	return b ? `${base} ${b > 0 ? '+' : '-'} ${Math.abs(b)}` : base;
}

/** Janela rápida de ajustes (Shift pula). */
async function ajustes(titulo) {
	return foundry.applications.api.DialogV2.wait({
		window: { title: titulo, icon: 'fa-solid fa-dice-d20' },
		position: { width: 360 },
		classes: ['op-dossie', 'op-roll-dialog'],
		content: `<div class="op-roll-adj">
			<label>Dados extras <input type="number" name="dados" value="0" step="1"></label>
			<label>Bônus extra <input type="number" name="bonus" value="0" step="1"></label>
			<p class="op-roll-adj__hint">Segure Shift ao clicar para rolar direto, sem esta janela.</p>
		</div>`,
		buttons: [{
			action: 'rolar', label: 'Rolar', icon: 'fa-solid fa-dice-d20', default: true,
			callback: (ev, btn) => ({ dados: Number(btn.form.elements.dados.value) || 0, bonus: Number(btn.form.elements.bonus.value) || 0 })
		}],
		rejectClose: false
	});
}

/**
 * @param {object} o
 * @param {Actor} o.actor
 * @param {number} o.dados    dados do atributo
 * @param {number} o.bonus    bônus fixo
 * @param {string} o.titulo
 * @param {Event} [o.event]   Shift pula a janela de ajustes
 * @param {number} [o.dt]
 */
export async function rolarTeste({ actor, dados, bonus = 0, titulo, event, dt = null, nota = '', extraFlags = {} }) {
	let adj = { dados: 0, bonus: 0 };
	if (!event?.shiftKey) {
		const r = await ajustes(titulo);
		if (!r) return null;
		adj = r;
	}
	const totalDados = (Number(dados) || 0) + adj.dados;
	const roll = await new Roll(formulaTeste(totalDados, bonus + adj.bonus), actor?.getRollData?.() ?? {}).evaluate();
	const ok = dt != null ? roll.total >= dt : null;
	await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor, token: actor.token }),
		flavor: `<span class="op-flavor">${titulo}${dt != null ? ` · DT ${dt} · <strong class="${ok ? 'op-ok' : 'op-fail'}">${ok ? 'sucesso' : 'falha'}</strong>` : ''}</span>${nota ? `<small class="op-cond-note">${nota}</small>` : ''}`,
		flags: { [SYSTEM_ID]: { teste: { titulo, dt }, ...extraFlags } }
	});
	return roll;
}

/** Valor do dado mantido (para crítico). */
export function dadoMantido(roll) {
	const d = roll.dice.find(t => t.faces === 20);
	return d?.results.find(r => r.active)?.result ?? 0;
}

const NOME_TIPO = { 'corpo a corpo': 'corpo a corpo', arremesso: 'arremesso', disparo: 'disparo', fogo: 'arma de fogo' };

/**
 * Usar uma arma: manda para o chat um cartão em etapas. Quem controla o atacante rola o ataque;
 * se acertar, o botão de dano aparece e ele rola o dano. Nada é rolado sozinho.
 */
export async function rolarAtaque({ actor, item }) {
	const s = item.system;
	const pericia = s.periciaAtaque;
	const alvos = alvosAtuais();
	const mun = resumoMunicao(actor, item);
	const stats = [
		['Dano', `${s.dano.formula}${TIPOS_DANO[s.dano.tipo] ? ` ${TIPOS_DANO[s.dano.tipo].toLowerCase()}` : ''}`],
		['Crítico', `${s.critico.margem} / ×${s.critico.multiplicador}`],
		['Alcance', s.alcance], ['Munição', mun]
	].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
	const nomePericia = pericia === 'luta' ? 'Luta' : 'Pontaria';
	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor, token: actor.token }),
		content: `<div class="op-dossie op-chatcard op-weapon">
			<header class="op-chatcard__head"><img src="${item.img}" alt="">
				<div><p class="op-chatcard__eyebrow">${NOME_TIPO[s.tipo] ?? 'arma'} · ${nomePericia}</p><h3>${esc(item.name)}</h3></div></header>
			<dl class="op-chatcard__stats">${stats}</dl>
			<ol class="op-steps">
				<li class="op-step" data-op-step="ataque">
					<p class="op-step__label">Ataque <small>${nomePericia} contra a Defesa</small></p>
					<div class="op-step__body">${htmlAlvos(alvos)}
						<button type="button" class="op-step__btn" data-op-atacar><i class="fa-solid fa-dice-d20"></i> Rolar ataque</button></div></li>
				<li class="op-step" data-op-step="dano">
					<p class="op-step__label">Dano <small>se acertar</small></p>
					<div class="op-step__body"><p class="op-step__hint">Role o ataque primeiro.</p></div></li>
			</ol></div>`,
		flags: { [SYSTEM_ID]: { arma: { itemId: item.id, alvos } } }
	});
}

/** Rolagem de ataque de um cartão (a mensagem da rolagem guarda o resultado com ataqueDe). */
async function atacarDoCartao(card, event) {
	const info = card.getFlag(SYSTEM_ID, 'arma');
	const actor = ChatMessage.getSpeakerActor(card.speaker);
	const item = actor?.items.get(info?.itemId);
	if (!item) { ui.notifications.warn('A arma não está mais na ficha.'); return null; }
	const s = item.system;
	const pericia = s.periciaAtaque;
	const calc = actor.system.periciasCalc?.[pericia];
	const attr = actor.system.atributos?.[calc?.atributo ?? (pericia === 'luta' ? 'for' : 'agi')]?.valor ?? 1;
	let adj = { dados: 0, bonus: 0 };
	if (!event?.shiftKey) {
		const r = await ajustes(`Ataque com ${item.name}`);
		if (!r) return null;
		adj = r;
	}
	const mun = await gastarMunicao(actor, item);
	if (!mun.ok) return null;
	const pen = penalidadeDados(actor, { pericia, ataque: true, corpoACorpo: s.tipo === 'corpo a corpo' });
	const roll = await new Roll(formulaTeste(attr + adj.dados - pen.n, (calc?.total ?? 0) + (s.bonusAtaque || 0) + adj.bonus)).evaluate();
	const critico = dadoMantido(roll) >= s.critico.margem;
	// Alvos do cartão; se não havia, os que quem rola marcou agora.
	const alvos = (info.alvos?.length ? info.alvos : alvosAtuais()).map(a => {
		const ator = atorDoAlvo(a.uuid);
		return { ...a, defesa: ator?.system?.defesaTotal ?? ator?.system?.defesa ?? a.defesa };
	});
	const notas = [pen.n ? pen.nota : '', mun.nota].filter(Boolean);
	const ataque = { itemId: item.id, critico, total: roll.total, formula: roll.formula, dados: dadosDe(roll), alvos: alvos.map(a => a.uuid), alvosInfo: alvos, notas };
	// O resultado entra no próprio cartão; os dados 3D rolam antes, para todos.
	await mostrarDados(roll);
	// Dado de uso fora do combate: rola quando a ação terminar (errou todos: agora; acertou: depois do dano).
	const errouTodos = alvos.length > 0 && alvos.every(a => a.defesa != null && roll.total < a.defesa);
	const posAtaque = async (noCartao) => {
		if (!mun.dadoUso) return;
		const { marcarPendente, rolarDadoUso } = await import('../automation/dado-uso.mjs');
		if (noCartao) await marcarPendente(card, mun.dadoUso, item, { errouTodos });
		else await rolarDadoUso(mun.dadoUso, { motivo: `ataque com ${item.name}` });
	};
	if (await gravarNoCartao(card, 'ataque', ataque, roll)) { await posAtaque(true); return roll; }
	await roll.toMessage({
		speaker: card.speaker,
		flavor: `<span class="op-flavor">${esc(item.name)}: ataque${critico ? ' · <strong class="op-ok">crítico</strong>' : ''}</span>${notas.map(n => `<small class="op-cond-note">${esc(n)}</small>`).join('')}`,
		flags: { [SYSTEM_ID]: { ataqueDe: card.id, ataque } }
	});
	await posAtaque(false);
	return roll;
}

/** Faces dos d20 (mantido marcado) para mostrar no cartão. */
function dadosDe(roll) {
	return roll.dice.flatMap(d => d.results.map(r => ({ v: r.result, f: d.faces, ativo: r.active !== false })));
}
const htmlDados = (dados = []) => dados.length ? `<span class="op-card__dados" aria-label="Dados">${dados.map(d => `<b class="${d.ativo ? '' : 'is-fora'}">${d.v}</b>`).join('')}</span>` : '';

/** Resultado do ataque: no cartão (novo) ou na mensagem de rolagem ligada a ele (cartões antigos). */
function resultadoAtaque(card) {
	return resultados(card).ataque ?? mensagemDe(card, 'ataqueDe')?.getFlag(SYSTEM_ID, 'ataque') ?? null;
}

/** Última mensagem ligada a um cartão (rolagem de ataque, de dano...). */
export function mensagemDe(card, chave, filtro = () => true) {
	return game.messages.contents.findLast(m => m.getFlag(SYSTEM_ID, chave) === card.id && filtro(m)) ?? null;
}

/** Etapas do cartão de arma conforme o que já foi rolado. */
function renderCartaoArma(message, html) {
	const info = message.getFlag(SYSTEM_ID, 'arma');
	const passoAtaque = html.querySelector('[data-op-step="ataque"] .op-step__body');
	const passoDano = html.querySelector('[data-op-step="dano"] .op-step__body');
	if (!info || !passoAtaque || !passoDano) return;
	const at = resultadoAtaque(message);
	if (!at) {
		const btn = passoAtaque.querySelector('[data-op-atacar]');
		if (!btn) return;
		travar(btn, controlaFalante(message), `Só ${message.speaker?.alias ?? 'quem ataca'} (ou o mestre) rola o ataque.`);
		btn.addEventListener('click', async (ev) => {
			ev.preventDefault();
			if (!controlaFalante(message) || resultadoAtaque(message)) return;
			btn.disabled = true;
			const r = await atacarDoCartao(message, ev).catch(err => { console.error(err); return null; });
			if (!r) btn.disabled = false;
		});
		return;
	}
	const actor = ChatMessage.getSpeakerActor(message.speaker);
	const item = actor?.items.get(info.itemId);
	const alvos = at.alvosInfo ?? [];
	const atingidos = alvos.filter(a => a.defesa == null || at.total >= a.defesa);
	const resumo = at.critico ? 'Crítico!' : alvos.length ? `acertou ${atingidos.length} de ${alvos.length}` : 'sem alvo marcado';
	passoAtaque.innerHTML = `<div class="op-card__test ${atingidos.length || !alvos.length ? 'is-ok' : 'is-fail'}"><span>Ataque <strong>${at.total}</strong>${htmlDados(at.dados)}</span><span>${resumo}</span></div>${(at.notas ?? []).map(n => `<small class="op-cond-note">${esc(n)}</small>`).join('')}
		${htmlAlvos(alvos, { ataque: at.total })}`;
	if (alvos.length && !atingidos.length) {
		passoDano.innerHTML = '<p class="op-step__hint">Errou. Sem dano.</p>';
		return;
	}
	if (!item) { passoDano.innerHTML = '<p class="op-step__hint">A arma não está mais na ficha.</p>'; return; }
	const s = item.system;
	const forca = s.corpoACorpo ? actor.system.atributos?.for?.valor ?? 0 : 0;
	const mult = at.critico ? s.critico.multiplicador : 1;
	const dice = mult > 1 ? multiplicarDados(s.dano.formula, mult) : s.dano.formula;
	const formula = [dice, forca ? `${forca}` : '', s.bonusDano].filter(Boolean).join(' + ');
	passoDano.classList.add('op-chatcard__btns');
	passoDano.innerHTML = (alvos.length ? '' : '<p class="op-step__hint">Sem alvo marcado: confira a Defesa antes de rolar.</p>')
		+ botaoDano(formula, `${item.name}: dano${at.critico ? ' crítico' : ''}`, s.dano.tipo, at.critico ? `Rolar dano crítico ×${mult}` : 'Rolar dano', atingidos);
}

/** "2d6+1" ×3 → "6d6+1": multiplica só os dados. */
export function multiplicarDados(formula, mult) {
	return String(formula).replace(/(\d*)d(\d+)/g, (m, n, f) => `${(Number(n) || 1) * mult}d${f}`);
}

export function botaoDano(formula, titulo, tipo, rotulo, alvos = []) {
	const nome = TIPOS_DANO[tipo] ?? '';
	return `<button type="button" class="op-btn-roll" data-op-roll="${encodeURIComponent(formula)}" data-op-title="${encodeURIComponent(titulo)}" data-op-type="${tipo ?? ''}"${attrAlvos(alvos)}>
		<i class="fa-solid fa-burst" aria-hidden="true"></i> ${rotulo} <small>${formula}${nome ? ` ${nome.toLowerCase()}` : ''}</small></button>`;
}

export function botaoCura(formula, titulo, alvos = []) {
	return `<button type="button" class="op-btn-roll" data-op-roll="${encodeURIComponent(formula)}" data-op-title="${encodeURIComponent(titulo)}" data-op-type="cura"${attrAlvos(alvos)}>
		<i class="fa-solid fa-heart-pulse" aria-hidden="true"></i> Cura <small>${formula}</small></button>`;
}

/** Quem pode usar cada botão: desliga para os outros e explica no title. */
function travar(btn, pode, motivo) {
	if (pode) return;
	btn.disabled = true;
	btn.classList.add('is-locked');
	btn.title = motivo;
}

/** O usuário controla quem fala na mensagem (o atacante ou conjurador)? */
export function controlaFalante(message) {
	if (game.user.isGM) return true;
	const ator = ChatMessage.getSpeakerActor(message.speaker);
	return ator ? ator.isOwner : message.isAuthor;
}

/** Botões nos cartões: rolar dano/cura e aplicar nos tokens selecionados. */
export function registrarBotoesChat() {
	// Quando uma rolagem ligada a um cartão chega ou some, o cartão se redesenha em todos os clientes.
	const redesenhar = (m) => {
		for (const k of ['ataqueDe', 'danoDe']) {
			const card = game.messages.get(m.getFlag(SYSTEM_ID, k));
			if (card) ui.chat?.updateMessage?.(card);
		}
	};
	Hooks.on('createChatMessage', redesenhar);
	Hooks.on('deleteChatMessage', redesenhar);
	Hooks.on('renderChatMessageHTML', (message, html) => {
		renderCartaoArma(message, html);
		if (message.flags?.[SYSTEM_ID] || html.querySelector('.op-chatcard, .op-attack')) {
			html.classList.add('op-dossie', 'op-msg');
			const el = html.querySelector('[class*="op-el--"]')?.className.match(/op-el--(\w+)/)?.[1];
			if (el) html.classList.add(`op-el--${el}`);
			// No ataque, o resultado vem antes dos botões de dano.
			const btns = html.querySelector('.op-attack .op-btns');
			const roll = html.querySelector('.dice-roll');
			if (btns && roll) roll.after(btns);
		}
		const falante = controlaFalante(message);
		const nomeFalante = message.speaker?.alias ?? 'quem rolou';
		for (const btn of html.querySelectorAll('[data-op-roll]')) {
			// Já rolado a partir deste cartão: mostra o resultado no lugar do botão.
			const tituloBtn = decodeURIComponent(btn.dataset.opTitle ?? '');
			const noCartao = resultados(message).danos?.[chaveFlag(tituloBtn)];
			if (noCartao) {
				const cura = noCartao.tipo === 'cura';
				const caixa = document.createElement('div');
				caixa.className = 'op-dano-feito';
				caixa.innerHTML = `<div class="op-card__test is-done"><span>${cura ? 'Cura' : 'Dano'} <strong>${noCartao.total}</strong>${htmlDados(noCartao.dados)}</span><span>${esc(noCartao.formula ?? '')}</span></div>`;
				caixa.append(barraAplicar(noCartao.total, noCartao));
				btn.replaceWith(caixa);
				continue;
			}
			const feito = mensagemDe(message, 'danoDe', m => m.getFlag(SYSTEM_ID, 'dano')?.titulo === tituloBtn);
			if (feito?.rolls?.length) {
				const cura = btn.dataset.opType === 'cura';
				btn.outerHTML = `<div class="op-card__test is-done"><span>${cura ? 'Cura' : 'Dano'} <strong>${feito.rolls[0].total}</strong></span><span>aplique na rolagem abaixo</span></div>`;
				continue;
			}
			travar(btn, falante, `Só ${nomeFalante} (ou o mestre) rola isto.`);
			btn.addEventListener('click', async (ev) => {
				ev.preventDefault();
				if (!controlaFalante(message)) return;
				const formula = decodeURIComponent(btn.dataset.opRoll);
				const titulo = decodeURIComponent(btn.dataset.opTitle ?? '');
				const tipo = btn.dataset.opType || '';
				// Sem alvos no cartão: os que quem rola marcou agora.
				const alvos = btn.dataset.opAlvos ? btn.dataset.opAlvos.split(',') : alvosAtuais().map(a => a.uuid);
				btn.disabled = true;
				const roll = await new Roll(formula).evaluate();
				const dano = { titulo, tipo, alvos, total: roll.total, formula: roll.formula, dados: dadosDe(roll) };
				await mostrarDados(roll);
				const fimDaAcao = async () => { const { resolverPendente } = await import('../automation/dado-uso.mjs'); await resolverPendente(message); };
				if (await gravarNoCartao(message, `danos.${chaveFlag(titulo)}`, dano, roll)) return fimDaAcao();
				await roll.toMessage({
					speaker: message.speaker,
					flavor: `<span class="op-flavor">${esc(titulo)}</span>`,
					flags: { [SYSTEM_ID]: { danoDe: message.id, dano: { tipo, alvos, titulo } } }
				});
				await fimDaAcao();
			});
		}
		for (const btn of html.querySelectorAll('[data-op-resist]')) {
			const res = resultados(message).resist?.[chaveFlag(btn.dataset.opResist)];
			if (res) {
				btn.outerHTML = `<span class="op-target__state ${res.ok ? 'is-hit' : 'is-miss'}" title="${esc(res.nome)} ${res.total} contra DT ${res.dt}">${esc(res.nome)} ${res.total} · ${res.ok ? 'passou' : 'falhou'}</span>`;
				continue;
			}
			const alvo = atorDoAlvo(btn.dataset.opResist);
			travar(btn, !alvo || alvo.isOwner, `Só quem controla ${nomeDoAlvo(btn.dataset.opResist) ?? 'o alvo'} (ou o mestre) resiste.`);
			btn.addEventListener('click', async (ev) => {
				ev.preventDefault();
				const ator = atorDoAlvo(btn.dataset.opResist);
				if (!ator) return ui.notifications.warn('O alvo não está mais na cena.');
				if (!ator.isOwner) return ui.notifications.warn(`Só quem controla ${ator.name} (ou o mestre) resiste.`);
				const t = ator.dadosTeste(btn.dataset.pericia);
				if (!t) return ator.rolarPericia(btn.dataset.pericia, { dt: Number(btn.dataset.dt), event: { shiftKey: true } });
				btn.disabled = true;
				const dt = Number(btn.dataset.dt);
				const roll = await new Roll(formulaTeste(t.dados, t.bonus), ator.getRollData()).evaluate();
				const res = { uuid: btn.dataset.opResist, nome: t.nome, total: roll.total, dt, ok: roll.total >= dt, dados: dadosDe(roll) };
				await mostrarDados(roll);
				if (await gravarNoCartao(message, `resist.${chaveFlag(btn.dataset.opResist)}`, res, roll)) return;
				await ator.rolarPericia(btn.dataset.pericia, { dt, event: { shiftKey: true } });
			});
		}
		// Mensagens de dano ganham os botões de aplicar.
		const dano = message.getFlag(SYSTEM_ID, 'dano');
		if (dano && message.rolls?.length && !html.querySelector('.op-apply')) {
			const total = message.rolls[0].total;
			const cura = dano.tipo === 'cura';
			const nomes = (dano.alvos ?? []).map(u => nomeDoAlvo(u)).filter(Boolean);
			const em = nomes.length === 1 ? ` em ${esc(nomes[0])}` : nomes.length ? ` em ${nomes.length} alvos` : '';
			const dica = nomes.length > 1 ? ` title="${esc(nomes.join(', '))}"` : '';
			const bar = document.createElement('div');
			bar.className = 'op-apply';
			bar.innerHTML = cura
				? `<button type="button" data-mult="-1"${dica}><i class="fa-solid fa-heart-pulse"></i> Curar ${total}${em}</button>`
				: `<button type="button" data-mult="1"${dica}><i class="fa-solid fa-burst"></i> Aplicar ${total}${em}</button>
				   <button type="button" data-mult="0.5">½</button><button type="button" data-mult="2">×2</button>`;
			const atores = (dano.alvos ?? []).map(u => atorDoAlvo(u)).filter(Boolean);
			const podeAplicar = !atores.length || atores.every(a => a.isOwner);
			for (const b of bar.querySelectorAll('button')) {
				travar(b, podeAplicar, `Só o mestre (ou quem controla o alvo) aplica.`);
				b.addEventListener('click', () => aplicarNosSelecionados(total, Number(b.dataset.mult), cura ? null : dano.tipo, dano.alvos));
			}
			html.querySelector('.message-content')?.append(bar);
		}
	});
}

/** Botões Aplicar / ½ / ×2 (ou Curar) para um total de dano, dentro do cartão. */
function barraAplicar(total, dano) {
	const cura = dano.tipo === 'cura';
	const nomes = (dano.alvos ?? []).map(u => nomeDoAlvo(u)).filter(Boolean);
	const em = nomes.length === 1 ? ` em ${esc(nomes[0])}` : nomes.length ? ` em ${nomes.length} alvos` : '';
	const dica = nomes.length > 1 ? ` title="${esc(nomes.join(', '))}"` : '';
	const bar = document.createElement('div');
	bar.className = 'op-apply';
	bar.innerHTML = cura
		? `<button type="button" data-mult="-1"${dica}><i class="fa-solid fa-heart-pulse"></i> Curar ${total}${em}</button>`
		: `<button type="button" data-mult="1"${dica}><i class="fa-solid fa-burst"></i> Aplicar ${total}${em}</button>
		   <button type="button" data-mult="0.5">½</button><button type="button" data-mult="2">×2</button>`;
	const atores = (dano.alvos ?? []).map(u => atorDoAlvo(u)).filter(Boolean);
	const podeAplicar = !atores.length || atores.every(a => a.isOwner);
	for (const b of bar.querySelectorAll('button')) {
		travar(b, podeAplicar, 'Só o mestre (ou quem controla o alvo) aplica.');
		b.addEventListener('click', () => aplicarNosSelecionados(total, Number(b.dataset.mult), cura ? null : dano.tipo, dano.alvos));
	}
	return bar;
}

/** Aplica nos alvos do cartão; sem alvos, nos tokens selecionados; sem nada, no próprio personagem. */
async function aplicarNosSelecionados(total, mult, tipo, alvos = []) {
	const doCartao = (alvos ?? []).map(u => atorDoAlvo(u)).filter(Boolean);
	const tokens = canvas?.tokens?.controlled ?? [];
	const actors = doCartao.length ? doCartao
		: tokens.length ? tokens.map(t => t.actor).filter(Boolean)
			: (game.user.character ? [game.user.character] : []);
	if (!actors.length) return ui.notifications.warn('Marque um alvo (tecla T) ou selecione um token para aplicar.');
	for (const a of actors) {
		if (!a.isOwner) { ui.notifications.warn(`Só o mestre aplica em ${a.name}.`); continue; }
		if (mult < 0) await a.curar(Math.abs(total));
		else await a.aplicarDano(Math.floor(total * mult), tipo);
	}
}
