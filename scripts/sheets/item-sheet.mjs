/**
 * Fichas de item: editável (arma, proteção, equipamento, ritual, poder) e de leitura (classe, origem, trilha).
 */
import { trocarImagem } from './imagem.mjs';
import { regraAtiva, tipoDoItem, usaDadoUso, rotuloDado, dadoInicial, ESCADA } from '../automation/dado-uso.mjs';
import { SYSTEM_ID, ELEMENTOS, TIPOS_DANO, EXECUCAO, ALCANCE, DURACAO, EFEITO_RESISTENCIA, TIPOS_PODER } from '../config.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const TPL = `systems/${SYSTEM_ID}/templates/item`;
const LIVRO = { base: 'Livro de Regras', sah: 'Sobrevivendo ao Horror' };
const TIPO_NOME = { arma: 'Arma', protecao: 'Proteção', equipamento: 'Equipamento', ritual: 'Ritual', poder: 'Poder', classe: 'Classe', origem: 'Origem', trilha: 'Trilha' };

const opts = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }));
const optsEl = () => [{ value: '', label: '—' }, ...Object.entries(ELEMENTOS).map(([value, e]) => ({ value, label: e.nome }))];

export class ItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
	static DEFAULT_OPTIONS = {
		classes: ['op-dossie', 'op-item', 'theme-dark'],
		position: { width: 560, height: 640 },
		window: { resizable: true },
		form: { submitOnChange: true },
		actions: { forma: ItemSheet.#forma, trocarImagem }
	};

	static PARTS = {
		header: { template: `${TPL}/header.hbs` },
		body: { template: `${TPL}/body.hbs`, scrollable: [''] }
	};

	get title() { return `${TIPO_NOME[this.document.type] ?? ''}: ${this.document.name}`; }

	async _prepareContext(options) {
		const ctx = await super._prepareContext(options);
		const item = this.document;
		const s = item.system;
		const TE = foundry.applications.ux.TextEditor.implementation;
		Object.assign(ctx, {
			item, system: s, editable: this.isEditable, tipo: TIPO_NOME[item.type],
			is: { [item.type]: true },
			fonte: s.fonte?.livro ? `${LIVRO[s.fonte.livro] ?? s.fonte.livro}${s.fonte.pagina ? `, p. ${s.fonte.pagina}` : ''}` : '',
			descricaoHTML: await TE.enrichHTML(s.descricao ?? '', { relativeTo: item }),
			o: {
				elemento: optsEl(),
				dano: [{ value: '', label: '—' }, ...opts(TIPOS_DANO)],
				execucao: opts(EXECUCAO), alcance: opts(ALCANCE), duracao: opts(DURACAO),
				efeito: [{ value: '', label: '—' }, ...opts(EFEITO_RESISTENCIA)],
				tipoPoder: opts(TIPOS_PODER),
				limite: opts({ '': 'Sem limite', rodada: 'Por rodada', cena: 'Por cena', interludio: 'Por interlúdio', missao: 'Por missão' }),
				circulo: [1, 2, 3, 4].map(v => ({ value: v, label: `${v}º círculo` })),
				categoria: [0, 1, 2, 3, 4].map(v => ({ value: v, label: ['0', 'I', 'II', 'III', 'IV'][v] })),
				proficiencia: opts({ simples: 'Simples', taticas: 'Táticas', pesadas: 'Pesadas' }),
				tipoArma: opts({ 'corpo a corpo': 'Corpo a corpo', arremesso: 'Arremesso', disparo: 'Disparo', fogo: 'Fogo' }),
				empunhadura: opts({ leve: 'Leve', 'uma mão': 'Uma mão', 'duas mãos': 'Duas mãos' })
			}
		});
		if (item.type === 'equipamento' && regraAtiva()) {
			const tipo = tipoDoItem(item);
			const auto = tipo ? `Auto: ${{ municao: 'munição', medico: 'médico', gasto: 'gasto' }[tipo]}` : 'Auto: não usa';
			const padrao = { municao: 10, medico: 6, gasto: 8 }[tipo] ?? 8;
			ctx.dadoUso = {
				ativo: usaDadoUso(item), rotulo: rotuloDado(item),
				modo: [{ value: '', label: auto }, { value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }],
				inicial: [{ value: 0, label: `Padrão (d${padrao})` }, ...ESCADA.map(d => ({ value: d, label: `d${d}` }))],
				atual: [{ value: 0, label: `Inicial (d${dadoInicial(item)})` }, ...ESCADA.map(d => ({ value: d, label: `d${d}` }))]
			};
		}
		ctx.formas = item.type === 'ritual' ? [
			{ k: 'discente', titulo: 'Forma discente', f: s.discente },
			{ k: 'verdadeiro', titulo: 'Forma verdadeira', f: s.verdadeiro }
		] : [];
		if (['classe', 'origem', 'trilha'].includes(item.type)) {
			ctx.leitura = true;
			if (item.type === 'classe') {
				ctx.stats = [['PV', s.pv], ['PE', s.pe], ['SAN', s.san], ['PD', s.pd]].filter(([, f]) => f.inicial).map(([k, f]) => ({ k, a: f.inicial, b: f.porNivel }));
				ctx.progressao = s.progressao.map(p => ({ quando: p.nex != null ? `${p.nex}%` : `Est. ${p.estagio}`, ganhos: p.ganhos.join(' · ') }));
				ctx.habilidades = await Promise.all(s.habilidades.map(async h => ({ ...h, quando: h.nex != null ? `NEX ${h.nex}%` : h.estagio != null ? `Estágio ${h.estagio}` : '', html: await TE.enrichHTML(h.texto, { relativeTo: item }) })));
				ctx.pericias = s.periciasFixas.map(p => p.replace('|', ' ou '));
			}
			if (item.type === 'origem') ctx.poderHTML = await TE.enrichHTML(s.poder.texto, { relativeTo: item });
			if (item.type === 'trilha') ctx.habilidades = await Promise.all(s.habilidades.map(async h => ({ ...h, quando: h.nex != null ? (h.nex <= 5 ? `Estágio ${h.nex}` : `NEX ${h.nex}%`) : '', html: await TE.enrichHTML(h.texto, { relativeTo: item }) })));
		}
		return ctx;
	}

	/** Liga/desliga as formas discente e verdadeira de um ritual. */
	static async #forma(event, target) {
		const k = target.dataset.forma;
		const atual = this.document.system[k];
		await this.document.update({ [`system.${k}`]: atual ? null : { custoExtra: k === 'discente' ? 2 : 5, circuloMin: null, afinidade: false, texto: '', dano: null } });
	}
}

export function registerItemSheets() {
	foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, ItemSheet, { makeDefault: true, label: 'Dossiê — Item' });
}
