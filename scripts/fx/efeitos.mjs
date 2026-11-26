/**
 * Efeitos visuais do Dossiê.
 * Os efeitos próprios funcionam sem módulos (PIXI do próprio Foundry). Com Sequencer + JB2A ativos,
 * as animações do JB2A tocam junto. Cada jogador escolhe: completo, reduzido ou desligado.
 * Tudo nasce de eventos que chegam a todos os clientes (mensagem criada, ator alterado),
 * então cada um desenha na própria tela, sem socket.
 */
import { SYSTEM_ID } from '../config.mjs';
import { worldRules } from '../rules/table-rules.mjs';
import { tocar, somDaArma } from './sons.mjs';
import { atualizarAlucinacoes, abafarAudio } from './alucinacoes.mjs';

const COR = { sangue: 0xd0312d, morte: 0x8a8590, conhecimento: 0xe0b23a, energia: 0x9b5cff, medo: 0xf2f2f2, '': 0xb3261e };
const COR_DANO = 0xff5a4f, COR_CURA = 0x6fdc8c, COR_SAN = 0x6fa3ff, COR_PE = 0xf0c24b;

/** JB2A gratuito: círculo sob quem conjura e projétil até o alvo, recoloridos por elemento. */
const JB2A_RITUAL = {
	sangue: { circulo: 'jb2a.magic_signs.circle.02.evocation.complete.dark_red', projetil: 'jb2a.energy_strands.range.standard.purple.02', filtro: { hue: 75 } },
	morte: { circulo: 'jb2a.magic_signs.circle.02.necromancy.complete.dark_green', projetil: 'jb2a.eldritch_blast.purple', filtro: { saturate: -1 }, filtroCirculo: { saturate: -1 } },
	conhecimento: { circulo: 'jb2a.magic_signs.circle.02.transmutation.complete.yellow', projetil: 'jb2a.ranged_missile.missile_only.001.blue', filtro: { hue: 185 } },
	energia: { circulo: 'jb2a.magic_signs.circle.02.illusion.complete.purple', projetil: 'jb2a.lightning_bolt.narrow.blue', filtro: { hue: 60 } },
	medo: { circulo: 'jb2a.magic_signs.circle.02.abjuration.complete.blue', projetil: 'jb2a.energy_strands.range.standard.purple.01', filtro: { saturate: -1, brightness: 1.6 }, filtroCirculo: { saturate: -1, brightness: 1.6 } }
};
const JB2A_ATAQUE = { fogo: 'jb2a.bullet.01.orange', disparo: 'jb2a.arrow.physical.white.01', arremesso: 'jb2a.arrow.physical.white.01', corpo: 'jb2a.melee_generic.slash.01.orange' };
const JB2A_CURA = 'jb2a.healing_generic.200px.green';
const JB2A_IMPACTO = { arma: 'jb2a.impact.010.orange', ritual: 'jb2a.impact.004.blue' };
const JB2A_CLARAO = 'jb2a.muzzle_flash.single.01.yellow';
/** Filtro do impacto azul do JB2A para a cor de cada elemento. */
const FILTRO_IMPACTO = { sangue: { hue: 150 }, morte: { saturate: -1, brightness: 0.8 }, conhecimento: { hue: 200 }, energia: { hue: 60 }, medo: { saturate: -1, brightness: 1.6 } };

/* --- configuração ------------------------------------------------------- */

export function registrarConfigEfeitos() {
	game.settings.register(SYSTEM_ID, 'efeitos', {
		name: 'Efeitos visuais',
		hint: 'Só no seu computador. Reduzido tira tremor e distorção de tela e mantém os números de dano.',
		scope: 'client', config: true, type: String, default: 'completo',
		choices: { completo: 'Completo', reduzido: 'Reduzido', desligado: 'Desligado' },
		onChange: () => atualizarTelaSanidade()
	});
}
const nivel = () => game.settings.get(SYSTEM_ID, 'efeitos');
const ligado = () => nivel() !== 'desligado' && canvas?.ready;
const completo = () => nivel() === 'completo';
const temJB2A = () => !!(game.modules.get('sequencer')?.active && game.modules.get('JB2A_DnD5e')?.active && globalThis.Sequence);
const jb2aExiste = (k) => { try { return Sequencer.Database.entryExists(k); } catch { return false; } };

