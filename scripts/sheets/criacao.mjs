/**
 * Assistente de criação de agente.
 * Segue as Regras da Mesa: livros ligados, progressão (NEX, Nível ou Patentes), recursos,
 * personagens de NEX 0% (Mundano ou Sobrevivente) e o que o mestre desligou.
 * Monta atributos, origem, classe, perícias, graus de treinamento e trilha; poderes, rituais
 * e equipamento ficam para a ficha, com a conta do que falta.
 * Livro de Regras pp. 14–33 e 171–172; Sobrevivendo ao Horror pp. 30–32 e 98–113.
 */
import { SYSTEM_ID, ATRIBUTOS, PERICIAS, PATENTES, PATENTE_CLASSE } from '../config.mjs';
import { DATA, worldRules, classAvailable, trilhaAvailable, origemAvailable } from '../rules/table-rules.mjs';
import { evalFormula } from '../data/agente.mjs';
import { FAIXAS, DESVANTAGENS, INTERESSES } from '../rules/opcionais-dados.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ETAPAS = [
	{ id: 'conceito', nome: 'Conceito' },
	{ id: 'atributos', nome: 'Atributos' },
	{ id: 'origem', nome: 'Origem' },
	{ id: 'classe', nome: 'Classe' },
	{ id: 'pericias', nome: 'Perícias' },
	{ id: 'trilha', nome: 'Trilha' },
	{ id: 'revisao', nome: 'Revisão' }
];

/** Perícias que cada grau de treinamento melhora: base + Intelecto (Livro de Regras pp. 25, 29, 33). */
const GRAU_BASE = { combatente: 2, especialista: 5, ocultista: 3 };
const GRAU = { treinado: 5, veterano: 10, expert: 15 };
const NOME_GRAU = { 5: 'Treinado', 10: 'Veterano', 15: 'Expert' };

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const PERICIA_POR_NOME = Object.fromEntries(Object.entries(PERICIAS).map(([k, p]) => [norm(p.nome), k]));

/** "Profissão (cozinheiro)" → { chave: 'profissao', nome: 'cozinheiro' }; "Duas à escolha" → { livres: 2 }. */
function lerPericia(texto) {
	const t = norm(texto);
	if (/a escolha|à escolha/.test(t) || t.includes('escolha')) return { livres: /^duas|^2/.test(t) ? 2 : 1 };
	const m = t.match(/^profissao\s*\((.+)\)$/);
	if (m) return { chave: 'profissao', nome: String(texto).match(/\((.+)\)/)[1] };
	const chave = PERICIA_POR_NOME[t];
	return chave ? { chave } : null;
}

/* --- regras de criação ------------------------------------------------------ */

/** Ponto de partida que as Regras da Mesa permitem. */
function partidas(r) {
	const out = [{ id: 'agente', nome: 'Agente', dica: 'Começa numa classe treinada: Combatente, Especialista ou Ocultista.' }];
	if (r.iniciante === 'mundano' && classAvailable('mundano', r)) out.push({ id: 'mundano', nome: 'Mundano', dica: 'NEX 0%. 3 pontos de atributo; escolhe a classe ao chegar em NEX 5%.' });
	if (r.iniciante === 'sobrevivente' && classAvailable('sobrevivente', r)) out.push({ id: 'sobrevivente', nome: 'Sobrevivente', dica: 'Classe própria do Sobrevivendo ao Horror, com 5 estágios.' });
	return out;
}

/** Trilho de progressão do personagem: nex, nivel, patentes, mundano ou estagio. */
function trilho(e, r) {
	if (e.partida === 'mundano') return 'mundano';
	if (e.partida === 'sobrevivente') return 'estagio';
	return r.progressao;
}

/** Passo equivalente (1 = NEX 5% / nível 1) para os benefícios que seguem a tabela de NEX. */
function passos(e, r) {
	const t = trilho(e, r);
	if (t === 'nivel') return nivelEfetivo(e, r);
	if (t === 'nex') { const n = nexEfetivo(e, r); return n >= 99 ? 20 : Math.floor(n / 5); }
	return 0;
}

/** Idade variada: maduro começa com NEX +5%, idoso +10% (OPRPG p. 173). Com Nível, +1 nível por 5%. */
const extraIdade = (e, r) => r.opcionais?.idadeVariada ? (FAIXAS[e.faixa]?.nexExtra ?? 0) : 0;
function nexEfetivo(e, r) { return Math.min(e.nex + extraIdade(e, r), 99); }
function nivelEfetivo(e, r) { return Math.min(e.nivel + extraIdade(e, r) / 5, 20); }
/** Valor inicial e máximo de cada atributo pela faixa etária. */
const faixaDe = (e, r) => r.opcionais?.idadeVariada ? FAIXAS[e.faixa] : null;
const baseAttr = (e, r, k) => faixaDe(e, r)?.atributos?.[k]?.inicial ?? 1;
const maxFaixa = (e, r, k) => faixaDe(e, r)?.atributos?.[k]?.max ?? 99;

