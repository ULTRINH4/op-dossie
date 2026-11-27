/**
 * Subir de nível: avança um passo na progressão da mesa e aplica o que dá para automatizar.
 * NEX +5% (até 99%), Nível +1, próxima Patente ou Estágio +1; Mundano vira agente em NEX 5%.
 * Pede aumento de atributo, graus de treinamento e trilha quando o passo dá; poderes e rituais
 * ficam como lembrete. Livro de Regras pp. 25–33 e 172; Sobrevivendo ao Horror pp. 30–32 e 108–113.
 */
import { SYSTEM_ID, ATRIBUTOS, PERICIAS, PATENTES, PATENTE_CLASSE, indicePatente } from '../config.mjs';
import { DATA, classAvailable, trilhaAvailable } from '../rules/table-rules.mjs';
import { PERICIAS_NOVA_CLASSE, TREINAMENTO_ESPECIAL } from '../rules/opcionais-dados.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const GRAU_BASE = { combatente: 2, especialista: 5, ocultista: 3 };
const NOME_GRAU = { 5: 'Treinado', 10: 'Veterano', 15: 'Expert' };

/** Ganhos de cada patente acima de Recruta (Tabelas 2.7–2.9). */
const GANHOS_PATENTE = {
	1: { ganhos: ['Aumento de atributo', 'Poder de classe'], aumento: true },
	2: { ganhos: ['Grau de treinamento', 'Poder de classe', 'Trilha (1ª habilidade)'], grau: true, trilha: true },
	3: { ganhos: ['Aumento de atributo', 'Poder de classe', 'Trilha (2ª habilidade)'], aumento: true },
	4: { ganhos: ['Grau de treinamento', 'Poder de classe', 'Trilha (3ª ou 4ª habilidade)'], grau: true }
};

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Para onde o agente vai e o que ganha nesse passo. */
export function proximoPasso(actor, { treinamento = false } = {}) {
	const s = actor.system;
	const r = s.regras;
	const chave = s.classe?.system.chave;
	if (!s.classe) return { erro: 'O agente ainda não tem classe. Use o assistente de criação.' };
	// Decrepitude (idoso): Aumento de Atributo não sobe Agilidade, Força nem Vigor (OPRPG p. 173).
	const semFisicos = !!s.idade?.faixa?.decrepitude;

	// Treinamento Especial: o mestre converte o Sobrevivente em agente de NEX 5% (SaH p. 32).
	if (treinamento && s.isSobrevivente) {
		return { trilho: 'treinamento', de: `Estágio ${s.progressao.estagio}`, para: 'NEX 5%', update: { 'system.progressao.nex': 5 },
			ganhos: ['Proficiências e habilidades da nova classe (veja a ficha)'], virarAgente: true, treinamento: true };
	}

	if (s.isMundano) {
		return { trilho: 'mundano', de: 'NEX 0%', para: 'NEX 5%', update: { 'system.progressao.nex': 5 }, semFisicos,
			ganhos: ['Perícias treinadas e proficiências da nova classe', 'Ocultista: 3 rituais de 1º círculo'], virarAgente: true, aumento: true, maxAttr: 3 };
	}
	if (s.isSobrevivente) {
		const e = s.progressao.estagio;
		if (e >= 5) return { erro: 'Estágio 5 é o último. A partir daqui, só o Treinamento Especial que o mestre libera.' };
		const novo = e + 1;
		const entrada = s.classe.system.progressao.find(p => p.estagio === novo);
		return { trilho: 'estagio', de: `Estágio ${e}`, para: `Estágio ${novo}`, update: { 'system.progressao.estagio': novo }, semFisicos, podeTreinar: true,
			ganhos: entrada?.ganhos ?? [], aumento: novo === 3, maxAttr: 3, trilha: novo === 2 };
	}
	if (s.usaPatentes) {
		const i = indicePatente(s.patente.pp);
		if (i >= PATENTES.length - 1) return { erro: 'Agente de elite é a última patente.' };
		const g = GANHOS_PATENTE[i + 1];
		const extra = chave === 'ocultista' ? ['2 rituais novos', ...(i + 1 === 2 ? ['Rituais de 2º círculo'] : i + 1 === 3 ? ['Rituais de 3º círculo'] : i + 1 === 4 ? ['Rituais de 4º círculo'] : [])] : [];
		return { trilho: 'patentes', de: PATENTES[i].nome, para: PATENTES[i + 1].nome, semFisicos,
			update: { 'system.patente.pp': Math.max(s.patente.pp, PATENTES[i + 1].pp) },
			ganhos: [...g.ganhos, ...extra], aumento: !!g.aumento, maxAttr: 4, grau: !!g.grau, contaGrau: 2 + s.atributos.int.valor, trilha: !!g.trilha };
	}
	// NEX ou Nível de Experiência: os ganhos seguem a tabela da classe pelo NEX equivalente.
	const porNivel = r.progressao === 'nivel';
	const atual = porNivel ? s.progressao.nivel : s.progressao.nex;
	if (porNivel ? atual >= 20 : atual >= 99) return { erro: porNivel ? 'Nível 20 é o máximo.' : 'NEX 99% é o máximo.' };
	const novo = porNivel ? atual + 1 : (atual >= 95 ? 99 : Math.floor(atual / 5) * 5 + 5);
	const nexEq = porNivel ? (novo >= 20 ? 99 : novo * 5) : novo;
	const entrada = s.classe.system.progressao.find(p => p.nex === nexEq);
	const ganhos = [...(entrada?.ganhos ?? [])];
	if (chave === 'ocultista' && r.aprendizadoRituais !== 'campo') {
		const aprende = r.aprendizadoRituais !== 'lento' || novo % 2 === 1;
		if (aprende) ganhos.push('1 ritual novo');
	}
	const tem = (txt) => ganhos.some(g => norm(g).includes(txt));
	return {
		trilho: porNivel ? 'nivel' : 'nex',
		de: porNivel ? `Nível ${atual}` : `NEX ${atual}%`,
		para: porNivel ? `Nível ${novo}` : `NEX ${novo}%`,
		update: porNivel ? { 'system.progressao.nivel': novo } : { 'system.progressao.nex': novo },
		ganhos, aumento: tem('aumento de atributo'), maxAttr: 5, semFisicos,
		grau: tem('grau de treinamento'), contaGrau: (GRAU_BASE[chave] ?? 2) + s.atributos.int.valor,
		trilha: nexEq === 10 && !s.trilha
	};
}

