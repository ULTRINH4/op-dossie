/**
 * Conversão de personagens do sistema "ordemparanormal" (tipos agent/threat) para o Dossiê.
 * Usado quando um mundo antigo passa a usar este sistema: os atores antigos ficam "inválidos"
 * (tipo desconhecido) e são recriados no formato novo com o MESMO id, para os tokens continuarem ligados.
 * Só lê os dados salvos no mundo; nada do código do sistema antigo é usado.
 */
import { SYSTEM_ID } from '../config.mjs';
import { iconeItem, iconeRitual } from '../compendium/icones.mjs';

const ATTR = { dex: 'agi', str: 'for', int: 'int', pre: 'pre', vit: 'vig' };
const PERICIA = {
	acrobatics: 'acrobacia', animal: 'adestramento', arts: 'artes', athleticism: 'atletismo', relevance: 'atualidades',
	sciences: 'ciencias', crime: 'crime', diplomacy: 'diplomacia', deception: 'enganacao', resilience: 'fortitude',
	stealth: 'furtividade', initiative: 'iniciativa', intimidation: 'intimidacao', intuition: 'intuicao',
	investigation: 'investigacao', fighting: 'luta', medicine: 'medicina', occultism: 'ocultismo', perception: 'percepcao',
	driving: 'pilotagem', aim: 'pontaria', reflexes: 'reflexos', religion: 'religiao', survival: 'sobrevivencia',
	tactics: 'tatica', technology: 'tecnologia', will: 'vontade', freeSkill: 'profissao'
};
const GRAU = { untrained: 0, trained: 5, veteran: 10, expert: 15 };
const CLASSE = { fighter: 'combatente', specialist: 'especialista', occultist: 'ocultista', survivor: 'sobrevivente' };
const TRILHA = {
	agenteSecreto: 'agente-secreto', aniquilador: 'aniquilador', cacador: 'cacador', comanDeCamp: 'comandante-de-campo',
	guerreiro: 'guerreiro', monstruoso: 'monstruoso', opeEspeciais: 'operacoes-especiais', tropaChoque: 'tropa-de-choque',
	atiradorElite: 'atirador-de-elite', bibliotecario: 'bibliotecario', infiltrador: 'infiltrador', medicoCampo: 'medico-de-campo',
	muambeiro: 'muambeiro', negociador: 'negociador', perseverante: 'perseverante', tecnico: 'tecnico',
	conduite: 'conduite', exorcista: 'exorcista', flagelador: 'flagelador', graduado: 'graduado', intuitivo: 'intuitivo',
	laminaParanormal: 'lamina-paranormal', parapsicologo: 'parapsicologo', possuido: 'possuido',
	durao: 'durao', esperto: 'esperto', esoterico: 'esoterico'
};
const DANO = {
	cuttingDamage: 'corte', impactDamage: 'impacto', piercingDamage: 'perfuracao', ballisticDamage: 'balistico',
	fireDamage: 'fogo', coldDamage: 'frio', eletricDamage: 'eletricidade', chemicalDamage: 'quimico', mentalDamage: 'mental',
	bloodDamage: 'sangue', deathDamage: 'morte', knowledgeDamage: 'conhecimento', energyDamage: 'energia', fearDamage: 'medo'
};
const ELEMENTO = { blood: 'sangue', death: 'morte', knowledge: 'conhecimento', energy: 'energia', fear: 'medo' };
const EXEC = { free: 'livre', default: 'padrao', complete: 'completa', reaction: 'reacao', livre: 'livre', padrão: 'padrao', padrao: 'padrao', completa: 'completa', reação: 'reacao', reacao: 'reacao', movimento: 'movimento' };
const ALC = { personal: 'pessoal', touch: 'toque', short: 'curto', medium: 'medio', long: 'longo', extreme: 'extremo', unlimited: 'ilimitado' };
const DUR = { instantaneous: 'instantanea', scene: 'cena', sustained: 'sustentada', setDuration: 'definida', permanent: 'permanente' };
const RES = { nullifies: 'anula', discredits: 'desacredita', partial: 'parcial', reducesByHalf: 'metade' };
const PODER = { origin: 'origem', class: 'classe', path: 'trilha', general: 'geral', paranormal: 'paranormal', complication: 'complicacao', ability: 'outro' };
const PROF = { simpleWeapons: 'simples', tacticalWeapons: 'taticas', heavyWeapons: 'pesadas' };
const GRIP = { light: 'leve', oneHand: 'uma mão', twoHands: 'duas mãos' };

