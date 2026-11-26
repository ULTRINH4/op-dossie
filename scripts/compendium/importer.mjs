/**
 * Preenche os compêndios do sistema a partir de data/fontes/*.json.
 * Roda no mestre ativo quando o conteúdo muda (hash por compêndio).
 */
import { SYSTEM_ID } from '../config.mjs';
import {
	ritualToItem, classeToItem, origemToItem, origemPoderToItem, poderToItem, trilhaToItem,
	armaToItem, protecaoToItem, equipamentoToItem
} from './convert.mjs';

const CONVERTER_VERSION = 3;
const ELEMENTO_PASTA = { sangue: 'Sangue', morte: 'Morte', conhecimento: 'Conhecimento', energia: 'Energia', medo: 'Medo' };
const LIVRO_PASTA = { base: 'Livro de Regras', sah: 'Sobrevivendo ao Horror' };
const CLASSE_PASTA = { combatente: 'Combatente', especialista: 'Especialista', ocultista: 'Ocultista', sobrevivente: 'Sobrevivente' };
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const isArma = (e) => ['armament', 'arma'].includes(e.tipo) || !!e.arma || ('dano' in e && 'critico' in e);
const isProtecao = (e) => ['protection', 'protecao'].includes(e.tipo);

/** Cada compêndio: arquivos de origem, como converter, em que pasta pôr. */
const SOURCES = [
	{ pack: 'classes', files: ['classes.json'], build: (e) => [classeToItem(e)], folder: (e) => LIVRO_PASTA[e.livro] },
	{ pack: 'origens', files: ['origens.json'], build: (e) => [origemToItem(e)], folder: (e) => LIVRO_PASTA[e.livro] },
	{ pack: 'trilhas', files: ['trilhas-base.json', 'trilhas-sah.json'], build: (e) => [trilhaToItem(e)], folder: (e) => CLASSE_PASTA[e.classe] },
	{
		pack: 'poderes', files: ['origens.json', 'poderes-base.json', 'poderes-sah.json', 'poderes-paranormais-sah.json'],
		build: (e, file) => file === 'origens.json' ? [origemPoderToItem(e)].filter(Boolean)
			: [poderToItem(file === 'poderes-paranormais-sah.json' ? { ...e, tipo: 'paranormal' } : e)],
		folder: (e, file) => {
			if (file === 'origens.json') return 'Poderes de origem';
			const tipo = file === 'poderes-paranormais-sah.json' ? 'paranormal' : e.tipo;
			if (tipo === 'paranormal') return 'Poderes paranormais';
			if (tipo === 'geral') return 'Poderes gerais';
			return `Poderes de ${CLASSE_PASTA[e.classe]?.toLowerCase() ?? 'classe'}`;
		}
	},
	{
		pack: 'rituais', files: ['rituais-base.json', 'rituais-sah.json'], build: (e) => [ritualToItem(e)],
		folder: (e) => ELEMENTO_PASTA[{ blood: 'sangue', death: 'morte', knowledge: 'conhecimento', energy: 'energia', fear: 'medo' }[e.elemento] ?? e.elemento] ?? 'Outros',
		sort: (e) => (e.circulo ?? 9) * 1000
	},
	{
		pack: 'armas', files: ['armas-base.json', 'itens-sah.json'], dedupe: true,
		build: (e, file) => ((file === 'armas-base.json' && e.tipo !== 'municao') || (file !== 'armas-base.json' && isArma(e))) ? [armaToItem(e)] : [],
		folder: (e) => LIVRO_PASTA[e.livro]
	},
	{
		pack: 'protecoes', files: ['equipamentos-base.json', 'itens-sah.json'], dedupe: true,
		build: (e) => isProtecao(e) ? [protecaoToItem(e)] : [], folder: (e) => LIVRO_PASTA[e.livro]
	},
	{
		pack: 'equipamentos', files: ['equipamentos-base.json', 'armas-base.json', 'itens-sah.json'], dedupe: true,
		build: (e, file) => file === 'armas-base.json' ? (e.tipo === 'municao' ? [equipamentoToItem({ ...e, subtipo: 'munição' })] : []) : ((!isArma(e) && !isProtecao(e)) ? [equipamentoToItem(e)] : []),
		folder: (e) => {
			const s = norm(e.subtipo);
			if (/amaldicoad/.test(s)) return 'Itens amaldiçoados';
			if (/paranormal|catalis/.test(s)) return 'Itens paranormais';
			if (/municao/.test(s) || e.tipo === 'municao') return 'Munição';
			if (/explosiv/.test(s)) return 'Explosivos';
			if (/modific/.test(s) || e.tipo === 'modificacao') return 'Modificações';
			if (/medic/.test(s)) return 'Medicamentos';
			if (/acess/.test(s)) return 'Acessórios';
			return 'Itens operacionais';
		}
	}
];

