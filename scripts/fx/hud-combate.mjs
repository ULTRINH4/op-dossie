/**
 * HUD de combate: barra no rodapé para o token selecionado (um só, de quem o controla).
 * Ficha resumida, ações do turno (padrão, movimento, reação), gavetas de armas, rituais,
 * poderes, itens e perícias, passos dados no turno contra o deslocamento e "Encerrar turno".
 * Os passos vêm do histórico de movimento do Foundry, que zera no início do turno de cada combatente.
 * As ações marcadas ficam só neste computador e voltam no início do turno.
 */
import { SYSTEM_ID, ATRIBUTOS, PERICIAS, EXECUCAO, CUSTO_CIRCULO } from '../config.mjs';
import { CONDICAO } from '../automation/condicoes.mjs';
import { combatenteDe, acoesDoTurno, planejar, execucaoDo, quadradosLivres, _teste as _acoes } from '../automation/acoes.mjs';

const esc = (t) => foundry.utils.escapeHTML(String(t ?? ''));
let raiz = null;
let gaveta = null;
let agendado = null;
/** Ações gastas por turno: chave combate:rodada:turno:token → Set('padrao'|'movimento'|'reacao'). */
const gastas = new Map();

export function registrarConfigHud() {
	game.settings.register(SYSTEM_ID, 'hudCombate', {
		name: 'HUD de combate',
		hint: 'Só no seu computador. Barra no rodapé com ações, armas, rituais, poderes, itens, perícias e passos do token selecionado.',
		scope: 'client', config: true, type: String, default: 'sempre',
		choices: { sempre: 'Sempre que selecionar um token seu', combate: 'Só durante o combate', desligado: 'Desligada' },
		onChange: () => agendar()
	});
}

/* --- estado ------------------------------------------------------------------ */

function tokenAtual() {
	const modo = game.settings.get(SYSTEM_ID, 'hudCombate');
	if (modo === 'desligado' || !canvas?.ready) return null;
	const sel = canvas.tokens.controlled;
	if (sel.length !== 1) return null;
	const t = sel[0];
	if (!t.actor?.isOwner || !['agente', 'ameaca'].includes(t.actor.type)) return null;
	if (modo === 'combate' && !game.combat?.started) return null;
	return t;
}

function chaveTurno(token) {
	const c = game.combat;
	return c?.started ? `${c.id}:${c.round}:${c.turn}:${token.id}` : `fora:${token.id}`;
}

/** Ações gastas (Set). No combate vêm do combatente (iguais para todos); fora dele, só deste computador. */
function acoesDe(token) {
	const c = combatenteDe(token.document);
	if (c) {
		const a = acoesDoTurno(c);
		return new Set(['padrao', 'movimento'].filter(k => a[k]).concat(a.reacao ? ['reacao'] : []));
	}
	const k = chaveTurno(token);
	if (!gastas.has(k)) gastas.set(k, new Set());
	return gastas.get(k);
}

/** Marcar/desmarcar uma ação no pip. No combate: o jogador só marca; o mestre também desmarca. */
async function alternarPip(token, k) {
	const c = combatenteDe(token.document);
	if (!c) { const s = acoesDe(token); s.has(k) ? s.delete(k) : s.add(k); return; }
	const a = acoesDoTurno(c);
	const gasta = k === 'reacao' ? a.reacao : !!a[k];
	if (gasta && !game.user.isGM) return ui.notifications.info('Só o mestre devolve uma ação gasta.');
	if (k === 'reacao') a.reacao = !gasta; else a[k] = gasta ? null : 'acao';
	await _acoes.salvar(c, a);
}

/** Marca a ação gasta pela execução de um item (arma = padrão; completa = padrão + movimento). */
function gastar(token, execucao) {
	const s = acoesDe(token);
	if (execucao === 'padrao') s.add('padrao');
	else if (execucao === 'movimento') s.add('movimento');
	else if (execucao === 'completa') { s.add('padrao'); s.add('movimento'); }
	else if (execucao === 'reacao') s.add('reacao');
}

