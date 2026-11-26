/**
 * Faixa de turnos: retratos dos combatentes no topo da tela, na ordem da iniciativa a partir de quem
 * está jogando. Mestre: voltar, próximo turno, próxima rodada, encerrar; antes de começar, iniciar e
 * rolar a iniciativa das ameaças. Jogador: "Encerrar turno" na vez dele e rolar a própria iniciativa.
 * Clique seleciona o token e centraliza; dois cliques abrem a ficha (quem controla).
 * Cada cliente desenha a própria faixa a partir dos documentos de combate (sem socket).
 */
import { SYSTEM_ID } from '../config.mjs';
import { worldRules } from '../rules/table-rules.mjs';

const esc = (t) => foundry.utils.escapeHTML(String(t ?? ''));
let raiz = null;
let agendado = null;

export function registrarConfigFaixa() {
	game.settings.register(SYSTEM_ID, 'faixaTurnos', {
		name: 'Faixa de turnos',
		hint: 'Só no seu computador. Mostra os retratos dos combatentes no topo da tela durante o combate.',
		scope: 'client', config: true, type: Boolean, default: true,
		onChange: () => desenhar()
	});
}

/** Barras de recurso do combatente, conforme quem olha. */
function barras(c) {
	const a = c.actor;
	if (!a) return { html: '', estado: '' };
	const pct = (r) => r?.max > 0 ? Math.clamp(Math.round((r.valor / r.max) * 100), 0, 100) : 0;
	const barra = (k, r, rotulo) => `<span class="op-faixa__bar op-faixa__bar--${k}" title="${rotulo} ${r.valor}/${r.max}"><span style="width:${pct(r)}%"></span></span>`;
	if (a.type === 'agente') {
		const r = a.system.recursos;
		const segunda = a.system.semSanidade || a.system.usaPatentes ? barra('pd', r.pd, 'PD') : `${barra('san', r.san, 'SAN')}${barra('pe', r.pe, 'PE')}`;
		return { html: `${barra('pv', r.pv, 'PV')}${segunda}`, estado: '' };
	}
	const pv = a.system.pv ?? { valor: 0, max: 0 };
	const esconder = !game.user.isGM && !a.isOwner && worldRules().automacao?.ocultarDanoAmeacas;
	if (!esconder) return { html: barra('pv', pv, 'PV'), estado: '' };
	const p = pct(pv);
	const estado = p >= 100 ? 'Ileso' : p > 50 ? 'Ferido' : p > 0 ? 'Muito ferido' : 'Caído';
	return { html: '', estado };
}

function retrato(c, { atual, combat }) {
	const a = c.actor;
	const img = c.img || c.token?.texture?.src || a?.img || 'icons/svg/mystery-man.svg';
	const dono = c.isOwner;
	const hostil = c.token?.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE;
	const { html, estado } = barras(c);
	const ini = c.initiative;
	const podeRolar = dono && ini == null;
	const classes = ['op-faixa__item', atual ? 'is-atual' : '', c.isDefeated ? 'is-fora' : '', c.hidden ? 'is-oculto' : '', hostil ? 'is-hostil' : '', dono && !game.user.isGM ? 'is-meu' : ''].filter(Boolean).join(' ');
	return `<li class="${classes}" data-combatant="${c.id}">
		<button type="button" class="op-faixa__retrato" data-acao="focar" aria-label="${esc(c.name)}${atual ? ', na vez' : ''}">
			<img src="${esc(img)}" alt="">
			${ini != null ? `<span class="op-faixa__ini" title="Iniciativa">${ini}</span>` : ''}
			${c.isDefeated ? '<span class="op-faixa__x" aria-hidden="true"><i class="fa-solid fa-skull"></i></span>' : ''}
		</button>
		${podeRolar && combat ? `<button type="button" class="op-faixa__rolar" data-acao="rolarIni" title="Rolar iniciativa" aria-label="Rolar iniciativa de ${esc(c.name)}"><i class="fa-solid fa-dice-d20"></i></button>` : ''}
		<span class="op-faixa__nome">${esc(c.name)}</span>
		${html ? `<span class="op-faixa__bars">${html}</span>` : ''}
		${estado ? `<span class="op-faixa__estado">${estado}</span>` : ''}
	</li>`;
}

function conteudo(combat) {
	const gm = game.user.isGM;
	const visiveis = (lista) => lista.filter(c => gm || !c.hidden);
	const iniciado = combat.started;
	let html = '';
	if (iniciado) {
		const turns = combat.turns;
		const i = Math.max(combat.turn ?? 0, 0);
		const daqui = visiveis(turns.slice(i));
		const proxima = visiveis(turns.slice(0, i));
		html += daqui.map((c, k) => retrato(c, { atual: k === 0 && turns[i]?.id === c.id, combat })).join('');
		if (proxima.length) html += `<li class="op-faixa__divisor" aria-hidden="true"><span>Rodada ${combat.round + 1}</span></li>` + proxima.map(c => retrato(c, { atual: false, combat })).join('');
	} else {
		html += visiveis(combat.turns).map(c => retrato(c, { atual: false, combat })).join('');
	}
	const atual = combat.combatant;
	const minhaVez = iniciado && atual?.isOwner && !gm;
	const ctrl = gm
		? (iniciado
			? `<button type="button" data-acao="voltar" title="Turno anterior" aria-label="Turno anterior"><i class="fa-solid fa-backward-step"></i></button>
				<button type="button" class="is-principal" data-acao="proximo" title="Próximo turno" aria-label="Próximo turno"><i class="fa-solid fa-forward-step"></i> Próximo</button>
				<button type="button" data-acao="rodada" title="Próxima rodada" aria-label="Próxima rodada"><i class="fa-solid fa-forward-fast"></i></button>
				<button type="button" data-acao="encerrar" title="Encerrar o combate" aria-label="Encerrar o combate"><i class="fa-solid fa-flag-checkered"></i></button>`
			: `<button type="button" data-acao="rolarNpcs" title="Rolar a iniciativa das ameaças" aria-label="Rolar a iniciativa das ameaças"><i class="fa-solid fa-dice"></i></button>
				<button type="button" class="is-principal" data-acao="iniciar"><i class="fa-solid fa-play"></i> Iniciar combate</button>`)
		: (minhaVez ? `<button type="button" class="is-principal" data-acao="encerrarTurno"><i class="fa-solid fa-check"></i> Encerrar turno</button>` : '');
	return `<div class="op-faixa__rodada">${iniciado ? `<span>Rodada</span><strong>${combat.round}</strong>` : '<span>Combate</span><strong>—</strong>'}</div>
		<ol class="op-faixa__lista">${html || '<li class="op-faixa__vazio">Sem combatentes</li>'}</ol>
		${ctrl ? `<div class="op-faixa__ctrl">${ctrl}</div>` : ''}`;
}

