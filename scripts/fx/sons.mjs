/**
 * Efeitos sonoros do Dossiê: gravações reais em domínio público (CC0) na pasta sounds/,
 * listadas em sounds/CREDITS.md. O mestre pode trocar qualquer som por um arquivo próprio
 * em "Sons da mesa". Tocam no canal de Interface do Foundry (o volume de Interface controla tudo)
 * e cada cliente toca na própria máquina, a partir dos mesmos eventos dos efeitos visuais.
 */
import { SYSTEM_ID } from '../config.mjs';

const PASTA = `systems/${SYSTEM_ID}/sounds`;

/** Eventos sonoros: rótulo, grupo e quantas variantes padrão existem em sounds/. */
export const EVENTOS = {
	'tiro-pistola': { nome: 'Tiro de pistola ou revólver', grupo: 'Armas' },
	'tiro-fuzil': { nome: 'Tiro de fuzil ou metralhadora', grupo: 'Armas' },
	'tiro-espingarda': { nome: 'Tiro de espingarda', grupo: 'Armas' },
	flecha: { nome: 'Arco, besta ou arremesso', grupo: 'Armas' },
	golpe: { nome: 'Golpe corpo a corpo', grupo: 'Armas' },
	'golpe-acerto': { nome: 'Golpe acertando', grupo: 'Armas' },
	errou: { nome: 'Ataque errado', grupo: 'Armas' },
	impacto: { nome: 'Dano sofrido', grupo: 'Combate' },
	cura: { nome: 'Cura', grupo: 'Combate' },
	poder: { nome: 'Uso de poder', grupo: 'Combate' },
	'sangue-conjurar': { nome: 'Sangue: conjurar', grupo: 'Rituais' },
	'sangue-acerto': { nome: 'Sangue: acerto', grupo: 'Rituais' },
	'morte-conjurar': { nome: 'Morte: conjurar', grupo: 'Rituais' },
	'morte-acerto': { nome: 'Morte: acerto', grupo: 'Rituais' },
	'conhecimento-conjurar': { nome: 'Conhecimento: conjurar', grupo: 'Rituais' },
	'conhecimento-acerto': { nome: 'Conhecimento: acerto', grupo: 'Rituais' },
	'energia-conjurar': { nome: 'Energia: conjurar', grupo: 'Rituais' },
	'energia-acerto': { nome: 'Energia: acerto', grupo: 'Rituais' },
	'medo-conjurar': { nome: 'Medo: conjurar', grupo: 'Rituais' },
	'medo-acerto': { nome: 'Medo: acerto', grupo: 'Rituais' },
	coracao: { nome: 'Sanidade baixa (batimento)', grupo: 'Sanidade' },
	'san-zero': { nome: 'Sanidade zerada (choque)', grupo: 'Sanidade' },
	loucura: { nome: 'Sussurros das alucinações', grupo: 'Sanidade' }
};

/** Variantes padrão disponíveis em sounds/ (preenchido com o que foi incluído no sistema). */
const VARIANTES = {
	'conhecimento-acerto': 3,
	'conhecimento-conjurar': 3,
	'coracao': 3,
	'cura': 3,
	'energia-acerto': 3,
	'energia-conjurar': 3,
	'errou': 3,
	'flecha': 3,
	'golpe': 3,
	'golpe-acerto': 3,
	'impacto': 3,
	'loucura': 3,
	'medo-acerto': 2,
	'medo-conjurar': 2,
	'morte-acerto': 3,
	'morte-conjurar': 3,
	'poder': 3,
	'san-zero': 2,
	'sangue-acerto': 3,
	'sangue-conjurar': 3,
	'tiro-espingarda': 3,
	'tiro-fuzil': 3,
	'tiro-pistola': 3
};

/** Se um evento não tem arquivo, usa o de um parecido. */
const RESERVA = { 'tiro-fuzil': 'tiro-pistola', 'tiro-espingarda': 'tiro-fuzil', 'golpe-acerto': 'impacto', flecha: 'golpe', errou: 'golpe' };

export function registrarConfigSons() {
	game.settings.register(SYSTEM_ID, 'sons', {
		name: 'Efeitos sonoros',
		hint: 'Só no seu computador. Tiros, golpes, rituais e impactos. O volume segue o volume de Interface do Foundry.',
		scope: 'client', config: true, type: Boolean, default: true
	});
	game.settings.register(SYSTEM_ID, 'sonsMesa', { scope: 'world', config: false, type: Object, default: {} });
	game.settings.registerMenu(SYSTEM_ID, 'sonsMenu', {
		name: 'Sons da mesa', label: 'Escolher sons',
		hint: 'Troque qualquer efeito sonoro por um arquivo seu. Vale para todos na mesa.',
		icon: 'fa-solid fa-volume-high', type: SonsDaMesa, restricted: true
	});
}

const ligado = () => game.settings.get(SYSTEM_ID, 'sons') && game.settings.get(SYSTEM_ID, 'efeitos') !== 'desligado';

/** Arquivos de um evento: o escolhido pelo mestre ou os padrões do sistema. */
function arquivos(chave, visitados = new Set()) {
	const proprio = game.settings.get(SYSTEM_ID, 'sonsMesa')?.[chave];
	if (proprio) return [proprio];
	const n = VARIANTES[chave] ?? 0;
	if (n) return Array.from({ length: n }, (_, i) => `${PASTA}/${chave}-${i + 1}.ogg`);
	visitados.add(chave);
	const r = RESERVA[chave];
	return r && !visitados.has(r) ? arquivos(r, visitados) : [];
}