/* --- primitivas PIXI ---------------------------------------------------- */

/** Anima de 0 a 1 em `ms` e remove o objeto no fim. */
function animar(obj, ms, passo) {
	const camada = canvas.interface;
	camada.addChild(obj);
	const t0 = performance.now();
	const tick = () => {
		const t = Math.min((performance.now() - t0) / ms, 1);
		passo(t);
		if (t >= 1) { canvas.app.ticker.remove(tick); obj.destroy({ children: true }); }
	};
	canvas.app.ticker.add(tick);
}
const easeOut = (t) => 1 - (1 - t) ** 3;

/** Anel que se expande na cor do elemento. */
function anel(centro, raio, cor, ms = 900) {
	const g = new PIXI.Graphics();
	g.position.set(centro.x, centro.y);
	animar(g, ms, (t) => {
		const e = easeOut(t);
		g.clear();
		g.lineStyle(Math.max(6 * (1 - t), 1), cor, 1 - t);
		g.drawCircle(0, 0, raio * (0.55 + e * 0.9));
		g.lineStyle(2, cor, (1 - t) * 0.6);
		g.drawCircle(0, 0, raio * (0.35 + e * 1.3));
	});
}

/** Feixe de A até B com um ponto de luz correndo por ele. */
function feixe(a, b, cor, ms = 650) {
	const g = new PIXI.Graphics();
	animar(g, ms, (t) => {
		const p = easeOut(Math.min(t * 1.6, 1));
		const x = a.x + (b.x - a.x) * p, y = a.y + (b.y - a.y) * p;
		const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
		g.clear();
		g.lineStyle(10, cor, 0.18 * fade); g.moveTo(a.x, a.y); g.lineTo(x, y);
		g.lineStyle(3, cor, 0.9 * fade); g.moveTo(a.x, a.y); g.lineTo(x, y);
		g.beginFill(0xffffff, fade); g.drawCircle(x, y, 5); g.endFill();
		g.beginFill(cor, 0.35 * fade); g.drawCircle(x, y, 14); g.endFill();
	});
}

/** Corte em arco sobre o alvo (ataque corpo a corpo). */
function corte(c, raio, cor, ms = 420) {
	const g = new PIXI.Graphics();
	g.position.set(c.x, c.y);
	g.rotation = -0.6;
	animar(g, ms, (t) => {
		g.clear();
		const fim = -Math.PI / 2 + Math.PI * easeOut(t);
		g.lineStyle(6 * (1 - t) + 1, cor, 1 - t * 0.8);
		g.arc(0, 0, raio * 0.8, -Math.PI / 2, fim);
	});
}

/** Impacto: clarão cheio que se abre, anel e estilhaços. */
function explosao(c, raio, cor, ms = 650) {
	const g = new PIXI.Graphics();
	g.position.set(c.x, c.y);
	const raios = Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * Math.PI * 2 + Math.random() * 0.5, l: 0.6 + Math.random() * 0.6 }));
	animar(g, ms, (t) => {
		const e = easeOut(t);
		g.clear();
		g.beginFill(0xffffff, Math.max(0.9 - t * 3, 0)); g.drawCircle(0, 0, raio * (0.2 + e * 0.35)); g.endFill();
		g.beginFill(cor, 0.45 * (1 - t)); g.drawCircle(0, 0, raio * (0.3 + e * 0.5)); g.endFill();
		g.lineStyle(Math.max(5 * (1 - t), 1), cor, 1 - t); g.drawCircle(0, 0, raio * (0.4 + e * 0.75));
		g.lineStyle(Math.max(3 * (1 - t), 1), cor, 1 - t);
		for (const r of raios) {
			const d0 = raio * (0.3 + e * 0.5), d1 = raio * (0.3 + e * r.l * 1.1);
			g.moveTo(Math.cos(r.a) * d0, Math.sin(r.a) * d0); g.lineTo(Math.cos(r.a) * d1, Math.sin(r.a) * d1);
		}
	});
}