/** O que a progressão escolhida dá na criação. */
export function beneficios(e, r) {
	const t = trilho(e, r);
	if (t === 'mundano') return { pontos: 3, aumentos: 0, maxAttr: 3, graus: 0, trilha: false, poderes: 0, versatilidade: false };
	if (t === 'estagio') return { pontos: 3, aumentos: e.estagio >= 3 ? 1 : 0, maxAttr: 3, graus: 0, trilha: e.estagio >= 2, poderes: 0, versatilidade: false };
	if (t === 'patentes') {
		const i = e.patente;
		return { pontos: 4, aumentos: (i >= 1) + (i >= 3), maxAttr: 4, graus: (i >= 2) + (i >= 4), trilha: i >= 2, poderes: i, versatilidade: false };
	}
	const p = passos(e, r);
	return {
		pontos: 4,
		aumentos: [4, 10, 16, 19].filter(x => p >= x).length,
		maxAttr: 5,
		graus: [7, 14].filter(x => p >= x).length,
		trilha: p >= 2,
		poderes: [3, 6, 9, 12, 15, 18].filter(x => p >= x).length,
		versatilidade: p >= 10
	};
}

/* --- estado ------------------------------------------------------------------ */

function estadoInicial(actor) {
	return {
		etapa: 0,
		nome: actor?.name && actor.name !== 'Novo agente' ? actor.name : '',
		partida: 'agente',
		nex: 5, nivel: 1, patente: 0, estagio: 1,
		atributos: { agi: 1, for: 1, int: 1, pre: 1, vig: 1 },
		origem: null,
		origemEscolhas: [],
		classe: null,
		fixas: {},
		livres: [],
		profissao: '',
		veterano: [],
		expert: [],
		trilha: null,
		faixa: 'jovem',
		desvantagens: [],
		beneficios: [],
		interesseTipo: '',
		interesseNome: ''
	};
}

