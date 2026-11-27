/**
 * Dados de ameaça (pessoas e criaturas), no formato dos blocos do livro:
 * "Percepção 2O+5" = 2 dados com bônus +5.
 */
import { ATRIBUTOS, TIPOS_DANO } from '../config.mjs';
import { modsCondicoes } from '../automation/condicoes.mjs';

const { fields } = foundry.data;
const int = (initial = 0, opts = {}) => new fields.NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
const str = (initial = '') => new fields.StringField({ required: true, blank: true, initial });
const teste = (dados = 1, bonus = 0) => new fields.SchemaField({ dados: int(dados, { min: 0 }), bonus: int(bonus) });

export class AmeacaData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			tipo: str('criatura'),            // pessoa | criatura | animal
			enxame: new fields.BooleanField({ initial: false }),
			elemento: str(''),                // elemento principal (cor da ficha)
			descritores: new fields.ArrayField(new fields.StringField(), { initial: [] }), // outros elementos do bloco
			tamanho: str('medio'),
			vd: int(10, { min: 0 }),
			atributos: new fields.SchemaField(Object.fromEntries(Object.keys(ATRIBUTOS).map(k => [k, new fields.SchemaField({ valor: int(1, { min: 0 }) })]))),
			pv: new fields.SchemaField({ valor: int(10), max: int(10, { min: 0 }) }),
			defesa: int(10),
			deslocamento: str('9m'),
			sentidos: str(''),
			percepcao: teste(1, 0),
			iniciativa: teste(1, 0),
			fortitude: teste(1, 0),
			reflexos: teste(1, 0),
			vontade: teste(1, 0),
			pericias: new fields.ArrayField(new fields.SchemaField({ nome: str(''), dados: int(1, { min: 0 }), bonus: int(0) }), { initial: [] }),
			resistencias: new fields.SchemaField(Object.fromEntries(Object.keys(TIPOS_DANO).map(k => [k, int(0, { min: 0 })]))),
			imunidades: new fields.ArrayField(new fields.StringField(), { initial: [] }),
			vulnerabilidades: new fields.ArrayField(new fields.StringField(), { initial: [] }),
			presencaPerturbadora: new fields.SchemaField({ dt: int(0, { min: 0 }), dano: str(''), nexImune: int(0, { min: 0 }) }),
			enigma: new fields.HTMLField({ initial: '' }),
			descricao: new fields.HTMLField({ initial: '' })
		};
	}

	get machucado() { return Math.floor(this.pv.max / 2); }

	prepareDerivedData() {
		this.condicoes = modsCondicoes(this.parent);
		this.defesaTotal = this.defesa - this.condicoes.defesa;
		this.dtRitual = 15;
	}

	getRollData() {
		const d = this.toObject();
		for (const k of Object.keys(ATRIBUTOS)) d[k] = this.atributos[k].valor;
		return d;
	}
}
