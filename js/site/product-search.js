// A grocery phrase maps to a Dutch search term and, where needed, rules that
// distinguish the ingredient from flavoured snacks and prepared meals.
const groceryTerms = [
	[
		/\b(?:semi[- ]skimmed milk|reduced[- ]fat milk|halfvolle melk)\b/i,
		'halfvolle melk',
		/\bhalfvolle\s+melk\b/i
	],
	[
		/\b(?:skimmed milk|skim milk|nonfat milk|magere melk)\b/i,
		'magere melk',
		/\bmagere\s+melk\b/i
	],
	[
		/\b(?:whole milk|full[- ]fat milk|volle melk)\b/i,
		'volle melk',
		/\bvolle\s+melk\b/i
	],
	[
		/\b(?:oat milk|haverdrank|havermelk)\b/i,
		'haverdrank',
		/\bhaver(?:drank|melk)\b/i,
		/\b(?:vanille|chocolade|koffie|capsules?|cups?|creamer)\b/i
	],
	[
		/\b(?:unsalted butter|ongezouten roomboter|roomboter ongezouten|ongezouten boter)\b/i,
		'ongezouten roomboter',
		/(?=.*\bongezouten\b)(?=.*\b(?:room|gras)?boter\b)/i,
		/\b(?:kruidenboter|bakmix|cupjesverpakking|blend)\b/i
	],
	[
		/\b(?:salted butter|gezouten roomboter|roomboter gezouten)\b/i,
		'gezouten roomboter',
		/(?=.*\bgezouten\b)(?=.*\b(?:room|gras)?boter\b)/i
	],
	[
		/\b(?:spreadable butter|smeerbare roomboter)\b/i,
		'smeerbare roomboter',
		/(?=.*\bsmeerbar\w*\b)(?=.*\b(?:room)?boter\b)/i
	],
	[
		/\b(?:sweet potato(?:es)?|zoete aardappel(?:s|en)?|bataat)\b/i,
		'zoete aardappel',
		/\b(?:zoete\s+aardappel(?:s|en)?|bataat)\b/i,
		/\b(?:babyvoeding|groentehapje|knijpfruit|maaltijd|stoofpot|salade|saus|soep|friet|chips|puree|spread|blokjes|ovenschotel|brokjes|paté|curry|gnocchi|diepvries)\b/i
	],
	[
		/\b(?:chicken drumsticks?|kip\s?drumsticks?|drumsticks? kip)\b/i,
		'kipdrumsticks',
		/\b(?:kip\s?drumsticks?|drumsticks?\s+kip)\b/i,
		/\b(?:gemarineerd|gekruid|voorgegaard|gegaard|gaar|gegrild|paprika|barbecue|ketjap|marinade)\b/i
	],
	[
		/\b(?:chicken breasts?|kipfilet)\b/i,
		'kipfilet',
		/\bkipfilet\b/i,
		/\b(?:gebraden|gerookt|gegrild|gegaard|gekruid|gemarineerd|doperwten?|saus|wrap|soep|salade|maaltijd|cat|kattenvoer|vleeswaren|plakjes|flinterdun|sandwich)\b/i
	],
	[
		/\b(?:spring onions?|green onions?|scallions?|bosui(?:en)?|lente[- ]?ui(?:en)?)\b/i,
		'bosui',
		/\b(?:bosui(?:en)?|lente[- ]?ui(?:en)?)\b/i,
		/\b(?:saus|spread|soep|salade|snack|crackers?|toast|bbq|kruiden|bouillon)\b|uisoep/i
	],
	[
		/\b(?:greek yogh?urt|griekse yogh?urt|yogh?urt griekse stijl)\b/i,
		'Griekse yoghurt',
		/(?=.*\b(?:grieks\w*|greek)\b)(?=.*\byogh?urt\b)/i,
		/\b(?:ice|ijs|frozen|alternatief|plantaardig|aardbei|vanille|passievrucht|perzik|raspberry|vanilla)\b/i
	],
	[
		/\b(?:panko breadcrumbs?|panko broodkruim|panko)\b/i,
		'panko',
		/\bpanko\b/i,
		/\b(?:garnalen|shrimp|kip|chicken|schnitzel)\b/i
	],
	[
		/\b(?:breadcrumbs?|paneermeel)\b/i,
		'paneermeel',
		/\b(?:paneermeel|broodkruim)\b/i
	],
	[
		/\b(?:(?:wholemeal|whole[- ]wheat|whole[- ]grain) bread|volkoren\s?brood)\b/i,
		'volkoren brood',
		/\bvolkoren\s?(?:tarwe)?brood\b|\bbrood\s+volkoren\b/i,
		/\b(?:naan|stokbrood|pita|bakmix|mix|crackers?)\b/i
	],
	[
		/\b(?:(?:brown|whole[- ]grain) rice|zilvervliesrijst)\b/i,
		'zilvervliesrijst',
		/\bzilvervliesrijst\b/i,
		/\b(?:noedels|crackers?|wafels|maaltijd)\b/i
	],
	[
		/\b(?:pandan rice|pandan\s?rijst)\b/i,
		'pandanrijst',
		/\bpandan\s?rijst\b/i
	],
	[
		/\b(?:garlic sauce|knoflooksaus)\b/i,
		'knoflooksaus',
		/\bknoflooksaus\b/i,
		/\b(?:met|in)\s+knoflooksaus\b/i
	],
	[
		/\b(?:(?:chopped|diced) tomatoes|tomatenblokjes)\b/i,
		'tomatenblokjes',
		/\btomatenblokjes\b/i
	],
	[
		/\b(?:baking powder|bakpoeder)\b/i,
		'bakpoeder',
		/\bbakpoeder\b/i
	],
	[
		/\b(?:bananas?|bananen?)\b/i,
		'bananen',
		/\bbananen?\b/i,
		/\b(?:chips|gedroogd|vriesvers\w*|knijpfruit|muesli|puree|schuim)\b/i
	],
	[
		/\b(?:potato(?:es)?|aardappelen)\b/i,
		'aardappelen',
		/\baardappelen\b/i,
		/\b(?:zoete|gekookte|gekruid|puree|friet|schotel|voorgekookt|vlees|saus|zuurkool|maaltijd)\b/i
	],
	[
		/\b(?:carrots?|wortels?|winterpeen)\b/i,
		'wortel',
		/\b(?:wortels?|winterpeen|bospeen|waspeen)\b/i,
		/\b(?:doperwten|saus|sap|puree|soep|maaltijd)\b/i
	],
	[
		/\b(?:cucumbers?|komkommers?)\b/i,
		'komkommer',
		/\bkomkommers?\b/i,
		/\b(?:salade|spread|saus|drank|zoetzuur)\b/i
	],
	[
		/\b(?:garlic|knoflook)\b/i,
		'knoflook',
		/\bknoflook\b/i,
		/\b(?:poeder|saus|granulaat|olie|marinade|brood|garnalen|boter)\b/i
	],
	[
		/\b(?:eggs?|eieren)\b/i,
		'eieren',
		/\b(?:scharrel|uitloop)?eieren\b/i,
		/\b(?:chocolade|choco|paas|gekookt|gekookte)\b/i
	],
	[
		/\b(?:butter|roomboter|boter)\b/i,
		'roomboter',
		/\b(?:room|gras)?boter\b/i,
		/\b(?:pinda|cupjesverpakking|kruiden)\b/i
	],
	[
		/\b(?:milk|melk)\b/i,
		'melk',
		/\b(?:halfvolle|volle|magere)\s+melk\b/i
	],
	[
		/\b(?:bread|brood)\b/i,
		'brood',
		/\b(?:tarwe|volkoren|bruin|wit)?brood\b/i,
		/\b(?:mix|bakmix|crackers?)\b/i
	],
	[
		/\b(?:rice|rijst)\b/i,
		'rijst',
		/\b(?:zilvervlies|pandan|basmati)?rijst\b/i,
		/\b(?:noedels|crackers?|wafels|pap|maaltijd)\b/i
	]
];

