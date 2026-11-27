/**
 * Converte as entradas de data/fontes/*.json em itens do sistema.
 * IDs estáveis (derivados do id da entrada): reimportar mantém links.
 */
import { SYSTEM_ID } from '../config.mjs';
import { iconeItem, iconeRitual } from './icones.mjs';

const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function stableId(text) {
	let h1 = 0x811c9dc5, h2 = 0x01000193, out = '';
	for (let round = 0; out.length < 16; round++) {
		for (const ch of `${round}:${text}`) {
			h1 = Math.imul(h1 ^ ch.codePointAt(0), 16777619) >>> 0;
			h2 = Math.imul(h2 + ch.codePointAt(0), 2246822519) >>> 0;
		}
		let n = (h1 ^ (h2 << 7)) >>> 0;
		for (let i = 0; i < 5 && out.length < 16; i++) { out += ALPHA[n % 62]; n = Math.floor(n / 62); }
	}
	return out;
}

/* --- tradução de códigos antigos para os do sistema --- */
const ELEMENTO = { blood: 'sangue', death: 'morte', knowledge: 'conhecimento', energy: 'energia', fear: 'medo' };
const EXEC = { free: 'livre', default: 'padrao', complete: 'completa', reaction: 'reacao', movement: 'movimento' };
const ALC = { personal: 'pessoal', touch: 'toque', short: 'curto', medium: 'medio', long: 'longo', extreme: 'extremo', unlimited: 'ilimitado' };
const DUR = { instantaneous: 'instantanea', scene: 'cena', sustained: 'sustentada', setDuration: 'definida', permanent: 'permanente' };
const RES = { nullifies: 'anula', discredits: 'desacredita', partial: 'parcial', reducesByHalf: 'metade' };
const DANO = {
	cuttingDamage: 'corte', impactDamage: 'impacto', piercingDamage: 'perfuracao', ballisticDamage: 'balistico',
	fireDamage: 'fogo', coldDamage: 'frio', eletricDamage: 'eletricidade', chemicalDamage: 'quimico', mentalDamage: 'mental',
	bloodDamage: 'sangue', deathDamage: 'morte', knowledgeDamage: 'conhecimento', energyDamage: 'energia', fearDamage: 'medo'
};
const el = (v) => ELEMENTO[v] ?? v ?? '';
const tipoDano = (v) => DANO[v] ?? (v ? String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : '');
const dano = (d) => d?.formula ? { formula: String(d.formula), tipo: tipoDano(d.tipo) } : null;
const fonte = (e) => ({ livro: e.livro ?? '', pagina: e.pagina ?? null, id: e.id });
const str = (v) => (v === null || v === undefined) ? '' : String(v);

export function ritualToItem(e) {
	const forma = (f) => f ? { custoExtra: Number(f.custoExtra) || 0, circuloMin: f.circuloMin ?? null, afinidade: !!f.afinidade, texto: f.texto ?? '', dano: dano(f.dano) } : null;
	const elemento = el(e.elemento);
	return {
		_id: stableId(`ritual:${e.id}`), name: e.nome, type: 'ritual',
		img: iconeRitual(e.id, elemento),
		system: {
			descricao: e.descricao ?? '', fonte: fonte(e), revisar: e.revisar || '',
			circulo: e.circulo, elemento,
			execucao: EXEC[e.execucao] ?? 'padrao',
			alcance: { chave: ALC[e.alcance] ?? '', texto: e.alcanceTexto ?? '' },
			alvo: e.alvo ?? '', area: e.area?.texto ?? '',
			duracao: { chave: DUR[e.duracao] ?? '', texto: e.duracaoTexto ?? '' },
			resistencia: { pericia: e.resistencia?.pericia ?? '', efeito: RES[e.resistencia?.efeito] ?? '', texto: e.resistencia?.texto ?? '' },
			custo: e.custo ?? null, dano: dano(e.dano), cura: str(e.cura), condicoes: e.condicoes ?? [],
			discente: forma(e.discente), verdadeiro: forma(e.verdadeiro)
		}
	};
}

const recursoF = (f) => ({ inicial: str(f?.inicial), porNivel: str(f?.porNivel) });
export function classeToItem(e) {
	return {
		_id: stableId(`classe:${e.id}`), name: e.nome, type: 'classe', img: iconeItem('classe', e.id),
		system: {
			descricao: e.descricao ?? '', fonte: fonte(e), revisar: e.revisar || '', chave: e.chave ?? e.id,
			pv: recursoF(e.pv), pe: recursoF(e.pe), san: recursoF(e.san), pd: recursoF(e.pd),
			periciasFixas: e.periciasFixas ?? [], periciasLivres: str(e.periciasLivres), proficiencias: e.proficiencias ?? [],
			progressao: (e.progressao ?? []).map(p => ({ nex: p.nex ?? null, estagio: p.estagio ?? null, ganhos: p.ganhos ?? [] })),
			habilidades: (e.habilidades ?? []).map(h => ({ nome: h.nome, nex: h.nex ?? null, estagio: h.estagio ?? null, texto: h.texto ?? '' }))
		}
	};
}

