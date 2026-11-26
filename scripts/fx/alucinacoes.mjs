/**
 * Alucinações de quem está com a Sanidade baixa ou zerada.
 * De tempo em tempo, só na tela daquele jogador: sussurros, batimentos, um vulto na borda do mapa,
 * mensagens que só ele vê no chat e falhas no mapa ou na ficha. Nada é salvo no mundo
 * nem enviado aos outros; a mesa e o mestre não percebem nada.
 * Com SAN baixa (1/4 ou menos) são mais leves e com metade da frequência; com SAN 0, todas.
 * O mestre escolhe a frequência em Configurações (Alucinações de Sanidade).
 */
import { SYSTEM_ID } from '../config.mjs';

/** Intervalo entre alucinações com SAN 0, em segundos [mínimo, máximo]. Com SAN baixa, o dobro. */
const FREQUENCIA = { raro: [180, 360], medio: [60, 180], frequente: [30, 90] };
/** O que pode aparecer em cada estado (repetir um tipo o torna mais provável). */
const TIPOS = {
	baixa: ['batimento', 'batimento', 'sussurro', 'sussurro', 'vulto', 'distorcao'],
	zero: ['sussurro', 'vulto', 'chat', 'distorcao', 'batimento']
};

const FRASES = [
	'Ele está atrás de você.',
	'Você já esteve aqui antes.',
	'Não confie em {aliado}.',
	'Por que você ainda está lutando?',
	'Eles não conseguem ver. Só você.',
	'{nome}... {nome}... você ouviu?',
	'Tem alguém na sala com você.',
	'A Membrana está fina aqui.',
	'Olhe para a porta.',
	'Você não vai sair daqui.',
	'Eu lembro do seu rosto.',
	'Pare de fingir que não está me ouvindo.',
	'{aliado} sabe o que você fez.',
	'Conte de novo. Faltou um.',
	'Isso não é sangue seu.',
	'Você está sorrindo. Por que está sorrindo?'
];

const aleatorio = (lista) => lista[Math.floor(Math.random() * lista.length)];
const entre = (a, b) => a + Math.random() * (b - a);
const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function registrarConfigAlucinacoes() {
	game.settings.register(SYSTEM_ID, 'alucinacoes', {
		name: 'Alucinações de Sanidade',
		hint: 'Com SAN baixa (1/4 ou menos), o agente ouve batimentos e sussurros e vê vultos de vez em quando. Com SAN 0, também recebe mensagens que só ele vê e nota falhas no mapa e na ficha. Só aparece na tela daquele jogador. Os tempos abaixo são para SAN 0; com SAN baixa, o dobro.',
		scope: 'world', config: true, type: String, default: 'medio',
		choices: { desligado: 'Desligado', raro: 'Raro (a cada 3–6 min)', medio: 'Médio (a cada 1–3 min)', frequente: 'Frequente (a cada 30–90 s)' },
		onChange: () => { if (estado) { parar(); iniciar(); } }
	});
}

/** 'baixa', 'zero' ou null. */
let estado = null;
let completo = true;
let timer = null;
let ultimo = null;

/** Liga, troca de intensidade ou desliga o ciclo. Chamado sempre que a tela de Sanidade é atualizada. */
export function atualizarAlucinacoes(novo, efeitosCompletos = true) {
	completo = efeitosCompletos;
	if (novo === estado) return;
	estado = novo;
	parar();
	if (estado) iniciar();
}

function iniciar() {
	const faixa = FREQUENCIA[game.settings.get(SYSTEM_ID, 'alucinacoes')];
	if (!faixa || !estado) return;
	const fator = estado === 'baixa' ? 2 : 1;
	clearTimeout(timer);
	timer = setTimeout(() => {
		if (!estado) return;
		alucinar().catch(err => console.warn(`${SYSTEM_ID} | alucinação`, err));
		iniciar();
	}, entre(...faixa) * fator * 1000);
}

