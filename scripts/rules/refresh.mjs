/** Recalcula os agentes e redesenha fichas abertas depois de uma mudança de regra. */
export function refreshActors(actors = game.actors) {
	for (const actor of actors) {
		if (actor.type !== 'agente') continue;
		actor.reset();
		actor.sheet?.rendered && actor.sheet.render();
	}
	for (const token of canvas?.tokens?.placeables ?? []) {
		if (token.actor?.type === 'agente' && !token.document.actorLink) token.actor.reset();
	}
}
