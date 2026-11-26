/**
 * Documentos do sistema: Actor, Item e Combatant.
 */
import { SYSTEM_ID, ATRIBUTOS, PERICIAS, TIPOS_DANO } from './config.mjs';
import { rolarTeste, rolarAtaque, formulaTeste } from './dice/testes.mjs';
import { penalidadeDados, modsCondicoes } from './automation/condicoes.mjs';

export class OpActor extends Actor {
	/** Teste de atributo. */
	rolarAtributo(chave, { event } = {}) {
		const valor = this.system.atributos?.[chave]?.valor ?? 0;
		const pen = penalidadeDados(this, { atributo: chave });
		return rolarTeste({ actor: this, dados: valor - pen.n, bonus: 0, titulo: `Teste de ${ATRIBUTOS[chave]?.nome ?? chave}`, event, nota: pen.nota });
	}

	/** PE (ou PD) disponível, contando o temporário. */
	recursoDisponivel(pool) {
		const r = this.system.recursos?.[pool];
		return r ? r.valor + (r.temp ?? 0) : 0;
	}

	/** Atualização para gastar PE (ou PD): o temporário vai primeiro. */
	gastoDe(pool, custo) {
		const r = this.system.recursos[pool];
		const doTemp = Math.min(r.temp ?? 0, custo);
		return { [`system.recursos.${pool}.temp`]: (r.temp ?? 0) - doTemp, [`system.recursos.${pool}.valor`]: r.valor - (custo - doTemp) };
	}

	/** Dados, bônus e nome de um teste de perícia (agente) ou de teste listado (ameaça). */
	dadosTeste(chave) {
		if (this.type === 'ameaca') {
			const t = this.system[chave] ?? this.system.pericias?.find(p => p.nome === chave);
			const pen = penalidadeDados(this, { pericia: PERICIAS[chave] ? chave : null, atributo: PERICIAS[chave] ? null : 'nenhum' });
			return { dados: (t?.dados ?? 1) - pen.n, bonus: t?.bonus ?? 0, nome: PERICIAS[chave]?.nome ?? chave, nota: pen.nota };
		}
		const c = this.system.periciasCalc?.[chave];
		const def = PERICIAS[chave];
		if (!c || !def) return null;
		const pen = penalidadeDados(this, { pericia: chave });
		return { dados: c.dados - pen.n, bonus: c.total, nome: def.nome, nota: pen.nota };
	}

	/** Teste de perícia (agente) ou de teste listado (ameaça). */
	rolarPericia(chave, { event, dt } = {}) {
		if (this.type === 'ameaca') {
			const t = this.system[chave] ?? this.system.pericias?.find(p => p.nome === chave);
			const pen = penalidadeDados(this, { pericia: PERICIAS[chave] ? chave : null, atributo: PERICIAS[chave] ? null : 'nenhum' });
			return rolarTeste({ actor: this, dados: (t?.dados ?? 1) - pen.n, bonus: t?.bonus ?? 0, titulo: PERICIAS[chave]?.nome ?? chave, event, dt, nota: pen.nota });
		}
		const c = this.system.periciasCalc?.[chave];
		const def = PERICIAS[chave];
		if (!c || !def) return null;
		const p = this.system.pericias[chave];
		const nome = def.livre && p.nome ? `${def.nome} (${p.nome})` : def.nome;
		const pen = penalidadeDados(this, { pericia: chave });
		return rolarTeste({ actor: this, dados: c.dados - pen.n, bonus: c.total, titulo: nome, event, dt, nota: pen.nota });
	}