/** Tremor curto no token. */
function tremer(token) {
	if (!completo() || !token?.mesh) return;
	const mesh = token.mesh;
	const x0 = mesh.position.x;
	const t0 = performance.now();
	const tick = () => {
		const t = (performance.now() - t0) / 380;
		if (t >= 1 || mesh.destroyed) { if (!mesh.destroyed) mesh.position.x = x0; canvas.app.ticker.remove(tick); return; }
		mesh.position.x = x0 + Math.sin(t * 40) * 6 * (1 - t);
	};
	canvas.app.ticker.add(tick);
}

function texto(token, txt, cor) {
	canvas.interface.createScrollingText(token.center, txt, {
		anchor: CONST.TEXT_ANCHOR_POINTS.TOP, direction: CONST.TEXT_ANCHOR_POINTS.TOP,
		fontSize: 30, fill: cor, stroke: 0x111111, strokeThickness: 5, jitter: 0.25, duration: 1800
	});
}

/* --- tokens a partir das mensagens ------------------------------------- */

function tokenDoFalante(message) {
	const s = message.speaker;
	if (s?.scene && s.scene !== canvas.scene?.id) return null;
	if (s?.token) return canvas.tokens.get(s.token) ?? null;
	return game.actors.get(s?.actor)?.getActiveTokens()?.[0] ?? null;
}
function tokenDoAlvo(uuid) {
	const doc = fromUuidSync(uuid);
	return doc?.parent?.id === canvas.scene?.id ? canvas.tokens.get(doc.id) : null;
}

/* --- reações ------------------------------------------------------------ */

/** O ritual causa dano ou cura? Então o ataque visual sai quando o dano é rolado. */
function ritualTemRolagem(item, forma) {
	const s = item?.system;
	if (!s) return false;
	const f = forma && forma !== 'normal' ? s[forma] : null;
	return !!((f?.dano ?? s.dano)?.formula || /\d+d\d+/.test(String(s.cura ?? '')));
}

/** Conjurar: círculo do elemento em quem conjura. Rituais sem dano disparam o efeito nos alvos já. */
function efeitoRitual(message, r) {
	const origem = tokenDoFalante(message);
	if (!origem) return;
	const item = origem.actor?.items.get(r.itemId);
	const el = item?.system.elemento ?? '';
	tocar(`conjurar:${el}`);
	if (temJB2A() && completo() && JB2A_RITUAL[el] && jb2aExiste(JB2A_RITUAL[el].circulo)) {
		const j = JB2A_RITUAL[el];
		const e = new Sequence().effect().file(j.circulo).atLocation(origem).scaleToObject(1.8).belowTokens().fadeOut(400);
		if (j.filtroCirculo) e.filter('ColorMatrix', j.filtroCirculo);
		e.play();
	} else anel(origem.center, Math.max(origem.w, origem.h), COR[el] ?? COR['']);
	if (!ritualTemRolagem(item, r.forma)) setTimeout(() => ataqueRitual(origem, el, r.alvos ?? []), 450);
}

/** Ataque do ritual: projétil do elemento até cada alvo e impacto. */
function ataqueRitual(origem, el, uuids) {
	const cor = COR[el] ?? COR[''];
	const alvos = uuids.map(tokenDoAlvo).filter(Boolean);
	if (!alvos.length) { anel(origem.center, Math.max(origem.w, origem.h) * 1.3, cor, 700); return; }
	const j = JB2A_RITUAL[el];
	alvos.forEach((a, i) => {
		const atraso = i * 120;
		if (temJB2A() && completo() && j && jb2aExiste(j.projetil)) {
			const seq = new Sequence();
			if (atraso) seq.wait(atraso);
			seq.effect().file(j.projetil).atLocation(origem).stretchTo(a).filter('ColorMatrix', j.filtro).waitUntilFinished(-500);
			if (jb2aExiste(JB2A_IMPACTO.ritual)) seq.effect().file(JB2A_IMPACTO.ritual).atLocation(a).scaleToObject(1.6).filter('ColorMatrix', FILTRO_IMPACTO[el] ?? {});
			seq.play();
			setTimeout(() => tocar(`acerto:${el}`), atraso + 550);
			return;
		}
		setTimeout(() => {
			feixe(origem.center, a.center, cor, 520);
			setTimeout(() => { explosao(a.center, Math.max(a.w, a.h), cor); tocar(`acerto:${el}`); }, 330);
		}, atraso);
	});
}