/** Metros andados no turno (histórico do Foundry) e o deslocamento do personagem. */
function passos(token) {
	const doc = token.document;
	let andou = 0;
	try {
		const hist = doc.movementHistory ?? [];
		if (hist.length > 1) andou = doc.measureMovementPath(hist).distance ?? 0;
	} catch { andou = 0; }
	const s = token.actor.system;
	const desloc = token.actor.type === 'agente' ? (s.deslocamentoTotal ?? 9) : (Number.parseFloat(s.deslocamento) || 9);
	const unidade = canvas.scene?.grid?.units || 'm';
	const quadrado = canvas.scene?.grid?.distance || 1.5;
	return { andou: Math.round(andou * 10) / 10, desloc, unidade, quadrado };
}

/* --- desenho ---------------------------------------------------------------- */

function barra(k, r, rotulo) {
	const pct = r?.max > 0 ? Math.clamp(Math.round((r.valor / r.max) * 100), 0, 100) : 0;
	return `<div class="op-hud__bar op-hud__bar--${k}" title="${rotulo}">
		<span class="op-hud__bar-k">${rotulo}</span>
		<span class="op-hud__bar-trilho"><span style="width:${pct}%"></span></span>
		<span class="op-hud__bar-v">${r?.valor ?? 0}<small>/${r?.max ?? 0}</small></span></div>`;
}

function blocoFicha(token) {
	const a = token.actor;
	const s = a.system;
	const img = token.document.texture?.src || a.img;
	let linha; let bars;
	if (a.type === 'agente') {
		const prog = s.isSobrevivente ? `Estágio ${s.progressao.estagio}` : s.usaPatentes ? s.patenteAtual?.nome : s.regras?.progressao === 'nivel' ? `Nível ${s.progressao.nivel}` : `NEX ${s.progressao.nex}%`;
		linha = [prog, `Defesa ${s.defesaTotal} · Esquiva ${s.esquiva}`];
		const r = s.recursos;
		bars = barra('pv', r.pv, 'PV') + (s.semSanidade || s.usaPatentes ? barra('pd', r.pd, 'PD') : barra('san', r.san, 'SAN') + barra('pe', r.pe, 'PE'));
	} else {
		linha = [`VD ${s.vd ?? '—'}`, `Defesa ${s.defesaTotal ?? s.defesa ?? '—'}`];
		bars = barra('pv', s.pv, 'PV');
	}
	const conds = [...a.statuses].map(id => CONDICAO[id]).filter(Boolean).slice(0, 8)
		.map(c => `<img src="${c.img}" alt="${esc(c.nome)}" title="${esc(c.nome)}">`).join('');
	return `<div class="op-hud__ficha">
		<button type="button" class="op-hud__retrato" data-hud="ficha" aria-label="Abrir a ficha de ${esc(a.name)}"><img src="${esc(img)}" alt=""></button>
		<div class="op-hud__ident">
			<strong class="op-hud__nome">${esc(a.name)}</strong>
			<span class="op-hud__linha">${linha.map(esc).join('<br>')}</span>
			<div class="op-hud__bars">${bars}</div>
			${conds ? `<div class="op-hud__conds">${conds}</div>` : ''}
		</div></div>`;
}

function blocoAcoes(token) {
	const s = acoesDe(token);
	const pip = (k, nome, icone) => `<button type="button" class="op-hud__pip ${s.has(k) ? 'is-gasta' : ''}" data-hud="pip" data-k="${k}" aria-pressed="${s.has(k)}" title="${nome}: ${s.has(k) ? 'usada (clique para devolver)' : 'disponível (clique para marcar)'}">
		<i class="fa-solid ${icone}" aria-hidden="true"></i><span>${nome}</span></button>`;
	return `<div class="op-hud__acoes" role="group" aria-label="Ações do turno">
		${pip('padrao', 'Padrão', 'fa-circle-dot')}${pip('movimento', 'Movimento', 'fa-shoe-prints')}${pip('reacao', 'Reação', 'fa-shield-halved')}</div>`;
}

const CATS = [
	{ id: 'armas', nome: 'Armas', icone: 'fa-gun', tipos: ['arma'] },
	{ id: 'rituais', nome: 'Rituais', icone: 'fa-book-skull', tipos: ['ritual'] },
	{ id: 'poderes', nome: 'Poderes', icone: 'fa-bolt', tipos: ['poder'] },
	{ id: 'itens', nome: 'Itens', icone: 'fa-briefcase-medical', tipos: ['equipamento'] },
	{ id: 'pericias', nome: 'Perícias', icone: 'fa-dice-d20', tipos: [] }
];

