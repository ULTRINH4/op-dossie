/**
 * Ficha de ameaça (pessoas e criaturas), no formato dos blocos do livro.
 */
import { trocarImagem } from './imagem.mjs';
import { SYSTEM_ID, ATRIBUTOS, ELEMENTOS, TIPOS_DANO } from '../config.mjs';
import { conjurarRitual } from '../automation/conjurar.mjs';

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
			pv: AmeacaSheet.#pv
		}
	};

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
		Object.assign(ctx, {
			actor: a, system: s, editable: this.isEditable, edit: this.#editando && this.isEditable,
			elemento: ELEMENTOS[s.elemento]?.nome ?? '',
			pvPct: s.pv.max ? Math.clamp(Math.round((s.pv.valor / s.pv.max) * 100), 0, 100) : 0,
			machucado: s.pv.valor <= s.machucado,
			testes: TESTES.map(([key, label]) => ({ key, label, dados: s[key].dados, bonus: s[key].bonus, fmt: fmt(s[key]) })),
			attrs: Object.entries(ATRIBUTOS).map(([key, at]) => ({ key, abv: at.abv, nome: at.nome, value: s.atributos[key].valor })),
			resistencias: Object.entries(TIPOS_DANO).map(([key, label]) => ({ key, label, value: s.resistencias[key] })).filter(r => r.value || this.#editando),
			elementos: [{ value: '', label: '—' }, ...Object.entries(ELEMENTOS).map(([value, e]) => ({ value, label: e.nome }))],
			ataques: a.items.filter(i => i.type === 'arma').map(i => row(i, {
				attack: `${i.system.periciaAtaque === 'luta' ? 'Luta' : 'Pontaria'}${i.system.bonusAtaque ? ` +${i.system.bonusAtaque}` : ''}`,
				damage: `${i.system.dano.formula} ${TIPOS_DANO[i.system.dano.tipo]?.toLowerCase() ?? ''}`
			})),
			rituais: a.items.filter(i => i.type === 'ritual').map(i => row(i, { element: i.system.elemento })),
			habilidades: a.items.filter(i => i.type === 'poder').map(i => row(i)),
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
		const [i] = await this.document.createEmbeddedDocuments('Item', [{ name: `Novo ${CONFIG.Item.typeLabels?.[type] ?? type}`, type }]);
		i?.sheet.render(true);
	}
	static #edicao() { this.#editando = !this.#editando; this.render(); }
	static async #pv(event, target) {
		const step = Number(target.dataset.step) * (event.shiftKey ? 5 : 1);
		await this.document.update({ 'system.pv.valor': this.document.system.pv.valor + step });
	}
}
