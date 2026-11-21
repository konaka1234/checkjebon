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
			{ n: 'Crackers met Lente-ui', p: 0.49, s: '100 g' },
			{ n: 'Bosui', p: 0.89, s: 'per bos' },
			{ n: 'Halfvolle melk', p: 0.79, s: '1 l' },
			{ n: 'Volle melk', p: 0.99, s: '1 l' },
			{ n: 'Halfvolle melk', p: 1.49, s: '1,5 l' },
			{ n: 'Roomboter gezouten', p: 1.19, s: '250 g' },
			{ n: 'Roomboter ongezouten', p: 1.89, s: '250 g' },
			{ n: 'Kipdrumsticks gekruid', p: 2.99, s: '500 g' },
			{ n: 'Kipdrumsticks ca. 600 g', p: 3.49 },
			{ n: 'Oatly Haverdrank', p: 1.99, s: '1 l' },
			{ n: 'Andere Haverdrank', p: 1.49, s: '1 l' }
		]
	},
	{
		n: 'second',
		c: 'Second supermarket',
		d: [
			{ n: 'Toast Spring Onion', p: 0.29, s: '100 g' },
			{ n: 'Halfvolle melk', p: 1.29, s: '1.5 l' }
		]
	}
];

function withCatalogue(data)
{
	const browser = vm.createContext({
		fetch: async () => ({ ok: true, headers: new Headers(), json: async () => data })
	});
	browser.window = browser;
	for (const file of ['js/checkjebon/checkjebon.js', 'js/site/grocery-terms.js', 'js/site/product-search.js'])
	{
		vm.runInContext(readFileSync(resolve(__dirname, '..', file), 'utf8'), browser, { filename: file });
	}
	return browser;
}

const browser = withCatalogue(catalogue);

test('English groceries match the Dutch equivalents without dropping quantities, brands or descriptors', async () => {
	const english = 'spring onions\nwhole milk\n1.5 litres of semi-skimmed milk\n250 g unsalted butter\n500 g chicken drumsticks\nOatly oat milk';
	const dutch = 'bosui\nvolle melk\n1,5 liter halfvolle melk\n250 g ongezouten roomboter\n500 g kipdrumsticks\nOatly haverdrank';
	const [prices] = await browser.getShoppingListPrices(english, 'en');
	const [translated] = await browser.getShoppingListPrices(dutch, 'nl');
	assert.deepEqual(Array.from(prices.products, item => item.name), [
		'Bosui', 'Volle melk', 'Halfvolle melk', 'Roomboter ongezouten', 'Kipdrumsticks ca. 600 g', 'Oatly Haverdrank'
	]);
	assert.deepEqual(Array.from(prices.products, item => item.price), [0.89, 0.99, 1.49, 1.89, 3.49, 1.99]);
	assert.deepEqual(Array.from(translated.products, item => item.price), Array.from(prices.products, item => item.price));
});

test('an unresolved row stays editable and out of the plan total', async () => {
	const list = 'x spring onions\n\n1.5 litres of semi-skimmed milk\nrare grocery [unavailable]';
	const prices = await browser.getShoppingListPrices(list, 'en');
	const [first, second] = prices;
	assert.equal(second.products[0].isEstimate, true);
	assert.equal(second.products[0].price, 0.89);
	assert.equal(first.notFound, 1);
	const plan = browser.checkjebon.getShoppingPlanForPrices(prices, 2, ['first', 'second']);
	assert.equal(plan.totalCost, 2.18);
	const items = plan.supermarkets.flatMap(store => store.products);
	const unresolved = items.find(item => item.listIndex === 3);
	assert.equal(unresolved.originalQuery, 'rare grocery [unavailable]');
	assert.equal(unresolved.searchedName, 'rare grocery [unavailable]');
	assert.equal(unresolved.price, null);
	assert.equal(unresolved.needsReview, true);
	assert.equal(items.find(item => item.listIndex === 0).checked, true);
	assert.equal(items.find(item => item.listIndex === 2).price, 1.29);
});

test('a full English list gives the same prices as its Dutch equivalent in the checked-in catalogue', async () => {
	const data = JSON.parse(readFileSync(resolve(__dirname, '..', 'data/supermarkets.json'), 'utf8'));
	const app = withCatalogue(data);
	const entries = [
		['1.5 litres of semi-skimmed milk', '1,5 liter halfvolle melk'],
		['whole milk', 'volle melk'],
		['250 g unsalted butter', '250 g ongezouten roomboter'],
		['1 kg sweet potatoes', '1 kg zoete aardappelen'],
		['500 g chicken drumsticks', '500 g kipdrumsticks'],
		['spring onions', 'bosui'],
		['panko breadcrumbs', 'panko'],
		['500 grams Greek yoghurt', '500 gram Griekse yoghurt'],
		['Oatly oat milk', 'Oatly haverdrank'],
		['pandan rice', 'pandanrijst'],
		['chopped tomatoes', 'tomatenblokjes'],
		['brown rice', 'zilvervliesrijst'],
		['canned algae in avocado oil', 'algen in avocado-olie in blik']
	];
	const english = await app.getShoppingListPrices(entries.map(entry => entry[0]).join('\n'), 'en');
	const dutch = await app.getShoppingListPrices(entries.map(entry => entry[1]).join('\n'), 'nl');
	const matches = prices => Array.from(prices, store => [
		store.code, Array.from(store.products, item => [item.name, item.price])
	]);
	assert.ok(english.length > 0);
	assert.deepEqual(matches(english), matches(dutch));
	assert.ok(english.every(store => store.products.at(-1).needsReview));
	for (const [index, [term]] of entries.slice(0, -1).entries())
	{
		assert.ok(english.some(store => store.products[index].name), term);
	}
});