function itensDa(cat, actor) {
	return actor.items.filter(i => cat.tipos.includes(i.type) && (i.type !== 'equipamento' || (i.system.quantidade ?? 1) > 0))
		.sort((a, b) => a.name.localeCompare(b.name));
}

function blocoCats(token) {
	return `<div class="op-hud__cats" role="group" aria-label="Ações">${CATS.map(c => {
		const n = c.id === 'pericias' ? null : itensDa(c, token.actor).length;
		const aberta = gaveta === c.id;
		return `<button type="button" class="op-hud__cat ${aberta ? 'is-aberta' : ''}" data-hud="cat" data-cat="${c.id}" aria-expanded="${aberta}" ${n === 0 ? 'disabled' : ''}>
			<i class="fa-solid ${c.icone}" aria-hidden="true"></i><span>${c.nome}</span>${n ? `<small>${n}</small>` : ''}</button>`;
	}).join('')}</div>`;
}

function blocoPassos(token) {
	const p = passos(token);
	const frac = p.desloc > 0 ? p.andou / p.desloc : 0;
	const estado = frac <= 1 ? 'ok' : frac <= 2 ? 'dobro' : 'alem';
	// Anel: até 1× deslocamento numa volta; o segundo movimento enche a volta de novo em outra cor.
	const R = 22; const C = 2 * Math.PI * R;
	const volta1 = Math.min(frac, 1); const volta2 = Math.clamp(frac - 1, 0, 1);
	const fmt = (n) => String(n).replace('.', ',');
	const q = (n) => `${n} ${n === 1 ? 'quadrado' : 'quadrados'}`;
	const livres = quadradosLivres(token, p.andou);
	let titulo; let nota;
	if (livres && !livres.naVez) { titulo = 'Fora da vez'; nota = `andou ${fmt(p.andou)} ${esc(p.unidade)} no turno`; }
	else if (livres) {
		titulo = livres.vagas ? q(livres.nestaAcao) : 'Sem movimento';
		const extra = livres.total > livres.nestaAcao ? ` · até ${livres.total} com a ação padrão` : '';
		nota = livres.vagas ? `${fmt(p.andou)} / ${fmt(p.desloc)} ${esc(p.unidade)}${extra}` : 'sem ações para andar neste turno';
	} else {
		titulo = q(Math.max(Math.floor((p.desloc - p.andou) / p.quadrado), 0));
		nota = estado === 'ok' ? `${fmt(p.andou)} / ${fmt(p.desloc)} ${esc(p.unidade)}` : estado === 'dobro' ? 'usando a ação padrão para andar' : 'além de dois movimentos';
	}
	const fim = livres && livres.naVez && (!livres.vagas || (livres.total === 0));
	return `<div class="op-hud__passos is-${fim ? 'alem' : estado}" title="Quadrados que ainda dá para andar neste turno">
		<svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="${R}" class="op-hud__anel-fundo"/>
			<circle cx="28" cy="28" r="${R}" class="op-hud__anel-1" stroke-dasharray="${C * volta1} ${C}"/>
			${volta2 ? `<circle cx="28" cy="28" r="${R - 5}" class="op-hud__anel-2" stroke-dasharray="${2 * Math.PI * (R - 5) * volta2} ${C}"/>` : ''}</svg>
		<div class="op-hud__passos-txt"><strong>${titulo}</strong><span>${nota}</span></div>
	</div>`;
}

function blocoTurno(token) {
	const c = game.combat;
	const vez = c?.started && c.combatant?.tokenId === token.id && c.combatant?.isOwner;
	if (!vez) return '';
	return `<button type="button" class="op-hud__fim" data-hud="encerrar"><i class="fa-solid fa-check" aria-hidden="true"></i> Encerrar turno</button>`;
}