export function registerImporterSettings() {
	game.settings.register(SYSTEM_ID, 'compendios', { scope: 'world', config: false, type: Object, default: {} });
}

async function readSource(file) {
	try {
		const res = await fetch(`systems/${SYSTEM_ID}/data/fontes/${file}`, { cache: 'no-store' });
		if (!res.ok) return null;
		const text = await res.text();
		return { text, entries: JSON.parse(text) };
	} catch (err) {
		console.error(`${SYSTEM_ID} | data/fontes/${file}`, err);
		ui.notifications.error(`Dossiê: data/fontes/${file} tem um erro de formato.`);
		return null;
	}
}

function hash(text) {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
	return `${CONVERTER_VERSION}-${h.toString(36)}-${text.length}`;
}

export async function syncCompendiums({ force = false } = {}) {
	if (!game.user.isActiveGM) return [];
	const stored = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, 'compendios'));
	const report = [];
	for (const src of SOURCES) {
		const pack = game.packs.get(`${SYSTEM_ID}.${src.pack}`);
		if (!pack) continue;
		const loaded = [];
		for (const file of src.files) {
			const data = await readSource(file);
			if (data) loaded.push({ file, ...data });
		}
		if (!loaded.length) continue;
		const h = hash(loaded.map(l => l.text).join('\n'));
		if (!force && stored[src.pack] === h) continue;

		const items = [];
		const seen = new Set();
		const folders = new Set();
		for (const { file, entries } of loaded) {
			for (const e of entries) {
				for (const item of src.build(e, file)) {
					const key = norm(item.name);
					if (src.dedupe && seen.has(key)) continue;
					seen.add(key);
					const folder = src.folder?.(e, file);
					if (folder) { item._folderName = folder; folders.add(folder); }
					item.sort = (src.sort?.(e) ?? 0) + items.length;
					items.push(item);
				}
			}
		}
		const n = await replacePackContents(pack, items, [...folders]);
		stored[src.pack] = h;
		report.push(`${pack.metadata.label}: ${n}`);
	}
	if (report.length) {
		await game.settings.set(SYSTEM_ID, 'compendios', stored);
		ui.notifications.info(`Dossiê: compêndios atualizados (${report.join(' · ')}).`);
	}
	return report;
}

async function replacePackContents(pack, items, folderNames) {
	const wasLocked = pack.locked;
	if (wasLocked) await pack.configure({ locked: false });
	try {
		const index = await pack.getIndex();
		if (index.size) await Item.deleteDocuments([...index.keys()], { pack: pack.collection });
		const old = pack.folders.map(f => f.id);
		if (old.length) await Folder.deleteDocuments(old, { pack: pack.collection });
		const ids = {};
		if (folderNames.length) {
			const created = await Folder.createDocuments(
				folderNames.sort((a, b) => a.localeCompare(b, 'pt-BR')).map((name, i) => ({ name, type: 'Item', sorting: 'm', sort: i })),
				{ pack: pack.collection }
			);
			for (const f of created) ids[f.name] = f.id;
		}
		for (const item of items) {
			if (item._folderName) item.folder = ids[item._folderName] ?? null;
			delete item._folderName;
		}
		for (let i = 0; i < items.length; i += 50) {
			await Item.createDocuments(items.slice(i, i + 50), { pack: pack.collection, keepId: true });
		}
		return items.length;
	} finally {
		if (wasLocked) await pack.configure({ locked: true });
	}
}