function parar() {
	clearTimeout(timer);
	timer = null;
	document.querySelectorAll('.op-vulto, .op-alucina').forEach(el => el.remove());
	document.body.classList.remove('op-falha', 'op-falha--leve');
}

/** Dispara uma alucinação; nunca a mesma duas vezes seguidas. */
export async function alucinar(tipo) {
	tipo ??= aleatorio((TIPOS[estado] ?? TIPOS.zero).filter(t => t !== ultimo));
	ultimo = tipo;
	switch (tipo) {
		case 'sussurro': return sussurro();
		case 'batimento': return batimento();
		case 'vulto': return vulto();
		case 'chat': return mensagemFalsa();
		case 'distorcao': return distorcao();
	}
}

/* --- sons dentro da cabeça ---------------------------------------------- */

const buffers = new Map();
const somDaMesa = (chave) => game.settings.get(SYSTEM_ID, 'sonsMesa')?.[chave];

/** Toca um arquivo no canal de Interface com volume, lado e velocidade próprios. */
async function tocarPerto(src, { volume, pan = 0, velocidade = 1 }) {
	const ctx = game.audio?.interface;
	if (!ctx || !game.settings.get(SYSTEM_ID, 'sons')) return;
	let buffer = buffers.get(src);
	if (!buffer) {
		const resp = await fetch(src);
		buffer = await ctx.decodeAudioData(await resp.arrayBuffer());
		buffers.set(src, buffer);
	}
	if (ctx.state === 'suspended') await ctx.resume().catch(() => null);
	const fonte = ctx.createBufferSource();
	fonte.buffer = buffer;
	fonte.playbackRate.value = velocidade;
	const ganho = ctx.createGain();
	ganho.gain.value = volume;
	const lado = ctx.createStereoPanner();
	lado.pan.value = pan;
	fonte.connect(ganho).connect(lado).connect(ctx.gainNode ?? ctx.destination);
	fonte.start();
}

/** Baixo e de um lado só, como alguém falando perto do ouvido. Com SAN baixa, ainda mais baixo. */
function sussurro() {
	const src = somDaMesa('loucura') || `systems/${SYSTEM_ID}/sounds/loucura-${1 + Math.floor(Math.random() * 3)}.ogg`;
	const volume = estado === 'baixa' ? entre(0.12, 0.22) : entre(0.25, 0.45);
	return tocarPerto(src, { volume, pan: aleatorio([-1, 1]) * entre(0.6, 1), velocidade: entre(0.72, 1.05) });
}

/** O próprio coração, alto demais. */
function batimento() {
	const src = somDaMesa('coracao') || `systems/${SYSTEM_ID}/sounds/coracao-${2 + Math.floor(Math.random() * 2)}.ogg`;
	return tocarPerto(src, { volume: estado === 'baixa' ? entre(0.3, 0.45) : entre(0.45, 0.6), velocidade: entre(0.85, 1.1) });
}

/** Filtros de "ouvido tapado" em uso, por contexto de áudio. */
const abafados = new Map();

/** "Ouvido tapado": abafa a música e os sons de ambiente por alguns instantes. Chamar de novo só estende. */
export function abafarAudio(ms = 3000) {
	for (const ctx of [game.audio?.music, game.audio?.environment]) {
		const g = ctx?.gainNode;
		if (!g || ctx.state !== 'running') continue;
		try {
			let a = abafados.get(ctx);
			if (!a) {
				const filtro = ctx.createBiquadFilter();
				filtro.type = 'lowpass';
				g.disconnect(ctx.destination);
				g.connect(filtro).connect(ctx.destination);
				a = { filtro, timer: null };
				abafados.set(ctx, a);
			}
			const f = a.filtro.frequency;
			f.cancelScheduledValues(ctx.currentTime);
			f.setValueAtTime(350, ctx.currentTime);
			f.setTargetAtTime(18000, ctx.currentTime + ms / 1000 * 0.6, ms / 1000 * 0.25);
			clearTimeout(a.timer);
			a.timer = setTimeout(() => {
				abafados.delete(ctx);
				try { g.disconnect(a.filtro); } catch {}
				a.filtro.disconnect();
				g.connect(ctx.destination);
			}, ms);
		} catch (err) { console.warn(`${SYSTEM_ID} | abafar áudio`, err); }
	}
}

