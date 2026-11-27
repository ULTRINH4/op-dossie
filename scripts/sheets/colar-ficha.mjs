/**
 * Colar ficha: o mestre cola o texto de uma ficha de ameaça copiado de um PDF (o próprio livro, uma
 * aventura) e o sistema monta a ameaça, com ataques, ações e habilidades. É o caminho da versão pública
 * para ter as criaturas dos livros: cada mestre traz as do próprio material.
 */
import { lerFicha } from '../automation/ler-ficha.mjs';
import { iconeItem } from '../compendium/icones.mjs';
import { imagemAmeaca, tokenAmeaca } from '../compendium/convert.mjs';

const esc = (t) => foundry.utils.escapeHTML(String(t ?? ''));

export async function abrirColarFicha() {
	const r = await foundry.applications.api.DialogV2.wait({
		window: { title: 'Colar ficha de ameaça', icon: 'fa-solid fa-paste' },
		classes: ['op-dossie', 'op-colar'],
		position: { width: 620 },
		content: `<div class="op-colar__corpo">
			<p class="op-colar__dica">Copie a ficha inteira do PDF (do nome até a última ação) e cole abaixo. Depois confira a ficha criada: o texto de PDFs em duas colunas às vezes sai fora de ordem.</p>
			<label>Nome <input type="text" name="nome" placeholder="Deixe em branco para usar o nome da ficha"></label>
			<textarea name="texto" rows="16" placeholder="ZUMBI DE SANGUE&#10;SANGUE&#10;VD 20&#10;CRIATURA MÉDIO&#10;PRESENÇA PERTURBADORA DT 15 2d6 mental NEX 25%+ é imune&#10;..."></textarea>
		</div>`,
		buttons: [
			{ action: 'criar', label: 'Criar ameaça', icon: 'fa-solid fa-skull', default: true, callback: (ev, btn) => ({ nome: btn.form.elements.nome.value.trim(), texto: btn.form.elements.texto.value }) },
			{ action: 'cancelar', label: 'Cancelar' }
		],
		rejectClose: false
	});
	if (!r?.texto?.trim()) return null;
	return criarDaFicha(r.texto, { nome: r.nome || null });
}

/** Cria a ameaça a partir do texto colado e abre a ficha. */
export async function criarDaFicha(texto, { nome = null, pasta = null } = {}) {
	const f = lerFicha(texto, { nome });
	const img = imagemAmeaca(f.system);
	const itens = f.itens.map(i => ({ ...i, img: iconeItem(i.type, i.name, i.type === 'poder' ? (f.system.tipo === 'criatura' ? 'paranormal' : 'geral') : '', f.system.elemento) }));
	const actor = await Actor.create({ name: f.nome, type: 'ameaca', img, folder: pasta, system: f.system, items: itens, prototypeToken: tokenAmeaca(f.nome, img, f.system.tamanho) });
	if (!actor) return null;
	if (f.avisos.length) {
		ui.notifications.warn(`${actor.name}: confira a ficha. ${f.avisos.join(' ')}`, { permanent: true });
		await ChatMessage.create({ whisper: [game.user.id], speaker: { alias: 'OP Dossiê' }, content: `<div class="op-dossie op-chatcard"><p><strong>${esc(actor.name)}</strong> criada a partir do texto colado. Confira:</p><ul>${f.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` });
	} else ui.notifications.info(`${actor.name} criada a partir do texto colado.`);
	actor.sheet.render(true);
	return actor;
}
