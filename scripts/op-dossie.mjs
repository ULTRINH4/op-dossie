/**
 * Ordem Paranormal: Dossiê — sistema não oficial para Foundry VTT.
 * Ordem Paranormal RPG foi criado por Rafael Lange (Cellbit) e publicado pela Jambô Editora.
 */
import { SYSTEM_ID } from './config.mjs';
import { AgenteData } from './data/agente.mjs';
import { AmeacaData } from './data/ameaca.mjs';
import { ITEM_MODELS } from './data/itens.mjs';
import { OpActor, OpItem, OpCombatant } from './documents.mjs';
import { AgenteSheet } from './sheets/agente-sheet.mjs';
import { AmeacaSheet } from './sheets/ameaca-sheet.mjs';
import { registerItemSheets } from './sheets/item-sheet.mjs';
import { loadData, registerSettings } from './rules/table-rules.mjs';
import { TableRulesApp } from './rules/table-rules-app.mjs';
import { registerActorOverride } from './rules/actor-override.mjs';
import { refreshActors } from './rules/refresh.mjs';
import { registerImporterSettings, syncCompendiums } from './compendium/importer.mjs';
import { registrarBotoesChat } from './dice/testes.mjs';
import { registrarCustoParanormal } from './automation/conjurar.mjs';
import { oferecerConversao, converterTudo } from './migration/sistema-antigo.mjs';
import { registrarCondicoes, registrarCondicoesAutomaticas } from './automation/condicoes.mjs';
import { registrarRegrasDeTurno } from './automation/opcionais.mjs';
import { registrarPoderes, interludio } from './automation/poderes.mjs';
import { registrarConfigEfeitos, registrarEfeitos } from './fx/efeitos.mjs';
import { registrarConfigSons } from './fx/sons.mjs';
import { registrarConfigAlucinacoes, alucinar } from './fx/alucinacoes.mjs';
import { repararImagens } from './sheets/imagem.mjs';
import { abrirCriacao } from './sheets/criacao.mjs';
import { registrarConfigFaixa, registrarFaixa } from './fx/faixa-turnos.mjs';
import { registrarConfigHud, registrarHud } from './fx/hud-combate.mjs';
import { registrarSocketCartoes } from './dice/no-cartao.mjs';
import { registrarDadoUso } from './automation/dado-uso.mjs';

const dataReady = loadData().catch(err => console.error(`${SYSTEM_ID} | data/*.json`, err));
const TPL = `systems/${SYSTEM_ID}/templates`;

Hooks.once('init', () => {
	CONFIG.Actor.documentClass = OpActor;
	CONFIG.Item.documentClass = OpItem;
	CONFIG.Combatant.documentClass = OpCombatant;
	CONFIG.Actor.dataModels = { agente: AgenteData, ameaca: AmeacaData };
	Object.assign(CONFIG.Item.dataModels, ITEM_MODELS);
	CONFIG.Actor.trackableAttributes = {
		agente: { bar: ['recursos.pv', 'recursos.pe', 'recursos.san', 'recursos.pd'], value: ['progressao.nex'] },
		ameaca: { bar: ['pv'], value: ['vd'] }
	};
	CONFIG.Item.typeLabels = { arma: 'arma', protecao: 'proteção', equipamento: 'equipamento', ritual: 'ritual', poder: 'poder', classe: 'classe', origem: 'origem', trilha: 'trilha' };

	const DSC = foundry.applications.apps.DocumentSheetConfig;
	DSC.registerSheet(Actor, SYSTEM_ID, AgenteSheet, { types: ['agente'], makeDefault: true, label: 'Dossiê — Agente' });
	DSC.registerSheet(Actor, SYSTEM_ID, AmeacaSheet, { types: ['ameaca'], makeDefault: true, label: 'Dossiê — Ameaça' });
	registerItemSheets();

	registerSettings(() => refreshActors());
	registerImporterSettings();
	game.settings.registerMenu(SYSTEM_ID, 'regrasMenu', {
		name: 'Regras da Mesa', label: 'Abrir Regras da Mesa',
		hint: 'Livros, progressão, recursos, personagens de NEX 0%, regras opcionais e o que pode ser escolhido na criação de personagem.',
		icon: 'fa-solid fa-scale-balanced', type: TableRulesApp, restricted: true
	});

	foundry.applications.handlebars.loadTemplates([
		`${TPL}/table-rules.hbs`, `${TPL}/partials/pill.hbs`,
		...['header', 'tabs', 'item-row', 'tab-skills', 'tab-combat', 'tab-rituals', 'tab-abilities', 'tab-inventory', 'tab-biography', 'tab-effects', 'ameaca'].map(n => `${TPL}/sheet/${n}.hbs`),
		`${TPL}/item/header.hbs`, `${TPL}/item/body.hbs`
	]).then(() => {
		Handlebars.registerPartial('opItemRow', Handlebars.partials[`${TPL}/sheet/item-row.hbs`]);
	});

	// Mensagens antigas (sistema anterior) guardam rolagens como D20Roll/BasicRoll: lê como Roll comum.
	for (const nome of ['D20Roll', 'BasicRoll', 'DamageRoll']) {
		if (CONFIG.Dice.rolls.some(r => r.name === nome)) continue;
		const Classe = { [nome]: class extends Roll {} }[nome];
		CONFIG.Dice.rolls.push(Classe);
	}

	registerActorOverride();
	registrarBotoesChat();
	registrarCustoParanormal();
	registrarCondicoes();
	registrarCondicoesAutomaticas();
	registrarRegrasDeTurno();
	registrarPoderes();
	registrarDadoUso();
	registrarConfigEfeitos();
	registrarConfigSons();
	registrarConfigAlucinacoes();
	registrarConfigFaixa();
	registrarFaixa();
	registrarConfigHud();
	registrarHud();
	registrarEfeitos();
	game.system.api = {
		regras: () => new TableRulesApp().render(true),
		reimportarCompendios: () => syncCompendiums({ force: true }),
		converterSistemaAntigo: () => converterTudo(),
		interludio: () => interludio(),
		/** Assistente de criação: sem argumento cria um agente novo; com um agente, preenche esse. */
		novoAgente: (actor) => abrirCriacao(actor ?? null),
		/** Teste: dispara uma alucinação na própria tela (sussurro, batimento, vulto, chat ou distorcao). */
		alucinar: (tipo) => alucinar(tipo)
	};
});

Hooks.once('ready', async () => {
	registrarSocketCartoes();
	await dataReady;
	refreshActors();
	await syncCompendiums();
	await oferecerConversao();
	await repararImagens().catch(err => console.error(`${SYSTEM_ID} | reparar imagens`, err));
});

Hooks.on('renderActorDirectory', (app, html) => {
	const lugar = html.querySelector('.header-actions') ?? html.querySelector('.directory-header');
	if (game.user.can('ACTOR_CREATE') && !html.querySelector('.op-dossie-novo-btn')) {
		const novo = document.createElement('button');
		novo.type = 'button';
		novo.className = 'op-dossie-novo-btn';
		novo.innerHTML = '<i class="fa-solid fa-id-card" aria-hidden="true"></i> Novo agente';
		novo.addEventListener('click', () => abrirCriacao());
		lugar?.append(novo);
	}
	if (!game.user.isGM || html.querySelector('.op-dossie-rules-btn')) return;
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'op-dossie-rules-btn';
	btn.innerHTML = '<i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> Regras da Mesa';
	btn.addEventListener('click', () => new TableRulesApp().render(true));
	lugar?.append(btn);
});
