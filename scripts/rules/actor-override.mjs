/**
 * Exceção de regras por personagem: botão no cabeçalho da ficha (só mestre)
 * e aviso dentro da ficha quando o personagem segue regras diferentes.
 */
import { MOD, DATA, ACTOR_OVERRIDABLE, actorOverride, worldRules, warningsFor, rulesFor, choiceName } from './table-rules.mjs';
import { refreshActors } from './refresh.mjs';

export function registerActorOverride() {
	Hooks.on('getHeaderControlsActorSheetV2', (app, controls) => {
		if (!game.user.isGM || app.document?.type !== 'agente') return;
		controls.push({
			icon: 'fa-solid fa-scale-unbalanced',
			label: 'Regras deste personagem',
			action: 'opFichaOverride',
			onClick: () => openOverrideDialog(app.document)
		});
	});

	// Faixa de aviso no topo da ficha quando há exceção.
	Hooks.on('renderActorSheetV2', (app, element) => {
		const actor = app.document;
		if (actor?.type !== 'agente') return;
		element.querySelector('.op-dossie-exception')?.remove();
		const o = actorOverride(actor);
		if (!o) return;
		const parts = Object.entries(o).map(([k, v]) => choiceName(k, v));
		const bar = document.createElement('div');
		bar.className = 'op-dossie-exception';
		bar.setAttribute('role', 'note');
		bar.innerHTML = `<i class="fa-solid fa-scale-unbalanced" aria-hidden="true"></i><span>Regras próprias: ${parts.join(' · ')}</span>`;
		const content = element.querySelector('.window-content');
		content?.prepend(bar);
	});
}

async function openOverrideDialog(actor) {
	const world = worldRules();
	const current = actorOverride(actor) ?? {};
	const fields = ACTOR_OVERRIDABLE.map(group => {
		const def = DATA.regras.escolhas[group];
		const allowed = def.opcoes.filter(o => o.livro !== 'sah' || world.livros.sah);
		const options = [`<option value="">Igual à mesa (${choiceName(group, world[group])})</option>`]
			.concat(allowed.map(o => `<option value="${o.id}" ${current[group] === o.id ? 'selected' : ''}>${o.nome}</option>`));
		return `<div class="form-group"><label for="op-ov-${group}">${def.nome}</label>
			<select id="op-ov-${group}" name="${group}">${options.join('')}</select></div>`;
	}).join('');

	const result = await foundry.applications.api.DialogV2.wait({
		window: { title: `Regras de ${actor.name}`, icon: 'fa-solid fa-scale-unbalanced' },
		classes: ['op-dossie', 'op-override'],
		content: `<p class="op-lead">Use para um personagem que segue regras diferentes da mesa, como um sobrevivente num grupo de agentes.</p>${fields}`,
		buttons: [
			{ action: 'clear', label: 'Remover exceção', icon: 'fa-solid fa-eraser' },
			{
				action: 'save', label: 'Salvar', icon: 'fa-solid fa-check', default: true,
				callback: (event, button) => Object.fromEntries(new FormData(button.form).entries())
			}
		],
		rejectClose: false
	});
	if (!result) return;

	if (result === 'clear') {
		await actor.unsetFlag(MOD, 'excecao');
	} else {
		const picked = Object.fromEntries(Object.entries(result).filter(([, v]) => v));
		await actor.unsetFlag(MOD, 'excecao');
		if (Object.keys(picked).length) await actor.setFlag(MOD, 'excecao', picked);
	}
	for (const w of warningsFor(rulesFor(actor))) ui.notifications.warn(w);
	refreshActors([actor]);
}
