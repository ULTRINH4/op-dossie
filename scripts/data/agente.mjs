/**
 * Dados do agente (personagem de jogador).
 * Valores máximos de PV/PE/SAN/PD vêm do item de Classe; regras da mesa decidem a progressão.
 */
import { SYSTEM_ID, ATRIBUTOS, PERICIAS, PATENTES, PATENTE_CLASSE, indicePatente, TIPOS_DANO } from '../config.mjs';
import { rulesFor } from '../rules/table-rules.mjs';
import { modsCondicoes, deslocamentoComCondicoes } from '../automation/condicoes.mjs';
import { FAIXAS, DESVANTAGENS } from '../rules/opcionais-dados.mjs';

const { fields } = foundry.data;
const int = (initial = 0, opts = {}) => new fields.NumberField({ required: true, nullable: false, integer: true, initial, ...opts });
const recurso = () => new fields.SchemaField({
	valor: int(0),
	temp: int(0, { min: 0 }),
	bonusMax: int(0)
});

export class AgenteData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		return {
			atributos: new fields.SchemaField(Object.fromEntries(Object.keys(ATRIBUTOS).map(k => [k, new fields.SchemaField({ valor: int(1, { min: 0, max: 9 }) })]))),
			pericias: new fields.SchemaField(Object.fromEntries(Object.entries(PERICIAS).map(([k, p]) => [k, new fields.SchemaField({
				grau: int(0, { choices: [0, 5, 10, 15] }),
				bonus: int(0),
				...(p.livre ? { nome: new fields.StringField({ blank: true, initial: '' }) } : {})
			})]))),
			recursos: new fields.SchemaField({ pv: recurso(), pe: recurso(), san: recurso(), pd: recurso() }),
			progressao: new fields.SchemaField({
				nex: int(5, { min: 0, max: 99 }),
				nivel: int(1, { min: 0, max: 20 }),
				estagio: int(1, { min: 0, max: 5 })
			}),
			patente: new fields.SchemaField({ pp: int(0, { min: 0 }) }),
			defesa: new fields.SchemaField({ bonus: int(0) }),
			deslocamento: new fields.SchemaField({ base: int(9, { min: 0 }) }),
			resistencias: new fields.SchemaField(Object.fromEntries(Object.keys(TIPOS_DANO).map(k => [k, int(0, { min: 0 })]))),
			sanPermanente: int(0, { min: 0 }),
			recursosExtras: new fields.ArrayField(new fields.SchemaField({
				nome: new fields.StringField({ blank: true, initial: '' }),
				valor: int(0), max: int(0)
			}), { initial: [] }),
			biografia: new fields.HTMLField({ initial: '' }),
			objetivos: new fields.HTMLField({ initial: '' })
		};
	}

	/** Itens de classe, origem e trilha do agente. */
	get classe() { return this.parent.items.find(i => i.type === 'classe') ?? null; }
	get origem() { return this.parent.items.find(i => i.type === 'origem') ?? null; }
	get trilha() { return this.parent.items.find(i => i.type === 'trilha') ?? null; }

	get regras() { return rulesFor(this.parent); }
	get semSanidade() { return this.regras.recursos === 'semSanidade'; }
	get isSobrevivente() { return this.classe?.system.chave === 'sobrevivente'; }
	get isMundano() { return this.classe?.system.chave === 'mundano'; }

	/** Evolução por Patentes vale para este agente (classes treinadas; Mundano e Sobrevivente seguem as próprias regras). */
	get usaPatentes() {
		return this.regras.progressao === 'patentes' && !this.isSobrevivente && !this.isMundano && !!PATENTE_CLASSE[this.classe?.system.chave];
	}

	/** Quantos "passos" de progressão o agente tem (1 = o primeiro nível). */
	get passos() {
		if (this.isSobrevivente) return Math.max(this.progressao.estagio, 1);
		// Patentes: o nível para pré-requisitos é o limite de PD (SaH p. 109).
		if (this.usaPatentes) return PATENTES[indicePatente(this.patente.pp)].limitePD;
		if (this.regras.progressao === 'nivel') return Math.max(this.progressao.nivel, 1);
		const nex = this.progressao.nex;
		return nex >= 99 ? 20 : Math.max(Math.floor(nex / 5), 1);
	}

	prepareBaseData() {
		for (const r of Object.values(this.recursos)) r.max = 0;
	}

	prepareDerivedData() {
		const attr = Object.fromEntries(Object.entries(this.atributos).map(([k, v]) => [k, v.valor]));
		const classe = this.classe?.system;
		const n = this.passos;

		// Máximos pela classe: inicial + (passos − 1) × por nível.
		const calc = (f) => {
			if (!f?.inicial) return 0;
			const ini = evalFormula(f.inicial, attr);
			const per = f.porNivel ? evalFormula(f.porNivel, attr) : 0;
			return ini + Math.max(n - 1, 0) * per;
		};
		const r = this.recursos;
		const ip = indicePatente(this.patente.pp);
		const te = this.parent.getFlag?.(SYSTEM_ID, 'treinamentoEspecial');
		const calcTE = (k) => {
			const b = te.base?.[k];
			const base = b?.inicial ? evalFormula(b.inicial, attr) + Math.max(te.estagio - 1, 0) * (b.porNivel ? evalFormula(b.porNivel, attr) : 0) : 0;
			const per = classe?.[k]?.porNivel ? evalFormula(classe[k].porNivel, attr) : 0;
			return base + (te.bonus?.[k] ?? 0) + Math.max(n - 1, 0) * per;
		};
		const usaTE = te && !this.isSobrevivente && !this.isMundano && !this.usaPatentes;
		const calcR = (k) => usaTE ? calcTE(k) : calc(classe?.[k]);
		r.pv.max = calcR('pv') + r.pv.bonusMax;
		if (this.usaPatentes) {
			// Patentes: valores próprios da tabela, inicial + (patentes acima de Recruta) × por patente.
			const t = PATENTE_CLASSE[classe.chave];
			const porPatente = ([ini, per]) => evalFormula(ini, attr) + ip * evalFormula(per, attr);
			r.pv.max = porPatente(t.pv) + r.pv.bonusMax;
			r.pd.max = porPatente(t.pd) + r.pd.bonusMax;
		} else if (this.semSanidade) {
			r.pd.max = calcR('pd') + r.pd.bonusMax;
		} else {
			r.pe.max = calcR('pe') + r.pe.bonusMax;
			r.san.max = Math.max(calcR('san') + r.san.bonusMax - this.sanPermanente, 0);
		}

		// Regras opcionais que mexem nos máximos: ferimento em Vigor, idade e folga.
		const efeitos = (this.parent.effects ?? []).filter(e => !e.disabled);
		const flag = (k) => this.parent.getFlag?.(SYSTEM_ID, k);
		const peKey = r.pe.max ? 'pe' : 'pd';
		const feridasVig = efeitos.filter(e => e.getFlag(SYSTEM_ID, 'ferimento') === 'vig').length;
		if (feridasVig) r.pv.max = Math.max(r.pv.max - feridasVig * n, 1);
		const idade = flag('idade');
		const desv = (idade?.desvantagens ?? []).map(d => DESVANTAGENS[d]).filter(Boolean);
		for (const d of desv) {
			if (d.pvPorNex) r.pv.max = Math.max(r.pv.max + d.pvPorNex * n, 1);
			if (d.pePorNex) r[peKey].max = Math.max(r[peKey].max + d.pePorNex * n, 0);
		}
		if (FAIXAS[idade?.faixa]?.peExtra) r[peKey].max += FAIXAS[idade.faixa].peExtra;
		const folga = flag('folga');
		if (folga?.peMax) r[peKey].max = Math.max(r[peKey].max + folga.peMax, 0);
		this.idade = idade?.faixa ? { faixa: FAIXAS[idade.faixa], desvantagens: desv } : null;

		// Limite de PE (ou PD) por turno.
		this.limitePE = this.isSobrevivente || this.isMundano ? 1
			: this.usaPatentes ? PATENTES[ip].limitePD
			: this.regras.progressao === 'nivel' ? Math.max(this.progressao.nivel, 1)
				: Math.max(this.progressao.nex >= 99 ? 20 : Math.floor(this.progressao.nex / 5), 1);

		// Euforia Catatônica (Loucura não letal): o limite dobra, mas o que se baseia nele não (OPRPG p. 175).
		this.limitePEBase = this.limitePE;
		if (efeitos.some(e => e.getFlag(SYSTEM_ID, 'insanidade') === 'euforia')) this.limitePE *= 2;

		// Perícias: total = grau + bônus; dados pelo atributo.
		this.periciasCalc = {};
		const carga = this.carga = this.#prepareCarga(attr.for);
		for (const [k, def] of Object.entries(PERICIAS)) {
			const p = this.pericias[k];
			const penal = def.carga && carga.sobrecarregado ? -5 : 0;
			// Desvantagens de idade com número fixo (Catarata, Rabugento...).
			const idadePen = desv.reduce((s, d) => s + (d.pericias?.[k] ?? 0) + (d.presenca && def.atributo === 'pre' && k !== 'intimidacao' ? d.presenca : 0), 0);
			this.periciasCalc[k] = { atributo: def.atributo, dados: attr[def.atributo], total: p.grau + p.bonus + penal + idadePen };
		}

		// Defesa = 10 + AGI + proteções em uso + bônus.
		const protecoes = this.parent.items.filter(i => i.type === 'protecao' && i.system.equipado);
		const cond = this.condicoes = modsCondicoes(this.parent);
		this.defesaTotal = 10 + attr.agi + protecoes.reduce((s, i) => s + (i.system.defesa || 0), 0) + this.defesa.bonus - cond.defesa + (FAIXAS[idade?.faixa]?.defesa ?? 0);
		this.esquiva = this.defesaTotal + this.periciasCalc.reflexos.total;
		const baseDesloc = (FAIXAS[idade?.faixa]?.deslocamento ?? this.deslocamento.base) + desv.reduce((s, d) => s + (d.deslocamento ?? 0), 0);
		this.deslocamentoTotal = deslocamentoComCondicoes(Math.max(baseDesloc - (carga.sobrecarregado ? 3 : 0), 0), cond.desloc);
		this.dtRitual = 10 + this.limitePEBase + attr.pre;

		// Patente pelos pontos de prestígio.
		this.patenteAtual = PATENTES[ip];
	}

	#prepareCarga(forca) {
		const max = forca > 0 ? forca * 5 : 2;
		const usado = this.parent.items.reduce((s, i) => {
			if (!('espacos' in (i.system ?? {}))) return s;
			return s + (Number(i.system.espacos) || 0) * (Number(i.system.quantidade) || 1);
		}, 0);
		return { max, usado: Math.round(usado * 10) / 10, sobrecarregado: usado > max, limiteAbsoluto: max * 2 };
	}

	/** Dados para fórmulas: @atributos.agi, @pericias.luta, @limitePE... */
	getRollData() {
		const d = this.toObject();
		d.agi = this.atributos.agi.valor; d.for = this.atributos.for.valor; d.int = this.atributos.int.valor;
		d.pre = this.atributos.pre.valor; d.vig = this.atributos.vig.valor;
		d.limitePE = this.limitePE;
		d.nex = this.progressao.nex;
		return d;
	}
}

/** Avalia fórmulas de classe como "20+VIG" ou "3+PRE" com segurança. */
export function evalFormula(formula, attr) {
	const expr = String(formula).toUpperCase()
		.replace(/AGI/g, attr.agi ?? 0).replace(/FOR/g, attr.for ?? 0).replace(/INT/g, attr.int ?? 0)
		.replace(/PRE/g, attr.pre ?? 0).replace(/VIG/g, attr.vig ?? 0)
		.replace(/[^0-9+\-*/(). ]/g, '');
	if (!expr.trim()) return 0;
	try { return Math.floor(Roll.safeEval(expr)) || 0; } catch { return 0; }
}

export { SYSTEM_ID };