	/**
	 * Aplica dano considerando resistências. Dano mental vai para a Sanidade (ou PD sem Sanidade).
	 * @returns {Promise<number>} dano efetivo
	 */
	async aplicarDano(valor, tipo) {
		let dano = Math.max(Number(valor) || 0, 0);
		const s = this.system;
		if (this.type === 'ameaca') {
			if (s.imunidades?.includes(tipo)) dano = 0;
			else {
				if (s.vulnerabilidades?.includes(tipo)) dano *= 2;
				dano = Math.max(dano - (s.resistencias?.[tipo] ?? 0) - modsCondicoes(this).rd, 0);
			}
			await this.update({ 'system.pv.valor': s.pv.valor - dano });
			return this.#avisarDano(dano, tipo);
		}
		dano = Math.max(dano - (s.resistencias?.[tipo] ?? 0) - (tipo === 'mental' ? 0 : modsCondicoes(this).rd), 0);
		if (tipo === 'mental') {
			const k = s.semSanidade ? 'pd' : 'san';
			await this.update({ [`system.recursos.${k}.valor`]: Math.max(s.recursos[k].valor - dano, 0) });
			return this.#avisarDano(dano, tipo, k === 'pd' ? 'PD' : 'SAN');
		}
		const temp = s.recursos.pv.temp;
		const doTemp = Math.min(temp, dano);
		const pvDepois = s.recursos.pv.valor - (dano - doTemp);
		await this.update({
			'system.recursos.pv.temp': temp - doTemp,
			'system.recursos.pv.valor': pvDepois
		});
		// Dano massivo: metade ou mais dos PV de uma vez, sem zerar (OPRPG p. 88).
		const { verificarDanoMassivo } = await import('./automation/opcionais.mjs');
		await verificarDanoMassivo(this, dano, pvDepois);
		return this.#avisarDano(dano, tipo);
	}

	async curar(valor, recurso = 'pv') {
		const v = Math.max(Number(valor) || 0, 0);
		if (this.type === 'ameaca') {
			const pv = this.system.pv;
			await this.update({ 'system.pv.valor': Math.min(pv.valor + v, pv.max) });
		} else {
			const r = this.system.recursos[recurso];
			await this.update({ [`system.recursos.${recurso}.valor`]: Math.min(r.valor + v, r.max) });
		}
		ui.notifications.info(`${this.name} recupera ${v} ${recurso.toUpperCase()}.`);
		return v;
	}

	#avisarDano(dano, tipo, alvo = 'PV') {
		const nome = TIPOS_DANO[tipo] ? ` de ${TIPOS_DANO[tipo].toLowerCase()}` : '';
		ui.notifications.info(`${this.name} sofre ${dano} ${alvo}${nome}.`);
		return dano;
	}

	getRollData() {
		return this.system.getRollData?.() ?? super.getRollData();
	}
}

export class OpItem extends Item {
	/** Usar o item a partir da ficha: arma ataca, ritual conjura, o resto vai para o chat. */
	async usar({ event } = {}) {
		if (this.type === 'arma' && this.actor) {
			const { gastarAcao } = await import('./automation/acoes.mjs');
			if (!(await gastarAcao(this.actor, 'padrao', { item: this }))) return null;
			return rolarAtaque({ actor: this.actor, item: this, event });
		}
		if (this.type === 'poder' && this.actor) {
			const { usarPoder } = await import('./automation/poderes.mjs');
			return usarPoder(this.actor, this);
		}
		if (this.type === 'ritual' && this.actor) {
			const { conjurarRitual } = await import('./automation/conjurar.mjs');
			return conjurarRitual(this.actor, this);
		}
		if (this.type === 'equipamento' && this.actor) {
			const { usaDadoUso, usarComDadoUso } = await import('./automation/dado-uso.mjs');
			if (usaDadoUso(this)) {
				// Usar um consumível (medicamento, componente…) é uma ação padrão.
				const { gastarAcao } = await import('./automation/acoes.mjs');
				if (!(await gastarAcao(this.actor, 'padrao', { item: this }))) return null;
				return usarComDadoUso(this);
			}
		}
		return this.mostrarNoChat();
	}

	async mostrarNoChat() {
		const TE = foundry.applications.ux.TextEditor.implementation;
		const texto = await TE.enrichHTML(this.system.descricao ?? '', { relativeTo: this });
		return ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			content: `<div class="op-dossie op-chatcard">
				<header class="op-chatcard__head"><img src="${this.img}" alt=""><div><h3>${this.name}</h3></div></header>
				<div class="op-chatcard__text">${texto}</div></div>`
		});
	}
}

export class OpCombatant extends Combatant {
	/** Iniciativa: teste de Iniciativa (Agilidade). */
	_getInitiativeFormula() {
		const a = this.actor;
		if (!a) return '1d20';
		const pen = penalidadeDados(a, { pericia: 'iniciativa' }).n;
		if (a.type === 'ameaca') return formulaTeste(a.system.iniciativa.dados - pen, a.system.iniciativa.bonus);
		const c = a.system.periciasCalc?.iniciativa;
		return formulaTeste((c?.dados ?? 1) - pen, c?.total ?? 0);
	}
}

export { SYSTEM_ID };