/** Conteúdo da gaveta aberta. */
function conteudoGaveta(token) {
	const a = token.actor;
	if (gaveta === 'pericias') {
		if (a.type === 'agente') {
			const s = a.system;
			const attrs = Object.entries(ATRIBUTOS).map(([k, at]) => `<button type="button" class="op-hud__attr" data-hud="atributo" data-k="${k}"><b>${at.abv}</b><span>${s.atributos[k].valor}</span></button>`).join('');
			const per = Object.entries(PERICIAS).map(([k, p]) => {
				const c = s.periciasCalc?.[k];
				const treinada = s.pericias[k].grau > 0;
				return `<button type="button" class="op-hud__per ${treinada ? 'is-treinada' : ''}" data-hud="pericia" data-k="${k}"><span>${p.nome}</span><small>${c?.dados ?? 0}d ${c?.total >= 0 ? '+' : ''}${c?.total ?? 0}</small></button>`;
			}).join('');
			return `<div class="op-hud__attrs">${attrs}</div><div class="op-hud__pers">${per}</div>`;
		}
		const testes = (a.system.pericias ?? []).map(t => `<button type="button" class="op-hud__per" data-hud="pericia" data-k="${esc(t.nome)}"><span>${esc(t.nome)}</span><small>${t.dados}d +${t.bonus}</small></button>`).join('');
		return `<div class="op-hud__pers">${testes || '<p class="op-hud__vazio">Sem testes listados.</p>'}</div>`;
	}
	const cat = CATS.find(c => c.id === gaveta);
	const itens = itensDa(cat, a);
	if (!itens.length) return '<p class="op-hud__vazio">Nada aqui.</p>';
	const combatente = combatenteDe(token.document);
	return `<div class="op-hud__itens">${itens.map(i => {
		const s = i.system;
		let meta = ''; let canto = '';
		if (i.type === 'arma') { meta = `${s.dano?.formula ?? ''} · ${s.critico?.margem ?? 20}/×${s.critico?.multiplicador ?? 2}`; canto = 'Padrão'; }
		else if (i.type === 'ritual') { meta = `${s.circulo}º círculo · ${EXECUCAO[s.execucao] ?? ''}`; canto = `${s.custo ?? CUSTO_CIRCULO[s.circulo] ?? 1} ${a.system.semSanidade ? 'PD' : 'PE'}`; }
		else if (i.type === 'poder') { meta = [EXECUCAO[s.execucao], s.usos?.max ? `${s.usos.valor}/${s.usos.max}` : ''].filter(Boolean).join(' · '); canto = s.custo ? `${s.custo} ${a.system.semSanidade ? 'PD' : 'PE'}` : ''; }
		else { meta = s.quantidade > 1 ? `×${s.quantidade}` : ''; }
		const el = i.type === 'ritual' && s.elemento ? ` op-el--${s.elemento}` : '';
		// Não cabe nas ações que sobram: aparece travado (o mestre continua podendo usar).
		const plano = combatente && game.settings.get(SYSTEM_ID, 'limiteAcoes') ? planejar(combatente, execucaoDo(i)) : { ok: true };
		const trava = !plano.ok ? ` is-bloqueado" aria-disabled="true` : '';
		const dica = plano.ok ? 'Clique para usar · botão direito abre a ficha do item' : `${plano.motivo} · botão direito abre a ficha`;
		return `<button type="button" class="op-hud__item${el}${trava}" data-hud="usar" data-item="${i.id}" title="${esc(dica)}">
			<img src="${esc(i.img)}" alt=""><span class="op-hud__item-txt"><strong>${esc(i.name)}</strong>${meta ? `<small>${esc(meta)}</small>` : ''}</span>${canto ? `<span class="op-hud__canto">${esc(canto)}</span>` : ''}</button>`;
	}).join('')}</div>`;
}

