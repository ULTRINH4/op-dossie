/**
 * Movimento só na vez: com o combate iniciado, o jogador só move o token de quem está na vez.
 * Vale para tokens que estão no combate; os demais e o mestre movem à vontade.
 * Recusa o movimento (arrastar e teclado) e nem deixa começar a arrastar.
 */
import { SYSTEM_ID } from '../config.mjs';

export function registrarConfigMovimento() {
	game.settings.register(SYSTEM_ID, 'movimentoNaVez', {
		name: 'Movimento só na vez',
		hint: 'Com o combate iniciado, os jogadores só movem o token de quem está na vez. O mestre move qualquer token.',
		scope: 'world', config: true, type: Boolean, default: true
	});
}

/** Motivo para recusar o movimento deste token agora, ou null se pode mover. */
export function bloqueioDeMovimento(tokenDoc, user = game.user) {
	if (!tokenDoc || user.isGM || !game.settings.get(SYSTEM_ID, 'movimentoNaVez')) return null;
	const cena = tokenDoc.parent?.id;
	for (const combat of game.combats) {
		if (!combat.started) continue;
		if (combat.scene && combat.scene.id !== cena) continue;
		if (!combat.combatants.some(c => c.tokenId === tokenDoc.id)) continue;
		if (combat.combatant?.tokenId === tokenDoc.id) return null;
		return `Não é a vez de ${tokenDoc.name}. Espere o seu turno para mover.`;
	}
	return null;
}

export function registrarMovimento() {
	// Nem começa a arrastar fora da vez.
	const Base = CONFIG.Token.objectClass;
	CONFIG.Token.objectClass = class OpToken extends Base {
		_canDrag(user, event) {
			if (bloqueioDeMovimento(this.document, user)) return false;
			return super._canDrag(user, event);
		}
	};
	// Teclado, régua e qualquer outro caminho: recusa o movimento.
	let ultimoAviso = 0;
	Hooks.on('preMoveToken', (tokenDoc) => {
		const motivo = bloqueioDeMovimento(tokenDoc);
		if (!motivo) return;
		if (Date.now() - ultimoAviso > 1500) { ui.notifications.warn(motivo); ultimoAviso = Date.now(); }
		return false;
	});
}
