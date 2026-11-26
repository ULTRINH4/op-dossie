/**
 * Ficha de agente.
 */
import { trocarImagem } from './imagem.mjs';
import { abrirCriacao } from './criacao.mjs';
import { abrirSubirNivel } from './subir-nivel.mjs';
import { interessesDe, adicionarInteresse, removerInteresse, fazerFolga, encerrarFolga } from '../automation/folga.mjs';
import { INTERESSES } from '../rules/opcionais-dados.mjs';
import { SYSTEM_ID, ATRIBUTOS, PERICIAS, GRAUS, ELEMENTOS, TIPOS_DANO, DANO_PARANORMAL, EXECUCAO, ALCANCE, DURACAO, TIPOS_PODER } from '../config.mjs';
import { worldRules } from '../rules/table-rules.mjs';
import { rulesFor } from '../rules/table-rules.mjs';
import { conjurarRitual } from '../automation/conjurar.mjs';
import { CONDICOES, CONDICAO, resumoCondicao, condicoesAtivas } from '../automation/condicoes.mjs';
import { resumoMunicao, recarregar, usaMunicao } from '../automation/municao.mjs';
import { LIMITES } from '../automation/poderes.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const TPL = `systems/${SYSTEM_ID}/templates/sheet`;
const GRAU_SEQ = [0, 5, 10, 15];
const UNICOS = ['classe', 'origem', 'trilha'];

