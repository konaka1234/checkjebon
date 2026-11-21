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

async function getShoppingListPrices(shoppingList, language)
{
	const items = shoppingList.split('\n')
		.map((line, index) => line.trim() ? prepareSearchItem(line, index, language) : null)
		.filter(Boolean);
	const results = await checkjebon.getPricesForProducts(items.map(item => item.query), items);
	return results.map(store => {
		const products = store.products.map((product, index) => {
			const { originalQuery, listIndex, checked, searchedName, scoreName } = items[index];
			return { ...product, originalQuery, listIndex, checked, searchedName, needsReview: Boolean(scoreName) && product.price == null };
		});
		return {
			...store,
			products,
			totalPrice: products.reduce((total, product) => total + (product.price ?? 0), 0),
			notFound: products.filter(product => product.isEstimate || product.price == null).length
		};
	});
}
