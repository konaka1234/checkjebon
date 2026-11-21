// Common English grocery terms, matched on word boundaries. Order specific phrases first.
const englishGroceryTerms = [
	[/\b(?:semi[- ]skimmed|reduced[- ]fat) milk\b/gi, '\\bhalfvolle\\smelk\\b'],
	[/\b(?:skimmed|skim|nonfat) milk\b/gi, '\\bmagere\\smelk\\b'],
	[/\b(?:whole|full[- ]fat) milk\b/gi, '\\bvolle\\smelk\\b'],
	[/\boat milk\b/gi, 'haverdrank'],
	[/\b(?:wholemeal|whole[- ]wheat|whole[- ]grain) bread\b/gi, 'volkoren brood'],
	[/\b(?:brown|whole[- ]grain) rice\b/gi, 'zilvervliesrijst'],
	[/\bchicken breasts?\b/gi, 'kipfilet'],
	[/\bgarlic sauce\b/gi, 'knoflooksaus'],
	[/\b(?:chopped|diced) tomatoes\b/gi, 'tomatenblokjes'],
	[/\bbaking powder\b/gi, 'bakpoeder'],
	[/\bspreadable butter\b/gi, 'smeerbare roomboter'],
	[/\bbananas?\b/gi, 'bananen'],
	[/\bpotatoes\b/gi, 'aardappelen'],
	[/\bcarrots?\b/gi, 'wortel'],
	[/\bcucumbers?\b/gi, 'komkommer'],
	[/\bgarlic\b/gi, 'knoflook'],
	[/\beggs?\b/gi, 'eieren'],
	[/\bbutter\b/gi, 'boter'],
	[/\bmilk\b/gi, 'melk'],
	[/\bbread\b/gi, 'brood'],
	[/\brice\b/gi, 'rijst']
];

function translateProductQuery(query)
{
	let translated = query.replace(
		/(\d)\s*(grams?|kilograms?|litres?|liters?|millilitres?|milliliters?)\b/gi,
		(match, digit, unit) => digit + ' ' + unit.toLowerCase().replace(/litre/, 'liter').replace(/s$/, '')
	);
	for (const [pattern, term] of englishGroceryTerms)
	{
		translated = translated.replace(pattern, term);
	}
	return translated;
}

function prepareProductSearch(shoppingList)
{
	const lines = shoppingList.split('\n');
	const items = new Map();
	const queries = [];
	// The library echoes its input but trims it before matching. Trailing spaces
	// let us distinguish duplicate rows and synonyms even in a multi-store plan.
	lines.forEach((line, index) => {
		if (!line.trim()) return;
		let query = translateProductQuery(line);
		while (items.has(query)) query += ' ';
		queries.push(query);
		items.set(query, { originalQuery: line, listIndex: index });
	});
	return {
		queries,
		restore(product) {
			const { originalQuery, listIndex } = items.get(product.originalQuery);
			return { ...product, originalQuery, listIndex, checked: originalQuery.startsWith('x ') };
		}
	};
}
