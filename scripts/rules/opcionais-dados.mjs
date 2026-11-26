/**
 * Tabelas das regras opcionais. Textos resumidos com as nossas palavras; números conforme os livros.
 * Livro de Regras (OPRPG) pp. 171–175; Sobrevivendo ao Horror (SaH) pp. 32 e 94–105.
 */

/** 1d6 → atributo afetado (Lesões e Ferimentos Debilitantes). 6 = nenhum. */
export const ATR_D6 = ['agi', 'for', 'int', 'pre', 'vig', null];

/** Personagens de idade variada (OPRPG pp. 172–173). */
export const FAIXAS = {
	crianca: {
		nome: 'Criança', anos: '9 a 12 anos', desvantagens: 0,
		atributos: { for: { inicial: 0, max: 1 }, vig: { inicial: 0, max: 1 } },
		beneficiosOrigem: 1, defesa: 2, deslocamento: 6,
		texto: 'Força e Vigor começam em 0 (máximo 1). Tampinha: deslocamento 6m, tamanho Pequeno. Página em Branco: só um benefício da origem. Sorte de Principiante: +2 na Defesa e +5 em testes de resistência.'
	},
	adolescente: {
		nome: 'Adolescente', anos: '13 a 16 anos', desvantagens: 0,
		atributos: { for: { inicial: 0, max: 2 } },
		beneficiosOrigem: 2, peExtra: 5,
		texto: 'Força começa em 0 (máximo 2). Anos de Formação: dois benefícios da origem. Ímpeto Juvenil: +5 PE.'
	},
	jovem: { nome: 'Jovem', anos: '17 a 24 anos', desvantagens: 0, texto: 'Sem modificadores.' },
	adulto: { nome: 'Adulto', anos: '25 a 44 anos', desvantagens: 1, poderExtra: true, texto: 'Vivência: um poder de classe adicional. Peso da Idade: uma desvantagem.' },
	maduro: { nome: 'Maduro', anos: '45 a 64 anos', desvantagens: 2, nexExtra: 5, texto: 'Começa com NEX +5%. Peso da Idade: duas desvantagens.' },
	idoso: { nome: 'Idoso', anos: '65 anos ou mais', desvantagens: 3, nexExtra: 10, decrepitude: true, texto: 'Começa com NEX +10%. Decrepitude: Aumento de Atributo não sobe Agilidade, Força nem Vigor. Peso da Idade: três desvantagens.' }
};

/**
 * Desvantagens de idade (OPRPG pp. 173–174).
 * pericias: penalidade fixa na perícia. pvPorNex/pePorNex: perda por passo de NEX. deslocamento: metros.
 */
export const DESVANTAGENS = {
	catarata: { nome: 'Catarata', pericias: { percepcao: -5, pontaria: -5 }, texto: '–5 em Percepção e Pontaria.' },
	definhamento: { nome: 'Definhamento', pericias: { fortitude: -5 }, texto: '–5 em Fortitude e em manobras de combate.' },
	devagar: { nome: '"Devagar, Jovem!"', deslocamento: -3, texto: 'Deslocamento –3m; não pode fazer investidas.' },
	distraido: { nome: 'Distraído', texto: 'Surpreendido na primeira rodada de cenas de ação; perde o primeiro turno em cenas de investigação.' },
	fragil: { nome: 'Frágil', pvPorNex: -2, texto: 'Perde 2 PV por NEX.' },
	gota: { nome: 'Gota', texto: 'Sofre 1d6 de dano ao fazer testes de Agilidade (ou baseados nela) ou ao se esquivar.' },
	juntasDuras: { nome: 'Juntas Duras', pericias: { acrobacia: -5, reflexos: -5 }, texto: '–5 em Acrobacia e Reflexos.' },
	melancolico: { nome: 'Melancólico', pePorNex: -1, texto: 'Perde 1 PE por NEX.' },
	noMeuTempo: { nome: '"No Meu Tempo"', pericias: { intuicao: -5, vontade: -5 }, texto: '–5 em Intuição e Vontade.' },
	pulmaoRuim: { nome: 'Pulmão Ruim', texto: 'Sofre 1d6 de dano ao fazer testes de Força (ou baseados nela); não prende a respiração; fica fatigado após investidas.' },
	rabugento: { nome: 'Rabugento', presenca: -5, texto: '–5 em testes de Presença e perícias de Presença, exceto Intimidação.' },
	recurvado: { nome: 'Recurvado', texto: 'Tamanho Pequeno (sem o bônus de Furtividade).' },
	sonoRuim: { nome: 'Sono Ruim', texto: 'Condição de descanso sempre uma categoria pior.' },
	teimoso: { nome: 'Teimoso', texto: 'Não recebe nem fornece bônus por ajuda.' },
	tosse: { nome: 'Tosse', texto: 'Ação/investigação: 1d6 no início da rodada, em 1 perde o turno. Interpretação: em 1, –5 no teste de Presença.' }
};

