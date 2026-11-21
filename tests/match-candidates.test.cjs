const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const catalogue = [
	{
		n: 'first',
		c: 'First supermarket',
		u: 'https://example.test/',
		d: [
			{ n: 'Merk Griekse yoghurt', l: 'small', p: 1.29, s: '150 g' },
			{ n: 'Merk Griekse yoghurt', l: 'large', p: 2.6, s: '500 g' },
			{ n: 'Merk Griekse yoghurt', l: 'large', p: 3.4, s: '500 g' },
			{ n: 'Merk Griekse yoghurt naturel', l: 'medium', p: 2.1, s: '300 g' },
			{ n: 'Andere Griekse yoghurt naturel', p: 2.05, s: '150 g' },
			{ n: 'Merk Griekse yoghurt naturel', l: 'twin', p: 3.2, s: '2 x 500 g' },
			{ n: 'Merk Griekse yoghurt naturel', l: 'bulk', p: 5.9, s: '2 kg' },
			{ n: 'Andere Griekse yoghurt aardbei', p: 0.95, s: '500 g' },
			{ n: 'IJs Griekse yoghurt', p: 0.69, s: '500 g' },
			{ n: 'Merk Griekse yoghurt coupon', p: 0.01, s: '500 g' },
			{ n: 'Huismerk Volle Melk', l: 'milk', p: 2.85, s: '1,5 L' },
			{ n: 'Doos Volle Melk', l: 'box', p: 5.94, s: '6 × 33 cl' },
			{ n: 'Volle Melk Familie', l: 'family', p: 1.89, s: '900 mililiters' },
			{ n: 'Olijven los', p: 8.9, s: 'per kilo' },
			{ n: 'Tomaten blik', p: 2.2, s: 'Per 400 g' },
			{ n: 'Gemengd pakket', p: 2.8, s: '200 g + 200 ml' },
			{ n: 'Vuilniszakken 60 L', p: 2.3, s: '20 stuks' },
			{ n: 'Maatbeker 1 L', p: 2.04, s: '' },
			{ n: 'Ongewogen artikel', p: 2.1, s: '0 g' }
		]
	},
	{
		n: 'second',
		c: 'Second supermarket',
		d: [
			{ n: 'Andere Griekse yoghurt', p: 1.3, s: '170 g' },
			{ n: 'IJs Merk Griekse yoghurt', p: 0.63, s: '100 g' }
		]
	},
	{ n: 'third', c: 'Third supermarket', d: [] }
];

function createSearchEnvironment(stores = catalogue)
{
	let fetches = 0;
	const browser = vm.createContext({
		localStorage: { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); } },
		fetch: async () => {
			fetches++;
			return { ok: true, headers: new Headers({ 'Last-Modified': 'Tue, 17 Nov 2026 10:00:00 GMT' }), json: async () => stores };
		}
	});
	browser.window = browser;
	for (const file of ['js/checkjebon/checkjebon.js', 'js/site/grocery-terms.js', 'js/site/product-search.js'])
	{
		vm.runInContext(readFileSync(resolve(__dirname, '..', file), 'utf8'), browser, { filename: file });
	}
	return { browser, checkjebon: browser.checkjebon, fetchCount: () => fetches };
}

async function search(browse, query, overrides)
{
	const options = browse.browser.prepareSearchItem(query, 0, 'en');
	if (overrides) options.overrides = overrides;
	const stores = await browse.checkjebon.getPricesForProducts([options.query], [options]);
	return { options, product: stores[0].products[0], stores };
}

test('the picker shows one current item, three eligible alternatives and different pack sizes', async () => {
	const browse = createSearchEnvironment();
	const { options, product } = await search(browse, 'Greek yoghurt');
	assert.equal(product.amount, '150 g');
	assert.equal(product.price, 1.29);
	const { current, alternatives } = await browse.checkjebon.getProductAlternatives(options.query, options, 'first', product);
	assert.equal(current.productId, product.productId);
	assert.equal(current.unitPrice.price, 8.6);
	assert.equal(current.unitPrice.unit, 'kg');
	assert.deepEqual(Array.from(alternatives, match => match.amount), ['300 g', '500 g', '2 x 500 g']);
	assert.deepEqual(Array.from(alternatives, match => match.price), [2.1, 2.6, 3.2]);
	assert.deepEqual(Array.from(alternatives, match => match.unitPrice.price), [7, 5.2, 3.2]);
	assert.equal(alternatives[1].link, 'https://example.test/large');
});

test('a selected listing reprices the match, and survives catalogue reordering and price changes', async () => {
	const browse = createSearchEnvironment();
	const { options, product, stores } = await search(browse, 'Greek yoghurt');
	const { alternatives } = await browse.checkjebon.getProductAlternatives(options.query, options, 'first', product);
	const picked = alternatives.find(option => option.amount === '500 g');
	const selection = { first: picked.productId };
	const overridden = await search(browse, 'Greek yoghurt', selection);
	assert.equal(overridden.product.price, 2.6);
	assert.equal(overridden.stores[1].products[0].price, 1.3);
	assert.equal(overridden.stores[2].products[0].price, stores[2].products[0].price);
	assert.equal(overridden.stores[2].products[0].isEstimate, true);

	const updated = {
		...catalogue[0],
		d: catalogue[0].d.map(item => ({ ...item, p: item.l === 'large' ? 3.8 : item.p })).reverse()
	};
	const fresh = createSearchEnvironment([updated, ...catalogue.slice(1)]);
	const repriced = await search(fresh, 'Greek yoghurt', selection);
	assert.equal(repriced.product.productId, picked.productId);
	assert.equal(repriced.product.price, 3.8);
	const restored = await search(fresh, 'Greek yoghurt', { first: 'unavailable' });
	assert.equal(restored.product.price, 1.29);
	assert.equal(browse.fetchCount(), 1);
});