function searchWords(value)
{
	return value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function prepareSearchItem(line, listIndex, language)
{
	const originalName = line.trim().replace(/^x\s+/i, '');
	const query = originalName.replace(
		/(\d)\s*(grams?|kilograms?|litres?|liters?|millilitres?|milliliters?)\b/gi,
		(match, digit, unit) => digit + ' ' + unit.toLowerCase().replace(/litre/, 'liter').replace(/s$/, '')
	);
	const amount = checkjebon.getAmount(query);
	const name = amount ? query.replace(amount, '').trim().replace(/^of\s+/i, '') : query;
	const term = groceryTerms.find(([phrase]) => phrase.test(name));
	const item = { originalQuery: line, listIndex, checked: line.startsWith('x ') };
	if (!term && language !== 'en') return { ...item, query };

	const [phrase, translation, productName, exclusions] = term || [];
	const qualifiers = searchWords(phrase ? name.replace(phrase, '') : name);
	const translatedName = phrase ? name.replace(phrase, translation) : name;
	const searchedName = amount ? amount + ' ' + translatedName : translatedName;
	return {
		...item,
		query,
		searchedName,
		matchesName(candidate) {
			if (productName && (!productName.test(candidate) || exclusions?.test(candidate))) return false;
			if (qualifiers.length === 0) return Boolean(productName);
			const candidateWords = searchWords(candidate);
			return qualifiers.every(word => candidateWords.includes(word));
		}
	};
}

async function getShoppingListPrices(shoppingList, language)
{
	const items = shoppingList.split('\n')
		.map((line, index) => line.trim() ? prepareSearchItem(line, index, language) : null)
		.filter(Boolean);
	const results = await checkjebon.getPricesForProducts(items.map(item => item.query), items.map(item => item.matchesName));
	return results.map(store => {
		const products = store.products.map((product, index) => {
			const { originalQuery, listIndex, checked, searchedName, matchesName } = items[index];
			return { ...product, originalQuery, listIndex, checked, searchedName, needsReview: Boolean(matchesName) && product.price == null };
		});
		return {
			...store,
			products,
			totalPrice: products.reduce((total, product) => total + (product.price ?? 0), 0),
			notFound: products.filter(product => product.isEstimate || product.price == null).length
		};
	});
}
