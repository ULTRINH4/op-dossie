/**
 * Janela "Regras da Mesa" (só para o mestre).
 */
import { MOD, DATA, normalize, worldRules, saveWorldRules } from './table-rules.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const BOOK_LABEL = { base: 'OPRPG', sah: 'SaH', outros: 'Extra' };

/** Nomes em português vêm de data/conteudo.json (independem do idioma do Foundry). */
export function classLabel(id) {
	return DATA.conteudo.classes.find(c => c.id === id)?.nome ?? id;
}

export function trilhaLabel(classId, id) {
	return DATA.conteudo.trilhas[classId]?.find(t => t.id === id)?.nome ?? id;
}

export function origemLabel(id) {
	return DATA.conteudo.origens.find(o => o.id === id)?.nome ?? id;
}

export class TableRulesApp extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: 'op-dossie-regras',
		tag: 'form',
		classes: ['op-dossie', 'op-rules'],
		window: { title: 'Regras da Mesa', icon: 'fa-solid fa-scale-balanced', resizable: true },
		position: { width: 760, height: 760 },
		form: { handler: TableRulesApp.#onSubmit, submitOnChange: false, closeOnSubmit: true },
		actions: {
			reset: TableRulesApp.#onReset,
			toggleGroup: TableRulesApp.#onToggleGroup,
			opTab: TableRulesApp.#onTab
		}
	};

	static PARTS = {
		body: { template: `systems/${MOD}/templates/table-rules.hbs`, scrollable: ['.op-rules__scroll'] }
	};

	/** Rascunho editado na janela; só vai para o mundo ao salvar. */
	#draft = null;
	#tab = 'regras';

	get draft() {
		this.#draft ??= foundry.utils.deepClone(worldRules());
		return this.#draft;
	}

	async _prepareContext() {
		const { regras: r, avisos, ajustes } = normalize(this.draft);
		this.#draft = r;
		const sahOn = r.livros.sah;
		const needSah = (livro) => livro === 'sah' && !sahOn;

		const livros = DATA.regras.livros.map(l => ({
			...l,
			checked: !!r.livros[l.id],
			disabled: l.fixo || (l.requer && !r.livros[l.requer])
		}));

		const escolhas = Object.entries(DATA.regras.escolhas).map(([group, def]) => ({
			group,
			nome: def.nome,
			opcoes: def.opcoes.map(o => {
				let motivo = needSah(o.livro) ? 'Ligue o Sobrevivendo ao Horror' : null;
				if (group === 'recursos' && o.id === 'padrao' && r.progressao === 'patentes') motivo = 'Evolução por Patentes usa PD';
				return { ...o, sigla: BOOK_LABEL[o.livro], checked: r[group] === o.id, disabled: !!motivo, motivo };
			})
		}));

		const opcionais = DATA.regras.opcionais.map(o => {
			const motivo = needSah(o.livro) ? 'Ligue o Sobrevivendo ao Horror' : null;
			return { ...o, sigla: BOOK_LABEL[o.livro], checked: !!r.opcionais[o.id], disabled: !!motivo, motivo };
		});

		const automacao = (DATA.regras.automacao ?? []).map(o => ({ ...o, checked: !!r.automacao?.[o.id] }));

		const bookOn = (e) => !!r.livros[e.livro] && !(e.comunidade && !r.livros.sahComunidade);
		const item = (kind, e, label) => ({
			kind, id: e.id, label, sigla: BOOK_LABEL[e.livro],
			checked: !r.desativados[kind].includes(e.id),
			off: !bookOn(e)
		});
		const classes = DATA.conteudo.classes.map(e => item('classes', e, classLabel(e.id)));
		const trilhas = Object.entries(DATA.conteudo.trilhas).map(([cls, list]) => ({
			nome: classLabel(cls),
			itens: list.map(e => item('trilhas', e, trilhaLabel(cls, e.id)))
		}));
		const origens = ['base', 'sah', 'outros'].map(livro => ({
			nome: { base: 'Livro de Regras', sah: 'Sobrevivendo ao Horror', outros: 'Extra do sistema' }[livro],
			itens: DATA.conteudo.origens.filter(e => e.livro === livro)
				.map(e => item('origens', e, origemLabel(e.id)))
				.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
		}));

		const resumo = [
			escolhas.find(e => e.group === 'progressao').opcoes.find(o => o.checked)?.nome,
			escolhas.find(e => e.group === 'recursos').opcoes.find(o => o.checked)?.nome,
			r.livros.sah ? 'Com SaH' : 'Só Livro de Regras'
		];

		return { tab: this.#tab, livros, escolhas, opcionais, automacao, classes, trilhas, origens, avisos, ajustes, resumo };
	}

	_onFirstRender(context, options) {
		super._onFirstRender(context, options);
		this.element.addEventListener('change', this.#onChange.bind(this));
	}

	/** Lê o formulário para o rascunho e redesenha, para as restrições aparecerem na hora. */
	#onChange(event) {
		const el = event.target;
		const kind = el?.dataset?.kind;
		if (!kind) return;
		const d = this.draft;
		const id = el.dataset.id;
		if (kind === 'livro') d.livros[id] = el.checked;
		else if (kind === 'opcional') d.opcionais[id] = el.checked;
		else if (kind === 'automacao') { d.automacao ??= {}; d.automacao[id] = el.checked; }
		else if (kind === 'escolha') d[el.dataset.group] = el.value;
		else if (kind === 'conteudo') {
			const list = el.dataset.list;
			const set = new Set(d.desativados[list]);
			el.checked ? set.delete(id) : set.add(id);
			d.desativados[list] = [...set];
		}
		this.render();
	}

	static async #onSubmit() {
		await saveWorldRules(this.draft);
		ui.notifications.info('Regras da Mesa salvas.');
	}

	static #onReset() {
		this.#draft = foundry.utils.deepClone(DATA.regras.padrao);
		this.render();
	}

	static #onToggleGroup(event, target) {
		const list = target.dataset.list;
		const ids = [...this.element.querySelectorAll(`input[data-list="${list}"]${target.dataset.scope ? `[data-scope="${target.dataset.scope}"]` : ''}`)]
			.filter(i => !i.disabled).map(i => i.dataset.id);
		const d = this.draft;
		const set = new Set(d.desativados[list]);
		const allOn = ids.every(id => !set.has(id));
		for (const id of ids) allOn ? set.add(id) : set.delete(id);
		d.desativados[list] = [...set];
		this.render();
	}

	static #onTab(event, target) {
		this.#tab = target.dataset.tab;
		this.render().then(() => {
			const scroll = this.element.querySelector('.op-rules__scroll');
			if (scroll) scroll.scrollTop = 0;
		});
	}
}
