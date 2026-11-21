const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const catalogue = [
	{
		n: 'first',
		c: 'First supermarket',
		d: [
			{ n: 'AH Biologisch Kipfilet flinterdun', p: 3.29, s: '100 g' },
			{ n: 'AH Vuilniszakken 60l met sluitclip', p: 2.19, s: '20 stuks' },
			{ n: 'Van Dijk Rode linzen', p: 0.99, s: '250 g' },
			{ n: 'Van Dijk Rode linzen', p: 1.79, s: '500 g' },
			{ n: 'Van Dijk Rode linzen', p: 2.19, s: '750 g' },
			{ n: 'Merk Kaas jong 48+', p: 2.19, s: '200 g' },
			{ n: 'Merk Kaas jong 48', p: 0.89, s: '200 g' },
			{ n: 'Zakjes A+B [proef]', p: 1.19, s: '10 stuks' },
			{ n: 'Zakjes AB proef', p: 0.79, s: '10 stuks' },
			{ n: 'Halfvolle melk', p: 1.29, s: '1 l' },
			{ n: 'Huismerk Griekse yoghurt aardbei', p: 1.09, s: '500 g' },
			{ n: 'Huismerk Griekse yoghurt naturel', p: 0.89, s: '500 g' },
			{ n: 'IJs Griekse yoghurt aardbei', p: 0.69, s: '500 g' },
			{ n: 'Huismerk Kipfilet gerookt', p: 1.39, s: '100 g' },
			{ n: 'Huismerk Kipfilet naturel', p: 1.19, s: '100 g' },
			{ n: 'Sandwich kipfilet gerookt', p: 0.99, s: '130 g' },
			{ n: 'AH Oranje zoete aardappel', p: 1.69, s: '500 g' },
			{ n: 'AH Ovenfriet zoete aardappel', p: 0.99, s: '400 g' },
			{ n: 'Bonbébé Wortel 6+ maanden', p: 0.59, s: '125 g' },
			{ n: 'AH Waspeen', p: 1.19, s: '500 g' },
			{ n: 'Calvé Pindakaas', p: 2.99, s: '350 g' },
			{ n: 'Proteinereep met pindakaas', p: 1.09, s: '50 g' },
			{ n: 'Roomboter ongezouten', p: 1.89, s: '250 g' },
			{ n: 'Roomboter coupon', p: 0.01, s: '250 g' }
		]
	},
	{
		n: 'second',
		c: 'Second supermarket',
		d: [
			{ n: 'Salade met AH biologisch kipfilet flinterdun', p: 0.99, s: '150 g' },
			{ n: 'Volle melk', p: 1.39, s: '1 l' }
		]
	}
];

const browser = vm.createContext({
	fetch: async () => ({ ok: true, headers: new Headers(), json: async () => catalogue })
});
browser.window = browser;
for (const file of ['js/checkjebon/checkjebon.js', 'js/site/grocery-terms.js', 'js/site/product-search.js'])
{
	vm.runInContext(readFileSync(resolve(__dirname, '..', file), 'utf8'), browser, { filename: file });
}

test('Dutch catalogue names and English grocery terms can share an English list', async () => {
	const list = '  AH biologisch KIPFILET flinterdun  \nsemi-skimmed milk\nAH Vuilniszakken 60l met sluitclip';
	const [first, second] = await browser.getShoppingListPrices(list, 'en');
	assert.deepEqual(Array.from(first.products, item => item.name), [
		'AH Biologisch Kipfilet flinterdun', 'Halfvolle melk', 'AH Vuilniszakken 60l met sluitclip'
	]);
	assert.equal(first.products[2].amount, '20 stuks');
	assert.equal(second.products[0].name, null);
	assert.equal(second.products[0].isEstimate, true);
	assert.equal(second.products[0].price, 3.29);
});

test('a quantity distinguishes duplicate catalogue titles with different package sizes', async () => {
	const list = 'Van Dijk Rode linzen\n500 g Van Dijk Rode linzen\nVan Dijk Rode linzen 500 g\n2 x 250 g Van Dijk Rode linzen';
	const [store] = await browser.getShoppingListPrices(list, 'en');
	assert.ok(store.products.every(item => item.name === 'Van Dijk Rode linzen'));
	assert.deepEqual(Array.from(store.products, item => item.amount), ['250 g', '500 g', '500 g', '500 g']);
	assert.deepEqual(Array.from(store.products, item => item.price), [0.99, 1.79, 1.79, 1.79]);
});

test('punctuation remains literal in product names in both languages', async () => {
	for (const language of ['en', 'nl'])
	{
		const list = 'Merk Kaas jong 48+\nkaas 48+\nZakjes A+B [proef]';
		const [store] = await browser.getShoppingListPrices(list, language);
		assert.deepEqual(Array.from(store.products, item => item.name), [
			'Merk Kaas jong 48+', 'Merk Kaas jong 48+', 'Zakjes A+B [proef]'
		]);
	}
});

test('explicit Dutch qualifiers allow the requested prepared or flavoured grocery', async () => {
	const [store] = await browser.getShoppingListPrices('Griekse yoghurt aardbei\nkipfilet gerookt', 'en');
	assert.deepEqual(Array.from(store.products, item => item.name), [
		'Huismerk Griekse yoghurt aardbei', 'Huismerk Kipfilet gerookt'
	]);
});

test('generic groceries reject cheaper prepared items, baby food, snacks and coupons', async () => {
	const [store] = await browser.getShoppingListPrices('sweet potatoes\ncarrots\npindakaas\nbutter', 'en');
	assert.deepEqual(Array.from(store.products, item => item.name), [
		'AH Oranje zoete aardappel', 'AH Waspeen', 'Calvé Pindakaas', 'Roomboter ongezouten'
	]);
});