/** Dano rolado a partir de um cartão: ritual dispara o ataque; arma mostra o impacto nos atingidos. */
function efeitoDano(message, d, cardId) {
	const card = game.messages.get(cardId);
	if (!card) return;
	const origem = tokenDoFalante(card);
	const f = card.flags?.[SYSTEM_ID] ?? {};
	if (f.ritual && origem) {
		const el = origem.actor?.items.get(f.ritual.itemId)?.system.elemento ?? '';
		if (d.tipo === 'cura') {
			tocar('cura');
			for (const a of (d.alvos ?? []).map(tokenDoAlvo).filter(Boolean)) anel(a.center, Math.max(a.w, a.h) * 0.7, COR_CURA, 800);
			return;
		}
		ataqueRitual(origem, el, d.alvos ?? []);
		return;
	}
	if (f.arma) {
		const alvos = (d.alvos ?? []).map(tokenDoAlvo).filter(Boolean);
		const arma = origem?.actor?.items.get(f.arma.itemId);
		if (alvos.length) tocar(arma?.system.tipo === 'corpo a corpo' ? 'golpe-acerto' : 'impacto');
		for (const a of alvos) {
			if (temJB2A() && completo() && jb2aExiste(JB2A_IMPACTO.arma)) new Sequence().effect().file(JB2A_IMPACTO.arma).atLocation(a).scaleToObject(1.3).play();
			else explosao(a.center, Math.max(a.w, a.h) * 0.8, 0xffb347, 500);
		}
	}
}

function efeitoAtaque(message, at) {
	const origem = tokenDoFalante(message);
	if (!origem) return;
	const arma = origem.actor?.items.get(at.itemId);
	const total = at.total ?? message.rolls?.[0]?.total ?? 0;
	const tipo = arma?.system.tipo ?? 'corpo a corpo';
	tocar(somDaArma(arma));
	const primeiro = at.alvos?.[0] ? tokenDoAlvo(at.alvos[0]) : null;
	if (tipo === 'fogo' && primeiro && temJB2A() && completo() && jb2aExiste(JB2A_CLARAO)) {
		new Sequence().effect().file(JB2A_CLARAO).atLocation(origem).rotateTowards(primeiro).scaleToObject(1.2).play();
	}
	for (const uuid of at.alvos ?? []) {
		const alvo = tokenDoAlvo(uuid);
		if (!alvo) continue;
		const def = alvo.actor?.system.defesaTotal ?? alvo.actor?.system.defesa ?? 0;
		const acertou = total >= def;
		if (temJB2A() && completo()) {
			const k = tipo === 'corpo a corpo' ? JB2A_ATAQUE.corpo : JB2A_ATAQUE[tipo] ?? JB2A_ATAQUE.fogo;
			if (jb2aExiste(k)) {
				const e = new Sequence().effect().file(k).atLocation(origem);
				if (tipo === 'corpo a corpo') e.stretchTo(alvo).missed(!acertou); else e.stretchTo(alvo).missed(!acertou);
				e.play();
			}
		} else if (tipo === 'corpo a corpo') corte(alvo.center, Math.max(alvo.w, alvo.h), acertou ? 0xffffff : 0x777777);
		else feixe(origem.center, acertou ? alvo.center : { x: alvo.center.x + alvo.w * 0.8, y: alvo.center.y - alvo.h * 0.6 }, acertou ? 0xffc36b : 0x8a8a8a, 380);
		if (!acertou) { setTimeout(() => texto(alvo, 'Errou', 0xbdbdbd), 300); tocar('errou', { atraso: 250 }); }
	}
}

function efeitoPoder(message, p) {
	const origem = tokenDoFalante(message);
	if (origem) anel(origem.center, Math.max(origem.w, origem.h) * 0.8, COR[p.elemento] ?? 0xe8e2d6, 700);
	tocar('poder');
}