/** Loucura não letal: efeitos de insanidade, 1d6 (OPRPG p. 175). */
export const INSANIDADE = [
	{ id: 'culpa', nome: 'A Culpa É Toda Sua', texto: 'Passa a odiar um membro do grupo (o mestre escolhe). No início de cada cena, role um dado: em ímpar, deve atacá-lo até matá-lo ou morrer; só ataca outros inimigos se estiverem mais perto.' },
	{ id: 'euforia', nome: 'Euforia Catatônica', texto: 'Limite de PE por turno dobra, mas não recupera PE e perde 1d10 PE no início de cada cena. Com 0 PE, fica atordoado para sempre.' },
	{ id: 'alucinacoes', nome: 'Alucinações', texto: 'No início de cada cena, Vontade (DT 20, +5 por teste já feito): falha e gasta o primeiro turno interagindo com uma alucinação; falha por 5 ou mais e entra em catatonia irreversível.' },
	{ id: 'furia', nome: 'Fúria Homicida', texto: '+2 em ataque e dano corpo a corpo. No início de cada cena, Vontade (DT 20, +5 por teste já feito): falha e ataca todos que vê, aliados também, até matar todos ou morrer.' },
	{ id: 'amnesia', nome: 'Amnésia Paranormal', texto: 'Perde a memória e todos os poderes de classe. Para cada perícia e proficiência, role um dado: em ímpar, perde.' },
	{ id: 'descontrole', nome: 'Descontrole Mortal', texto: 'No início de cada cena (ou rodada, em ação e investigação), role um dado: em ímpar, gasta o turno atacando a si mesmo com o que tiver de mais forte.' }
];

/** Inspiração Resoluta: 1d10 (OPRPG pp. 174–175). */
export const INSPIRACAO = [
	{ id: 'vinganca', faixa: [1, 2], nome: 'Chamas da Vingança', texto: '+5 em testes de ataque contra quem causou a morte, até o fim da cena.' },
	{ id: 'odio', faixa: [3, 4], nome: 'Força do Ódio', texto: '+2 em Força até o fim da cena e uma ação padrão adicional no próximo turno.' },
	{ id: 'luto', faixa: [5, 6], nome: 'Mente em Luto', texto: 'Resistência mental 10 até o fim da cena.' },
	{ id: 'resoluto', faixa: [7, 8], nome: 'Resoluto', texto: 'Recupera 4d8+4 PV e 2d6 PE.' },
	{ id: 'selvagem', faixa: [9, 10], nome: 'Loucura Selvagem', texto: 'Efeitos de paralisia terminam e ganha uma ação padrão adicional no próximo turno.' }
];
export const inspiracaoPorDado = (n) => INSPIRACAO.find(i => n >= i.faixa[0] && n <= i.faixa[1]);

/** Benefícios ao virar agente: Mundano (OPRPG p. 172) e Treinamento Especial do Sobrevivente (SaH p. 32). */
export const PERICIAS_NOVA_CLASSE = {
	combatente: { fixas: [['fortitude', 'reflexos'], ['luta', 'pontaria']], livres: 0 },
	especialista: { fixas: [], livres: 6 },
	ocultista: { fixas: [['ocultismo'], ['vontade']], livres: 2 }
};
/** Treinamento Especial: o que soma aos valores de Sobrevivente (SaH p. 32). */
export const TREINAMENTO_ESPECIAL = {
	combatente: { pv: 8, pe: 0, san: 0 },
	especialista: { pv: 4, pe: 1, san: 4 },
	ocultista: { pv: 0, pe: 2, san: 8 }
};

/** Vida Além da Ordem: interesses pessoais (SaH pp. 94–97). */
export const INTERESSES = {
	relacionamento: { nome: 'Relacionamento', dt: 20, pericias: 'duas', texto: 'Duas perícias diferentes, DT 20. Dois sucessos: 1d6 de bônus para um teste na próxima missão (20 natural: 3d6, usados separadamente). Nenhum sucesso: um desentendimento; não pode relaxar até gastar uma ação de interlúdio resolvendo.' },
	trabalho: { nome: 'Trabalho', dt: 20, pericias: 'uma', padrao: 'profissao', texto: 'Dois testes de Profissão (ou perícia do ofício), DT 20. Dois sucessos: um item extra de categoria I na próxima missão (20 natural: categoria II). Nenhum sucesso: um problema; no início de cada interlúdio da próxima missão role 1d4, no primeiro 1 gaste uma ação resolvendo ou perca o interesse.' },
	lazer: { nome: 'Lazer', dt: 20, pericias: 'uma', texto: 'Dois testes de uma perícia do hobby, DT 20. Dois sucessos: PE máximos +2 na próxima missão (20 natural: +5). Nenhum sucesso: desanimado; PE máximos reduzidos pelo limite de PE durante a próxima sessão.' },
	busca: { nome: 'Busca pessoal', dt: 25, pericias: 'jogadorMestre', texto: 'Uma perícia escolhida pelo jogador e outra pelo mestre, DT 25. Dois sucessos: uma pista (20 natural: também +1 dado em Vontade na próxima missão). Nenhum sucesso: fica frustrado até gastar duas ações de interlúdio.' }
};
