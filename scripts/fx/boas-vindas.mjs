/**
 * Tela de boas-vindas com o selo da Licença da Comunidade de Ordem Paranormal e os avisos obrigatórios
 * (conteúdo não oficial, material gerado por IA, conteúdo sensível). Aparece uma vez por computador e
 * de novo quando a versão do aviso mudar; também abre pelo menu de configurações do sistema.
 */
import { SYSTEM_ID } from '../config.mjs';

/** Suba este número quando o texto dos avisos mudar, para todos verem de novo. */
const VERSAO_AVISO = 1;

export function abrirBoasVindas() {
	const selo = `systems/${SYSTEM_ID}/assets/licenca/selo-branco.png`;
	return foundry.applications.api.DialogV2.prompt({
		window: { title: 'OP Dossiê', icon: 'fa-solid fa-id-card' },
		classes: ['op-dossie', 'op-boas-vindas'],
		position: { width: 560 },
		content: `<div class="op-bv">
			<img class="op-bv__selo" src="${selo}" alt="Selo da Licença da Comunidade de Ordem Paranormal: não oficial, não canônico">
			<div class="op-bv__avisos">
				<p><strong>Este é um conteúdo não oficial, publicado sob a Licença da Comunidade de Ordem Paranormal.</strong></p>
				<p><strong>Contém material gerado por inteligência artificial.</strong></p>
				<p>Aviso de conteúdo: temas de terror, violência e morte.</p>
			</div>
			<p class="op-bv__creditos">Ordem Paranormal RPG foi criado por Rafael Lange (Cellbit) e publicado pela Jambô Editora.
			Este sistema não tem vínculo, parceria nem aprovação deles e não traz os textos dos livros.
			<a href="https://ordemparanormal.com.br/licenca" target="_blank" rel="noopener">Licença da Comunidade</a> ·
			<a href="https://github.com/ULTRINH4/op-dossie" target="_blank" rel="noopener">Projeto e créditos</a></p>
		</div>`,
		ok: { label: 'Entendi', icon: 'fa-solid fa-check' },
		rejectClose: false
	});
}

/** Menu nas configurações para abrir de novo. */
class BoasVindasMenu extends foundry.applications.api.ApplicationV2 {
	async render() { await abrirBoasVindas(); return this; }
}

export function registrarBoasVindas() {
	game.settings.register(SYSTEM_ID, 'avisoLicencaVisto', { scope: 'client', config: false, type: Number, default: 0 });
	game.settings.registerMenu(SYSTEM_ID, 'avisoLicencaMenu', {
		name: 'Licença e créditos', label: 'Ver aviso da licença',
		hint: 'Selo da Licença da Comunidade de Ordem Paranormal, avisos e créditos do sistema.',
		icon: 'fa-solid fa-stamp', type: BoasVindasMenu, restricted: false
	});
	Hooks.once('ready', async () => {
		if (game.settings.get(SYSTEM_ID, 'avisoLicencaVisto') >= VERSAO_AVISO) return;
		await abrirBoasVindas();
		await game.settings.set(SYSTEM_ID, 'avisoLicencaVisto', VERSAO_AVISO);
	});
}