/** Antes de salvar: guarda quanto cada recurso mudou (vai junto para todos os clientes). */
function registrarDiferencas() {
	Hooks.on('preUpdateActor', (actor, changes, options) => {
		const s = actor.system;
		const delta = {};
		const ler = (path, atual) => {
			const novo = foundry.utils.getProperty(changes, path);
			if (novo !== undefined && Number(novo) !== Number(atual)) return Number(novo) - Number(atual);
			return 0;
		};
		if (actor.type === 'ameaca') delta.pv = ler('system.pv.valor', s.pv.valor);
		else {
			delta.pv = ler('system.recursos.pv.valor', s.recursos.pv.valor) + ler('system.recursos.pv.temp', s.recursos.pv.temp);
			delta.san = ler('system.recursos.san.valor', s.recursos.san.valor);
			delta.pd = ler('system.recursos.pd.valor', s.recursos.pd.valor);
		}
		if (Object.values(delta).some(Boolean)) options.opFx = delta;
	});
	Hooks.on('updateActor', (actor, changes, options) => {
		const d = options.opFx;
		if (d) mostrarDiferencas(actor, d);
		if (actor === game.user.character) atualizarTelaSanidade();
	});
}

function mostrarDiferencas(actor, d) {
	if (!ligado()) return;
	const esconder = actor.type === 'ameaca' && !game.user.isGM && worldRules().automacao?.ocultarDanoAmeacas;
	for (const token of actor.getActiveTokens(true)) {
		if (token.document.hidden && !game.user.isGM) continue;
		let atraso = 0;
		const mostra = (txt, cor) => { setTimeout(() => texto(token, txt, cor), atraso); atraso += 260; };
		if (d.pv < 0) { mostra(esconder ? '−?' : `${d.pv}`.replace('-', '−'), COR_DANO); tremer(token); tocar('impacto'); }
		if (d.pv > 0) {
			tocar('cura');
			mostra(esconder ? '+?' : `+${d.pv}`, COR_CURA);
			if (temJB2A() && completo() && jb2aExiste(JB2A_CURA)) new Sequence().effect().file(JB2A_CURA).atLocation(token).scaleToObject(1.4).play();
		}
		if (d.san) mostra(`${d.san > 0 ? '+' : '−'}${Math.abs(d.san)} SAN`, COR_SAN);
		if (d.pd) mostra(`${d.pd > 0 ? '+' : '−'}${Math.abs(d.pd)} PD`, COR_PE);
	}
}

/* --- condições no token -------------------------------------------------- */

const TOM = { morrendo: { cor: 0xff2a2a, pulso: 1.4 }, sangrando: { cor: 0xff6b6b, pulso: 0 }, emChamas: { cor: 0xffa040, pulso: 6 }, enlouquecendo: { cor: 0xb27cff, pulso: 0.9 }, petrificado: { cor: 0x9a9a9a, pulso: 0 } };
const ORDEM_TOM = ['morrendo', 'emChamas', 'enlouquecendo', 'sangrando', 'petrificado'];

function misturar(c1, c2, t) {
	const r = ((c1 >> 16) & 255) + ((((c2 >> 16) & 255) - ((c1 >> 16) & 255)) * t);
	const g = ((c1 >> 8) & 255) + ((((c2 >> 8) & 255) - ((c1 >> 8) & 255)) * t);
	const b = (c1 & 255) + (((c2 & 255) - (c1 & 255)) * t);
	return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function registrarTons() {
	const tingidos = new Set();
	canvas.app?.ticker.add(() => {
		if (!canvas.ready) return;
		const agora = performance.now() / 1000;
		const vivos = new Set();
		if (nivel() !== 'desligado') {
			for (const token of canvas.tokens.placeables) {
				const st = token.actor?.statuses;
				const id = st && ORDEM_TOM.find(k => st.has(k));
				if (!id || !token.mesh) continue;
				const { cor, pulso } = TOM[id];
				const t = completo() && pulso ? 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(agora * pulso * Math.PI)) : 0.35;
				token.mesh.tint = misturar(0xffffff, cor, t);
				vivos.add(token);
			}
		}
		for (const token of tingidos) if (!vivos.has(token) && token.mesh && !token.destroyed) token.mesh.tint = Number(token.document.texture.tint ?? 0xffffff);
		tingidos.clear();
		for (const t of vivos) tingidos.add(t);
	});
}