const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const origemId = (k) => String(k ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\./g, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

function critico(v) {
	const m = String(v ?? '20').match(/(\d+)\s*(?:\/\s*x\s*(\d+))?/i);
	return { margem: Math.clamp(num(m?.[1], 20), 2, 20), multiplicador: Math.clamp(num(m?.[2], 2), 2, 5) };
}

/** Item antigo → item novo (mesmo id). */
export function converterItem(i) {
	const s = i.system ?? {};
	const base = { _id: i._id, name: i.name, img: iconeNovo(i), sort: i.sort ?? 0, flags: limparFlags(i.flags), effects: i.effects ?? [], ownership: i.ownership };
	const comum = { descricao: s.description ?? '' };
	const fisico = { categoria: Math.clamp(num(s.category), 0, 4), espacos: Math.max(num(s.weight, 1), 0), quantidade: Math.max(num(s.quantity, 1), 0), equipado: s.using?.state !== false };
	switch (i.type) {
		case 'armament': {
			const melee = s.types?.rangeType?.name === 'melee';
			const sub = s.types?.rangeType?.subRangeType;
			return {
				...base, type: 'arma',
				system: {
					...comum, ...fisico,
					proficiencia: PROF[s.proficiency] ?? 'simples',
					tipo: melee ? (s.conditions?.throwable ? 'arremesso' : 'corpo a corpo') : (sub === 'fire' ? 'fogo' : 'disparo'),
					empunhadura: GRIP[s.types?.gripType] ?? 'uma mão',
					dano: { formula: String(s.formulas?.damage?.formula || '1d6'), tipo: DANO[s.formulas?.damage?.type] ?? '' },
					critico: critico(s.critical), alcance: melee ? '' : String(s.range ?? ''),
					bonusAtaque: num(s.formulas?.attack?.bonus), bonusDano: String(s.formulas?.damage?.bonus ?? '')
				}
			};
		}
		case 'protection':
			return { ...base, type: 'protecao', system: { ...comum, ...fisico, defesa: num(s.defense), penalidade: num(s.penalty) } };
		case 'generalEquipment':
			return { ...base, type: 'equipamento', system: { ...comum, ...fisico, subtipo: String(s.type ?? '') } };
		case 'ritual':
			return {
				...base, type: 'ritual',
				system: {
					...comum, circulo: Math.clamp(num(s.circle, 1), 1, 4), elemento: ELEMENTO[s.element] ?? '',
					execucao: EXEC[s.execution] ?? 'padrao', alcance: { chave: ALC[s.range] ?? '', texto: '' },
					alvo: String(s.target ?? ''), area: [s.area?.name, s.area?.size].filter(Boolean).join(' '),
					duracao: { chave: DUR[s.duration] ?? '', texto: '' },
					resistencia: { pericia: '', efeito: RES[s.resistance] ?? '', texto: '' },
					discente: s.studentForm ? { custoExtra: 0, circuloMin: null, afinidade: false, texto: '', dano: null } : null,
					verdadeiro: s.trueForm ? { custoExtra: 0, circuloMin: null, afinidade: false, texto: '', dano: null } : null
				}
			};
		case 'ability':
			return {
				...base, type: 'poder',
				system: {
					...comum, tipo: PODER[s.abilityType] ?? 'outro', requisitos: String(s.preRequisite ?? ''),
					custo: s.cost !== '' && s.cost != null ? num(s.cost, null) : null,
					execucao: EXEC[String(s.activation ?? '').toLowerCase()] ?? ''
				}
			};
		default: return null;
	}
}

/** Troca ícones do sistema antigo pelos do Dossiê; mantém imagens próprias do usuário. */
function iconeNovo(i) {
	if (i.img && !String(i.img).startsWith('systems/ordemparanormal/') && !String(i.img).startsWith('icons/svg/')) return i.img;
	const nome = String(i.name ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
	const s = i.system ?? {};
	switch (i.type) {
		case 'armament': return iconeItem('arma', nome, s.types?.rangeType?.name === 'melee' ? 'corpo a corpo' : 'fogo');
		case 'protection': return iconeItem('protecao', nome);
		case 'generalEquipment': return iconeItem('equipamento', nome, String(s.type ?? ''));
		case 'ritual': return iconeItem('poder', nome, 'paranormal', ELEMENTO[s.element] ?? '');
		case 'ability': return iconeItem('poder', nome, PODER[s.abilityType] ?? 'outro');
		default: return i.img;
	}
}

function limparFlags(flags = {}) {
	const f = foundry.utils.deepClone(flags ?? {});
	delete f.ordemparanormal;
	if (f.core) delete f.core.sheetClass;
	return f;
}

/** Busca itens no compêndio do sistema pelo id da fonte. */
async function doCompendio(pack, fonteId) {
	if (!fonteId) return null;
	const p = game.packs.get(`${SYSTEM_ID}.${pack}`);
	if (!p) return null;
	const docs = await p.getDocuments();
	return docs.find(d => d.system.fonte?.id === fonteId || d.system.chave === fonteId)?.toObject() ?? null;
}
async function ritualDoCompendio(nome) {
	const p = game.packs.get(`${SYSTEM_ID}.rituais`);
	const idx = (await p?.getIndex()) ?? [];
	const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
	const hit = idx.find(i => norm(i.name) === norm(nome));
	return hit ? (await p.getDocument(hit._id)).toObject() : null;
}

/** Ator antigo → dados do ator novo (mesmo id) e o que precisa ajustar depois. */
export async function converterAtor(src) {
	const s = src.system ?? {};
	const base = {
		_id: src._id, name: src.name, img: src.img, folder: src.folder ?? null, sort: src.sort ?? 0,
		ownership: src.ownership, prototypeToken: src.prototypeToken, flags: limparFlags(src.flags), effects: src.effects ?? []
	};
	const itensAntigos = src.items ?? [];
	const itens = [];
	for (const i of itensAntigos) {
		if (i.type === 'ritual') {
			const pack = await ritualDoCompendio(i.name);
			if (pack) { itens.push({ ...pack, _id: i._id, sort: i.sort ?? 0 }); continue; }
		}
		const c = converterItem(i);
		if (c) itens.push(c);
	}

	if (src.type === 'threat') {
		const a = s.attributes ?? {};
		const teste = (k) => {
			const sk = s.skills?.[k] ?? {};
			const attr = num(a[sk.attr?.[0]]?.value, 1);
			return { dados: attr, bonus: (GRAU[sk.degree?.label] ?? 0) + num(sk.mod) };
		};
		const res = {}, imunes = [], vulner = [];
		for (const [k, v] of Object.entries(s.resistances ?? {})) {
			const t = DANO[k]; if (!t) continue;
			res[t] = num(v?.value);
			if (v?.immune) imunes.push(t);
			if (v?.vulnerable) vulner.push(t);
		}
		const outras = Object.entries(s.skills ?? {}).filter(([k]) => !['perception', 'initiative', 'resilience', 'reflexes', 'will'].includes(k))
			.filter(([, sk]) => sk.degree?.label && sk.degree.label !== 'untrained')
			.map(([k, sk]) => ({ nome: k === 'freeSkill' ? (sk.name || 'Perícia') : (PERICIA[k] ?? k), dados: num(a[sk.attr?.[0]]?.value, 1), bonus: GRAU[sk.degree?.label] ?? 0 }));
		const det = s.details ?? {};
		const descricao = [det.description, s.temporary?.characteristics].filter(Boolean).join('');
		return {
			data: {
				...base, type: 'ameaca', items: itens,
				system: {
					tipo: det.creatureType === 'person' ? 'pessoa' : 'criatura',
					elemento: ELEMENTO[det.element] ?? '', tamanho: det.size || 'medio', vd: num(a.vd?.value, 0),
					atributos: Object.fromEntries(Object.entries(ATTR).map(([o, n]) => [n, { valor: num(a[o]?.value, 1) }])),
					pv: { valor: num(a.hp?.value), max: num(a.hp?.max) },
					defesa: num(s.defense?.value, 10),
					deslocamento: a.movement?.walk ? `${a.movement.walk}${a.movement.unit ?? 'm'}` : '9m',
					sentidos: Array.isArray(s.senses) ? s.senses.map(x => x.name ?? x).join(', ') : String(s.senses ?? ''),
					percepcao: teste('perception'), iniciativa: teste('initiative'), fortitude: teste('resilience'), reflexos: teste('reflexes'), vontade: teste('will'),
					pericias: outras, resistencias: res, imunidades: imunes, vulnerabilidades: vulner,
					presencaPerturbadora: { dt: num(s.disturbingPresence?.dt), dano: String(s.disturbingPresence?.mentalDamage ?? ''), nexImune: num(s.disturbingPresence?.immuneNex) },
					enigma: det.fearRiddle ?? '', descricao
				}
			},
			avisos: [...(s.actions?.length ? [`${src.name}: ${s.actions.length} ação(ões) da ficha antiga não convertidas; recrie como Habilidades.`] : []),
				...(Object.keys(s.attacks ?? {}).length ? [`${src.name}: ataques da ficha antiga não convertidos; recrie como Ataques.`] : [])]
		};
	}

	// Agente
	const classeId = CLASSE[s.class];
	const classe = classeId ? await doCompendio('classes', classeId) : null;
	const origem = s.origin ? await doCompendio('origens', origemId(s.origin)) : null;
	const trilha = s.trilha && TRILHA[s.trilha] ? await doCompendio('trilhas', TRILHA[s.trilha]) : null;
	for (const x of [classe, origem, trilha]) if (x) { delete x._id; itens.push(x); }

	const pericias = {};
	for (const [k, sk] of Object.entries(s.skills ?? {})) {
		const n = PERICIA[k]; if (!n) continue;
		pericias[n] = { grau: GRAU[sk.degree?.label] ?? 0, bonus: num(sk.mod) };
		if (n === 'profissao') pericias[n].nome = String(sk.name ?? '');
	}
	const r = s.resources ?? {};
	const extras = ['res1', 'res2', 'res3'].map(k => r[k]).filter(x => x?.label).map(x => ({ nome: x.label, valor: num(x.value), max: num(x.max) }));
	return {
		data: {
			...base, type: 'agente', items: itens,
			system: {
				atributos: Object.fromEntries(Object.entries(ATTR).map(([o, n]) => [n, { valor: num(s.attributes?.[o]?.value, 1) }])),
				pericias,
				recursos: {
					pv: { valor: num(s.PV?.value) }, pe: { valor: num(s.PE?.value) },
					san: { valor: num(s.SAN?.value) }, pd: { valor: num(s.PD?.value) }
				},
				progressao: { nex: Math.clamp(num(s.NEX?.value, 5), 0, 99), nivel: num(s.nivel?.value, 1), estagio: num(s.stage?.value, 1) },
				patente: { pp: num(s.patent?.prestigePoints) },
				defesa: { bonus: num(s.defense?.bonus) },
				recursosExtras: extras,
				biografia: s.biography ?? '', objetivos: s.goals ?? ''
			}
		},
		maxAntigo: { pv: num(s.PV?.max), pe: num(s.PE?.max), san: num(s.SAN?.max), pd: num(s.PD?.max) },
		avisos: [
			...(s.class && !classe ? [`${src.name}: classe "${s.class}" não encontrada no compêndio.`] : []),
			...(s.origin && !origem ? [`${src.name}: origem "${s.origin}" não encontrada.`] : []),
			...(s.trilha && !trilha ? [`${src.name}: trilha "${s.trilha}" não encontrada.`] : [])
		]
	};
}

/** Atores do sistema antigo presentes neste mundo (aparecem como documentos inválidos). */
export function atoresAntigos() {
	const ids = [...(game.actors.invalidDocumentIds ?? [])];
	return ids.map(id => game.actors.getInvalid(id, { strict: false })).filter(a => ['agent', 'threat'].includes(a?._source?.type));
}

/**
 * Converte todos os atores antigos. Mantém os máximos de PV/PE/SAN/PD que cada ficha tinha:
 * a diferença para o valor calculado pela classe vai para "bônus no máximo".
 */
export async function converterTudo() {
	const antigos = atoresAntigos();
	const relatorio = { convertidos: [], avisos: [], erros: [] };
	for (const doc of antigos) {
		const src = foundry.utils.deepClone(doc._source);
		try {
			const { data, maxAntigo, avisos } = await converterAtor(src);
			await doc.delete();
			const novo = await Actor.create(data, { keepId: true });
			if (novo?.type === 'agente' && maxAntigo) {
				const rec = novo.system.recursos;
				const upd = {};
				for (const k of ['pv', 'pe', 'san', 'pd']) {
					const diff = maxAntigo[k] - rec[k].max;
					if (maxAntigo[k] && diff) upd[`system.recursos.${k}.bonusMax`] = diff;
				}
				if (Object.keys(upd).length) await novo.update(upd);
			}
			relatorio.convertidos.push(src.name);
			relatorio.avisos.push(...avisos);
		} catch (err) {
			console.error(`${SYSTEM_ID} | conversão de ${src.name}`, err);
			relatorio.erros.push(`${src.name}: ${err.message}`);
		}
	}
	// Tokens não vinculados guardam alterações no formato antigo: zera essas alterações.
	let tokens = 0;
	for (const scene of game.scenes) {
		const upd = scene.tokens.filter(t => !t.actorLink && game.actors.has(t.actorId) && (Object.keys(t.delta?._source?.system ?? {}).length || t.delta?._source?.items?.length))
			.map(t => ({ _id: t.id, delta: { system: {}, items: [] } }));
		for (const u of upd) {
			try { await scene.updateEmbeddedDocuments('Token', [u], { diff: false, recursive: false }); tokens += 1; }
			catch (err) { console.warn(`${SYSTEM_ID} | token ${u._id} em ${scene.name}`, err); }
		}
	}
	relatorio.tokens = tokens;
	return relatorio;
}

/** Pergunta ao mestre, ao abrir o mundo, se quer converter. */
export async function oferecerConversao() {
	if (!game.user.isActiveGM) return;
	const antigos = atoresAntigos();
	if (!antigos.length) return;
	const nomes = antigos.map(a => `<li>${a._source.name} <small>(${a._source.type === 'agent' ? 'agente' : 'ameaça'})</small></li>`).join('');
	const ok = await foundry.applications.api.DialogV2.confirm({
		window: { title: 'Personagens do sistema antigo', icon: 'fa-solid fa-right-left' },
		classes: ['op-dossie'],
		content: `<p>Este mundo tem <strong>${antigos.length}</strong> personagens no formato do sistema anterior (ordemparanormal). Converter agora para o Dossiê?</p>
			<p class="op-lead">Classe, origem e trilha vêm dos compêndios; perícias, atributos, recursos, itens e rituais são convertidos.
			Os máximos de PV, PE e SAN atuais são mantidos. Faça um backup do mundo antes.</p><ul class="op-migr-list">${nomes}</ul>`,
		yes: { label: 'Converter', icon: 'fa-solid fa-right-left' }, no: { label: 'Agora não' }
	});
	if (!ok) return;
	ui.notifications.info('Convertendo personagens…');
	const r = await converterTudo();
	const lista = (arr) => arr.length ? `<ul>${arr.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p>Nenhum.</p>';
	await foundry.applications.api.DialogV2.prompt({
		window: { title: 'Conversão concluída', icon: 'fa-solid fa-check' }, classes: ['op-dossie'],
		content: `<p><strong>${r.convertidos.length}</strong> convertidos. ${r.tokens} token(s) não vinculados tiveram as alterações zeradas.</p>
			<h3>Avisos</h3>${lista(r.avisos)}<h3>Erros</h3>${lista(r.erros)}`,
		ok: { label: 'Fechar' }
	});
}
