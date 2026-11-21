// These catalogue products name ingredients such as carrot and rice without
// selling them as groceries on their own.
const babyOrPetFood = /\bbonb[eé]b[eé]|\b(?:olvarit|gerber|gourmet gold|babyvoeding|babysnack\w*|groentehapje|fruithapje|knijpfruit|kattenvoer|hondenvoer|hondensnack|adult|maaltijdpotje)\b|\b\d+m?\+?(?:\s*(?:maanden|mnd)|\+)/i;
const excludeTogether = (...patterns) => new RegExp(patterns.map(pattern => pattern.source).join('|'), 'i');

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
		/\b(?:vanille|chocolade|cacao|matcha|koffie|capsules?|cups?|creamer|pancakes?)\b|\b\d+\s*[x×]\s*\d{1,2}\s*ml\b/i
	],
	[
		/\b(?:unsalted butter|ongezouten roomboter|roomboter ongezouten|ongezouten boter)\b/i,
		'ongezouten roomboter',
		/(?=.*\bongezouten\b)(?=.*\b(?:room|gras)?boter\b)/i,
		/\b(?:kruidenboter|bakmix|cupjesverpakking|cups?|blend)\b/i
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
		excludeTogether(babyOrPetFood, /\b(?:maaltijd|stoofpot|salade|saus|soep|\w*friet\w*|chips|puree|spread|blokjes|ovenschotel|ovengroente\w*|gratin|brokjes|pat[ée]|curry|gnocchi|diepvries|kruidenmix|bakplaat|airfryer|mix)\b/i)
	],
	[
		/\b(?:chicken drumsticks?|kip\s?drumsticks?|drumsticks? kip)\b/i,
		'kipdrumsticks',
		/\b(?:kip\s?drumsticks?|drumsticks?\s+kip)\b/i,
		/\b(?:gem\.?|gemarineerd\w*|gekruid\w*|voorgegaard\w*|gegaard\w*|gaar|gegrild\w*|paprika|barbecue|ketjap|marinade)\b/i
	],
	[
		/\b(?:smoked chicken breasts?|gerookte kipfilet|kipfilet gerookt)\b/i,
		'gerookte kipfilet',
		/(?=.*\bkipfilet\b)(?=.*\bgerookt\w*\b)/i,
		excludeTogether(babyOrPetFood, /\b(?:\w*salade|\w*soep|\w*saus|wrap|broodje|maaltijd|sandwich)\b/i)
	],
	[
		/\b(?:chicken breasts?|kipfilet)\b/i,
		'kipfilet',
		/\bkipfilet\s+(?:\d+\s*stuks?|voordeelverpakking|grootverpakking|rauw|onbereid)\b|^(?:(?:hoogvliet|vleeschmeesters|jumbo|vers(?:e)?)\s+)?kipfilet(?:\s+(?:[3-9]\d{2}|[1-9]\d{3})\s*g(?:ram)?)?$/i,
		excludeTogether(babyOrPetFood, /\b(?:gebraden|gerookt\w*|gegrild\w*|gegaard\w*|gekruid\w*|gemarineerd\w*|roasted|doperwten?|\w*saus|wrap|soep|salade|maaltijd|cat|vleeswaren|plakjes|flinterdun|sandwich|schnitzels?|nuggets?|plantaardig\w*|vegetarisch\w*|vega|zoet|pittig|roerbak|sate|saté|snijwaren|oven\w+)\b/i)
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
		/\b(?:ice|ijs|frozen|alternatief|plantaardig|aardbei|vanille|passievrucht|perzik|raspberry|vanilla|honing)\b/i
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
		/\bvolkoren\s?(?:tarwe|desem)?brood\b|\bbrood\s+volkoren\b|(?=.*\bvolkoren\b)(?=.*\b(?:boeren|casino|tijger|vloerdesem|bakkersbrood|tostibrood|heel|half|halfje)\b)/i,
		/\b(?:naan|stokbrood|pita|\w*bakmix|mix|crackers?|melbatoast|beschuit)\b/i
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
		excludeTogether(babyOrPetFood, /\b(?:chips|gedroogd\w*|gesuikerd\w*|vriesvers\w*|muesli|puree|schuim|snoep|yoghurt)\b/i)
	],
	[
		/\b(?:potato(?:es)?|aardappelen)\b/i,
		'aardappelen',
		/\baardappelen\b/i,
		excludeTogether(babyOrPetFood, /\b(?:zoete|gebakken|gekookt\w*|gekruid\w*|kruidenmix|puree|friet|\w*schotel|voorgekookt\w*|vlees|saus|zuurkool|maaltijd|ratatouille|gerechten|shake|silvo|kaas)\b/i)
	],
	[
		/\b(?:carrots?|wortels?|winterpeen)\b/i,
		'wortel',
		/\b(?:wortels?|winterpeen|bospeen|waspeen)\b/i,
		excludeTogether(babyOrPetFood, /\b(?:doperwten?|doperwtjes|tuinerwten|saus|sap|\w*shot|puree|soep|maaltijd|baguette|gourmet|nasi|tempura|ovengroente\w*|pompoen|knabbels?|maize|sticks|unox|pouch)\b/i)
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
		/^(?:(?:ah|jumbo|hoogvliet|plus|neutraal|biologisch(?:e)?|vers(?:e)?|solo)\s+)*knoflook(?:\s+(?:vers|biologisch|in mand|paars|baaltje))?(?:\s+\d+(?:[.,]\d+)?\s*(?:kg|g(?:ram)?|gr|st(?:uks?)?))?\.?$/i
	],
	[
		/\b(?:eggs?|eieren)\b/i,
		'eieren',
		/\b(?:scharrel|uitloop)?eieren\b/i,
		/\b(?:chocolade|choco|paas|gekookt\w*|spaghetti|pasta|tagliatelle|noedels|salade|advocaat|mayonaise)\b/i
	],
	[
		/\b(?:peanut butter|pindakaas)\b/i,
		'pindakaas',
		/\bpindakaas\b/i,
		/\b(?:\w*reep\w*|\w*koek\w*|\w*rijstwafel\w*|\w*cups?|\w*bites?|snoep|honing|cookie\w*|hapje|smoothie|granola|repen|bar|hipro)\b/i
	],
	[
		/\b(?:butter|roomboter|boter)\b/i,
		'roomboter',
		/(?=.*\b(?:boter|roomboter|grasboter|weideboter)\b)(?=.*\b(?:ongezouten|gezouten|grasboter|weideboter|smeerbare|echte)\b)|^(?:(?:ah|jumbo|hoogvliet|plus|bio|biologisch(?:e)?)\s+)*(?:room)?boter(?:\s+\d+\s*g(?:ram)?)?$/i,
		/\b(?:pinda|cupjesverpakking|cups?|kruiden|\w+botermelange|knoflookboter|\w*croissant\w*|\w*koek\w*|\w*cake\w*|krakeling\w*|sprits\w*|\w*flap|\w*taart|\w*brood\w*|\w*wafel\w*|\w*pasta|\w*hoef|kersencarree|kuikens|\w*creme|\w*crème|\w*bakjes|\w*rondjes|amandelspijs|\w*muffin\w*|picolientje|\w*pudding)\b/i
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
		/\b(?:mix|\w*bakmix|crackers?|kruidnootjes|speculaas|melbatoast)\b/i
	],
	[
		/\b(?:rice|rijst)\b/i,
		'rijst',
		/\b(?:zilvervlies|pandan|basmati)?rijst\b/i,
		excludeTogether(babyOrPetFood, /\b(?:noedels|crackers?|wafels|pap|maaltijd|kip|soep|salade|pudding|repen|vermicelli|bowl|gekookt\w*|voorgekookt\w*)\b/i)
	],
	[
		/\b(?:spinach|spinazie)\b/i,
		'spinazie',
		/\b(?:blad)?spinazie\b/i,
		excludeTogether(babyOrPetFood, /\b(?:gourmet|maaltijd|pasta|\w*soep|\w*saus|room|cr[eè]me|croissant|kaas|wrap|wok\w*|\w*shot|b[oö]rek|feta|\w*pizza|krieltjes|crackers?|rijst)\b/i)
	],
	[
		/\b(?:apples?|appels?|appelen|handappels|elstar)\b/i,
		'appel',
		/\b(?:elstar|jonagold|granny smith|braeburn|golden delicious|pink lady|kanzi|royal gala|junami|jazz|fuji|rubens|jonagored|goudreinet(?:ten)?|boskoop|evelina|wellant|handappels)\b|^(?:(?:ah|jumbo|hoogvliet|plus|neutraal|biologisch(?:e)?|vers(?:e)?)\s+)*appels?(?:\s+(?:los|per stuk|schaal|tas|zak))?(?:\s+\d+(?:[.,]\d+)?\s*(?:kg|g(?:ram)?|gr|st(?:uks?)?))?\.?$/i,
		excludeTogether(babyOrPetFood, /\b(?:kool|\w*sap|\w*moes|schijfjes|partjes|stukjes|gebak|cake|koek|reep|flap|muesli|compote|thee|jam|snoep|kwark|\w*yoghurt|rozenbottel|granola|rozijnen|kaneel|kiwi|chips|puffs|nektar|vla|\w*reinig\w*|\w*afwas\w*|smaak|gember|energy|red bull)\b/i)
	],
	[
		/\b(?:paprika powder|ground paprika|paprikapoeder)\b/i,
		'paprikapoeder',
		/\b(?:paprikapoeder|paprika\s+poeder)\b/i
	],
	[
		/\b(?:bell peppers?|sweet peppers?|paprika(?:'s)?)\b/i,
		'paprika',
		/\b(?:rode|gele|groene|oranje|punt|hollandse|biologische)\s+paprika(?:'s)?\b|\bpaprika\s+(?:rood|geel|groen|oranje|stoplicht|triocolor|mix)\b|\b(?:mini|punt)\s?paprika(?:'s)?\b|^(?:(?:ah|jumbo|hoogvliet|plus|lidl|neutraal|biologisch(?:e)?)\s+)*paprika(?:'s)?$/i,
		excludeTogether(babyOrPetFood, /\b(?:chips|dip\w*|\w*mix|\w*saus|\w*soep|smaak|kruiden|poeder|ketchup|hummus|spread|\w*reep|\w*snack|\w*crackers?|\w*worst|kruid\w*|maaltijd|filet|kaas|\w*friet\w*|tapenade|picos|grissini|gehakt|\w*aardappel\w*|doritos|lays|lay\x27s|croky|epixs|pringles|\w*wafel\w*|\w*sticks|tuc|chipito|spinners|smaak|\w*frites\w*)\b/i)
	],
	[
		/\bbroccoli\b/i,
		'broccoli',
		/\bbroccoli\b/i,
		excludeTogether(babyOrPetFood, /\b(?:stamppot\w*|\w*mix|\w*schotel|\w*soep|\w*saus|geroosterd\w*|pasta|room|kaas|salade|wok\w*|kipfilet|fish|vis|\w*quiche|\w*curry|iglo)\b/i)
	],
	[
		/\b(?:whipping cream|slagroom)\b/i,
		'slagroom',
		/\bslagroom\b/i,
		/\b(?:klop\b|klopfix|geklopt\w*|geslagen|spuitbus|\w*gebak|\w*brood\w*|\w*taart\w*|\w*flap|\w*soes\w*|\w*wafel|aerosol|slagroomvuller|dessert|choco\w*|vla|kwark|\w*koffie|pudding|caramel|karamel|cornets?|aardbei|stabilisator|met)\b/i
	],
	[
		/\b(?:self[- ]raising flour|self[- ]rising flour|zelfrijzend bakmeel)\b/i,
		'zelfrijzend bakmeel',
		/\bzelfrijzend\s+bakmeel\b/i
	],
	[
		/\b(?:plain flour|all[- ]purpose flour|wheat flour|flour|tarwebloem|patentbloem|bloem)\b/i,
		'tarwebloem',
		/\b(?:tarwe|patent)\s?bloem\b/i,
		/\b(?:\w*biscuits?|\w*koek\w*|\w*pasta|\w*brood\w*|\w*cake\w*)\b/i
	],
	[
		/\b(?:cheese|kaas)\b/i,
		'kaas',
		/\b(?:goudse|gouda|edammer|maasdammer|jonge|belegen|oude)\s+kaas\b|\bkaas\s+(?:jong\w*|belegen|oud\w*)\b/i,
		/\b(?:croissant\w*|\w*saus|\w*soep|kruidenmix|kruiden|\w*snack|\w*brood\w*|\w*chips|maaltijd|salade|crackers?|\w*stengels?|\w*rolletjes?|\w*noten|\w*wafel\w*|tapenade|pesto|ensalada|croque|dips?|filet|americain|\w*salade|smeerkaas|cheesepop|\w*bladerdeeg|sandwich|\w*broodje\w*)\b/i
	],
	[
		/\b(?:courgettes?|zucchini|zucchinis)\b/i,
		'courgette',
		/\bcourgettes?\b/i,
		excludeTogether(babyOrPetFood, /\b(?:maaltijd|wok\w*|\w*soep|\w*saus|\w*mix|pasta|room|kaas|gesneden|spaghetti)\b/i)
	],
	[
		/\b(?:aubergines?|eggplants?)\b/i,
		'aubergine',
		/\baubergines?\b/i,
		excludeTogether(babyOrPetFood, /\b(?:maaltijd|wok\w*|\w*soep|\w*saus|\w*mix|pasta|room|kaas|b[oö]rek|moussaka|tapenade|hummus|burger|dip|brood\w*)\b/i)
	],
	[
		/\b(?:chickpeas?|garbanzo beans?|kikkererwten)\b/i,
		'kikkererwten',
		/\bkikkererwten\b/i,
		excludeTogether(babyOrPetFood, /\b(?:maaltijd|\w*soep|\w*saus|\w*mix|crackers?|chips|curry|hummus|salade|pasta|kikkererwtenmeel)\b/i)
	],
	[
		/\b(?:rolled oats?|oats?|havermout|havervlokken)\b/i,
		'havermout',
		/\b(?:havermout|havervlokken)\b/i,
		excludeTogether(babyOrPetFood, /\b(?:\w*koek\w*|\w*reep\w*|muesli|melk|\w*drank|smaak|appel|kaneel|\w*pap|chocolade|granenmix|soep|maaltijd)\b/i)
	],
	[
		/\b(?:green beans?|sperziebonen|haricots verts)\b/i,
		'sperziebonen',
		/\b(?:sperziebonen|haricots verts)\b/i,
		excludeTogether(babyOrPetFood, /\b(?:maaltijd|wok\w*|\w*soep|\w*saus|\w*mix|pasta|salade|met|schotel|vlees|kipfilet|iglo|gegrilde|ping)\b/i)
	],
	[
		/\b(?:lemons?|citroen(?:en)?)\b/i,
		'citroen',
		/^(?:(?:ah|jumbo|hoogvliet|plus|neutraal|biologisch(?:e)?|vers(?:e)?|grote?|sanlucar)\s+)*citroen(?:en)?(?:\s+(?:verpakt|los|bio(?:logisch)?|per stuk))?(?:\s+\d+(?:[.,]\d+)?\s*(?:kg|g(?:ram)?|gr|st(?:uks?)?))?\.?$/i,
		excludeTogether(babyOrPetFood, /\b(?:smaak|sap|\w*drank|thee|fris\w*|\w*ijs|\w*koek\w*|\w*cake\w*|\w*saus|limonade|snoep|olijven|wafel|detergent|wasmiddel|reiniger|afwas\w*|toilet\w*|tonijn|roomboter|\w*chips|maaltijd)\b/i)
	]
];
