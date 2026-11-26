/**
 * Constantes do jogo (Ordem Paranormal RPG, Livro de Regras).
 */
export const SYSTEM_ID = 'op-dossie';

export const ATRIBUTOS = {
	agi: { nome: 'Agilidade', abv: 'AGI' },
	for: { nome: 'Força', abv: 'FOR' },
	int: { nome: 'Intelecto', abv: 'INT' },
	pre: { nome: 'Presença', abv: 'PRE' },
	vig: { nome: 'Vigor', abv: 'VIG' }
};

/**
 * Perícias: atributo-chave, se exige treinamento (*) e se sofre penalidade de carga (+).
 * Livro de Regras, capítulo de perícias.
 */
export const PERICIAS = {
	acrobacia: { nome: 'Acrobacia', atributo: 'agi', carga: true },
	adestramento: { nome: 'Adestramento', atributo: 'pre', treinada: true },
	artes: { nome: 'Artes', atributo: 'pre', treinada: true },
	atletismo: { nome: 'Atletismo', atributo: 'for' },
	atualidades: { nome: 'Atualidades', atributo: 'int' },
	ciencias: { nome: 'Ciências', atributo: 'int', treinada: true },
	crime: { nome: 'Crime', atributo: 'agi', treinada: true, carga: true },
	diplomacia: { nome: 'Diplomacia', atributo: 'pre' },
	enganacao: { nome: 'Enganação', atributo: 'pre' },
	fortitude: { nome: 'Fortitude', atributo: 'vig' },
	furtividade: { nome: 'Furtividade', atributo: 'agi', carga: true },
	iniciativa: { nome: 'Iniciativa', atributo: 'agi' },
	intimidacao: { nome: 'Intimidação', atributo: 'pre' },
	intuicao: { nome: 'Intuição', atributo: 'pre' },
	investigacao: { nome: 'Investigação', atributo: 'int' },
	luta: { nome: 'Luta', atributo: 'for' },
	medicina: { nome: 'Medicina', atributo: 'int' },
	ocultismo: { nome: 'Ocultismo', atributo: 'int', treinada: true },
	percepcao: { nome: 'Percepção', atributo: 'pre' },
	pilotagem: { nome: 'Pilotagem', atributo: 'agi', treinada: true },
	pontaria: { nome: 'Pontaria', atributo: 'agi' },
	profissao: { nome: 'Profissão', atributo: 'int', treinada: true, livre: true },
	reflexos: { nome: 'Reflexos', atributo: 'agi' },
	religiao: { nome: 'Religião', atributo: 'pre', treinada: true },
	sobrevivencia: { nome: 'Sobrevivência', atributo: 'int' },
	tatica: { nome: 'Tática', atributo: 'int', treinada: true },
	tecnologia: { nome: 'Tecnologia', atributo: 'int', treinada: true },
	vontade: { nome: 'Vontade', atributo: 'pre' }
};

export const GRAUS = {
	0: { nome: 'Destreinado', curto: '—' },
	5: { nome: 'Treinado', curto: 'T' },
	10: { nome: 'Veterano', curto: 'V' },
	15: { nome: 'Expert', curto: 'E' }
};

export const ELEMENTOS = {
	sangue: { nome: 'Sangue', cor: '#c0392b' },
	morte: { nome: 'Morte', cor: '#6b6b6b' },
	conhecimento: { nome: 'Conhecimento', cor: '#d6a84a' },
	energia: { nome: 'Energia', cor: '#8e5cc2' },
	medo: { nome: 'Medo', cor: '#f2f2f2' }
};

export const TIPOS_DANO = {
	corte: 'Corte', impacto: 'Impacto', perfuracao: 'Perfuração', balistico: 'Balístico',
	fogo: 'Fogo', frio: 'Frio', eletricidade: 'Eletricidade', quimico: 'Químico', mental: 'Mental',
	sangue: 'Sangue', morte: 'Morte', conhecimento: 'Conhecimento', energia: 'Energia', medo: 'Medo'
};
export const DANO_PARANORMAL = ['sangue', 'morte', 'conhecimento', 'energia', 'medo'];

export const EXECUCAO = { livre: 'Livre', padrao: 'Padrão', movimento: 'Movimento', completa: 'Completa', reacao: 'Reação' };
export const ALCANCE = { pessoal: 'Pessoal', toque: 'Toque', curto: 'Curto', medio: 'Médio', longo: 'Longo', extremo: 'Extremo', ilimitado: 'Ilimitado' };
export const DURACAO = { instantanea: 'Instantânea', cena: 'Cena', sustentada: 'Sustentada', definida: 'Definida', permanente: 'Permanente' };
export const EFEITO_RESISTENCIA = { anula: 'anula', desacredita: 'desacredita', parcial: 'parcial', metade: 'reduz à metade' };

/** Custo base de ritual por círculo. */
export const CUSTO_CIRCULO = { 1: 1, 2: 3, 3: 6, 4: 10 };

/** Patentes (Livro de Regras, Tabela 3.2). */
export const PATENTES = [
	{ nome: 'Recruta', pp: 0, limites: [2, 0, 0, 0], credito: 'Baixo', limitePD: 1 },
	{ nome: 'Operador', pp: 20, limites: [3, 1, 0, 0], credito: 'Médio', limitePD: 3 },
	{ nome: 'Agente especial', pp: 50, limites: [3, 2, 1, 0], credito: 'Médio', limitePD: 6 },
	{ nome: 'Oficial de operações', pp: 100, limites: [3, 3, 2, 1], credito: 'Alto', limitePD: 10 },
	{ nome: 'Agente de elite', pp: 200, limites: [3, 3, 3, 2], credito: 'Ilimitado', limitePD: 15 }
];

/**
 * Evolução por Patentes (Sobrevivendo ao Horror pp. 108–113, Tabelas 2.7–2.9):
 * PV e PD iniciais e o que cada nova patente soma. O limite de PD vale como nível para pré-requisitos.
 */
export const PATENTE_CLASSE = {
	combatente: { pv: ['20+VIG', '10+VIG'], pd: ['8+PRE', '4+PRE'] },
	especialista: { pv: ['16+VIG', '8+VIG'], pd: ['12+PRE', '6+PRE'] },
	ocultista: { pv: ['12+VIG', '6+VIG'], pd: ['16+PRE', '8+PRE'] }
};

/** Índice da patente pelos pontos de prestígio. */
export function indicePatente(pp) {
	let i = 0;
	PATENTES.forEach((p, j) => { if (pp >= p.pp) i = j; });
	return i;
}

export const TIPOS_PODER = {
	origem: 'Poderes de origem', classe: 'Poderes de classe', trilha: 'Habilidades de trilha',
	geral: 'Poderes gerais', paranormal: 'Poderes paranormais', complicacao: 'Complicações', outro: 'Outras habilidades'
};