/** Qual tiro: pelo nome da arma. */
export function somDaArma(arma) {
	const s = arma?.system ?? {};
	if (s.tipo === 'corpo a corpo') return 'golpe';
	if (s.tipo === 'disparo' || s.tipo === 'arremesso') return 'flecha';
	const n = String(arma?.name ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
	if (/espingarda|escopeta|shotgun/.test(n)) return 'tiro-espingarda';
	if (/fuzil|metralhadora|rifle|carabina/.test(n)) return 'tiro-fuzil';
	return 'tiro-pistola';
}

const ultimos = new Map();
/**
 * Toca um evento. Repetições do mesmo som em menos de 80 ms viram uma só (vários alvos no mesmo golpe).
 * Aceita também os nomes curtos "conjurar:<elemento>" e "acerto:<elemento>".
 */
export function tocar(nome, { atraso = 0, volume = 0.8 } = {}) {
	if (!ligado() || !game.audio?.interface) return;
	const [base, el] = nome.split(':');
	const chave = el ? `${el}-${base}` : nome;
	const lista = arquivos(chave);
	if (!lista.length) return;
	const agora = performance.now();
	if (agora - (ultimos.get(chave) ?? 0) < 80) return;
	ultimos.set(chave, agora);
	const src = lista[Math.floor(Math.random() * lista.length)];
	const toca = () => game.audio.play(src, { context: game.audio.interface, volume }).catch(err => console.warn(`${SYSTEM_ID} | som ${src}`, err));
	if (atraso) setTimeout(toca, atraso); else toca();
}

/* --- Sons da mesa (mestre) -------------------------------------------------- */

const { ApplicationV2 } = foundry.applications.api;
const esc = (t) => foundry.utils.escapeHTML(String(t ?? ''));

export class SonsDaMesa extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		id: 'op-sons-mesa', tag: 'form', classes: ['op-dossie', 'op-sons'],
		window: { title: 'Sons da mesa', icon: 'fa-solid fa-volume-high', resizable: true },
		position: { width: 560, height: 640 },
		form: { handler: SonsDaMesa.#salvar, closeOnSubmit: true },
		actions: { ouvir: SonsDaMesa.#ouvir, procurar: SonsDaMesa.#procurar, limpar: SonsDaMesa.#limpar }
	};

	async _renderHTML() {
		const atuais = game.settings.get(SYSTEM_ID, 'sonsMesa') ?? {};
		const grupos = {};
		for (const [k, e] of Object.entries(EVENTOS)) (grupos[e.grupo] ??= []).push([k, e]);
		const secoes = Object.entries(grupos).map(([g, itens]) => `<section class="op-sons__grupo"><h3>${g}</h3>
			${itens.map(([k, e]) => `<div class="op-sons__row">
				<label for="op-som-${k}">${esc(e.nome)}</label>
				<input id="op-som-${k}" type="text" name="${k}" value="${esc(atuais[k] ?? '')}" placeholder="${arquivos(k).length && !atuais[k] ? 'som do sistema' : 'sem som'}">
				<button type="button" data-action="procurar" data-chave="${k}" aria-label="Escolher arquivo para ${esc(e.nome)}" title="Escolher arquivo"><i class="fa-solid fa-folder-open"></i></button>
				<button type="button" data-action="ouvir" data-chave="${k}" aria-label="Ouvir ${esc(e.nome)}" title="Ouvir"><i class="fa-solid fa-play"></i></button>
				<button type="button" data-action="limpar" data-chave="${k}" aria-label="Voltar ao som do sistema" title="Voltar ao som do sistema"><i class="fa-solid fa-rotate-left"></i></button>
			</div>`).join('')}</section>`).join('');
		const div = document.createElement('div');
		div.className = 'op-sons__body';
		div.innerHTML = `<p class="op-sons__intro">Deixe em branco para usar o som do sistema. Os arquivos escolhidos precisam estar na pasta de dados do Foundry para que os jogadores também ouçam.</p>
			${secoes}
			<footer class="op-sons__footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> Salvar</button></footer>`;
		return div;
	}

	_replaceHTML(result, content) { content.replaceChildren(result); }

	static #campo(app, target) { return app.element.querySelector(`input[name="${target.dataset.chave}"]`); }

	static #ouvir(event, target) {
		const k = target.dataset.chave;
		const v = SonsDaMesa.#campo(this, target)?.value.trim();
		const src = v || arquivos(k)[0];
		if (!src) return ui.notifications.info('Este evento não tem som.');
		game.audio.play(src, { context: game.audio.interface, volume: 0.8 }).catch(() => ui.notifications.warn(`Não consegui tocar ${src}.`));
	}

	static #procurar(event, target) {
		const input = SonsDaMesa.#campo(this, target);
		const FP = foundry.applications.apps.FilePicker.implementation;
		new FP({ type: 'audio', current: input.value, callback: (path) => { input.value = path; } }).render(true);
	}

	static #limpar(event, target) { SonsDaMesa.#campo(this, target).value = ''; }

	static async #salvar(event, form, formData) {
		const dados = {};
		for (const [k, v] of Object.entries(formData.object)) if (EVENTOS[k] && String(v).trim()) dados[k] = String(v).trim();
		await game.settings.set(SYSTEM_ID, 'sonsMesa', dados);
		ui.notifications.info('Sons da mesa salvos.');
	}
}