export function origemToItem(e) {
	return {
		_id: stableId(`origem:${e.id}`), name: e.nome, type: 'origem', img: iconeItem('origem', e.id),
		system: {
			descricao: e.descricao ?? '', fonte: fonte(e), revisar: e.revisar || '', chave: e.chave ?? e.id,
			comunidade: !!e.comunidade, autores: str(e.autores), pericias: e.pericias ?? [],
			poder: { nome: e.poder?.nome ?? '', texto: e.poder?.texto ?? '' }
		}
	};
}

export function origemPoderToItem(e) {
	if (!e.poder?.nome) return null;
	return {
		_id: stableId(`origem-poder:${e.id}`), name: e.poder.nome, type: 'poder', img: iconeItem('poder', e.id, 'origem'),
		system: { descricao: e.poder.texto ?? '', fonte: fonte(e), revisar: e.revisar || '', tipo: 'origem', requisitos: `Origem: ${e.nome}` }
	};
}

/** "Uma vez por cena" e afins viram um contador. */
function limiteDoTexto(texto) {
	const m = String(texto ?? '').match(/uma vez por (rodada|cena|interl[uú]dio|miss[aã]o)/i);
	if (!m) return {};
	const limite = { rodada: 'rodada', cena: 'cena' }[m[1].toLowerCase()] ?? (/^interl/i.test(m[1]) ? 'interludio' : 'missao');
	return { limite, usos: { valor: 1, max: 1 } };
}

export function poderToItem(e) {
	const custo = typeof e.custo === 'number' ? e.custo : Number(String(e.custo ?? '').match(/\d+/)?.[0]) || null;
	return {
		_id: stableId(`poder:${e.livro}:${e.id}`), name: e.nome, type: 'poder',
		img: iconeItem('poder', e.id, e.tipo ?? 'outro', el(e.elemento)),
		system: {
			descricao: e.texto ?? '', fonte: fonte(e), revisar: e.revisar || '',
			tipo: e.tipo ?? 'outro', classe: str(e.classe), elemento: el(e.elemento),
			requisitos: str(e.requisitos ?? e.requisito), custo, ...limiteDoTexto(e.texto)
		}
	};
}

export function trilhaToItem(e) {
	return {
		_id: stableId(`trilha:${e.id}`), name: e.nome, type: 'trilha', img: iconeItem('trilha', e.id, e.classe),
		system: {
			descricao: e.texto ?? '', fonte: fonte(e), revisar: e.revisar || '', chave: e.id, classe: e.classe,
			habilidades: (e.habilidades ?? []).map(h => ({ nex: h.nex ?? h.estagio ?? null, nome: h.nome ?? '', custo: str(h.custo), texto: h.texto ?? '' }))
		}
	};
}

function critico(v) {
	if (v && typeof v === 'object') return { margem: Number(v.margem) || 20, multiplicador: Number(v.multiplicador) || 2 };
	const m = String(v ?? '20').match(/(\d+)\s*(?:\/\s*x\s*(\d+))?/i);
	return { margem: Number(m?.[1]) || 20, multiplicador: Number(m?.[2]) || 2 };
}
const PROF = { simples: 'simples', 'arma simples': 'simples', taticas: 'taticas', 'arma tática': 'taticas', pesadas: 'pesadas', 'arma pesada': 'pesadas' };

/** Arma (formato de armas-base.json ou itens-sah.json). */
export function armaToItem(e) {
	const a = e.arma ?? e;
	const alcance = str(a.alcance);
	const tipo = e.tipo && e.tipo !== 'armament' ? e.tipo : (/corpo a corpo/i.test(alcance) ? 'corpo a corpo' : 'fogo');
	return {
		_id: stableId(`arma:${e.livro}:${e.id}`), name: e.nome, type: 'arma', img: iconeItem('arma', e.id, tipo),
		system: {
			descricao: e.texto ?? e.descricao ?? '', fonte: fonte(e), revisar: e.revisar || '',
			categoria: Number(e.categoria) || 0, espacos: Number(e.espacos ?? 1), quantidade: 1, equipado: true,
			proficiencia: PROF[e.proficiencia ?? e.subtipo] ?? 'simples', tipo,
			empunhadura: str(a.empunhadura) || 'uma mão',
			dano: { formula: str(a.dano).split('/')[0].trim() || '1d6', tipo: tipoDano(a.tipoDano) },
			critico: critico(a.critico), alcance: /corpo a corpo|—/i.test(alcance) ? '' : alcance,
			municao: str(a.municao), especial: e.especial ?? []
		}
	};
}

