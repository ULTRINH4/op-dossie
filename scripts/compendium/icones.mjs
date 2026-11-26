/**
 * Escolha de ícone para cada item. Os arquivos ficam em assets/ e são gerados por tools/gerar-icones.mjs.
 * - Rituais: um sigilo próprio por ritual (assets/sigilos/<id>.svg).
 * - Origens: um emblema com monograma por origem (assets/origens/<id>.svg).
 * - Demais: desenho por tipo (assets/icones/<nome>.svg), com variação por elemento quando faz sentido.
 */
const BASE = 'systems/op-dossie/assets';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function iconeRitual(id) {
	return `${BASE}/sigilos/${id}.svg`;
}

const ARMAS = [
	[/faca|adaga|canivete|punhal|bisturi|estilete/, 'faca'],
	[/machad|machete|foice|cutelo|serra/, 'machado'],
	[/martelo|marreta|taco|bastao|porrete|cassetete|coronha|clava|tonfa|vara/, 'bastao'],
	[/espada|katana|lamina|florete|sabre|gladio/, 'espada'],
	[/lanca|baioneta|tridente|alabarda|picareta/, 'lanca'],
	[/arco|besta/, 'arco'],
	[/pistola|revolver/, 'pistola'],
	[/escopeta|espingarda/, 'escopeta'],
	[/fuzil|rifle|carabina|metralhadora|submetralhadora|smg/, 'fuzil'],
	[/granada|explosiv|dinamite|coquetel|mina|lanca-chamas|lanca chamas/, 'explosivo'],
	[/shuriken|dardo|arremesso|faca de arremesso/, 'arremesso'],
	[/soco|manopla|punho|garra/, 'punho']
];
const EQUIP = [
	[/municao|bala|cartucho|flecha|virote|carregador/, 'municao'],
	[/kit medico|medic|cicatrizante|curativo|remedio|antibio|analges|estimulante|sedativ|adrenalina|seringa/, 'medico'],
	[/lanterna|sinalizador|vela|holofote/, 'lanterna'],
	[/celular|telefone|radio|notebook|computador|tablet|camera|gravador|drone|bateria|detector|scanner|medidor/, 'eletronico'],
	[/livro|grimorio|manual|tabula|diario|caderno|mapa/, 'livro'],
	[/corda|gancho|arpeu/, 'corda'],
	[/algema|corrente/, 'algema'],
	[/binoculo|oculos|lente|luneta|mira/, 'optico'],
	[/mochila|bolsa|maleta|bandoleira|coldre/, 'mochila'],
	[/ferrament|pe de cabra|chave|kit|alicate|gazua/, 'ferramenta'],
	[/cao|cachorro|animal|gato/, 'animal'],
	[/carro|moto|veiculo|van/, 'veiculo'],
	[/carregador|silenciador|modific|acoplad/, 'modificacao']
];

/**
 * @param {string} tipo   arma | protecao | equipamento | poder | trilha | classe | origem
 * @param {string} id     id da entrada
 * @param {string} [sub]  subtipo/tipo de poder/classe
 * @param {string} [elemento]
 */
export function iconeItem(tipo, id, sub = '', elemento = '') {
	const n = norm(id) + ' ' + norm(sub);
	const EL_OK = ['sangue', 'morte', 'conhecimento', 'energia', 'medo'];
	const comEl = (nome) => EL_OK.includes(elemento) ? `${nome}-${elemento}` : nome;
	switch (tipo) {
		case 'arma': {
			const hit = ARMAS.find(([re]) => re.test(n));
			return `${BASE}/icones/${hit ? hit[1] : (/fogo|disparo/.test(n) ? 'pistola' : 'espada')}.svg`;
		}
		case 'protecao':
			return `${BASE}/icones/${/escudo/.test(n) ? 'escudo' : /pesad/.test(n) ? 'armadura' : 'colete'}.svg`;
		case 'equipamento': {
			if (/amaldicoad/.test(n)) return `${BASE}/icones/${comEl('amaldicoado')}.svg`;
			if (/catalis|componente/.test(n)) return `${BASE}/icones/${comEl('componente')}.svg`;
			if (/paranormal/.test(n) && elemento) return `${BASE}/icones/${comEl('paranormal')}.svg`;
			const hit = EQUIP.find(([re]) => re.test(n));
			return `${BASE}/icones/${hit ? hit[1] : 'caixa'}.svg`;
		}
		case 'poder': {
			if (sub === 'paranormal') return `${BASE}/icones/${comEl('poder-paranormal')}.svg`;
			if (sub === 'origem') return `${BASE}/icones/poder-origem.svg`;
			if (sub === 'geral') return `${BASE}/icones/poder-geral.svg`;
			if (sub === 'complicacao') return `${BASE}/icones/complicacao.svg`;
			if (sub === 'classe') return `${BASE}/icones/poder-classe.svg`;
			return `${BASE}/icones/poder-geral.svg`;
		}
		case 'trilha': return `${BASE}/icones/trilha-${sub || 'combatente'}.svg`;
		case 'classe': return `${BASE}/icones/classe-${id}.svg`;
		case 'origem': return `${BASE}/origens/${id}.svg`;
		default: return `${BASE}/icones/caixa.svg`;
	}
}