export class CriacaoAgente extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		classes: ['op-dossie', 'op-criacao'],
		window: { title: 'Novo agente', icon: 'fa-solid fa-id-card', resizable: true },
		position: { width: 880, height: 720 },
		actions: {
			etapa: CriacaoAgente.#irPara,
			proxima: CriacaoAgente.#proxima,
			voltar: CriacaoAgente.#voltar,
			atributo: CriacaoAgente.#atributo,
			criar: CriacaoAgente.#criar
		}
	};

	static PARTS = {
		body: { template: `systems/${SYSTEM_ID}/templates/criacao.hbs`, scrollable: ['.op-criacao__scroll'] }
	};

	/** Agente existente a preencher (vindo da ficha), ou null para criar um novo. */
	#actor = null;
	#e;
	#docs = null;
	#criando = false;

	constructor({ actor = null, ...options } = {}) {
		super(options);
		this.#actor = actor;
		this.#e = estadoInicial(actor);
	}

	get title() { return this.#actor ? `Assistente de criação: ${this.#actor.name}` : 'Novo agente'; }

	/** Itens de classe, origem, trilha e poder de origem dos compêndios do sistema. */
	async #carregar() {
		if (this.#docs) return this.#docs;
		const pegar = async (nome) => (await game.packs.get(`${SYSTEM_ID}.${nome}`)?.getDocuments()) ?? [];
		const [classes, origens, trilhas, poderes] = await Promise.all(['classes', 'origens', 'trilhas', 'poderes'].map(pegar));
		const porChave = (lista) => new Map(lista.map(d => [d.system.chave, d]));
		this.#docs = {
			classes: porChave(classes), origens: porChave(origens),
			trilhas: new Map(trilhas.map(d => [`${d.system.classe}:${d.system.chave}`, d])),
			poderesOrigem: new Map(poderes.filter(p => p.system.tipo === 'origem').map(p => [p.system.requisitos, p]))
		};
		return this.#docs;
	}

	/* --- contas --------------------------------------------------------------- */

	#regras() { return worldRules(); }

	#classeId() {
		const e = this.#e;
		return e.partida === 'agente' ? e.classe : e.partida;
	}

	#pontosGastos() {
		const r = this.#regras();
		return Object.entries(this.#e.atributos).reduce((s, [k, v]) => s + (v - baseAttr(this.#e, r, k)), 0);
	}

	/** Atributos baixados para 0 por escolha (não pela idade). */
	#zerosOpcionais() {
		const r = this.#regras();
		return Object.entries(this.#e.atributos).filter(([k, v]) => v === 0 && baseAttr(this.#e, r, k) === 1).length;
	}

	/** Criança e adolescente recebem só parte da origem (OPRPG p. 172). */
	#limiteOrigem() {
		return faixaDe(this.#e, this.#regras())?.beneficiosOrigem ?? null;
	}

	/** Perícias que a origem e a classe já dão (antes das livres). */
	#periciasDadas(docs) {
		const e = this.#e;
		const dadas = new Map();
		let extras = 0;
		const origem = docs.origens.get(e.origem);
		const lidasOrigem = (origem?.system.pericias ?? []).map(lerPericia).filter(Boolean);
		const limite = this.#limiteOrigem();
		for (const p of lidasOrigem) {
			if (p.livres) { if (!limite) extras += p.livres; }
			else if (!limite || e.beneficios.includes(`pericia:${p.chave}`)) dadas.set(p.chave, { fonte: 'origem', nome: p.nome });
		}
		const classe = docs.classes.get(this.#classeId());
		(classe?.system.periciasFixas ?? []).forEach((texto, i) => {
			const opcoes = texto.split('|').map(lerPericia).filter(p => p?.chave);
			const chave = opcoes.length === 1 ? opcoes[0].chave : e.fixas[i];
			if (!chave) return;
			// Classe repetindo perícia da origem: escolhe outra (Livro de Regras p. 22).
			if (dadas.has(chave)) extras += 1;
			else dadas.set(chave, { fonte: 'classe' });
		});
		return { dadas, extras };
	}

	#contaLivres(docs) {
		const classe = docs.classes.get(this.#classeId());
		const base = Math.max(evalFormula(classe?.system.periciasLivres || '0', this.#e.atributos), 0);
		return base + this.#periciasDadas(docs).extras;
	}

	#treinadas(docs) {
		const { dadas } = this.#periciasDadas(docs);
		const out = new Set(dadas.keys());
		for (const k of this.#e.livres) out.add(k);
		return out;
	}

	#contaGrau() {
		const base = GRAU_BASE[this.#classeId()];
		return base ? Math.max(base + this.#e.atributos.int, 1) : 0;
	}

	/** Problemas que impedem avançar de cada etapa. */
	#pendencias(docs, r) {
		const e = this.#e;
		const b = beneficios(e, r);
		const p = {};
		if (!e.nome.trim()) p.conceito = 'Dê um nome ao agente.';
		else if (faixaDe(e, r) && e.desvantagens.length !== faixaDe(e, r).desvantagens) p.conceito = `Escolha ${faixaDe(e, r).desvantagens} desvantagem(ns) de idade.`;
		const gastos = this.#pontosGastos();
		const total = b.pontos + b.aumentos;
		const zeros = this.#zerosOpcionais();
		if (zeros > 1) p.atributos = 'Só um atributo pode ficar em 0.';
		// Baixar um atributo para 0 conta como −1 gasto, ou seja, +1 ponto para usar.
		else if (gastos !== total) p.atributos = gastos < total ? `Faltam ${total - gastos} ponto(s).` : `${gastos - total} ponto(s) a mais.`;
		if (!e.origem) p.origem = 'Escolha uma origem.';
		else if (this.#limiteOrigem() && e.beneficios.length !== this.#limiteOrigem()) p.origem = `${FAIXAS[e.faixa].nome}: escolha ${this.#limiteOrigem()} benefício(s) da origem.`;
		if (e.partida === 'agente' && !e.classe) p.classe = 'Escolha uma classe.';
		const classe = docs.classes.get(this.#classeId());
		const fixasAbertas = (classe?.system.periciasFixas ?? []).some((t, i) => t.includes('|') && !e.fixas[i]);
		const livres = this.#contaLivres(docs);
		if (fixasAbertas) p.pericias = 'Escolha as perícias da classe.';
		else if (e.livres.length !== livres) p.pericias = `Escolha ${livres} perícia(s) livre(s): ${e.livres.length} marcada(s).`;
		else if (e.livres.includes('profissao') && !e.profissao.trim() && !this.#periciasDadas(docs).dadas.get('profissao')) p.pericias = 'Diga qual é a Profissão.';
		else if (b.graus >= 1 && e.veterano.length !== Math.min(this.#contaGrau(), this.#treinadas(docs).size)) p.pericias = `Escolha ${this.#contaGrau()} perícia(s) para Veterano.`;
		else if (b.graus >= 2 && e.expert.length !== Math.min(this.#contaGrau(), e.veterano.length)) p.pericias = `Escolha ${this.#contaGrau()} perícia(s) para Expert.`;
		if (b.trilha && !e.trilha && this.#trilhasDisponiveis(r).length) p.trilha = 'Escolha uma trilha.';
		return p;
	}

	#trilhasDisponiveis(r) {
		const classe = this.#classeId();
		return (DATA.conteudo.trilhas[classe] ?? []).filter(t => trilhaAvailable(classe, t.id, r));
	}

	/** PV, PE, SAN e PD como a ficha vai calcular. */
	#recursos(docs, r) {
		const e = this.#e;
		const classe = docs.classes.get(this.#classeId())?.system;
		if (!classe) return [];
		const t = trilho(e, r);
		const n = t === 'estagio' ? e.estagio : t === 'mundano' ? 1 : Math.max(passos(e, r), 1);
		// Patentes: tabela própria do SaH (igual à ficha, data/agente.mjs).
		const tp = t === 'patentes' ? PATENTE_CLASSE[this.#classeId()] : null;
		if (tp) {
			const porPatente = ([ini, per]) => evalFormula(ini, e.atributos) + e.patente * evalFormula(per, e.atributos);
			return [{ abv: 'PV', nome: 'Vida', valor: porPatente(tp.pv) }, { abv: 'PD', nome: 'Determinação', valor: porPatente(tp.pd) }];
		}
		const calc = (f) => {
			if (!f?.inicial) return 0;
			const ini = evalFormula(f.inicial, e.atributos);
			const per = f.porNivel ? evalFormula(f.porNivel, e.atributos) : 0;
			return ini + Math.max(n - 1, 0) * per;
		};
		const out = [{ abv: 'PV', nome: 'Vida', valor: calc(classe.pv) }];
		if (r.recursos === 'semSanidade') out.push({ abv: 'PD', nome: 'Determinação', valor: calc(classe.pd) });
		else out.push({ abv: 'PE', nome: 'Esforço', valor: calc(classe.pe) }, { abv: 'SAN', nome: 'Sanidade', valor: calc(classe.san) });
		return out;
	}

	/* --- contexto ------------------------------------------------------------- */

	async _prepareContext() {
		const docs = await this.#carregar();
		const r = this.#regras();
		const e = this.#e;
		const b = beneficios(e, r);
		const pend = this.#pendencias(docs, r);
		const etapaId = ETAPAS[e.etapa].id;
		const t = trilho(e, r);

		const etapas = ETAPAS.map((s, i) => ({
			...s, i, numero: i + 1,
			atual: i === e.etapa,
			feita: i < e.etapa && !pend[s.id],
			aviso: i < e.etapa && !!pend[s.id],
			pulada: s.id === 'trilha' && !b.trilha
		}));

		const ctx = { semCompendio: !docs.classes.size || !docs.origens.size, etapas, etapaId, e, pend: pend[etapaId] ?? null, recursos: this.#recursos(docs, r), primeira: e.etapa === 0, ultima: e.etapa === ETAPAS.length - 1 };

		// Conceito
		ctx.partidas = partidas(r).map(p => ({ ...p, checked: e.partida === p.id }));
		ctx.trilho = t;
		ctx.nexOpcoes = [...Array.from({ length: 19 }, (_, i) => (i + 1) * 5), 99].map(v => ({ v, sel: v === e.nex }));
		ctx.nivelOpcoes = Array.from({ length: 20 }, (_, i) => ({ v: i + 1, sel: i + 1 === e.nivel }));
		ctx.patenteOpcoes = PATENTES.map((p, i) => ({ v: i, nome: p.nome, pp: p.pp, sel: i === e.patente }));
		ctx.estagioOpcoes = [1, 2, 3, 4, 5].map(v => ({ v, sel: v === e.estagio }));
		const fx = faixaDe(e, r);
		ctx.idade = r.opcionais?.idadeVariada ? {
			faixas: Object.entries(FAIXAS).map(([id, f]) => ({ id, nome: `${f.nome} (${f.anos})`, sel: id === e.faixa })),
			texto: fx?.texto, conta: fx?.desvantagens ?? 0, marcadas: e.desvantagens.length,
			extra: extraIdade(e, r),
			desvantagens: (fx?.desvantagens ?? 0) ? Object.entries(DESVANTAGENS).map(([id, d]) => ({ id, nome: d.nome, texto: d.texto, checked: e.desvantagens.includes(id), bloqueada: !e.desvantagens.includes(id) && e.desvantagens.length >= fx.desvantagens })) : []
		} : null;
		ctx.interesse = r.opcionais?.vidaAlemDaOrdem ? {
			tipos: [{ id: '', nome: 'Nenhum por enquanto', sel: !e.interesseTipo }, ...Object.entries(INTERESSES).map(([id, d]) => ({ id, nome: d.nome, sel: id === e.interesseTipo }))],
			nome: e.interesseNome, texto: INTERESSES[e.interesseTipo]?.texto ?? null
		} : null;
		ctx.regrasResumo = [
			{ nex: 'Progressão por NEX', nivel: 'Nível de Experiência', patentes: 'Evolução por Patentes' }[r.progressao],
			r.recursos === 'semSanidade' ? 'Sem Sanidade (PD)' : 'PV, PE e Sanidade',
			r.livros.sah ? 'Livro de Regras + Sobrevivendo ao Horror' : 'Livro de Regras'
		];
		ctx.ganhos = [
			`${b.pontos} pontos de atributo${b.aumentos ? ` + ${b.aumentos} ${b.aumentos === 1 ? 'aumento' : 'aumentos'} de atributo` : ''}`,
			b.graus ? `${b.graus === 2 ? 'Graus Veterano e Expert' : 'Grau Veterano'} em ${this.#contaGrau() ? `${this.#contaGrau()} perícias` : 'algumas perícias (a conta depende da classe)'}` : null,
			b.trilha ? 'Trilha' : null,
			b.poderes ? `${b.poderes} ${b.poderes === 1 ? 'poder' : 'poderes'} de classe, escolhidos depois na ficha` : null
		].filter(Boolean);

		// Atributos
		const gastos = this.#pontosGastos();
		const total = b.pontos + b.aumentos;
		const zeros = this.#zerosOpcionais();
		const maxAtual = 3 + b.aumentos;
		ctx.atributos = Object.entries(ATRIBUTOS).map(([k, a]) => {
			const v = e.atributos[k];
			const base = baseAttr(e, r, k);
			return {
				k, nome: a.nome, abv: a.abv, v,
				menos: v > base || (v === 1 && base === 1 && zeros === 0),
				mais: gastos < total && v < Math.min(maxAtual, b.maxAttr, maxFaixa(e, r, k)),
				idade: base === 0 ? `idade: máx. ${maxFaixa(e, r, k)}` : null
			};
		});
		ctx.pontos = { total, gastos, sobra: total - gastos, aumentos: b.aumentos, max: Math.min(maxAtual, b.maxAttr), zero: zeros === 1 };

		// Origem
		ctx.origens = DATA.conteudo.origens.filter(o => origemAvailable(o.id, r)).map(o => {
			const d = docs.origens.get(o.id);
			return {
				id: o.id, nome: o.nome, checked: e.origem === o.id,
				pericias: (d?.system.pericias ?? []).join(' · '),
				poder: docs.poderesOrigem.get(`Origem: ${d?.name ?? o.nome}`)?.name ?? '',
				comunidade: !!o.comunidade, sigla: o.livro === 'sah' ? 'SaH' : 'OPRPG'
			};
		});
		const origemSel = docs.origens.get(e.origem);
		ctx.origemSel = origemSel ? {
			nome: origemSel.name,
			descricao: await foundry.applications.ux.TextEditor.implementation.enrichHTML(origemSel.system.descricao ?? ''),
			poder: docs.poderesOrigem.get(`Origem: ${origemSel.name}`)
		} : null;
		if (ctx.origemSel?.poder) ctx.origemSel.poderTexto = await foundry.applications.ux.TextEditor.implementation.enrichHTML(ctx.origemSel.poder.system.descricao ?? '');
		const limite = this.#limiteOrigem();
		if (limite && origemSel) {
			const ops = (origemSel.system.pericias ?? []).map(lerPericia).filter(p => p?.chave).map(p => ({ id: `pericia:${p.chave}`, nome: PERICIAS[p.chave].nome }));
			if (ctx.origemSel.poder) ops.push({ id: 'poder', nome: `Poder: ${ctx.origemSel.poder.name}` });
			ctx.origemLimite = { conta: limite, faixa: FAIXAS[e.faixa].nome, opcoes: ops.map(o => ({ ...o, checked: e.beneficios.includes(o.id), bloqueada: !e.beneficios.includes(o.id) && e.beneficios.length >= limite })) };
		}

		// Classe
		ctx.classeFixa = e.partida !== 'agente' ? docs.classes.get(e.partida)?.name : null;
		ctx.classes = ['combatente', 'especialista', 'ocultista'].filter(id => classAvailable(id, r)).map(id => {
			const d = docs.classes.get(id)?.system;
			const f = (x) => x?.inicial ? `${x.inicial}`.replace(/\+/g, ' + ') : '—';
			return {
				id, nome: docs.classes.get(id)?.name ?? id, checked: e.classe === id,
				stats: r.recursos === 'semSanidade' ? `PV ${f(d?.pv)} · PD ${f(d?.pd)}` : `PV ${f(d?.pv)} · PE ${f(d?.pe)} · SAN ${d?.san?.inicial ?? '—'}`,
				pericias: `${(d?.periciasFixas ?? []).map(t => t.replace('|', ' ou ')).join(', ')}${d?.periciasFixas?.length ? ' e ' : ''}${d?.periciasLivres ?? ''} livres`.replace('INT', 'Int'),
				prof: (d?.proficiencias ?? []).join(', ')
			};
		});

		// Perícias
		const { dadas } = this.#periciasDadas(docs);
		const classe = docs.classes.get(this.#classeId());
		ctx.fixas = (classe?.system.periciasFixas ?? []).map((texto, i) => {
			const opcoes = texto.split('|').map(lerPericia).filter(p => p?.chave);
			if (opcoes.length < 2) return null;
			return { i, rotulo: opcoes.map(o => PERICIAS[o.chave].nome).join(' ou '), opcoes: opcoes.map(o => ({ k: o.chave, nome: PERICIAS[o.chave].nome, checked: e.fixas[i] === o.chave })) };
		}).filter(Boolean);
		const livres = this.#contaLivres(docs);
		const treinadas = this.#treinadas(docs);
		ctx.livres = { conta: livres, marcadas: e.livres.length, cheio: e.livres.length >= livres };
		ctx.pericias = Object.entries(PERICIAS).map(([k, p]) => {
			const dada = dadas.get(k);
			const marcada = e.livres.includes(k);
			return {
				k, nome: p.nome, abv: ATRIBUTOS[p.atributo].abv,
				fonte: dada?.fonte === 'origem' ? 'Origem' : dada?.fonte === 'classe' ? 'Classe' : null,
				checked: !!dada || marcada,
				bloqueada: !!dada || (!marcada && e.livres.length >= livres)
			};
		});
		ctx.pedeProfissao = e.livres.includes('profissao') && !dadas.get('profissao');
		ctx.profissaoOrigem = dadas.get('profissao')?.nome ?? null;
		ctx.graus = b.graus;
		const contaGrau = this.#contaGrau();
		ctx.contaGrau = contaGrau;
		const lista = (sel, base, max) => [...base].map(k => ({ k, nome: PERICIAS[k].nome, checked: sel.includes(k), bloqueada: !sel.includes(k) && sel.length >= max }));
		ctx.veterano = b.graus >= 1 ? { itens: lista(e.veterano, treinadas, contaGrau), marcadas: e.veterano.length, conta: Math.min(contaGrau, treinadas.size) } : null;
		ctx.expert = b.graus >= 2 ? { itens: lista(e.expert, e.veterano, contaGrau), marcadas: e.expert.length, conta: Math.min(contaGrau, e.veterano.length) } : null;

		// Trilha
		ctx.trilhaPede = b.trilha;
		ctx.trilhas = this.#trilhasDisponiveis(r).map(tr => {
			const d = docs.trilhas.get(`${this.#classeId()}:${tr.id}`);
			return { id: tr.id, nome: tr.nome, checked: e.trilha === tr.id, texto: d?.system.descricao?.replace(/<[^>]+>/g, '') ?? '', sigla: tr.livro === 'sah' ? 'SaH' : 'OPRPG' };
		});

		// Revisão
		if (etapaId === 'revisao') {
			const pendentes = ETAPAS.filter(s => pend[s.id]).map(s => ({ etapa: s.nome, i: ETAPAS.indexOf(s), texto: pend[s.id] }));
			const graus = new Map([...treinadas].map(k => [k, GRAU.treinado]));
			for (const k of e.veterano) graus.set(k, GRAU.veterano);
			for (const k of e.expert) graus.set(k, GRAU.expert);
			ctx.revisao = {
				pendentes,
				idade: faixaDe(e, r) ? `${FAIXAS[e.faixa].nome}${e.desvantagens.length ? ` · ${e.desvantagens.map(d => DESVANTAGENS[d].nome).join(', ')}` : ''}` : null,
				progresso: { nex: `NEX ${nexEfetivo(e, r)}%`, nivel: `Nível ${nivelEfetivo(e, r)}`, patentes: PATENTES[e.patente].nome, mundano: 'NEX 0%', estagio: `Estágio ${e.estagio}` }[t],
				classe: docs.classes.get(this.#classeId())?.name ?? '—',
				origem: origemSel?.name ?? '—',
				trilha: e.trilha ? DATA.conteudo.trilhas[this.#classeId()]?.find(x => x.id === e.trilha)?.nome : null,
				atributos: Object.entries(ATRIBUTOS).map(([k, a]) => ({ abv: a.abv, v: e.atributos[k] })),
				pericias: [...graus].map(([k, g]) => ({ nome: k === 'profissao' && (e.profissao || ctx.profissaoOrigem) ? `Profissão (${e.profissao || ctx.profissaoOrigem})` : PERICIAS[k].nome, grau: NOME_GRAU[g] }))
					.sort((a, b2) => a.nome.localeCompare(b2.nome)),
				depois: this.#depois(b, r)
			};
		}
		ctx.podeCriar = !Object.keys(pend).length && !this.#criando;
		ctx.botaoCriar = this.#actor ? 'Aplicar no agente' : 'Criar agente';
		return ctx;
	}

	/** O que o assistente não escolhe: fica para a ficha, pelos compêndios. */
	#depois(b, r) {
		const e = this.#e;
		const out = [];
		const classe = this.#classeId();
		if (b.poderes) out.push(`${b.poderes} ${b.poderes === 1 ? 'poder' : 'poderes'} de ${{ combatente: 'combatente', especialista: 'especialista', ocultista: 'ocultista' }[classe] ?? 'classe'} (compêndio Poderes)`);
		if (b.versatilidade) out.push('Versatilidade (NEX 50%): um poder de classe ou o primeiro de outra trilha');
		if (classe === 'ocultista') {
			const p = Math.max(passos(e, r), 1);
			const extra = r.aprendizadoRituais === 'campo' ? 0 : r.aprendizadoRituais === 'lento' ? Math.floor((p - 1) / 2) : p - 1;
			const n = 3 + (trilho(e, r) === 'patentes' ? e.patente * 2 : extra);
			out.push(`${n} ${n === 1 ? 'ritual' : 'rituais'} de 1º círculo ou acima, conforme o NEX (compêndio Rituais)`);
		}
		const pat = trilho(e, r) === 'patentes' ? PATENTES[e.patente] : (trilho(e, r) === 'nex' || trilho(e, r) === 'nivel') ? PATENTES[0] : null;
		if (pat) out.push(`Equipamento de ${pat.nome}: até ${pat.limites.map((n, i) => n ? `${n} de categoria ${['I', 'II', 'III', 'IV'][i]}` : null).filter(Boolean).join(', ')}`);
		else out.push('Equipamento: um item de categoria I e itens de categoria 0');
		const fx = faixaDe(e, r);
		if (fx?.poderExtra) out.push('Vivência (adulto): um poder de classe adicional');
		if (e.faixa === 'crianca' && fx) out.push('Criança: tamanho Pequeno (armas leves contam como de uma mão, sem armas de duas mãos) e +5 em testes de resistência');
		if (r.opcionais?.vidaAlemDaOrdem && !e.interesseTipo) out.push('Vida Além da Ordem: dá para adicionar interesses pessoais depois, no Diário');
		return out;
	}

	/* --- eventos -------------------------------------------------------------- */

	_onFirstRender(context, options) {
		super._onFirstRender(context, options);
		this.element.addEventListener('change', this.#onChange.bind(this));
		this.element.addEventListener('input', (ev) => {
			if (ev.target.name === 'nome') this.#e.nome = ev.target.value;
			if (ev.target.name === 'profissao') this.#e.profissao = ev.target.value;
			if (ev.target.name === 'interesseNome') this.#e.interesseNome = ev.target.value;
		});
	}

	#onChange(event) {
		const el = event.target;
		const e = this.#e;
		const campo = el.dataset.campo ?? el.name;
		switch (campo) {
			case 'nome': e.nome = el.value; break;
			case 'profissao': e.profissao = el.value; break;
			case 'partida':
				e.partida = el.value;
				e.classe = null; e.fixas = {}; e.livres = []; e.veterano = []; e.expert = []; e.trilha = null;
				this.#ajustarAtributos();
				break;
			case 'nex': e.nex = Number(el.value); this.#ajustarAtributos(); this.#ajustarGraus(); break;
			case 'nivel': e.nivel = Number(el.value); this.#ajustarAtributos(); this.#ajustarGraus(); break;
			case 'patente': e.patente = Number(el.value); this.#ajustarAtributos(); this.#ajustarGraus(); break;
			case 'estagio': e.estagio = Number(el.value); this.#ajustarAtributos(); break;
			case 'origem': e.origem = el.value; e.livres = []; e.veterano = []; e.expert = []; e.beneficios = []; break;
			case 'faixa': e.faixa = el.value; e.desvantagens = []; e.beneficios = []; e.livres = []; this.#resetAtributos(); break;
			case 'desvantagem': this.#alternar(e.desvantagens, el.value, el.checked); break;
			case 'beneficio': this.#alternar(e.beneficios, el.value, el.checked); e.livres = []; e.veterano = []; e.expert = []; break;
			case 'interesseTipo': e.interesseTipo = el.value; break;
			case 'interesseNome': e.interesseNome = el.value; break;
			case 'classe':
				e.classe = el.value; e.fixas = {}; e.livres = []; e.veterano = []; e.expert = []; e.trilha = null;
				break;
			case 'fixa': e.fixas[el.dataset.i] = el.value; e.livres = e.livres.filter(k => k !== el.value); break;
			case 'livre':
				if (this.#docs && this.#periciasDadas(this.#docs).dadas.has(el.value)) return this.render();
				this.#alternar(e.livres, el.value, el.checked); e.veterano = e.veterano.filter(k => k !== el.value || el.checked); break;
			case 'veterano': this.#alternar(e.veterano, el.value, el.checked); if (!el.checked) e.expert = e.expert.filter(k => k !== el.value); break;
			case 'expert': this.#alternar(e.expert, el.value, el.checked); break;
			case 'trilha': e.trilha = el.value; break;
			default: return;
		}
		if (!['nome', 'profissao', 'interesseNome'].includes(campo)) this.render();
	}

	#alternar(lista, k, ligado) {
		const i = lista.indexOf(k);
		if (ligado && i < 0) lista.push(k);
		if (!ligado && i >= 0) lista.splice(i, 1);
	}

	/** Pontos a mais depois de baixar o NEX (ou trocar de partida): volta os atributos ao básico. */
	/** Atributos de volta ao valor inicial (1, ou o da faixa etária). */
	#resetAtributos() {
		const r = this.#regras();
		this.#e.atributos = Object.fromEntries(Object.keys(ATRIBUTOS).map(k => [k, baseAttr(this.#e, r, k)]));
	}

	#ajustarAtributos() {
		const r = this.#regras();
		const b = beneficios(this.#e, r);
		const max = Math.min(3 + b.aumentos, b.maxAttr);
		const at = this.#e.atributos;
		for (const k of Object.keys(at)) at[k] = Math.min(at[k], max, maxFaixa(this.#e, r, k));
		if (this.#pontosGastos() > b.pontos + b.aumentos) this.#resetAtributos();
		if (!b.trilha) this.#e.trilha = null;
	}

	#ajustarGraus() {
		const b = beneficios(this.#e, this.#regras());
		if (b.graus < 1) this.#e.veterano = [];
		if (b.graus < 2) this.#e.expert = [];
	}

	#ir(i) {
		const r = this.#regras();
		const b = beneficios(this.#e, r);
		let alvo = Math.clamp(i, 0, ETAPAS.length - 1);
		// Sem trilha nesse NEX: pula a etapa.
		if (ETAPAS[alvo].id === 'trilha' && !b.trilha) alvo += i >= this.#e.etapa ? 1 : -1;
		this.#e.etapa = alvo;
		this.render().then(() => {
			const s = this.element.querySelector('.op-criacao__scroll');
			if (s) s.scrollTop = 0;
			this.element.querySelector('.op-criacao__main h2')?.focus({ preventScroll: true });
		});
	}

	static #irPara(event, target) { this.#ir(Number(target.dataset.i)); }
	static #proxima() { this.#ir(this.#e.etapa + 1); }
	static #voltar() { this.#ir(this.#e.etapa - 1); }

	static #atributo(event, target) {
		const k = target.dataset.k;
		const d = Number(target.dataset.d);
		const at = this.#e.atributos;
		at[k] = Math.clamp(at[k] + d, 0, 5);
		// Intelecto mudou: o número de perícias livres e de graus muda junto.
		if (k === 'int') { this.#e.livres = []; this.#e.veterano = []; this.#e.expert = []; }
		this.render();
	}

	/* --- criar ---------------------------------------------------------------- */

	static async #criar() {
		if (this.#criando) return;
		const docs = await this.#carregar();
		const r = this.#regras();
		if (Object.keys(this.#pendencias(docs, r)).length) return this.render();
		this.#criando = true;
		this.render();
		try {
			const actor = await this.#aplicar(docs, r);
			ui.notifications.info(`${actor.name} está pronto. Poderes, rituais e equipamento ficam para a ficha.`);
			await this.close();
			actor.sheet.render(true);
		} catch (err) {
			console.error(`${SYSTEM_ID} | criação de agente`, err);
			ui.notifications.error('Não consegui criar o agente. Veja o console (F12).');
			this.#criando = false;
			this.render();
		}
	}

	async #aplicar(docs, r) {
		const e = this.#e;
		const t = trilho(e, r);
		const { dadas } = this.#periciasDadas(docs);
		const treinadas = this.#treinadas(docs);
		const pericias = Object.fromEntries(Object.keys(PERICIAS).map(k => [k, { grau: 0 }]));
		for (const k of treinadas) pericias[k].grau = GRAU.treinado;
		for (const k of e.veterano) pericias[k].grau = GRAU.veterano;
		for (const k of e.expert) pericias[k].grau = GRAU.expert;
		const profissao = dadas.get('profissao')?.nome || e.profissao.trim();
		if (profissao) pericias.profissao.nome = profissao;

		const system = {
			atributos: Object.fromEntries(Object.entries(e.atributos).map(([k, v]) => [k, { valor: v }])),
			pericias,
			progressao: {
				nex: t === 'nex' ? nexEfetivo(e, r) : t === 'patentes' ? 5 : 0,
				nivel: t === 'nivel' ? nivelEfetivo(e, r) : t === 'mundano' ? 0 : 1,
				estagio: t === 'estagio' ? e.estagio : 1
			},
			patente: { pp: t === 'patentes' ? PATENTES[e.patente].pp : 0 }
		};

		const itens = [];
		const deCompendio = (d) => d && game.items.fromCompendium(d);
		itens.push(deCompendio(docs.classes.get(this.#classeId())));
		const origem = docs.origens.get(e.origem);
		itens.push(deCompendio(origem));
		// Criança/adolescente: o poder da origem só vem se foi um dos benefícios escolhidos.
		if (!this.#limiteOrigem() || e.beneficios.includes('poder')) itens.push(deCompendio(docs.poderesOrigem.get(`Origem: ${origem?.name}`)));
		if (e.trilha) itens.push(deCompendio(docs.trilhas.get(`${this.#classeId()}:${e.trilha}`)));

		let actor = this.#actor;
		if (actor) {
			const velhos = actor.items.filter(i => ['classe', 'origem', 'trilha'].includes(i.type) || (i.type === 'poder' && i.system.tipo === 'origem'));
			if (velhos.length) await actor.deleteEmbeddedDocuments('Item', velhos.map(i => i.id));
			await actor.update({ name: e.nome.trim(), system });
		} else {
			actor = await Actor.implementation.create({ name: e.nome.trim(), type: 'agente', system, prototypeToken: { actorLink: true, name: e.nome.trim() } });
		}
		// Regras opcionais guardadas na ficha.
		const flags = {};
		if (faixaDe(e, r)) flags.idade = { faixa: e.faixa, desvantagens: [...e.desvantagens] };
		if (r.opcionais?.vidaAlemDaOrdem && e.interesseTipo) flags.interesses = [{ id: foundry.utils.randomID(), tipo: e.interesseTipo, nome: e.interesseNome.trim() }];
		if (Object.keys(flags).length) await actor.update({ [`flags.${SYSTEM_ID}`]: flags });
		await actor.createEmbeddedDocuments('Item', itens.filter(Boolean));
		// Recursos cheios com os máximos que a ficha calculou.
		const rec = actor.system.recursos;
		await actor.update(Object.fromEntries(Object.entries(rec).filter(([, v]) => v.max > 0).map(([k, v]) => [`system.recursos.${k}.valor`, v.max])));
		return actor;
	}
}

/** Abre o assistente: para um agente existente (da ficha) ou para criar um novo. */
export function abrirCriacao(actor = null) {
	const id = `op-criacao-${actor?.id ?? 'novo'}`;
	const aberta = foundry.applications.instances.get(id);
	if (aberta) return aberta.bringToFront?.() ?? aberta.render(true);
	return new CriacaoAgente({ actor, id }).render(true);
}