export function protecaoToItem(e) {
	return {
		_id: stableId(`protecao:${e.livro}:${e.id}`), name: e.nome, type: 'protecao', img: iconeItem('protecao', e.id),
		system: {
			descricao: e.texto ?? e.descricao ?? '', fonte: fonte(e), revisar: e.revisar || '',
			categoria: Number(e.categoria) || 0, espacos: Number(e.espacos ?? 2), quantidade: 1, equipado: true,
			defesa: Number(e.defesa) || 0, penalidade: Number(e.penalidade) || 0, pesada: /pesad/i.test(e.nome)
		}
	};
}

export function equipamentoToItem(e) {
	return {
		_id: stableId(`equip:${e.livro}:${e.id}`), name: e.nome, type: 'equipamento', img: iconeItem('equipamento', e.id, e.subtipo, el(e.elemento)),
		system: {
			descricao: e.texto ?? e.descricao ?? '', fonte: fonte(e), revisar: e.revisar || '',
			categoria: Number(e.categoria) || 0, espacos: Number(e.espacos ?? 1), quantidade: 1, equipado: true,
			subtipo: str(e.subtipo), elemento: el(e.elemento),
			municao: { cenas: Number(String(e.duracao ?? '').match(/(\d+)\s*cena/i)?.[1]) || (e.tipo === 'municao' ? 1 : 0), usadas: 0, disparos: 0 }
		}
	};
}

/** Item de equipamento genérico (itens-sah / equipamentos-base): decide o tipo. */
export function itemFisicoToItem(e) {
	const t = e.tipo;
	if (t === 'armament' || t === 'arma' || e.arma) return armaToItem(e);
	if (t === 'protection' || t === 'protecao') return protecaoToItem(e);
	return equipamentoToItem(e);
}

export { SYSTEM_ID };

/* --- ameaças (bestiário da mesa: data/mesa/ameacas-*.json, lidas por automation/ler-ficha.mjs) --- */

const FONTE_AMEACA = { base: 'Livro de Regras', sah: 'Sobrevivendo ao Horror', vendeta: 'Vendeta Oculta', voo: 'Voo da Morte' };
const TAM_TOKEN = { minusculo: 0.5, pequeno: 1, medio: 1, grande: 2, enorme: 3, colossal: 4 };
const ICONES = `systems/${SYSTEM_ID}/assets/icones`;

/** Imagem de reserva da ameaça quando não há token próprio. */
export function imagemAmeaca(s) {
	if (s.tipo === 'animal') return `${ICONES}/animal.svg`;
	if (s.tipo === 'pessoa') return `${ICONES}/classe-mundano.svg`;
	return ['sangue', 'morte', 'conhecimento', 'energia', 'medo'].includes(s.elemento) ? `${ICONES}/paranormal-${s.elemento}.svg` : `${ICONES}/paranormal.svg`;
}

/** Padrão dos tokens de ameaça: não vinculado, hostil, PV só para o mestre, nome ao passar o mouse. */
export function tokenAmeaca(nome, img, tamanho = 'medio') {
	const t = TAM_TOKEN[tamanho] ?? 1;
	return {
		name: nome, actorLink: false, disposition: -1,
		displayBars: 40, displayName: 30, bar1: { attribute: 'pv' },
		width: t, height: t, texture: { src: img }
	};
}

export function ameacaToActor(e) {
	const s = foundry.utils.deepClone(e.system);
	const img = e.img ?? imagemAmeaca(s);
	const ref = e.pagina ? `<p><em>${FONTE_AMEACA[e.livro] ?? e.livro}</em>, p. ${e.pagina}.</p>` : '';
	s.descricao = `${s.descricao ?? ''}${ref}`;
	const itens = (e.itens ?? []).map((i, k) => ({
		_id: stableId(`ameaca:${e.livro}:${e.id}:item:${k}:${i.name}`),
		name: i.name, type: i.type,
		img: iconeItem(i.type, i.name, i.type === 'poder' ? (s.tipo === 'criatura' ? 'paranormal' : 'geral') : '', s.elemento),
		system: i.system
	}));
	return {
		_id: stableId(`ameaca:${e.livro}:${e.id}`),
		name: e.nome, type: 'ameaca', img, system: s, items: itens,
		prototypeToken: tokenAmeaca(e.nome, img, s.tamanho),
		ownership: { default: 0 }
	};
}