/* --- vulto -------------------------------------------------------------- */

const SILHUETA = `<svg viewBox="0 0 100 260" aria-hidden="true"><path class="op-vulto__corpo" d="M50 8c13 0 22 11 22 25 0 10-5 18-11 22 14 5 25 16 27 34l6 70c1 8-4 12-10 12l-4 60c-1 10-6 16-10 16H40c-4 0-9-6-10-16l-4-60c-6 0-11-4-10-12l6-70c2-18 13-29 27-34-6-4-11-12-11-22 0-14 9-25 22-25z"/><ellipse class="op-vulto__olho" cx="42" cy="30" rx="2.6" ry="1.4"/><ellipse class="op-vulto__olho" cx="58" cy="30" rx="2.6" ry="1.4"/></svg>`;

function vulto() {
	if (!canvas?.ready) return mensagemFalsa();
	const el = document.createElement('div');
	el.className = 'op-vulto';
	el.innerHTML = SILHUETA;
	// Em uma das bordas do mapa visível, meio escondido.
	const lado = aleatorio(['esq', 'dir', 'baixo']);
	const h = entre(0.32, 0.5) * innerHeight;
	el.style.height = `${h}px`;
	if (lado === 'esq') { el.style.left = `${entre(2, 10)}vw`; el.style.top = `${entre(15, 55)}vh`; }
	else if (lado === 'dir') { el.style.right = `${entre(330, 420)}px`; el.style.top = `${entre(15, 55)}vh`; }
	else { el.style.left = `${entre(25, 60)}vw`; el.style.bottom = `${-h * 0.35}px`; }
	document.body.append(el);
	requestAnimationFrame(() => el.classList.add('is-visivel'));
	// Some ao olhar (mouse chega perto) ou sozinho em menos de um segundo.
	const sumir = () => {
		removeEventListener('pointermove', perto);
		el.classList.remove('is-visivel');
		el.classList.add('is-sumindo');
		setTimeout(() => el.remove(), 400);
	};
	const perto = (ev) => {
		const r = el.getBoundingClientRect();
		const dx = Math.max(r.left - ev.clientX, 0, ev.clientX - r.right);
		const dy = Math.max(r.top - ev.clientY, 0, ev.clientY - r.bottom);
		if (Math.hypot(dx, dy) < 160) sumir();
	};
	addEventListener('pointermove', perto);
	setTimeout(sumir, estado === 'baixa' ? entre(350, 700) : entre(700, 1400));
}

/* --- mensagem falsa no chat -------------------------------------------- */

function nomesDaMesa() {
	const meu = game.user.character;
	const outros = game.users.filter(u => u !== game.user && !u.isGM && u.character).map(u => u.character.name);
	return { nome: (meu?.name ?? game.user.name).split(' ')[0], aliado: outros.length ? aleatorio(outros) : 'ninguém aqui', outros };
}

