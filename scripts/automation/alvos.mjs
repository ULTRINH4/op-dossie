/**
 * Alvos marcados (tecla T): leitura, resolução e marcação nos cartões de chat.
 */
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Alvos que o usuário marcou agora, com o necessário para o cartão. */
export function alvosAtuais() {
	return [...(game.user.targets ?? [])].map(t => ({
		uuid: t.document.uuid,
		nome: t.name,
		img: t.document.texture?.src ?? t.actor?.img ?? 'icons/svg/mystery-man.svg',
		defesa: t.actor?.system?.defesaTotal ?? t.actor?.system?.defesa ?? null
	}));
}

/** Ator de um alvo salvo no cartão (token pode ter sido apagado). */
export function atorDoAlvo(uuid) {
	try { return fromUuidSync(uuid)?.actor ?? null; } catch { return null; }
}

/** Nome do token alvo (dois zumbis do mesmo ator têm nomes diferentes). */
export function nomeDoAlvo(uuid) {
	try { const d = fromUuidSync(uuid); return d?.name ?? d?.actor?.name ?? null; } catch { return null; }
}

/** Chave da perícia de resistência a partir do texto do ritual ("Fortitude", "Reflexos"...). */
export function chaveResistencia(texto) {
	const n = norm(texto);
	if (n.startsWith('fort')) return 'fortitude';
	if (n.startsWith('refl')) return 'reflexos';
	if (n.startsWith('vont')) return 'vontade';
	if (n.startsWith('intu')) return 'intuicao';
	if (n.startsWith('atle')) return 'atletismo';
	if (n.startsWith('acro')) return 'acrobacia';
	return null;
}

const esc = (s) => foundry.utils.escapeHTML?.(String(s ?? '')) ?? String(s ?? '');

/**
 * Lista de alvos para o cartão.
 * @param {object[]} alvos
 * @param {object} [o]
 * @param {number} [o.ataque]   total do ataque: marca acertou/errou contra a Defesa
 * @param {string} [o.pericia]  perícia de resistência do ritual
 * @param {number} [o.dt]       DT de resistência
 */
export function htmlAlvos(alvos, { ataque = null, pericia = null, dt = null } = {}) {
	if (!alvos?.length) return '';
	const chave = chaveResistencia(pericia);
	const itens = alvos.map(a => {
		let estado = '';
		if (ataque != null && a.defesa != null) {
			const acertou = ataque >= a.defesa;
			estado = `<span class="op-target__state ${acertou ? 'is-hit' : 'is-miss'}">${acertou ? 'acertou' : 'errou'}</span>`;
		}
		const resistir = chave && dt
			? `<button type="button" class="op-target__btn" data-op-resist="${a.uuid}" data-pericia="${chave}" data-dt="${dt}" aria-label="Rolar ${esc(pericia)} de ${esc(a.nome)}">Resistir</button>`
			: '';
		const defesa = a.defesa != null && ataque != null ? `<span class="op-target__def">Defesa ${a.defesa}</span>` : '';
		return `<li class="op-target" data-alvo="${a.uuid}"><img src="${a.img}" alt=""><span class="op-target__name">${esc(a.nome)}</span>${defesa}${estado}${resistir}</li>`;
	}).join('');
	return `<ul class="op-targets" aria-label="Alvos">${itens}</ul>`;
}

/** Atributo data-op-alvos para botões de dano. */
export function attrAlvos(alvos) {
	return alvos?.length ? ` data-op-alvos="${alvos.map(a => a.uuid).join(',')}"` : '';
}