/** Desenha (ou remove) a faixa para o combate da cena atual. */
export function desenhar() {
	const combat = game.combat;
	const ligada = game.settings.get(SYSTEM_ID, 'faixaTurnos');
	if (!ligada || !combat || !combat.turns.length) { raiz?.remove(); raiz = null; document.body.classList.remove('op-com-faixa'); return; }
	if (!raiz) {
		raiz = document.createElement('section');
		raiz.id = 'op-faixa-turnos';
		raiz.className = 'op-dossie op-faixa';
		raiz.setAttribute('aria-label', 'Ordem de turnos');
		raiz.addEventListener('click', aoClicar);
		raiz.addEventListener('dblclick', aoDuploClique);
		document.body.append(raiz);
	}
	const antes = raiz.dataset.atual;
	raiz.innerHTML = conteudo(combat);
	raiz.dataset.atual = combat.combatant?.id ?? '';
	// As notificações do Foundry ficam logo abaixo da faixa, sem cobri-la.
	document.body.classList.add('op-com-faixa');
	document.documentElement.style.setProperty('--op-faixa-fim', `${Math.ceil(raiz.getBoundingClientRect().bottom) + 12}px`);
	// A vez mudou: anima a entrada do novo retrato atual.
	if (antes !== raiz.dataset.atual) raiz.querySelector('.is-atual')?.classList.add('is-chegando');
}

/** Junta várias mudanças seguidas num só redesenho. */
export function agendar() {
	if (agendado) return;
	agendado = requestAnimationFrame(() => { agendado = null; desenhar(); });
}

async function aoClicar(ev) {
	const alvo = ev.target.closest('[data-acao]');
	if (!alvo) return;
	const combat = game.combat;
	if (!combat) return;
	const c = combat.combatants.get(alvo.closest('[data-combatant]')?.dataset.combatant);
	alvo.disabled = true;
	try {
		switch (alvo.dataset.acao) {
			case 'focar': {
				const token = c?.token?.object;
				if (!token) break;
				if (token.isOwner) token.control({ releaseOthers: !ev.shiftKey });
				if (token.visible) canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
				break;
			}
			case 'rolarIni': if (c) await combat.rollInitiative([c.id]); break;
			case 'proximo': await combat.nextTurn(); break;
			case 'voltar': await combat.previousTurn(); break;
			case 'rodada': await combat.nextRound(); break;
			case 'iniciar': await combat.startCombat(); break;
			case 'rolarNpcs': await combat.rollNPC(); break;
			case 'encerrarTurno': if (combat.combatant?.isOwner) await combat.nextTurn(); break;
			case 'encerrar': await combat.endCombat(); break;
		}
	} catch (err) {
		console.error(`${SYSTEM_ID} | faixa de turnos`, err);
	} finally {
		if (alvo.isConnected) alvo.disabled = false;
	}
}

function aoDuploClique(ev) {
	const li = ev.target.closest('[data-combatant]');
	const c = li && game.combat?.combatants.get(li.dataset.combatant);
	if (c?.actor?.isOwner || game.user.isGM) c?.actor?.sheet.render(true);
}

export function registrarFaixa() {
	for (const h of ['createCombat', 'updateCombat', 'deleteCombat', 'createCombatant', 'updateCombatant', 'deleteCombatant', 'canvasReady', 'updateToken', 'createActiveEffect', 'deleteActiveEffect']) Hooks.on(h, agendar);
	// Recursos do ator mudaram: só redesenha se ele está no combate.
	Hooks.on('updateActor', (actor) => { if (game.combat?.combatants.some(c => c.actor === actor || c.actorId === actor.id)) agendar(); });
	Hooks.once('ready', () => {
		desenhar();
		// O Carousel Combat Tracker faz o mesmo papel: avisa o mestre uma vez.
		if (game.user.isGM && game.modules.get('combat-tracker-dock')?.active && !game.settings.get(SYSTEM_ID, 'avisoCarrossel')) {
			ui.notifications.info('O Dossiê tem a própria faixa de turnos. Se quiser só uma, desative o módulo Carousel Combat Tracker ou a opção "Faixa de turnos" nas configurações.', { permanent: true });
			game.settings.set(SYSTEM_ID, 'avisoCarrossel', true);
		}
	});
	game.settings.register(SYSTEM_ID, 'avisoCarrossel', { scope: 'world', config: false, type: Boolean, default: false });
}
