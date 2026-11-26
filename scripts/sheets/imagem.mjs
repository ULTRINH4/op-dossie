/**
 * Trocar a imagem de atores e itens pelas fichas.
 * Não usa o editImage do Foundry: ele exige data-edit no botão, e ao salvar a ficha o Foundry lê
 * o innerHTML de qualquer [data-edit] que não seja <img>, gravando "<img src=...>" no campo img.
 */

/** Ação das fichas: abre o seletor de arquivos e grava só o caminho. */
export async function trocarImagem(event, target) {
	event.preventDefault();
	const doc = this.document;
	if (!doc?.isOwner) return;
	const FP = foundry.applications.apps.FilePicker.implementation;
	new FP({
		type: 'image',
		current: doc._source.img,
		callback: async (path) => {
			if (!path || path === doc._source.img) return;
			target.querySelector('img')?.setAttribute('src', path);
			await doc.update({ img: path });
		}
	}).render(true);
}

/** Tira o caminho de um img quebrado ("<img src=&quot;<img src=...>"...) ou devolve null se estiver bom. */
export function caminhoDaImagem(img) {
	if (typeof img !== 'string' || !img.trimStart().startsWith('<')) return null;
	let texto = img;
	// Desfaz as camadas de escape (&amp;quot; → &quot; → ").
	for (let i = 0; i < 8 && /&(amp|quot|lt|gt);/.test(texto); i++) {
		texto = texto.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
	}
	// O caminho real é o src mais interno: o último que não começa com "<".
	const srcs = [...texto.matchAll(/src\s*=\s*"([^"<>]+)"/g)].map(m => m[1].trim()).filter(Boolean);
	return srcs.at(-1) ?? '';
}

/** Mestre, ao abrir o mundo: conserta imagens que já foram gravadas como HTML. */
export async function repararImagens() {
	if (!game.user.isGM) return;
	const consertos = [];
	const conserta = async (doc) => {
		const caminho = caminhoDaImagem(doc._source.img);
		if (caminho === null) return;
		const img = caminho || doc.constructor.DEFAULT_ICON || 'icons/svg/mystery-man.svg';
		await doc.update({ img });
		consertos.push(doc.name);
	};
	for (const actor of game.actors) {
		await conserta(actor);
		for (const item of actor.items) await conserta(item);
	}
	for (const item of game.items) await conserta(item);
	for (const scene of game.scenes) {
		for (const token of scene.tokens) {
			if (token.actorLink || !token.actor) continue;
			await conserta(token.actor);
			for (const item of token.actor.items) await conserta(item);
		}
	}
	if (consertos.length) {
		console.info(`op-dossie | imagens consertadas: ${consertos.join(', ')}`);
		ui.notifications.info(`Imagens consertadas: ${consertos.join(', ')}.`);
	}
}