async function mensagemFalsa() {
	const { nome, aliado, outros } = nomesDaMesa();
	const frase = aleatorio(FRASES).replaceAll('{nome}', nome).replaceAll('{aliado}', aliado);
	// Às vezes parece vir de outro agente; às vezes de ninguém.
	const autor = outros.length && Math.random() < 0.45 ? aleatorio(outros) : aleatorio(['???', '—', '', 'Você']);
	const esc = foundry.utils.escapeHTML;
	const html = `<li class="chat-message message flexcol whisper op-alucina" aria-hidden="true">
		<header class="message-header flexrow">
			<h4 class="message-sender">${esc(autor || ' ')}</h4>
			<span class="message-metadata"><time class="message-timestamp">agora</time></span>
			<span class="whisper-to">Sussurro para: ${esc(game.user.name)}</span>
		</header>
		<div class="message-content"><p>${esc(frase)}</p></div>
	</li>`;
	const logs = [ui.chat?.element?.querySelector('.chat-log'), ui.chat?.popout?.element?.querySelector('.chat-log')];
	const notif = document.querySelector('#chat-notifications .chat-log');
	if (notif && !notif.hidden) logs.push(notif);
	const criados = [];
	for (const log of logs.filter(Boolean)) {
		log.insertAdjacentHTML('beforeend', html);
		const li = log.lastElementChild;
		criados.push(li);
		li.scrollIntoView?.({ block: 'end' });
	}
	if (!criados.length) return;
	const duracao = entre(5000, 9000);
	setTimeout(() => criados.forEach(li => li.classList.add('is-falhando')), duracao - 900);
	setTimeout(() => criados.forEach(li => li.remove()), duracao);
}

/* --- falhas no mapa e na ficha ------------------------------------------ */

async function distorcao() {
	// Com SAN baixa, só um lampejo na tela ou nomes trocados por um instante.
	if (estado === 'baixa') return Math.random() < 0.5 && canvas?.ready ? nomesTrocados(1200) : falhaDeTela(true);
	const opcoes = ['tela', 'nomes', 'ficha'];
	if (!canvas?.ready) opcoes.splice(opcoes.indexOf('nomes'), 1);
	const ficha = game.user.character?.sheet;
	if (!ficha?.rendered) opcoes.splice(opcoes.indexOf('ficha'), 1);
	const tipo = aleatorio(opcoes);
	if (tipo === 'nomes') return nomesTrocados();
	if (tipo === 'ficha') return fichaMente(ficha);
	return falhaDeTela();
}

function falhaDeTela(leve = false) {
	// Com efeitos reduzidos (ou movimento reduzido), só um lampejo de cor, sem tremor.
	const reduzido = leve || !completo || semMovimento();
	document.body.classList.toggle('op-falha--leve', reduzido);
	document.body.classList.add('op-falha');
	setTimeout(() => document.body.classList.remove('op-falha', 'op-falha--leve'), reduzido ? 450 : entre(500, 900));
}

function nomesTrocados(duracao) {
	const meu = game.user.character;
	const trocados = [];
	for (const token of canvas.tokens.placeables) {
		if (!token.nameplate || token.document.actorId === meu?.id) continue;
		trocados.push([token, token.nameplate.text]);
		token.nameplate.text = aleatorio(['???', '???', 'não é ele', 'VOCÊ', '????']);
	}
	if (!trocados.length) return falhaDeTela();
	setTimeout(() => {
		for (const [token, texto] of trocados) if (!token.destroyed && token.nameplate) token.nameplate.text = texto;
	}, duracao ?? entre(2500, 4500));
}

function fichaMente(ficha) {
	// Troca, por um instante, os números visíveis da ficha por valores errados.
	const raiz = ficha.element;
	const folhas = [...raiz.querySelectorAll('span, strong, b, em, small, div, label')]
		.filter(el => el.childElementCount === 0 && /^\s*[+\-/]?\s*\d{1,3}(\s*\/\s*\d{1,3})?m?\s*$/.test(el.textContent));
	if (!folhas.length) return falhaDeTela();
	const originais = folhas.map(el => [el, el.textContent]);
	for (const el of folhas) {
		el.textContent = el.textContent.replace(/\d+/g, () => aleatorio(['0', '0', '0', '13', '66', '-1', String(Math.floor(Math.random() * 99))]));
		el.classList.add('op-alucina-num');
	}
	setTimeout(() => {
		for (const [el, t] of originais) { el.textContent = t; el.classList.remove('op-alucina-num'); }
	}, entre(1200, 2200));
}

export const _teste = { alucinar, sussurro, batimento, vulto, mensagemFalsa, falhaDeTela, nomesTrocados, fichaMente, abafarAudio, estado: () => estado };
