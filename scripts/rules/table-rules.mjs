/**
 * Regras da Mesa: carregamento das definições, leitura das regras do mundo
 * e de exceções por personagem, e validação das combinações.
 */
export const MOD = 'op-dossie';
const SETTING = 'regras';

/** Definições carregadas de data/regras.json e data/conteudo.json. */
export const DATA = { regras: null, conteudo: null };

export async function loadData() {
	const base = `systems/${MOD}/data`;
	const [regras, conteudo] = await Promise.all([
		foundry.utils.fetchJsonWithTimeout(`${base}/regras.json`),
		foundry.utils.fetchJsonWithTimeout(`${base}/conteudo.json`)
	]);
	DATA.regras = regras;
	DATA.conteudo = conteudo;
}

export function registerSettings(onChange) {
	game.settings.register(MOD, SETTING, {
		scope: 'world',
		config: false,
		type: Object,
		default: {},
		onChange
	});
}

/** Campos que podem ter exceção por personagem. */
export const ACTOR_OVERRIDABLE = ['progressao', 'recursos', 'iniciante'];

const SAH_OPCIONAIS = () => DATA.regras.opcionais.filter(o => o.livro === 'sah').map(o => o.id);

/**
 * Junta as regras salvas com o padrão e aplica as restrições entre opções.
 * @returns {{regras: object, avisos: string[], ajustes: string[]}}
 */
export function normalize(raw = {}) {
	const r = foundry.utils.mergeObject(foundry.utils.deepClone(DATA.regras.padrao), raw ?? {}, { inplace: false });
	r.desativados ??= { classes: [], trilhas: [], origens: [] };
	r.automacao = { municao: true, ocultarDanoAmeacas: false, ...(r.automacao ?? {}) };
	for (const k of ['classes', 'trilhas', 'origens']) r.desativados[k] ??= [];
	const ajustes = [];
	const avisos = [];

	r.livros.base = true;
	if (!r.livros.sah) {
		// "Origens da comunidade" guarda a escolha; sem o SaH ela só deixa de valer.
		if (r.progressao !== 'nex') { ajustes.push('Progressão voltou para NEX: a opção escolhida é do Sobrevivendo ao Horror.'); r.progressao = 'nex'; }
		if (r.recursos !== 'padrao') { ajustes.push('Recursos voltaram para PV, PE e Sanidade: Jogando sem Sanidade é do Sobrevivendo ao Horror.'); r.recursos = 'padrao'; }
		if (r.iniciante === 'sobrevivente') { ajustes.push('Sobrevivente desligado: é uma classe do Sobrevivendo ao Horror.'); r.iniciante = 'nenhum'; }
		if (r.aprendizadoRituais !== 'padrao') { ajustes.push('Aprendizado de rituais voltou para o padrão.'); r.aprendizadoRituais = 'padrao'; }
		for (const id of SAH_OPCIONAIS()) if (r.opcionais[id]) r.opcionais[id] = false;
	}
	if (r.opcionais.municao && r.opcionais.dadoDeUso) {
		ajustes.push('Contagem de munição desligada: o Dado de uso já controla a munição.');
		r.opcionais.municao = false;
	}
	if (r.progressao === 'patentes' && r.recursos !== 'semSanidade') {
		ajustes.push('Evolução por Patentes exige Jogando sem Sanidade, que foi ligado.');
		r.recursos = 'semSanidade';
	}
	avisos.push(...warningsFor(r));
	return { regras: r, avisos, ajustes };
}

/** Combinações permitidas que o livro não explica. */
export function warningsFor(r) {
	const out = [];
	if (r.iniciante === 'sobrevivente' && r.progressao !== 'nex') {
		out.push(`O Sobrevivendo ao Horror não explica o Sobrevivente com ${r.progressao === 'nivel' ? 'Nível de Experiência' : 'Evolução por Patentes'}. Ele continua progredindo por estágios.`);
	}
	if (r.iniciante === 'mundano' && r.progressao === 'patentes') {
		out.push('O Mundano não usa patentes no livro. Ele recebe a patente ao virar agente em NEX 5%.');
	}
	return out;
}

/** Usado só se os personagens forem calculados antes de data/regras.json terminar de carregar. */
const FALLBACK = { livros: { base: true, sah: true }, progressao: 'nex', recursos: 'padrao', iniciante: 'nenhum', aprendizadoRituais: 'padrao', opcionais: {}, automacao: { municao: true, ocultarDanoAmeacas: false }, desativados: { classes: [], trilhas: [], origens: [] } };

/** Regras do mundo, já normalizadas. */
export function worldRules() {
	const saved = game.settings.get(MOD, SETTING);
	if (!DATA.regras) {
		const r = { ...FALLBACK, ...saved };
		if (r.progressao === 'patentes') r.recursos = 'semSanidade';
		return r;
	}
	return normalize(saved).regras;
}

export async function saveWorldRules(regras) {
	const { regras: clean } = normalize(regras);
	await game.settings.set(MOD, SETTING, clean);
	return clean;
}

/** Exceção salva no personagem (parcial), ou null. */
export function actorOverride(actor) {
	const o = actor?.getFlag?.(MOD, 'excecao');
	if (!o) return null;
	const picked = Object.fromEntries(ACTOR_OVERRIDABLE.filter(k => o[k]).map(k => [k, o[k]]));
	return Object.keys(picked).length ? picked : null;
}

/** Regras que valem para um personagem: as do mundo com a exceção por cima. */
export function rulesFor(actor) {
	const world = worldRules();
	const o = actorOverride(actor);
	if (!o) return world;
	const merged = { ...world, ...o };
	if (merged.progressao === 'patentes') merged.recursos = 'semSanidade';
	return merged;
}

/** Nome de uma opção de escolha, para mensagens. */
export function choiceName(group, id) {
	return DATA.regras.escolhas[group]?.opcoes.find(o => o.id === id)?.nome ?? id;
}

/** Livro de uma entrada de conteúdo está ligado? */
function bookOn(r, entry) {
	if (entry.comunidade && !r.livros.sahComunidade) return false;
	return !!r.livros[entry.livro];
}

/** Classe disponível na criação de personagem? */
export function classAvailable(id, r = worldRules()) {
	const e = DATA.conteudo.classes.find(c => c.id === id);
	if (!e || !bookOn(r, e)) return false;
	if (e.iniciante && r.iniciante !== e.iniciante) return false;
	return !r.desativados.classes.includes(id);
}

export function trilhaAvailable(classId, id, r = worldRules()) {
	const e = DATA.conteudo.trilhas[classId]?.find(t => t.id === id);
	return !!e && bookOn(r, e) && !r.desativados.trilhas.includes(id);
}

export function origemAvailable(id, r = worldRules()) {
	const e = DATA.conteudo.origens.find(o => o.id === id);
	return !!e && bookOn(r, e) && !r.desativados.origens.includes(id);
}
