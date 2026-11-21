Vue.component('share-button', {
	template: '#share-button-template'
});

Vue.component('supermarket-products', {
	template: '#supermarket-products-template',
	props: ['supermarket', 'showShareButton', 'openMatch', 'isSearching']
});

var app = new Vue(
{
	el: "#checkjebon",
	data:
	{
		language: initialLanguage(),
		prices: [],
		pricesLastUpdated: null,
		shoppinglist: "",
		matchChoices: [],
		openMatch: null,
		priceRequest: 0,
		products: [],
		supermarkets: [],
		selectedSupermarket: null,
		isSearching: false,
		shopMultipleSupermarkets: false,
		maxSupermarkets: null,
		availableSupermarkets: [],
		selectedSupermarketCodes: [],
		shoppingPlan: null,
		showSupermarketSelection: false
	},
	computed:
	{
		pricesNeedReview: function()
		{
			return this.supermarkets.some(store => store.products.some(product => product.needsReview));
		},
		compareLabel: function()
		{
			if (this.isSearching) return this.t('searching');
			return this.t(this.shopMultipleSupermarkets ? 'pickStores' : 'compare');
		}
	},
	watch:
	{
		language: function(language)
		{
			localStorage.setItem('checkjebonLanguage', language);
			const page = new URL(window.location.href);
			page.searchParams.set('lang', language);
			window.history.replaceState(window.history.state, '', page);
			this.updatePageLanguage();
		},
		shopMultipleSupermarkets: function(val)
		{
			this.invalidatePrices();
			if (!val)
			{
				this.showSupermarketSelection = false;
				this.shoppingPlan = null;
			}
			this.supermarkets = [];
			this.selectedSupermarket = null;
			this.saveShoppinglist();
		}
	},
	methods:
	{
		updatePageLanguage: function()
		{
			document.documentElement.lang = this.language;
			document.title = this.t('pageTitle');
			document.getElementById('page-description').content = this.t('pageDescription');
		},
		explainMissingSupermarkets: function()
		{
			alert(this.t('whyMissingMessage'));
		},
		loadSupermarkets: async function()
		{
			try {
				this.availableSupermarkets = await checkjebon.getSupermarkets();
			} catch (e) {
				console.error("Failed to load supermarkets", e);
			}
		},
		invalidatePrices: function()
		{
			this.priceRequest++;
			this.isSearching = false;
			this.openMatch = null;
		},
		refreshPrices: async function(inPlan, { scroll = true, choices = this.matchChoices, expectedMatch = null } = {})
		{
			const request = ++this.priceRequest;
			const storeCodes = [...this.selectedSupermarketCodes];
			const maxStores = this.maxSupermarkets;
			this.isSearching = true;
			this.openMatch = null;

			try
			{
				const prices = await getShoppingListPrices(this.shoppinglist, this.language, choices);
				if (request !== this.priceRequest) return;
				if (expectedMatch && !prices.find(store => store.code === expectedMatch.storeCode)?.products.some(product =>
					product.matchKey === expectedMatch.matchKey && product.productId === expectedMatch.productId && product.isManualMatch
				))
				{
					alert(this.t('matchUnavailable'));
					return;
				}

				if (inPlan)
				{
					this.shoppingPlan = shoppingPlanForChoices(prices, maxStores, storeCodes, choices);
					this.selectedSupermarket = null;
				}
				else
				{
					const selectedCode = this.selectedSupermarket?.code;
					this.supermarkets = prices.sort((a, b) => a.totalPrice - b.totalPrice);
					this.selectedSupermarket = prices.find(store => store.code === selectedCode) ?? null;
				}
				this.pricesLastUpdated = checkjebon.pricesLastUpdated();
				if (choices !== this.matchChoices)
				{
					this.matchChoices = choices;
					this.saveShoppinglist();
				}
				if (scroll && (inPlan || !this.selectedSupermarket))
				{
					this.$nextTick(() => {
						document.getElementById(inPlan ? 'shopping-plan' : 'supermarkets')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
					});
				}
				return true;
			}
			catch (error)
			{
				if (request === this.priceRequest)
				{
					alert(this.t(inPlan ? 'planError' : 'searchError'));
					console.error(error);
				}
			}
			finally
			{
				if (request === this.priceRequest) this.isSearching = false;
			}
		},
		createShoppingPlan: async function(scrollToResults = true)
		{
			if (!this.selectedSupermarketCodes.length || !this.maxSupermarkets || !this.shoppinglist?.trim())
			{
				this.invalidatePrices();
				this.shoppingPlan = null;
				return;
			}
			await this.refreshPrices(true, { scroll: scrollToResults });
		},
		updateShoppingPlan: function()
		{
			this.saveShoppinglist();
			if (this.shoppingPlan || this.isSearching) this.createShoppingPlan(false);
		},
		example: function()
		{
			this.shoppinglist = this.t('exampleList');
			this.update();
		},
		scan: function()
		{
			if (this.prices.length == 0)
			{
				setTimeout(function()
				{
					// Still loading prices, wait and retry
					app.scan();
				}, 100);
				return;
			}
			
			var fileSelector = document.getElementById("file-selector");
			
			fileSelector.addEventListener("change", (event) =>
			{
				var fileList = event.target.files;
				if (fileList.length > 0)
				{
					var fileReader = new FileReader();
					fileReader.addEventListener("load", (event) => 
					{
						var imageData = event.target.result;
						Tesseract.recognize(
							imageData,
							"nld",
							{
								logger: m => 
								{
									this.shoppinglist = m.status + ": " + (m.progress * 100).toFixed(0) + "%";
								}
							}
						).then(({ data: { text } }) => 
						{
							// Remove all non-text characters
							text = text.toLowerCase().replace(/([^a-zA-Z\s])+/g, "");
							// Remove all words that are 3 or less characters
							text = text.replace(/\b([a-zA-Z]){0,3}\b/g, "");
							// Trim results
							text = text.split("\n").map(t => t.trim()).join("\n");
							// Remove empty lines
							text = text.trim().replace(/\n{2,}/g, "\n");
							// Use fuzzy search logic to find closest match in an attempt to fix reading errors
							var words = [... new Set(app.prices.map(p => p.d).flat().map(p => p.n.toLowerCase().split(" ")).flat())].filter(p => p.length > 4);
							var ignoredWords = ["prijs", "aantal", "e-prijs", "actieprijs", "kassa", "lade", "omschrijving", "subtotaal", "totaal"];
							words = words.concat(ignoredWords);
							text = text.split("\n").filter(line => line.trim() != "").map((line, i) =>
							{
								// Update status
								this.shoppinglist = "matching: " + (i / text.split("\n").length * 100).toFixed(0) + "%";
								// Find closest match
								return line.split(/\s/).map(word => 
								{
									const options = {
										shouldSort: true,
										threshold: 0.4,
									};
									// Find closest match using words that somewhat match in length
									const fuse = new Fuse(words.filter(w => Math.abs(w.length - word.length) < 3), options);
									var results = fuse.search(word);
									// Exclude ignored words
									var result = results[0]?.item || word
									if (ignoredWords.includes(result))
									{
										return "";
									}
									// Return result
									return result;
								}).join(" ");								
							}).join("\n");
							// Capitalize first letter of each word
							text = text.replace(/\b[a-z]/g, letter => letter.toUpperCase());
							// Update shoppinglist
							this.shoppinglist = text;
						})
						
					});
					fileReader.readAsDataURL(fileList[0]);
				}
			});
			
			fileSelector.showPicker();
		},
		search: async function()
		{
			if (!this.shoppinglist?.trim())
			{
				this.update();
				return;
			}

			if (this.shopMultipleSupermarkets)
			{
				this.invalidatePrices();
				this.showSupermarketSelection = true;
				this.shoppingPlan = null;
				this.selectedSupermarket = null;
				this.supermarkets = [];
				if (this.availableSupermarkets.length === 0) await this.loadSupermarkets();
				this.$nextTick(() => {
					document.getElementById('supermarket-selection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
				});
				return;
			}

			this.showSupermarketSelection = false;
			this.shoppingPlan = null;
			await this.refreshPrices(false);
		},
		select: function()
		{
			this.openMatch = null;
			this.$nextTick(() => document.getElementById('articles')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
		},
		focusMatchToggle: function(supermarket, product)
		{
			this.$nextTick(() => {
				document.getElementById('match-toggle-' + supermarket.code + '-' + product.listIndex)?.focus({ preventScroll: true });
			});
		},
		toggleMatch: async function(supermarket, product)
		{
			if (this.isSearching) return;
			if (this.openMatch?.storeCode === supermarket.code && this.openMatch.listIndex === product.listIndex)
			{
				this.openMatch = null;
				this.focusMatchToggle(supermarket, product);
				return;
			}

			const line = this.shoppinglist.split('\n')[product.listIndex];
			if (!line?.trim()) return;
			const search = prepareSearchItem(line, product.listIndex, this.language);
			const drawer = {
				storeCode: supermarket.code,
				listIndex: product.listIndex,
				loading: true,
				error: false,
				current: null,
				options: []
			};
			this.openMatch = drawer;
			try
			{
				const { current, alternatives } = await checkjebon.getProductAlternatives(search.query, search, supermarket.code, product);
				if (this.openMatch !== drawer) return;
				drawer.current = current;
				drawer.options = alternatives;
			}
			catch (error)
			{
				if (this.openMatch === drawer) drawer.error = true;
			}
			finally
			{
				if (this.openMatch === drawer) drawer.loading = false;
			}
		},
		pickMatch: async function(supermarket, product, option)
		{
			const drawer = this.openMatch;
			if (this.isSearching || drawer?.storeCode !== supermarket.code || drawer.listIndex !== product.listIndex) return;
			if (option ? !drawer.options.some(candidate => candidate.productId === option.productId) : !product.isManualMatch) return;

			const forPlan = Boolean(this.shoppingPlan);
			const choices = this.matchChoices
				.filter(choice => choice.matchKey !== product.matchKey || choice.storeCode !== supermarket.code)
				.map(choice => option && forPlan && choice.matchKey === product.matchKey ? { ...choice, forPlan: false } : choice);
			const expectedMatch = option && {
				matchKey: product.matchKey,
				storeCode: supermarket.code,
				productId: option.productId,
				forPlan
			};
			if (expectedMatch) choices.push(expectedMatch);
			const request = this.priceRequest + 1;
			await this.refreshPrices(forPlan, { scroll: false, choices, expectedMatch });
			if (request === this.priceRequest) this.focusMatchToggle(supermarket, product);
		},
		check: function(product, event)
		{
			const lines = this.shoppinglist.split('\n');
			const line = lines[product.listIndex];
			product.checked = event.target.checked;
			lines[product.listIndex] = (product.checked ? 'x ' : '') + line.replace(/^x\s+/, '');
			this.shoppinglist = lines.join('\n');
			this.saveShoppinglist();
		},
		edit: async function(product, message)
		{
			const lines = this.shoppinglist.split('\n');
			const line = lines[product.listIndex];
			const newProduct = window.prompt(message, line.replace(/^x\s+/, ''));
			if (newProduct?.trim())
			{
				lines[product.listIndex] = (/^x\s+/.test(line) ? 'x ' : '') + newProduct.trim();
				this.shoppinglist = lines.join('\n');
				this.retainMatchChoices();
				this.saveShoppinglist();
				const request = this.priceRequest + 1;
				const refreshed = await this.refreshPrices(Boolean(this.shoppingPlan), { scroll: false });
				if (!refreshed && request === this.priceRequest)
				{
					this.supermarkets = [];
					this.selectedSupermarket = null;
					this.shoppingPlan = null;
				}
			}
		},
		share: async function()
		{
			const url = new URL(window.location.href);
			url.searchParams.set('lang', this.language);
			let hash = this.shoppinglist.replace(/%/g, '%25').replace(/\|/g, '%7C').replace(/\n/g, '%0A');
			if (this.shopMultipleSupermarkets || this.matchChoices.length)
			{
				hash += '|' + Number(this.shopMultipleSupermarkets) + '|' + (this.maxSupermarkets ?? '') +
					'|' + this.selectedSupermarketCodes.join(',');
				if (this.matchChoices.length) hash += '|' + encodeURIComponent(JSON.stringify(this.matchChoices));
			}
			url.hash = hash;
			if (navigator.share)
			{
				try
				{
					await navigator.share({
						title: 'Checkjebon.nl',
						text: this.t('sharedText'),
						url: url.href
					});
					return;
				}
				catch (error)
				{
					if (error.name === 'AbortError') return;
					console.log('Error sharing link', error);
				}
			}
			const products = this.shoppinglist.split('\n').map(p => p.trim()).filter(Boolean);
			const body = [this.t('emailIntro'), products.map(p => '- ' + p).join('\n')];
			if (this.selectedSupermarket)
			{
				body.push(this.t('emailTotal', {
					store: this.selectedSupermarket.name,
					price: this.formatPrice(this.selectedSupermarket.totalPrice)
				}));
			}
			body.push(this.t('emailLink'), url.href);
			window.location.href = 'mailto:?subject=' + encodeURIComponent(this.t('emailSubject')) +
				'&body=' + encodeURIComponent(body.join('\n\n'));
		},
		saveShoppinglist: function()
		{
			localStorage.setItem("shoppinglist", this.shoppinglist);
			localStorage.setItem("shopMultipleSupermarkets", this.shopMultipleSupermarkets);
			localStorage.setItem("maxSupermarkets", this.maxSupermarkets);
			localStorage.setItem("selectedSupermarketCodes", JSON.stringify(this.selectedSupermarketCodes));
			localStorage.setItem('checkjebonMatchChoices', JSON.stringify(this.matchChoices));
		},
		loadShoppinglist: async function()
		{
			// Populate shoppinglist from memory
			this.shoppinglist = localStorage.getItem("shoppinglist") ?? '';
			this.matchChoices = readMatchChoices(localStorage.getItem('checkjebonMatchChoices'));
			this.shopMultipleSupermarkets = localStorage.getItem("shopMultipleSupermarkets") === "true";
			this.maxSupermarkets = parseInt(localStorage.getItem("maxSupermarkets")) || null;
			try {
				this.selectedSupermarketCodes = JSON.parse(localStorage.getItem("selectedSupermarketCodes")) || [];
			} catch(e) {
				this.selectedSupermarketCodes = [];
			}

			// Override shoppinglist from URL hash, if present
			if (window.location.hash)
			{
				if (!this.shoppinglist || window.confirm(this.t('replaceList')))
				{
					const parts = window.location.hash.slice(1).split("|");
					this.shoppinglist = decodeURI(parts[0]);
					try {
						this.matchChoices = readMatchChoices(decodeURIComponent(parts[4] ?? ''));
					} catch (error) {
						this.matchChoices = [];
					}
					if (parts.length > 1) {
						this.shopMultipleSupermarkets = parts[1] === "1";
						this.maxSupermarkets = parseInt(parts[2]) || null;
						this.selectedSupermarketCodes = parts[3] ? parts[3].split(",") : [];
					}
					this.retainMatchChoices();
					this.saveShoppinglist();
				}
				window.location.hash = "";
			}

			if (this.shopMultipleSupermarkets && this.shoppinglist && this.shoppinglist.trim() !== '') {
				// Only show the supermarket selection on load when there is a non-empty shopping list.
				this.showSupermarketSelection = true;
				if (this.availableSupermarkets.length === 0) {
					await this.loadSupermarkets();
				}
			
				if (this.maxSupermarkets && this.selectedSupermarketCodes.length > 0) {
					this.createShoppingPlan(true);
				}
			} else {
				// Ensure the supermarket selection and any results are hidden when there's
				// no shopping list during initial page load.
				this.showSupermarketSelection = false;
				this.shoppingPlan = null;
				this.supermarkets = [];
				this.selectedSupermarket = null;
			}
		},
		retainMatchChoices: function()
		{
			if (!this.matchChoices.length) return;
			const matchKeys = new Set(shoppingListRows(this.shoppinglist).map(row => row.matchKey));
			this.matchChoices = this.matchChoices.filter(choice => matchKeys.has(choice.matchKey));
		},
		update: function()
		{
			this.invalidatePrices();
			this.retainMatchChoices();
			this.selectedSupermarket = null;
			this.supermarkets = [];
			
			if (this.shopMultipleSupermarkets)
			{
				this.showSupermarketSelection = false;
				this.shoppingPlan = null;
			}

			this.saveShoppinglist();
		},
		clear: function()
		{
			this.shoppinglist = "";
			this.update();
		}
	},
	created: function()
	{
		this.updatePageLanguage();
		this.loadShoppinglist();
	}
});
