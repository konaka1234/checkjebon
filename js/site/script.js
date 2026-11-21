Vue.component('share-button', {
	template: '#share-button-template'
});

Vue.component('supermarket-products', {
	template: '#supermarket-products-template',
	props: ['supermarket', 'showShareButton']
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
		createShoppingPlan: async function(scrollToResults = true)
		{
			if (this.selectedSupermarketCodes.length === 0) {
				this.shoppingPlan = null;
				return;
			}
			
			this.isSearching = true;
			const search = prepareProductSearch(this.shoppinglist);
			
			try {
				const result = await checkjebon.getOptimalShoppingPlan(
					search.queries,
					this.maxSupermarkets,
					this.selectedSupermarketCodes
				);
				
				this.pricesLastUpdated = checkjebon.pricesLastUpdated();
				const plan = {
					...result,
					supermarkets: result.supermarkets.map(s => ({
						...s,
						products: s.products.map(search.restore),
						totalPrice: s.products.reduce((sum, p) => sum + (p.price || 0), 0),
						notFound: s.products.filter(p => p.isEstimate).length
					}))
				};
				this.selectedSupermarket = null; // Clear single selection

				// Compute aggregate values for the shopping plan
				// totalCost: sum of assigned products' prices
				plan.totalCost = plan.supermarkets.reduce((sum, s) => sum + (s.totalPrice || 0), 0);
				plan.bestSingleTotal = null;
				plan.totalSavings = 0;

				// Compute best single-supermarket total using current product list and selected supermarket codes
				try {
					const allPricesResults = await checkjebon.getPricesForProducts(search.queries);
					// Filter to only supermarkets that were selectable for this plan (selectedSupermarketCodes)
					const filtered = allPricesResults.filter(s => this.selectedSupermarketCodes.includes(s.code));
					const singleTotals = filtered.map(s => ({
						code: s.code,
						name: s.name,
						totalPrice: s.products.reduce((sum, p) => sum + (p.price || 0), 0)
					}));
					if (singleTotals.length > 0) {
						const best = singleTotals.reduce((min, s) => s.totalPrice < min.totalPrice ? s : min, singleTotals[0]);
						plan.bestSingleTotal = best.totalPrice;
						plan.bestSingleName = best.name;
						plan.totalSavings = best.totalPrice - plan.totalCost;
					}
				} catch (e) {
					console.error('Failed to compute single-shop totals', e);
				}
				this.shoppingPlan = plan;
				
				if (scrollToResults) {
					setTimeout(function()
					{
						document.getElementById("shopping-plan")?.scrollIntoView({behavior: "smooth", block: "start"});
					}, 100);
				}
				
			} catch (e) {
				alert(this.t('planError'));
				console.error(e);
			}
			this.isSearching = false;
		},
		updateShoppingPlan: function()
		{
			if (this.shoppingPlan)
			{
				this.createShoppingPlan(false);
			}
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
			if (!this.shoppinglist || this.shoppinglist.trim() === "") {
				this.supermarkets = [];
				return;
			}

			if (this.shopMultipleSupermarkets) {
				this.showSupermarketSelection = true;
				this.shoppingPlan = null;
				this.selectedSupermarket = null;
				this.supermarkets = [];
				if (this.availableSupermarkets.length === 0) {
					await this.loadSupermarkets();
				}
				setTimeout(function()
				{
					const el = document.getElementById("supermarket-selection");
					if(el) el.scrollIntoView({behavior: "smooth", block: "start"});
				}, 100);
				return;
			}

			this.isSearching = true;
			this.showSupermarketSelection = false;
			this.shoppingPlan = null;
			const search = prepareProductSearch(this.shoppinglist);
			try {
				const results = await checkjebon.getPricesForProducts(search.queries);
				this.pricesLastUpdated = checkjebon.pricesLastUpdated();
				this.supermarkets = results.map(s => ({
					...s,
					products: s.products.map(search.restore),
					totalPrice: s.products.reduce((sum, p) => sum + (p.price || 0), 0),
					notFound: s.products.filter(p => p.isEstimate).length
				}));
				this.supermarkets.sort((a, b) => a.totalPrice - b.totalPrice);
				if (!this.selectedSupermarket) {
					setTimeout(function()
					{
						document.getElementById("supermarkets")?.scrollIntoView({behavior: "smooth", block: "start"});
					}, 100);
				}
			} catch (e) {
				alert(this.t('searchError'));
				console.error(e);
			}
			this.isSearching = false;
		},
		select: function()
		{
			setTimeout(function()
			{
				document.getElementById("articles")?.scrollIntoView({behavior: "smooth", block: "start"});
			}, 100);
		},
		check: function(product, event)
		{
			const lines = this.shoppinglist.split('\n');
			const line = lines[product.listIndex];
			product.checked = event.target.checked;
			lines[product.listIndex] = (product.checked ? 'x ' : '') + line.replace(/^x /, '');
			this.shoppinglist = lines.join('\n');
			this.saveShoppinglist();
		},
		edit: async function(product, message)
		{
			const lines = this.shoppinglist.split('\n');
			const line = lines[product.listIndex];
			const newProduct = window.prompt(message, line.replace(/^x /, ''));
			if (newProduct?.trim())
			{
				lines[product.listIndex] = (line.startsWith('x ') ? 'x ' : '') + newProduct.trim();
				this.shoppinglist = lines.join('\n');
				this.saveShoppinglist();

				if (this.shoppingPlan)
				{
					await this.createShoppingPlan(false);
				}
				else
				{
					const currentCode = this.selectedSupermarket.code;
					await this.search();
					this.selectedSupermarket = this.supermarkets.find(s => s.code === currentCode);
				}
			}
		},
		share: async function()
		{
			const url = new URL(window.location.href);
			url.searchParams.set('lang', this.language);
			let hash = this.shoppinglist.replace(/%/g, '%25').replace(/\|/g, '%7C').replace(/\n/g, '%0A');
			if (this.shopMultipleSupermarkets)
			{
				hash += '|1|' + this.maxSupermarkets + '|' + this.selectedSupermarketCodes.join(',');
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
		},
		loadShoppinglist: async function()
		{
			// Populate shoppinglist from memory
			this.shoppinglist = localStorage.getItem("shoppinglist");
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
					if (parts.length > 1) {
						this.shopMultipleSupermarkets = parts[1] === "1";
						this.maxSupermarkets = parseInt(parts[2]) || null;
						this.selectedSupermarketCodes = parts[3] ? parts[3].split(",") : [];
					}
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
		update: function()
		{
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