export class SubirNivel extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		classes: ['op-dossie', 'op-criacao', 'op-subir'],
		window: { title: 'Subir de nível', icon: 'fa-solid fa-angles-up', resizable: true },
		position: { width: 620, height: 'auto' },
		actions: { confirmar: SubirNivel.#confirmar, cancelar: SubirNivel.#cancelar }
	};

	static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/subir-nivel.hbs`, scrollable: ['.op-subir__scroll'] } };

	#actor;
	#escolha = { atributo: null, graus: [], trilha: null, classe: null, treinamento: false, fixas: {}, livres: [] };
	#aplicando = false;

	constructor({ actor, ...options }) {
		super(options);
		this.#actor = actor;
	}

	get title() { return `Subir de nível: ${this.#actor.name}`; }

	/** Máximos de PV/PE/SAN/PD depois do passo, sem gravar nada. */
	#recursosDepois(passo) {
		const clone = this.#actor.clone(foundry.utils.expandObject({
			...passo.update,
			...(this.#escolha.atributo ? { [`system.atributos.${this.#escolha.atributo}.valor`]: this.#actor.system.atributos[this.#escolha.atributo].valor + 1 } : {})
		}), { keepId: true });
		return clone.system.recursos;
	}

	async _prepareContext() {
		const actor = this.#actor;
		const s = actor.system;
		const esc = this.#escolha;
		const passo = proximoPasso(actor, { treinamento: esc.treinamento });
		if (passo.erro) return { erro: passo.erro };
		const r = s.regras;

		const atributos = passo.aumento ? Object.entries(ATRIBUTOS).map(([k, a]) => {
			const v = s.atributos[k].valor;
			const fisico = passo.semFisicos && ['agi', 'for', 'vig'].includes(k);
			return { k, nome: a.nome, abv: a.abv, v, checked: esc.atributo === k, bloqueado: v >= passo.maxAttr || fisico, motivo: fisico ? 'Decrepitude' : null };
		}) : null;

		const treinadas = Object.entries(PERICIAS).filter(([k]) => s.pericias[k].grau >= 5 && s.pericias[k].grau < 15);
		const graus = passo.grau ? {
			conta: Math.min(passo.contaGrau, treinadas.length),
			marcadas: esc.graus.length,
			itens: treinadas.map(([k, p]) => {
				const g = s.pericias[k].grau;
				return { k, nome: p.nome, de: NOME_GRAU[g], para: NOME_GRAU[g + 5], checked: esc.graus.includes(k), bloqueada: !esc.graus.includes(k) && esc.graus.length >= passo.contaGrau };
			})
		} : null;

		const classeChave = esc.classe ?? s.classe?.system.chave;
		const trilhas = passo.trilha && !passo.virarAgente
			? (DATA.conteudo.trilhas[classeChave] ?? []).filter(t => trilhaAvailable(classeChave, t.id, r)).map(t => ({ id: t.id, nome: t.nome, checked: esc.trilha === t.id }))
			: null;
		// Perícias da nova classe (Mundano e Treinamento Especial).
		const cfg = passo.virarAgente && esc.classe ? PERICIAS_NOVA_CLASSE[esc.classe] : null;
		const jaTreinadas = new Set(Object.keys(PERICIAS).filter(k => s.pericias[k].grau >= 5));
		const fixasEscolhidas = new Set(Object.values(esc.fixas));
		const novaClasse = cfg ? {
			fixas: cfg.fixas.map((g, i) => ({ i, unica: g.length === 1, nome: g.map(k => PERICIAS[k].nome).join(' ou '),
				opcoes: g.map(k => ({ k, nome: PERICIAS[k].nome, checked: g.length === 1 || esc.fixas[i] === k, ja: jaTreinadas.has(k) })) })),
			livres: cfg.livres ? { conta: cfg.livres, marcadas: esc.livres.length,
				itens: Object.entries(PERICIAS).filter(([k]) => !jaTreinadas.has(k) && !fixasEscolhidas.has(k) && !cfg.fixas.some(g => g.length === 1 && g[0] === k))
					.map(([k, p]) => ({ k, nome: p.nome, checked: esc.livres.includes(k), bloqueada: !esc.livres.includes(k) && esc.livres.length >= cfg.livres })) } : null
		} : null;

		const classes = passo.virarAgente
			? ['combatente', 'especialista', 'ocultista'].filter(id => classAvailable(id, { ...r, iniciante: 'nenhum' })).map(id => ({ id, nome: DATA.conteudo.classes.find(c => c.id === id)?.nome ?? id, checked: esc.classe === id }))
			: null;

		const antes = s.recursos;
		const depois = this.#recursosDepois(passo);
		const chaves = s.usaPatentes || s.semSanidade ? ['pv', 'pd'] : ['pv', 'pe', 'san'];
		const recursos = passo.virarAgente ? [] : chaves.map(k => ({ abv: k.toUpperCase(), de: antes[k].max, para: depois[k].max, sobe: depois[k].max > antes[k].max }));

		const falta = [];
		if (classes && !esc.classe) falta.push('Escolha a classe.');
		if (novaClasse?.fixas.some(f => !f.unica && !esc.fixas[f.i])) falta.push('Escolha as perícias da nova classe.');
		else if (novaClasse?.livres && esc.livres.length < Math.min(novaClasse.livres.conta, novaClasse.livres.itens.length)) falta.push(`Escolha ${novaClasse.livres.conta - esc.livres.length} perícia(s) da nova classe.`);
		if (atributos && !esc.atributo && atributos.some(a => !a.bloqueado)) falta.push('Escolha o atributo que sobe.');
		if (graus && esc.graus.length < graus.conta) falta.push(`Escolha ${graus.conta - esc.graus.length} perícia(s) para subir o grau.`);
		if (trilhas?.length && !esc.trilha) falta.push('Escolha a trilha.');

		// O que a janela já pergunta não vira lembrete (a trilha escolhida aqui já traz a 1ª habilidade).
		const lembretes = passo.ganhos.filter(g => !/aumento de atributo|grau de treinamento|^habilidade de trilha$/i.test(g) && !(trilhas?.length && /^trilha \(1/i.test(g)));
		return { passo, atributos, graus, trilhas, classes, novaClasse, recursos, falta: falta[0] ?? null, pode: !falta.length && !this.#aplicando, lembretes,
			podeTreinar: (passo.podeTreinar || esc.treinamento) && game.user.isGM, treinamento: esc.treinamento };
	}

	_onFirstRender(context, options) {
		super._onFirstRender(context, options);
		this.element.addEventListener('change', (ev) => {
			const el = ev.target;
			const esc = this.#escolha;
			if (el.name === 'atributo') esc.atributo = el.value;
			else if (el.name === 'trilha') esc.trilha = el.value;
			else if (el.name === 'classe') { esc.classe = el.value; esc.fixas = {}; esc.livres = []; }
			else if (el.name === 'treinamento') { esc.treinamento = el.checked; esc.classe = null; esc.fixas = {}; esc.livres = []; esc.atributo = null; esc.trilha = null; }
			else if (el.dataset.campo === 'fixa') esc.fixas[el.dataset.i] = el.value;
			else if (el.dataset.campo === 'livre') {
				const i = esc.livres.indexOf(el.value);
				if (el.checked && i < 0) esc.livres.push(el.value);
				if (!el.checked && i >= 0) esc.livres.splice(i, 1);
			}
			else if (el.dataset.campo === 'grau') {
				const i = esc.graus.indexOf(el.value);
				if (el.checked && i < 0) esc.graus.push(el.value);
				if (!el.checked && i >= 0) esc.graus.splice(i, 1);
			} else return;
			this.render();
		});
	}

	static #cancelar() { this.close(); }

	static async #confirmar() {
		if (this.#aplicando) return;
		const ctx = await this._prepareContext();
		if (!ctx.pode) return;
		this.#aplicando = true;
		try {
			await this.#aplicar(ctx);
			await this.close();
		} catch (err) {
			console.error(`${SYSTEM_ID} | subir de nível`, err);
			ui.notifications.error('Não consegui subir de nível. Veja o console (F12).');
			this.#aplicando = false;
			this.render();
		}
	}

	async #aplicar(ctx) {
		const actor = this.#actor;
		const s = actor.system;
		const { passo } = ctx;
		const esc = this.#escolha;
		const antes = Object.fromEntries(Object.entries(s.recursos).map(([k, v]) => [k, v.max]));

		const update = { ...passo.update };
		if (esc.atributo) update[`system.atributos.${esc.atributo}.valor`] = s.atributos[esc.atributo].valor + 1;
		for (const k of esc.graus) update[`system.pericias.${k}.grau`] = Math.min(s.pericias[k].grau + 5, 15);
		if (ctx.novaClasse) {
			for (const f of ctx.novaClasse.fixas) {
				const k = f.unica ? f.opcoes[0].k : esc.fixas[f.i];
				if (k && s.pericias[k].grau < 5) update[`system.pericias.${k}.grau`] = 5;
			}
			for (const k of esc.livres) update[`system.pericias.${k}.grau`] = 5;
		}
		// Treinamento Especial: guarda a base de Sobrevivente para os máximos (agente.mjs).
		if (passo.treinamento && esc.classe) {
			const sb = s.classe.system;
			update[`flags.${SYSTEM_ID}.treinamentoEspecial`] = {
				estagio: s.progressao.estagio, classe: esc.classe, bonus: TREINAMENTO_ESPECIAL[esc.classe],
				base: { pv: { ...sb.pv }, pe: { ...sb.pe }, san: { ...sb.san }, pd: { ...sb.pd } }
			};
		}

		const itens = [];
		const pacote = async (nome) => (await game.packs.get(`${SYSTEM_ID}.${nome}`)?.getDocuments()) ?? [];
		if (esc.classe) {
			const nova = (await pacote('classes')).find(d => d.system.chave === esc.classe);
			if (nova) {
				await actor.deleteEmbeddedDocuments('Item', actor.items.filter(i => i.type === 'classe').map(i => i.id));
				itens.push(game.items.fromCompendium(nova));
			}
		}
		if (esc.trilha) {
			const chave = esc.classe ?? s.classe.system.chave;
			const t = (await pacote('trilhas')).find(d => d.system.classe === chave && d.system.chave === esc.trilha);
			if (t) itens.push(game.items.fromCompendium(t));
		}
		await actor.update(update);
		if (itens.length) await actor.createEmbeddedDocuments('Item', itens);

		// O que o máximo subiu entra também no valor atual.
		const novos = actor.system.recursos;
		const ganho = {};
		for (const [k, v] of Object.entries(novos)) {
			const d = v.max - (antes[k] ?? 0);
			if (d > 0) ganho[`system.recursos.${k}.valor`] = v.valor + d;
		}
		if (Object.keys(ganho).length) await actor.update(ganho);

		// Aviso no chat para a mesa.
		const linhas = [
			esc.classe ? `Classe: ${DATA.conteudo.classes.find(c => c.id === esc.classe)?.nome}` : null,
			esc.atributo ? `${ATRIBUTOS[esc.atributo].nome} +1` : null,
			esc.graus.length ? `Grau de treinamento: ${esc.graus.map(k => PERICIAS[k].nome).join(', ')}` : null,
			esc.trilha ? `Trilha: ${ctx.trilhas.find(t => t.id === esc.trilha)?.nome}` : null,
			...ctx.recursos.filter(r => r.sobe).map(r => `${r.abv} ${r.de} → ${r.para}`),
			...ctx.lembretes.map(l => `A escolher: ${l}`)
		].filter(Boolean);
		const esc_ = foundry.utils.escapeHTML;
		await ChatMessage.implementation.create({
			speaker: ChatMessage.implementation.getSpeaker({ actor }),
			flags: { [SYSTEM_ID]: { subiu: { de: passo.de, para: passo.para } } },
			content: `<div class="op-dossie op-chatcard op-subiu"><header class="op-chatcard__head"><img src="icons/svg/upgrade.svg" alt=""><div><p class="op-chatcard__eyebrow">Subiu de nível · ${esc_(passo.de)}</p><h3>${esc_(actor.name)}: ${esc_(passo.para)}</h3></div></header><div class="op-chatcard__text"><ul>${linhas.map(l => `<li>${esc_(l)}</li>`).join('')}</ul></div></div>`
		});
		ui.notifications.info(`${actor.name}: ${passo.para}.`);
	}
}

export function abrirSubirNivel(actor) {
	const id = `op-subir-${actor.id}`;
	const aberta = foundry.applications.instances.get(id);
	if (aberta) return aberta.bringToFront?.() ?? aberta.render(true);
	return new SubirNivel({ actor, id }).render(true);
}