export class AgenteSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
	static DEFAULT_OPTIONS = {
		classes: ['op-dossie', 'op-agent', 'theme-dark'],
		position: { width: 820, height: 880 },
		window: { resizable: true },
		form: { submitOnChange: true },
		actions: {
			trocarImagem,
			assistente: AgenteSheet.#assistente,
			subirNivel: AgenteSheet.#subirNivel,
			interesseAdd: AgenteSheet.#interesseAdd,
			interesseRemover: AgenteSheet.#interesseRemover,
			folga: AgenteSheet.#folga,
			folgaEncerrar: AgenteSheet.#folgaEncerrar,
			rolarAtributo: AgenteSheet.#rolarAtributo,
			rolarPericia: AgenteSheet.#rolarPericia,
			usar: AgenteSheet.#usar,
			conjurar: AgenteSheet.#conjurar,
			expandir: AgenteSheet.#expandir,
			ajustar: AgenteSheet.#ajustar,
			grau: AgenteSheet.#grau,
			edicao: AgenteSheet.#edicao,
			equipar: AgenteSheet.#equipar,
			criar: AgenteSheet.#criar,
			remover: AgenteSheet.#remover,
			abrir: AgenteSheet.#abrir,
			efeitoAlternar: AgenteSheet.#efeitoAlternar,
			condicao: AgenteSheet.#condicao,
			recarregar: AgenteSheet.#recarregar,
			efeitoCriar: AgenteSheet.#efeitoCriar
		}
	};

	static PARTS = {
		header: { template: `${TPL}/header.hbs` },
		tabs: { template: `${TPL}/tabs.hbs` },
		skills: { template: `${TPL}/tab-skills.hbs`, scrollable: [''] },
		combat: { template: `${TPL}/tab-combat.hbs`, scrollable: [''] },
		rituals: { template: `${TPL}/tab-rituals.hbs`, scrollable: [''] },
		abilities: { template: `${TPL}/tab-abilities.hbs`, scrollable: [''] },
		inventory: { template: `${TPL}/tab-inventory.hbs`, scrollable: [''] },
		biography: { template: `${TPL}/tab-biography.hbs`, scrollable: [''] },
		effects: { template: `${TPL}/tab-effects.hbs`, scrollable: [''] }
	};

	static TAB_LIST = [
		{ id: 'skills', label: 'Perícias', icon: 'fa-solid fa-list-check' },
		{ id: 'combat', label: 'Combate', icon: 'fa-solid fa-crosshairs' },
		{ id: 'rituals', label: 'Rituais', icon: 'fa-solid fa-circle-nodes' },
		{ id: 'abilities', label: 'Habilidades', icon: 'fa-solid fa-star' },
		{ id: 'inventory', label: 'Inventário', icon: 'fa-solid fa-briefcase' },
		{ id: 'biography', label: 'Diário', icon: 'fa-solid fa-book-open' },
		{ id: 'effects', label: 'Efeitos', icon: 'fa-solid fa-wand-sparkles' }
	];

	#editando = false;
	#abertos = new Set();

	get title() { return this.document.name; }

	_configureRenderOptions(options) {
		super._configureRenderOptions(options);
		options.parts = ['header', 'tabs'];
		if (!this.document.limited) options.parts.push(...AgenteSheet.TAB_LIST.map(t => t.id));
	}

	async _prepareContext(options) {
		const ctx = await super._prepareContext(options);
		const actor = this.document;
		const s = actor.system;
		const regras = rulesFor(actor);
		this.tabGroups.primary ??= 'skills';
		const tabs = Object.fromEntries(AgenteSheet.TAB_LIST.map(t => [t.id, { ...t, active: this.tabGroups.primary === t.id, cssClass: this.tabGroups.primary === t.id ? 'active' : '' }]));
		const editable = this.isEditable;

		Object.assign(ctx, {
			actor, system: s, editable, edit: this.#editando && editable, isGM: game.user.isGM,
			tabs, tabList: Object.values(tabs),
			costLabel: s.semSanidade ? 'PD' : 'PE',
			// Agente ainda sem classe: oferece o assistente de criação.
			semClasse: editable && !s.classe
		});

		// Progressão
		ctx.progress = s.isSobrevivente
			? { label: 'Estágio', name: 'system.progressao.estagio', value: s.progressao.estagio, min: 0, max: 5 }
			: s.usaPatentes
				? { label: 'Prestígio', name: 'system.patente.pp', value: s.patente.pp, min: 0, max: 999, sub: s.patenteAtual.nome, largo: true }
			: regras.progressao === 'nivel'
				? { label: 'Nível', name: 'system.progressao.nivel', value: s.progressao.nivel, min: 0, max: 20, nex: s.progressao.nex }
				: { label: 'NEX', name: 'system.progressao.nex', value: s.progressao.nex, min: 0, max: 99, suffix: '%' };

		// Recursos
		const bar = (key, label) => {
			const r = s.recursos[key];
			const pct = r.max > 0 ? Math.clamp(Math.round((r.valor / r.max) * 100), 0, 100) : 0;
			return { key, abv: key.toUpperCase(), label, value: r.valor, max: r.max, temp: r.temp, pct, low: r.max > 0 && pct <= 25 };
		};
		ctx.bars = [bar('pv', 'Vida')];
		if (s.semSanidade) ctx.bars.push(bar('pd', 'Determinação'));
		else ctx.bars.push(bar('san', 'Sanidade'), bar('pe', 'Esforço'));
		ctx.perRound = { label: `${ctx.costLabel}/rodada`, value: s.limitePE };

		ctx.attrs = Object.entries(ATRIBUTOS).map(([key, a]) => ({ key, ...a, value: s.atributos[key].valor }));
		const cond = s.condicoes ?? { defesa: 0, desloc: null };
		ctx.derived = [
			{ label: 'Defesa', value: s.defesaTotal, cond: cond.defesa ? `–${cond.defesa} por condição` : '' },
			{ label: 'Esquiva', value: s.esquiva },
			{ label: 'Deslocamento', value: `${String(s.deslocamentoTotal).replace('.', ',')}m`, cond: cond.desloc ? 'Reduzido por condição' : '' },
			{ label: 'DT de ritual', value: s.dtRitual }
		];
		ctx.identidade = ['classe', 'origem', 'trilha'].map(k => {
			const it = s[k];
			return { key: k, label: { classe: 'Classe', origem: 'Origem', trilha: 'Trilha' }[k], id: it?.id, name: it?.name ?? '' };
		});
		ctx.patente = s.patenteAtual?.nome ?? '';

		// Perícias
		ctx.skills = Object.entries(PERICIAS).map(([key, def]) => {
			const p = s.pericias[key];
			const c = s.periciasCalc[key];
			const g = GRAUS[p.grau] ?? GRAUS[0];
			return {
				key, label: def.livre && p.nome ? `${def.nome} (${p.nome})` : def.nome, livre: !!def.livre, nome: p.nome ?? '',
				attr: ATRIBUTOS[def.atributo].abv, degree: p.grau, degreeLabel: g.nome, degreeShort: g.curto,
				untrained: p.grau === 0, total: c.total, mod: p.bonus, trainedOnly: !!def.treinada, load: !!def.carga
			};
		});

		// Itens
		const row = (i, extra = {}) => ({
			id: i.id, name: i.name, img: i.img, type: i.type, equipped: i.system.equipado !== false,
			quantity: i.system.quantidade ?? 1, category: i.system.categoria ?? 0, spaces: i.system.espacos ?? 0,
			description: i.system.descricao ?? '', expanded: this.#abertos.has(i.id), ...extra
		});
		const items = actor.items.contents.sort((a, b) => (a.sort || 0) - (b.sort || 0));
		ctx.weapons = items.filter(i => i.type === 'arma').map(i => row(i, {
			attackSkill: i.system.periciaAtaque === 'luta' ? 'Luta' : 'Pontaria',
			damage: `${i.system.dano.formula}${i.system.corpoACorpo && s.atributos.for.valor ? `+${s.atributos.for.valor}` : ''}`,
			damageType: TIPOS_DANO[i.system.dano.tipo] ?? '',
			critical: `${i.system.critico.margem}/×${i.system.critico.multiplicador}`,
			range: i.system.corpoACorpo && i.system.tipo === 'corpo a corpo' ? 'Corpo a corpo' : (i.system.alcance || '—'),
			ammo: resumoMunicao(actor, i), ammoEmpty: resumoMunicao(actor, i) === 'sem munição',
			reload: usaMunicao(i) && worldRules().opcionais?.municao && i.system.tipo === 'fogo'
		}));
		ctx.protections = items.filter(i => i.type === 'protecao').map(i => row(i, { defense: i.system.defesa }));
		ctx.resistances = Object.entries(TIPOS_DANO).map(([key, label]) => ({ key, label, value: s.resistencias[key], paranormal: DANO_PARANORMAL.includes(key) }));
		ctx.ritualCircles = [1, 2, 3, 4].map(circle => ({
			circle, label: `${circle}º círculo`,
			items: items.filter(i => i.type === 'ritual' && i.system.circulo === circle).map(i => {
				const r = i.system;
				return row(i, {
					element: r.elemento, elementLabel: ELEMENTOS[r.elemento]?.nome ?? '',
					cost: `${r.custoBase} ${ctx.costLabel}`,
					execution: EXECUCAO[r.execucao] ?? '', range: r.alcance.texto || ALCANCE[r.alcance.chave] || '',
					resistance: r.resistencia.texto, damage: r.dano?.formula ? `${r.dano.formula} ${TIPOS_DANO[r.dano.tipo]?.toLowerCase() ?? ''}` : '',
					discente: r.discente ? `+${r.discente.custoExtra}` : null, verdadeiro: r.verdadeiro ? `+${r.verdadeiro.custoExtra}` : null
				});
			})
		})).filter(c => c.items.length || ctx.edit);
		ctx.abilityGroups = Object.entries(TIPOS_PODER).map(([type, label]) => ({
			type, label,
			items: items.filter(i => i.type === 'poder' && (i.system.tipo || 'outro') === type).map(i => row(i, {
				cost: i.system.custo ? `${i.system.custo} ${ctx.costLabel}` : '', activation: EXECUCAO[i.system.execucao] ?? '',
				uses: i.system.limite && i.system.usos.max ? `${i.system.usos.valor}/${i.system.usos.max} ${{ rodada: 'rodada', cena: 'cena', interludio: 'interlúdio', missao: 'missão' }[i.system.limite]}` : '',
				usesEmpty: i.system.limite && i.system.usos.max && i.system.usos.valor <= 0
			}))
		})).filter(g => g.items.length || ctx.edit);
		ctx.classItem = s.classe; ctx.originItem = s.origem; ctx.trilhaItem = s.trilha;
		ctx.equipment = items.filter(i => i.type === 'equipamento').map(i => row(i));

		const usados = [0, 0, 0, 0, 0];
		for (const i of items) if (['arma', 'protecao', 'equipamento'].includes(i.type)) usados[i.system.categoria] += 1;
		const lim = s.patenteAtual?.limites ?? [0, 0, 0, 0];
		const roman = ['I', 'II', 'III', 'IV'];
		ctx.inventory = {
			patente: s.patenteAtual?.nome ?? 'Recruta', prestige: s.patente.pp, credit: s.patenteAtual?.credito ?? '',
			limits: [1, 2, 3, 4].map(c => ({ roman: roman[c - 1], used: usados[c], max: lim[c - 1], over: usados[c] > lim[c - 1] })),
			spaces: { value: s.carga.usado, max: s.carga.max, pct: Math.min(Math.round((s.carga.usado / (s.carga.max || 1)) * 100), 100), over: s.carga.sobrecarregado }
		};

		// Condições
		const ativas = condicoesAtivas(actor);
		ctx.condicoes = CONDICOES.map(c => ({ id: c.id, nome: c.nome, img: c.img, dica: resumoCondicao(c), ativo: actor.statuses.has(c.id), implicita: ativas.has(c.id) && !actor.statuses.has(c.id) }));
		ctx.condicoesAtivas = ctx.condicoes.filter(c => c.ativo || c.implicita);

		// Efeitos
		// Condições ficam na grade própria, não na lista de efeitos.
		const efeitos = [...actor.allApplicableEffects()].filter(e => !(e.statuses?.size && [...e.statuses].every(id => CONDICAO[id])));
		const sec = (type, label, filter) => ({ type, label, effects: efeitos.filter(filter) });
		ctx.effectSections = [
			sec('temporary', 'Efeitos temporários', e => !e.disabled && e.isTemporary),
			sec('passive', 'Efeitos passivos', e => !e.disabled && !e.isTemporary),
			sec('inactive', 'Efeitos inativos', e => e.disabled)
		];
		return ctx;
	}

	async _preparePartContext(partId, ctx) {
		ctx.tab = ctx.tabs?.[partId];
		if (partId === 'biography') {
			const TE = foundry.applications.ux.TextEditor.implementation;
			const opts = { secrets: this.document.isOwner, rollData: this.document.getRollData(), relativeTo: this.document };
			ctx.enrichedBiography = await TE.enrichHTML(this.document.system.biografia ?? '', opts);
			ctx.enrichedGoals = await TE.enrichHTML(this.document.system.objetivos ?? '', opts);
			// Regras opcionais: idade variada e Vida Além da Ordem.
			const regras = worldRules();
			const s = this.document.system;
			ctx.idadeInfo = s.idade ? { nome: s.idade.faixa.nome, anos: s.idade.faixa.anos, texto: s.idade.faixa.texto, desvantagens: s.idade.desvantagens } : null;
			const interesses = interessesDe(this.document);
			ctx.vidaAlem = regras.opcionais?.vidaAlemDaOrdem || interesses.length ? {
				interesses: interesses.map(i => ({ ...i, tipoNome: INTERESSES[i.tipo]?.nome ?? i.tipo })),
				tipos: Object.entries(INTERESSES).map(([id, d]) => ({ id, nome: d.nome })),
				folga: this.document.getFlag('op-dossie', 'folga') ?? null
			} : null;
		}
		return ctx;
	}

	_onRender(context, options) {
		super._onRender(context, options);
		for (const el of this.element.querySelectorAll('[data-action="grau"]')) {
			el.addEventListener('contextmenu', (ev) => { ev.preventDefault(); AgenteSheet.#grau.call(this, { button: 2 }, el); });
		}
		for (const input of this.element.querySelectorAll('input[data-item-field]')) {
			input.addEventListener('change', (ev) => {
				ev.stopPropagation();
				const id = ev.currentTarget.closest('[data-item-id]')?.dataset.itemId;
				this.document.items.get(id)?.update({ [ev.currentTarget.dataset.itemField]: Number(ev.currentTarget.value) || 0 });
			});
		}
	}

	/** Classe, origem e trilha são únicas: soltar uma nova substitui a anterior. */
	async _onDropItem(event, item) {
		if (UNICOS.includes(item.type) && item.parent?.uuid !== this.document.uuid) {
			const antigo = this.document.items.filter(i => i.type === item.type);
			if (antigo.length) {
				await this.document.deleteEmbeddedDocuments('Item', antigo.map(i => i.id));
				ui.notifications.info(`${item.name} substitui ${antigo.map(i => i.name).join(', ')}.`);
			}
		}
		return super._onDropItem(event, item);
	}

	/* --- ações --- */
	#item(target) { return this.document.items.get(target.closest('[data-item-id]')?.dataset.itemId); }

	static #assistente() { abrirCriacao(this.document); }
	static #subirNivel() { abrirSubirNivel(this.document); }
	static async #interesseAdd(event, target) {
		const box = target.closest('.op-interesse-add');
		const tipo = box?.querySelector('[name="novoInteresseTipo"]')?.value;
		const nome = box?.querySelector('[name="novoInteresseNome"]')?.value ?? '';
		if (tipo) await adicionarInteresse(this.document, tipo, nome);
	}
	static async #interesseRemover(event, target) { await removerInteresse(this.document, target.closest('[data-interesse]').dataset.interesse); }
	static #folga(event, target) {
		const i = interessesDe(this.document).find(x => x.id === target.closest('[data-interesse]').dataset.interesse);
		if (i) fazerFolga(this.document, i);
	}
	static async #folgaEncerrar() { await encerrarFolga(this.document); }
	static #rolarAtributo(event, target) { this.document.rolarAtributo(target.closest('[data-key]').dataset.key, { event }); }
	static #rolarPericia(event, target) { this.document.rolarPericia(target.closest('[data-key]').dataset.key, { event }); }
	static #usar(event, target) { this.#item(target)?.usar({ event }); }
	static #conjurar(event, target) { const i = this.#item(target); if (i) conjurarRitual(this.document, i); }
	static #abrir(event, target) {
		const id = target.closest('[data-item-id],[data-effect-id]');
		if (id?.dataset.effectId) return this.#efeito(id)?.sheet.render(true);
		this.#item(target)?.sheet.render(true);
	}
	static async #remover(event, target) {
		const row = target.closest('[data-item-id],[data-effect-id]');
		if (row?.dataset.effectId) return this.#efeito(row)?.delete();
		const i = this.#item(target);
		if (i) await i.deleteDialog?.() ?? i.delete();
	}
	static #expandir(event, target) {
		const id = target.closest('[data-item-id]')?.dataset.itemId;
		if (!id) return;
		this.#abertos.has(id) ? this.#abertos.delete(id) : this.#abertos.add(id);
		this.render();
	}
	static async #ajustar(event, target) {
		const key = target.dataset.key;
		const step = Number(target.dataset.step) * (event.shiftKey ? 5 : 1);
		const r = this.document.system.recursos[key];
		const max = key === 'pv' ? r.max + 999 : r.max;
		await this.document.update({ [`system.recursos.${key}.valor`]: Math.min(r.valor + step, max) });
	}
	static async #grau(event, target) {
		const key = target.closest('[data-key]').dataset.key;
		const atual = this.document.system.pericias[key].grau;
		const idx = GRAU_SEQ.indexOf(atual);
		const prox = GRAU_SEQ[(idx + (event.button === 2 ? GRAU_SEQ.length - 1 : 1)) % GRAU_SEQ.length];
		await this.document.update({ [`system.pericias.${key}.grau`]: prox });
	}
	static #edicao() { this.#editando = !this.#editando; this.render(); }
	static async #equipar(event, target) { const i = this.#item(target); if (i) await i.update({ 'system.equipado': !i.system.equipado }); }
	static async #criar(event, target) {
		const type = target.dataset.type;
		const data = { name: `Novo ${CONFIG.Item.typeLabels?.[type] ?? type}`, type, system: {} };
		if (target.dataset.circulo) data.system.circulo = Number(target.dataset.circulo);
		if (target.dataset.tipoPoder) data.system.tipo = target.dataset.tipoPoder;
		const [item] = await this.document.createEmbeddedDocuments('Item', [data]);
		item?.sheet.render(true);
	}
	#efeito(row) {
		const parentId = row.dataset.parentId;
		const parent = !parentId || parentId === this.document.id ? this.document : this.document.items.get(parentId);
		return parent?.effects.get(row.dataset.effectId);
	}
	static async #condicao(event, target) {
		await this.document.toggleStatusEffect(target.dataset.id);
	}
	static async #recarregar(event, target) {
		const i = this.#item(target);
		if (i) await recarregar(this.document, i);
	}
	static async #efeitoAlternar(event, target) {
		const e = this.#efeito(target.closest('[data-effect-id]'));
		if (e) await e.update({ disabled: !e.disabled });
	}
	static async #efeitoCriar(event, target) {
		const type = target.dataset.effectType;
		await this.document.createEmbeddedDocuments('ActiveEffect', [{
			name: 'Novo efeito', img: 'icons/svg/aura.svg', origin: this.document.uuid,
			disabled: type === 'inactive', duration: type === 'temporary' ? { rounds: 1 } : {}
		}]);
	}
}