export function desenhar() {
	const token = tokenAtual();
	if (!token) { raiz?.remove(); raiz = null; gaveta = null; document.body.classList.remove('op-com-hud'); return; }
	if (!raiz) {
		raiz = document.createElement('section');
		raiz.id = 'op-hud';
		raiz.className = 'op-dossie op-hud';
		raiz.setAttribute('aria-label', 'HUD de combate');
		raiz.addEventListener('click', aoClicar);
		raiz.addEventListener('contextmenu', aoBotaoDireito);
		document.body.append(raiz);
	}
	raiz.dataset.token = token.id;
	const cat = CATS.find(c => c.id === gaveta);
	raiz.innerHTML = `${gaveta ? `<div class="op-hud__gaveta" role="region" aria-label="${cat?.nome}"><header><h3>${cat?.nome}</h3><button type="button" data-hud="fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></header><div class="op-hud__gaveta-corpo">${conteudoGaveta(token)}</div></div>` : ''}
		<div class="op-hud__barra">${blocoFicha(token)}${blocoAcoes(token)}${blocoCats(token)}${blocoPassos(token)}${blocoTurno(token)}</div>`;
	// Fica logo acima da barra de macros do Foundry.
	const hotbar = document.getElementById('hotbar')?.getBoundingClientRect();
	raiz.style.bottom = `${hotbar && hotbar.height ? Math.max(window.innerHeight - hotbar.top + 8, 8) : 12}px`;
	document.body.classList.add('op-com-hud');
}

export function agendar() {
	if (agendado) return;
	agendado = requestAnimationFrame(() => { agendado = null; desenhar(); });
}

/* --- ações ------------------------------------------------------------------- */

async function aoClicar(ev) {
	const el = ev.target.closest('[data-hud]');
	if (!el) return;
	const token = canvas.tokens.get(raiz.dataset.token);
	const actor = token?.actor;
	if (!actor) return;
	switch (el.dataset.hud) {
		case 'ficha': actor.sheet.render(true); break;
		case 'pip': await alternarPip(token, el.dataset.k); break;
		case 'cat': gaveta = gaveta === el.dataset.cat ? null : el.dataset.cat; break;
		case 'fechar': gaveta = null; break;
		case 'usar': {
			const item = actor.items.get(el.dataset.item);
			if (!item) break;
			// No combate, o próprio uso confere e gasta as ações; fora dele, só marca aqui.
			if (!combatenteDe(token.document)) gastar(token, execucaoDo(item));
			await item.usar({ event: ev });
			break;
		}
		case 'pericia': await actor.rolarPericia(el.dataset.k, { event: ev }); break;
		case 'atributo': await actor.rolarAtributo(el.dataset.k, { event: ev }); break;
		case 'encerrar': await game.combat?.nextTurn(); break;
	}
	agendar();
}

function aoBotaoDireito(ev) {
	const el = ev.target.closest('[data-hud="usar"]');
	if (!el) return;
	ev.preventDefault();
	const token = canvas.tokens.get(raiz.dataset.token);
	token?.actor?.items.get(el.dataset.item)?.sheet.render(true);
}

export function registrarHud() {
	const sempre = () => agendar();
	for (const h of ['controlToken', 'canvasReady', 'updateCombat', 'deleteCombat', 'createCombat', 'moveToken', 'createActiveEffect', 'deleteActiveEffect']) Hooks.on(h, sempre);
	const doToken = (doc) => { if (raiz && (doc?.id === raiz.dataset.token || doc?.parent?.id === canvas.tokens.get(raiz?.dataset.token)?.actor?.id)) agendar(); };
	Hooks.on('updateToken', doToken);
	Hooks.on('updateActor', (actor) => { if (raiz && canvas.tokens.get(raiz.dataset.token)?.actor === actor) agendar(); });
	for (const h of ['createItem', 'updateItem', 'deleteItem']) Hooks.on(h, (item) => { if (raiz && canvas.tokens.get(raiz.dataset.token)?.actor === item.parent) agendar(); });
	// Andou no turno: o movimento conta como a ação de movimento.
	// No combate quem marca é automation/acoes.mjs (no combatente).
	Hooks.on('moveToken', (doc) => {
		const t = doc.object;
		if (t && !combatenteDe(doc) && doc.movementHistory?.length > 1 && t.actor?.isOwner) acoesDe(t).add('movimento');
	});
	Hooks.on('updateCombatant', (c) => { if (raiz && c.tokenId === raiz.dataset.token) agendar(); });
	// Esc fecha a gaveta.
	document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && gaveta && raiz) { gaveta = null; agendar(); } });
	window.addEventListener('resize', sempre);
}
