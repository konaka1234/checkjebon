const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = resolve(__dirname, '..');

function titleKey(title)
{
	return title.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}

test('every priced catalogue title can be found in the English shopping list', async t => {
	const catalogue = JSON.parse(readFileSync(resolve(root, 'data/supermarkets.json'), 'utf8'));
	const browser = vm.createContext({
		fetch: async () => ({ ok: true, headers: new Headers(), json: async () => catalogue })
	});
	browser.window = browser;
	for (const file of ['js/checkjebon/checkjebon.js', 'js/site/grocery-terms.js', 'js/site/product-search.js'])
	{
		vm.runInContext(readFileSync(resolve(root, file), 'utf8'), browser, { filename: file });
	}

	let pricedRows = 0;
	let titleQueries = 0;
	for (const store of catalogue)
	{
		const cheapestByTitle = new Map();
		const queries = new Set();
		for (const product of store.d)
		{
			if (!Number.isFinite(product.p)) continue;
			pricedRows++;
			const key = titleKey(product.n);
			assert.ok(key, `${store.n} has a priced listing with no title`);
			// A pasted title is one shopping-list line even if the feed wraps it.
			queries.add(product.n.replace(/[\r\n]+/g, ' '));
			cheapestByTitle.set(key, Math.min(product.p, cheapestByTitle.get(key) ?? Infinity));
		}
		if (queries.size === 0) continue;
		const titles = Array.from(queries);
		const results = await browser.getShoppingListPrices(titles.join('\n'), 'en');
		const ownStore = results.find(result => result.code === store.n);
		assert.equal(ownStore.products.length, titles.length, store.n);
		titleQueries += titles.length;
		for (const [index, title] of titles.entries())
		{
			const product = ownStore.products[index];
			const description = `${store.n}: ${title}`;
			assert.equal(product.originalQuery, title, description);
			assert.equal(product.isEstimate, false, description);
			assert.equal(titleKey(product.name ?? ''), titleKey(title), description);
			// An identical display title can describe several pack sizes.
			assert.equal(product.price, Math.round(cheapestByTitle.get(titleKey(title)) * 100) / 100, description);
		}
	}
	assert.ok(titleQueries > 0);
	t.diagnostic(`Checked ${titleQueries.toLocaleString('en-US')} store/title queries covering ${pricedRows.toLocaleString('en-US')} priced rows.`);
});
