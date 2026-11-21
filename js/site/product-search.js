function searchWords(value)
{
	const normalized = value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
	const words = normalized.match(/\d+(?:[.,]\d+)?[%+]|\d+[.,]\d+|[\p{L}\p{N}]+/gu) || [];
	return words.map(word => word.replace(',', '.'));
}

function prepareSearchItem(line, listIndex, language)
{
	const markedAsBought = /^x\s+/.test(line);
	const title = markedAsBought ? line.replace(/^x\s+/, '').trim() : line.trim();
	const query = title.replace(
		/(\d)\s*(grams?|kilograms?|litres?|liters?|millilitres?|milliliters?)\b/gi,
		(match, digit, unit) => digit + ' ' + unit.toLowerCase().replace(/litre/, 'liter').replace(/s$/, '')
	);
	// Keep the full title intact for exact catalogue lookup. A size within a
	// listing (such as a 60 L bin bag) may describe the product, not the pack.
	const amount = checkjebon.getAmount(query);
	const name = amount ? query.replace(amount, '').trim().replace(/^of\s+/i, '') : query;
	const term = groceryTerms.find(([phrase]) => phrase.test(name));
	const [phrase, translation, productName, exclusions] = term || [];
	const qualifiers = searchWords(phrase ? name.replace(phrase, '') : name);
	const qualified = qualifiers.length > 0;
	const item = {
		originalQuery: line,
		listIndex,
		checked: markedAsBought,
		title,
		query,
		amount,
		specificTitle: !term || qualified
	};
	if (!term && language !== 'en') return item;

	const translatedName = phrase ? name.replace(phrase, translation) : name;
	const searchedName = amount ? amount + ' ' + translatedName : translatedName;
	const preferredWords = searchWords(translatedName).join(' ');
	const exclusionPattern = exclusions && new RegExp(exclusions.source, exclusions.flags + 'g');
	const requestedVariant = qualified && exclusions?.test(name.replace(phrase, ''));
	return {
		...item,
		searchedName,
		scoreName(candidate) {
			const genericMatch = !productName || productName.test(candidate);
			if (!genericMatch && !requestedVariant) return 0;
			// Permit a flavour or preparation that the user explicitly asked for.
			if (exclusions?.test(candidate) && (!qualified || Array.from(candidate.matchAll(exclusionPattern)).some(match =>
				!searchWords(match[0]).every(word => qualifiers.includes(word))
			))) return 0;
			const words = searchWords(candidate);
			const wordsInOrder = words.join(' ');
			if (productName && !qualified) return wordsInOrder === preferredWords ? 2 : 1;
			if (!qualified || !qualifiers.every(word => words.includes(word))) return 0;
			const phraseInTitle = (' ' + wordsInOrder + ' ').includes(' ' + preferredWords + ' ');
			if (!genericMatch && !phraseInTitle) return 0;
			return phraseInTitle ? 2 : 1;
		}
	};
}

function shoppingListRows(shoppingList)
{
	// Keep choices attached to the same item when other lines move or a row
	// is checked off. Repeated entries each have their own occurrence.
	const occurrences = new Map();
	const rows = [];
	shoppingList.split('\n').forEach((line, listIndex) => {
		if (!line.trim()) return;
		const title = line.replace(/^x\s+/, '').trim();
		const occurrence = occurrences.get(title) ?? 0;
		occurrences.set(title, occurrence + 1);
		rows.push({ line, listIndex, matchKey: JSON.stringify([title, occurrence]) });
	});
	return rows;
}

function readMatchChoices(value)
{
	try {
		const choices = JSON.parse(value);
		if (!Array.isArray(choices)) return [];
		return choices.filter(choice => choice && typeof choice.matchKey === 'string' &&
			typeof choice.storeCode === 'string' && typeof choice.productId === 'string' &&
			typeof choice.forPlan === 'boolean');
	} catch (error) {
		return [];
	}
}

function basketTotals(products)
{
	let matchedCount = 0;
	let estimatedCount = 0;
	let unpricedCount = 0;
	let totalPrice = 0;
	for (const product of products)
	{
		if (!Number.isFinite(product.price)) unpricedCount++;
		else
		{
			totalPrice += product.price;
			if (product.isEstimate) estimatedCount++;
			else matchedCount++;
		}
	}
	return {
		matchedCount,
		estimatedCount,
		unpricedCount,
		totalPrice: Math.round(totalPrice * 100) / 100,
		notFound: estimatedCount + unpricedCount
	};
}

async function getShoppingListPrices(shoppingList, language, choices = [])
{
	const choicesByItem = new Map();
	for (const choice of choices)
	{
		if (!choicesByItem.has(choice.matchKey)) choicesByItem.set(choice.matchKey, []);
		choicesByItem.get(choice.matchKey).push([choice.storeCode, choice.productId]);
	}
	const items = shoppingListRows(shoppingList).map(({ line, listIndex, matchKey }) => ({
		...prepareSearchItem(line, listIndex, language),
		matchKey,
		overrides: choicesByItem.has(matchKey) ? Object.fromEntries(choicesByItem.get(matchKey)) : undefined
	}));
	const results = await checkjebon.getPricesForProducts(items.map(item => item.query), items);
	return results.map(store => {
		const products = store.products.map((product, index) => {
			const { originalQuery, listIndex, matchKey, checked, searchedName, scoreName, overrides } = items[index];
			const isManualMatch = Boolean(product.productId && overrides?.[store.code] === product.productId);
			return {
				...product, originalQuery, listIndex, matchKey, checked, searchedName, isManualMatch,
				needsReview: Boolean(scoreName) && product.price == null
			};
		});
		return { ...store, products, ...basketTotals(products) };
	});
}

function shoppingPlanForChoices(prices, maxStores, storeCodes, choices)
{
	const stores = prices.filter(store => storeCodes.includes(store.code));
	const byCode = new Map(stores.map(store => [store.code, store]));
	const pinned = new Map();
	const pinnedStores = new Set();
	// If the store limit changes, the most recent explicit choices take
	// precedence among stores still allowed in the plan.
	for (const choice of [...choices].reverse())
	{
		if (!choice.forPlan || (!pinnedStores.has(choice.storeCode) && pinnedStores.size >= maxStores)) continue;
		const product = byCode.get(choice.storeCode)?.products.find(row => row.matchKey === choice.matchKey);
		if (!product?.isManualMatch || product.productId !== choice.productId || pinned.has(product.listIndex)) continue;
		pinned.set(product.listIndex, choice.storeCode);
		pinnedStores.add(choice.storeCode);
	}
	const result = checkjebon.getShoppingPlanForPrices(prices, maxStores, storeCodes, pinned);
	const best = stores.reduce((cheapest, store) => store.totalPrice < cheapest.totalPrice ? store : cheapest);
	return {
		...result,
		supermarkets: result.supermarkets.map(store => ({ ...store, ...basketTotals(store.products) })),
		bestSingleTotal: best.totalPrice,
		bestSingleName: best.name,
		totalSavings: Math.round((best.totalPrice - result.totalCost) * 100) / 100,
		needsReview: result.supermarkets.some(store => store.products.some(product => product.needsReview))
	};
}
