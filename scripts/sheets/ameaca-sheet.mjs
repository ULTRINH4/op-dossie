/**
 * Ficha de ameaça (pessoas e criaturas), no formato dos blocos do livro.
 */
import { trocarImagem } from './imagem.mjs';
import { SYSTEM_ID, ATRIBUTOS, ELEMENTOS, TIPOS_DANO, EXECUCAO } from '../config.mjs';
import { conjurarRitual } from '../automation/conjurar.mjs';

const TAMANHOS = { minusculo: 'Minúsculo', pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande', enorme: 'Enorme', colossal: 'Colossal' };

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const TESTES = [['percepcao', 'Percepção'], ['iniciativa', 'Iniciativa'], ['fortitude', 'Fortitude'], ['reflexos', 'Reflexos'], ['vontade', 'Vontade']];

export class AmeacaSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
	static DEFAULT_OPTIONS = {
		classes: ['op-dossie', 'op-threat', 'theme-dark'],
		position: { width: 640, height: 760 },
		window: { resizable: true },
		form: { submitOnChange: true },
		actions: {
			trocarImagem,
			rolarTeste: AmeacaSheet.#rolarTeste,
			rolarAtributo: AmeacaSheet.#rolarAtributo,
			usar: AmeacaSheet.#usar,
			conjurar: AmeacaSheet.#conjurar,
			abrir: AmeacaSheet.#abrir,
			remover: AmeacaSheet.#remover,
			expandir: AmeacaSheet.#expandir,
			criar: AmeacaSheet.#criar,
			edicao: AmeacaSheet.#edicao,
			pv: AmeacaSheet.#pv,
			rolarPericia: AmeacaSheet.#rolarPericia,
			periciaAdd: AmeacaSheet.#periciaAdd,
			periciaRemover: AmeacaSheet.#periciaRemover
		}
	};

	/** Campos de lista vêm do formulário como objeto ({0: …}) ou faltando (nada marcado): vira lista. */
	_processFormData(event, form, formData) {
		const data = super._processFormData(event, form, formData);
		const s = data.system;
		if (s && this.#editando) {
			for (const k of ['descritores', 'imunidades', 'vulnerabilidades']) {
				const v = foundry.utils.getProperty(data, `system.${k}`);
				if (v == null && form.querySelector(`[name="system.${k}"]`)) s[k] = [];
				else if (v != null && !Array.isArray(v)) s[k] = [v].flat().filter(Boolean);
			}
			if (s.pericias && !Array.isArray(s.pericias)) s.pericias = Object.values(s.pericias);
		}
		return data;
	}

	static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/sheet/ameaca.hbs`, scrollable: ['.op-threat__scroll'] } };

	#editando = false;
	#abertos = new Set();
	get title() { return this.document.name; }

	async _prepareContext(options) {
		const ctx = await super._prepareContext(options);
		const a = this.document;
		const s = a.system;
		const TE = foundry.applications.ux.TextEditor.implementation;
		const row = (i, extra = {}) => ({ id: i.id, name: i.name, img: i.img, description: i.system.descricao ?? '', expanded: this.#abertos.has(i.id), equipped: true, ...extra });
		const fmt = (t) => `${t.dados}d20${t.bonus ? (t.bonus > 0 ? `+${t.bonus}` : t.bonus) : ''}`;
		const edit = this.#editando && this.isEditable;
		const tipoNome = { pessoa: 'Pessoa', criatura: 'Criatura', animal: 'Animal' }[s.tipo] ?? 'Criatura';
		const outros = (s.descritores ?? []).filter(e => e !== s.elemento).map(e => ELEMENTOS[e]?.nome ?? e);
		const nomesDano = (lista) => (lista ?? []).map(k => TIPOS_DANO[k] ?? k).join(', ');
		const marcar = (lista, opcoes) => opcoes.map(o => ({ ...o, selected: (lista ?? []).includes(o.value) }));
		const opDano = Object.entries(TIPOS_DANO).map(([value, label]) => ({ value, label }));
		const poderes = a.items.filter(i => i.type === 'poder');
		Object.assign(ctx, {
			actor: a, system: s, editable: this.isEditable, edit,
			elemento: ELEMENTOS[s.elemento]?.nome ?? '',
			eyebrow: [`${tipoNome}${s.enxame ? ' (enxame)' : ''}`, ELEMENTOS[s.elemento]?.nome, ...outros, TAMANHOS[s.tamanho]].filter(Boolean).join(' · '),
			tipos: [{ value: 'criatura', label: 'Criatura' }, { value: 'pessoa', label: 'Pessoa' }, { value: 'animal', label: 'Animal' }],
			tamanhos: Object.entries(TAMANHOS).map(([value, label]) => ({ value, label })),
			descritoresOpts: marcar(s.descritores, Object.entries(ELEMENTOS).map(([value, e]) => ({ value, label: e.nome }))),
			imunidadesOpts: marcar(s.imunidades, opDano), vulnerabilidadesOpts: marcar(s.vulnerabilidades, opDano),
			imunidadesTxt: nomesDano(s.imunidades), vulnerabilidadesTxt: nomesDano(s.vulnerabilidades),
			pericias: (s.pericias ?? []).map((p, i) => ({ ...p, i, fmt: fmt(p) })),
			pvPct: s.pv.max ? Math.clamp(Math.round((s.pv.valor / s.pv.max) * 100), 0, 100) : 0,
			machucado: s.pv.valor <= s.machucado,
			testes: TESTES.map(([key, label]) => ({ key, label, dados: s[key].dados, bonus: s[key].bonus, fmt: fmt(s[key]) })),
			attrs: Object.entries(ATRIBUTOS).map(([key, at]) => ({ key, abv: at.abv, nome: at.nome, value: s.atributos[key].valor })),
			resistencias: Object.entries(TIPOS_DANO).map(([key, label]) => ({ key, label, value: s.resistencias[key] })).filter(r => r.value || this.#editando),
			elementos: [{ value: '', label: '—' }, ...Object.entries(ELEMENTOS).map(([value, e]) => ({ value, label: e.nome }))],
			ataques: a.items.filter(i => i.type === 'arma').map(i => {
				const w = i.system;
				const tipoAtq = { 'corpo a corpo': 'Corpo a corpo', arremesso: 'Arremesso', disparo: 'À distância', fogo: 'À distância' }[w.tipo] ?? '';
				const teste = w.testeDados > 0 ? `${w.testeDados}d20${w.bonusAtaque ? (w.bonusAtaque > 0 ? `+${w.bonusAtaque}` : w.bonusAtaque) : ''}`
					: `${w.periciaAtaque === 'luta' ? 'Luta' : 'Pontaria'}${w.bonusAtaque ? ` +${w.bonusAtaque}` : ''}`;
				return row(i, {
					execucao: 'Padrão',
					attack: `${tipoAtq}${w.ataques > 1 ? ` ×${w.ataques}` : ''} · ${teste}`,
					damage: `${w.dano.formula} ${TIPOS_DANO[w.dano.tipo]?.toLowerCase() ?? ''}`
				});
			}),
			rituais: a.items.filter(i => i.type === 'ritual').map(i => row(i, { element: i.system.elemento })),
			// Ações (com tipo de ação) e habilidades (passivas, sem ação), como no bloco do livro.
			acoes: poderes.filter(i => i.system.execucao).map(i => row(i, { execucao: EXECUCAO[i.system.execucao] ?? i.system.execucao })),
			habilidades: poderes.filter(i => !i.system.execucao).map(i => row(i)),
			descricaoHTML: await TE.enrichHTML(s.descricao, { relativeTo: a }),
			enigmaHTML: await TE.enrichHTML(s.enigma, { relativeTo: a })
		});
		return ctx;
	}

	#item(t) { return this.document.items.get(t.closest('[data-item-id]')?.dataset.itemId); }
	static #rolarTeste(event, target) {
		const key = target.closest('[data-key]').dataset.key;
		const label = TESTES.find(([k]) => k === key)?.[1] ?? key;
		const t = this.document.system[key];
		import('../dice/testes.mjs').then(m => m.rolarTeste({ actor: this.document, dados: t.dados, bonus: t.bonus, titulo: label, event }));
	}
	static #rolarAtributo(event, target) { this.document.rolarAtributo(target.closest('[data-key]').dataset.key, { event }); }
	static #usar(event, target) { this.#item(target)?.usar({ event }); }
	static #conjurar(event, target) { const i = this.#item(target); if (i) conjurarRitual(this.document, i); }
	static #abrir(event, target) { this.#item(target)?.sheet.render(true); }
	static async #remover(event, target) { const i = this.#item(target); if (i) await i.deleteDialog(); }
	static #expandir(event, target) { const id = target.closest('[data-item-id]')?.dataset.itemId; this.#abertos.has(id) ? this.#abertos.delete(id) : this.#abertos.add(id); this.render(); }
	static async #criar(event, target) {
		const type = target.dataset.type;
		const execucao = target.dataset.execucao;
		const nome = execucao ? 'Nova ação' : type === 'poder' ? 'Nova habilidade' : `Novo ${CONFIG.Item.typeLabels?.[type] ?? type}`;
		const [i] = await this.document.createEmbeddedDocuments('Item', [{ name: nome, type, system: execucao ? { execucao } : {} }]);
		i?.sheet.render(true);
	}
	static #rolarPericia(event, target) {
		const p = this.document.system.pericias[Number(target.closest('[data-i]').dataset.i)];
		if (p) import('../dice/testes.mjs').then(m => m.rolarTeste({ actor: this.document, dados: p.dados, bonus: p.bonus, titulo: p.nome, event }));
	}
	static async #periciaAdd() {
		await this.document.update({ 'system.pericias': [...this.document.system.pericias, { nome: 'Perícia', dados: 1, bonus: 0 }] });
	}
	static async #periciaRemover(event, target) {
		const i = Number(target.closest('[data-i]').dataset.i);
		await this.document.update({ 'system.pericias': this.document.system.pericias.filter((_, k) => k !== i) });
	}
	static #edicao() { this.#editando = !this.#editando; this.render(); }
	static async #pv(event, target) {
		const step = Number(target.dataset.step) * (event.shiftKey ? 5 : 1);
		await this.document.update({ 'system.pv.valor': this.document.system.pv.valor + step });
	}
}
