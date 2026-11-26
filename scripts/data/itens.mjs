/**
 * Dados dos itens: arma, proteção, equipamento, ritual, poder, classe, origem, trilha.
 */
const { fields } = foundry.data;
const int = (initial = 0, opts = {}) => new fields.NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
const str = (initial = '') => new fields.StringField({ required: true, blank: true, initial });
const nstr = () => new fields.StringField({ required: false, nullable: true, blank: true, initial: null });

/** Campos comuns: descrição, fonte e marcação de revisão. */
const comum = () => ({
	descricao: new fields.HTMLField({ initial: '' }),
	fonte: new fields.SchemaField({ livro: str(''), pagina: new fields.NumberField({ integer: true, nullable: true, initial: null }), id: str('') }),
	revisar: str('')
});
/** Campos de itens físicos. */
const fisico = () => ({
	categoria: int(0, { min: 0, max: 4 }),
	espacos: new fields.NumberField({ required: true, nullable: false, initial: 1, min: 0 }),
	quantidade: int(1, { min: 0 }),
	equipado: new fields.BooleanField({ initial: true })
});
const dano = () => new fields.SchemaField({ formula: str(''), tipo: str('') }, { nullable: true, initial: null });

export class ArmaData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			...comum(), ...fisico(),
			proficiencia: str('simples'),         // simples | taticas | pesadas
			tipo: str('corpo a corpo'),           // corpo a corpo | arremesso | disparo | fogo
			empunhadura: str('uma mão'),          // leve | uma mão | duas mãos
			dano: new fields.SchemaField({ formula: str('1d6'), tipo: str('impacto') }),
			critico: new fields.SchemaField({ margem: int(20, { min: 2, max: 20 }), multiplicador: int(2, { min: 2, max: 5 }) }),
			alcance: str(''),
			municao: str(''),
			especial: new fields.ArrayField(new fields.StringField(), { initial: [] }),
			bonusAtaque: int(0),
			bonusDano: str(''),
			ultimaCena: str(''),                  // combate em que o pacote já foi gasto
			carregador: new fields.SchemaField({ valor: int(0, { min: 0 }), max: int(0, { min: 0 }) })
		};
	}
	get corpoACorpo() { return ['corpo a corpo', 'arremesso'].includes(this.tipo); }
	get periciaAtaque() { return this.tipo === 'corpo a corpo' ? 'luta' : 'pontaria'; }
}

export class ProtecaoData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return { ...comum(), ...fisico(), defesa: int(0), penalidade: int(0), pesada: new fields.BooleanField({ initial: false }) };
	}
}

export class EquipamentoData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			...comum(), ...fisico(), subtipo: str(''), elemento: str(''),
			// Munição: um pacote dura N cenas (Livro de Regras, p. 59); na contagem concreta, 20 ataques (p. 174).
			municao: new fields.SchemaField({ cenas: int(0, { min: 0 }), usadas: int(0, { min: 0 }), disparos: int(0, { min: 0 }) }),
			// Dado de uso (regra da casa): modo '' = automático pelo tipo, 'sim' ou 'nao'; dados 0 = padrão do tipo.
			dadoUso: new fields.SchemaField({ modo: str(''), inicial: int(0, { min: 0 }), atual: int(0, { min: 0 }) })
		};
	}
}

const forma = () => new fields.SchemaField({
	custoExtra: int(0, { min: 0 }),
	circuloMin: new fields.NumberField({ integer: true, nullable: true, initial: null }),
	afinidade: new fields.BooleanField({ initial: false }),
	texto: new fields.HTMLField({ initial: '' }),
	dano: dano()
}, { nullable: true, initial: null });

export class RitualData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			...comum(),
			circulo: int(1, { min: 1, max: 4 }),
			elemento: str('conhecimento'),
			execucao: str('padrao'),
			alcance: new fields.SchemaField({ chave: str('curto'), texto: str('') }),
			alvo: str(''),
			area: str(''),
			duracao: new fields.SchemaField({ chave: str('instantanea'), texto: str('') }),
			resistencia: new fields.SchemaField({ pericia: str(''), efeito: str(''), texto: str('') }),
			custo: new fields.NumberField({ integer: true, nullable: true, initial: null }),
			dano: dano(),
			cura: str(''),
			condicoes: new fields.ArrayField(new fields.StringField(), { initial: [] }),
			discente: forma(),
			verdadeiro: forma()
		};
	}
	/** Custo da forma normal: o do ritual ou o do círculo. */
	get custoBase() { return this.custo ?? ({ 1: 1, 2: 3, 3: 6, 4: 10 })[this.circulo] ?? 1; }
}

export class PoderData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			...comum(),
			tipo: str('outro'),                   // origem | classe | trilha | geral | paranormal | complicacao | outro
			classe: str(''),
			elemento: str(''),
			requisitos: str(''),
			custo: new fields.NumberField({ integer: true, nullable: true, initial: null }),
			execucao: str(''),
			limite: str(''),                      // '' | rodada | cena | interludio | missao
			usos: new fields.SchemaField({ valor: int(0), max: int(0) })
		};
	}
}

const formulaRecurso = () => new fields.SchemaField({ inicial: str(''), porNivel: str('') });

export class ClasseData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			...comum(),
			chave: str(''),                       // combatente | especialista | ocultista | mundano | sobrevivente
			pv: formulaRecurso(), pe: formulaRecurso(), san: formulaRecurso(), pd: formulaRecurso(),
			periciasFixas: new fields.ArrayField(new fields.StringField(), { initial: [] }),
			periciasLivres: str(''),
			proficiencias: new fields.ArrayField(new fields.StringField(), { initial: [] }),
			progressao: new fields.ArrayField(new fields.SchemaField({
				nex: new fields.NumberField({ integer: true, nullable: true, initial: null }),
				estagio: new fields.NumberField({ integer: true, nullable: true, initial: null }),
				ganhos: new fields.ArrayField(new fields.StringField(), { initial: [] })
			}), { initial: [] }),
			habilidades: new fields.ArrayField(new fields.SchemaField({
				nome: str(''),
				nex: new fields.NumberField({ integer: true, nullable: true, initial: null }),
				estagio: new fields.NumberField({ integer: true, nullable: true, initial: null }),
				texto: new fields.HTMLField({ initial: '' })
			}), { initial: [] })
		};
	}
}

export class OrigemData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			...comum(),
			chave: str(''),
			comunidade: new fields.BooleanField({ initial: false }),
			autores: str(''),
			pericias: new fields.ArrayField(new fields.StringField(), { initial: [] }),
			poder: new fields.SchemaField({ nome: str(''), texto: new fields.HTMLField({ initial: '' }) })
		};
	}
}

export class TrilhaData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			...comum(),
			chave: str(''),
			classe: str(''),
			habilidades: new fields.ArrayField(new fields.SchemaField({
				nex: new fields.NumberField({ integer: true, nullable: true, initial: null }),
				nome: str(''), custo: str(''), texto: new fields.HTMLField({ initial: '' })
			}), { initial: [] })
		};
	}
}

export const ITEM_MODELS = {
	arma: ArmaData, protecao: ProtecaoData, equipamento: EquipamentoData, ritual: RitualData,
	poder: PoderData, classe: ClasseData, origem: OrigemData, trilha: TrilhaData
};