test('exact-title, quantity and store rules constrain alternatives and overrides', async () => {
	const browse = createSearchEnvironment();
	const named = await search(browse, 'Merk Griekse yoghurt');
	const atOtherStore = await browse.checkjebon.getProductAlternatives(named.options.query, named.options, 'second', named.stores[1].products[0]);
	assert.equal(atOtherStore.current, null);
	assert.equal(atOtherStore.alternatives.length, 0);
	const ownStore = await browse.checkjebon.getProductAlternatives(named.options.query, named.options, 'first', named.product);
	assert.deepEqual(Array.from(ownStore.alternatives, candidate => candidate.amount), ['500 g']);

	const requestedSize = await search(browse, '500 g Greek yoghurt', { first: named.product.productId });
	assert.equal(requestedSize.product.amount, '500 g');
	const choices = await browse.checkjebon.getProductAlternatives(requestedSize.options.query, requestedSize.options, 'first', requestedSize.product);
	assert.deepEqual(Array.from(choices.alternatives, candidate => candidate.amount), ['2 x 500 g', '2 kg']);

	const candidateFromOtherStore = named.stores[1].products[0].productId;
	assert.equal(candidateFromOtherStore, undefined);
	const broad = await search(browse, 'Greek yoghurt');
	const foreign = await search(browse, 'Greek yoghurt', { first: broad.stores[1].products[0].productId });
	assert.equal(foreign.product.price, broad.product.price);
});

test('a measured pack gives a unit price including multipacks and decimal volumes', async () => {
	const browse = createSearchEnvironment();
	for (const [query, expectedPrice, expectedUnit] of [
		['Huismerk Volle Melk', 1.9, 'L'],
		['Doos Volle Melk', 3, 'L'],
		['Volle Melk Familie', 2.1, 'L'],
		['Olijven los', 8.9, 'kg'],
		['Tomaten blik', 5.5, 'kg'],
		['Gemengd pakket', null, null],
		['Vuilniszakken 60 L', null, null],
		['Maatbeker 1 L', null, null],
		['Ongewogen artikel', null, null]
	])
	{
		const { options, product } = await search(browse, query);
		const { current } = await browse.checkjebon.getProductAlternatives(options.query, options, 'first', product);
		assert.equal(current.unitPrice?.price ?? null, expectedPrice, query);
		assert.equal(current.unitPrice?.unit ?? null, expectedUnit, query);
	}
});

test('catalogue availability, alternatives and prices share an in-flight request', async () => {
	const browse = createSearchEnvironment();
	await Promise.all([
		browse.checkjebon.getSupermarkets(),
		search(browse, 'Greek yoghurt'),
		browse.checkjebon.getProductAlternatives('Greek yoghurt', null, 'first', null)
	]);
	assert.equal(browse.fetchCount(), 1);
	assert.equal(browse.checkjebon.pricesLastUpdated(), 'Tue, 17 Nov 2026 10:00:00 GMT');
	await browse.checkjebon.getSupermarkets();
	assert.equal(browse.fetchCount(), 1);
});

test('shopping plans honor selected stores when a shopping-list line is pinned', () => {
	const { checkjebon } = createSearchEnvironment();
	const stores = [
		{ code: 'first', products: [{ listIndex: 0, price: 3 }, { listIndex: 3, price: 2 }] },
		{ code: 'second', products: [{ listIndex: 0, price: 1 }, { listIndex: 3, price: 7 }] },
		{ code: 'third', products: [{ listIndex: 0, price: 6 }, { listIndex: 3, price: 1, isEstimate: true }] }
	];
	const codes = Array.from(stores, store => store.code);
	assert.equal(checkjebon.getShoppingPlanForPrices(stores, 2, codes).totalCost, 2);
	const pinned = checkjebon.getShoppingPlanForPrices(stores, 2, codes, new Map([[3, 'first']]));
	assert.equal(pinned.totalCost, 3);
	assert.deepEqual(Array.from(pinned.supermarkets, store => store.code), ['first', 'second']);
	assert.equal(pinned.supermarkets[0].products[0].listIndex, 3);
	const limited = checkjebon.getShoppingPlanForPrices(stores, 1, codes, new Map([[0, 'second']]));
	assert.equal(limited.totalCost, 8);
	assert.equal(limited.supermarkets[0].code, 'second');
	assert.equal(checkjebon.getShoppingPlanForPrices(stores, 2, codes, new Map([[3, 'third']])).totalCost, 2);
	assert.throws(() => checkjebon.getShoppingPlanForPrices(stores, 1, codes, new Map([[0, 'second'], [3, 'first']])), /exceed/);
});