/* --- tela do jogador com Sanidade baixa --------------------------------- */

let estadoSan = null;
export function atualizarTelaSanidade() {
	const a = game.user.character;
	document.body.classList.remove('op-san-baixa', 'op-san-zero', 'op-fx-reduzido');
	if (!a || game.user.isGM || a.type !== 'agente' || a.system.semSanidade || nivel() === 'desligado') return atualizarAlucinacoes(null);
	const san = a.system.recursos.san;
	if (!san.max) return atualizarAlucinacoes(null);
	if (!completo()) document.body.classList.add('op-fx-reduzido');
	let estado = '';
	if (san.valor <= 0) estado = 'op-san-zero';
	else if (san.valor <= Math.floor(san.max / 4)) estado = 'op-san-baixa';
	if (estado) document.body.classList.add(estado);
	// Som só ao entrar no estado (não ao abrir o mundo já nele).
	if (estadoSan !== null && estado && estado !== estadoSan) {
		if (estado === 'op-san-zero') { tocar('san-zero', { volume: 0.9 }); abafarAudio(3000); }
		else tocar('coracao');
	}
	estadoSan = estado;
	atualizarAlucinacoes(estado === 'op-san-zero' ? 'zero' : estado === 'op-san-baixa' ? 'baixa' : null, completo());
}

function montarCamadaSanidade() {
	if (document.getElementById('op-san-veu')) return;
	const veu = document.createElement('div');
	veu.id = 'op-san-veu';
	veu.setAttribute('aria-hidden', 'true');
	document.body.append(veu);
}

/* --- registro ------------------------------------------------------------ */

/**
 * Com o Dice So Nice, espera os dados 3D pararem antes do efeito (e do som).
 * Se a rolagem não for animada neste computador (cega, desligada, mensagem sem dados), segue logo;
 * o limite de 10 s evita esperar para sempre se o Dice So Nice não avisar.
 */
function esperarDados(message) {
	if (!message.rolls?.length || !game.dice3d?.waitFor3DAnimationByMessageID) return Promise.resolve();
	return Promise.race([
		game.dice3d.waitFor3DAnimationByMessageID(message.id).catch(() => null),
		new Promise(r => setTimeout(r, 10000))
	]);
}

export function registrarEfeitos() {
	Hooks.on('createChatMessage', async (message) => {
		if (!ligado()) return;
		const f = message.flags?.[SYSTEM_ID];
		if (!f || !(f.dano || f.ritual || f.ataque || f.poder)) return;
		await esperarDados(message);
		try {
			if (f.danoDe && f.dano) efeitoDano(message, f.dano, f.danoDe);
			else if (f.ritual) efeitoRitual(message, f.ritual);
			else if (f.ataque) efeitoAtaque(message, f.ataque);
			else if (f.poder) efeitoPoder(message, f.poder);
		} catch (err) { console.warn(`${SYSTEM_ID} | efeito visual`, err); }
	});
	// Resultado gravado no cartão (rolagem no próprio cartão): efeito na hora, os dados 3D já pararam.
	Hooks.on('updateChatMessage', (message, changes) => {
		if (!ligado()) return;
		const novo = changes?.flags?.[SYSTEM_ID]?.resultados;
		if (!novo) return;
		try {
			if (novo.ataque) efeitoAtaque(message, novo.ataque);
			for (const d of Object.values(novo.danos ?? {})) if (d?.total != null) efeitoDano(message, d, message.id);
		} catch (err) { console.warn(`${SYSTEM_ID} | efeito visual`, err); }
	});
	registrarDiferencas();
	Hooks.once('canvasReady', registrarTons);
	Hooks.once('ready', () => { montarCamadaSanidade(); atualizarTelaSanidade(); });
	Hooks.on('updateUser', (user) => { if (user === game.user) atualizarTelaSanidade(); });
}

export const _teste = { anel, feixe, corte, texto, tremer, explosao };
