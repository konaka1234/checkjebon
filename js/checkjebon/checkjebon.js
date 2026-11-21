// Based on supermarkt/checkjebon-js at c4729de. See LICENSE.txt.
// Environment detection
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

const SUPERMARKETS_URL = 'https://www.checkjebon.nl/data/supermarkets.json';



/**
 * Get a list of all available supermarkets with their code, name, and icon.
 * @returns {Promise<Array<{code: string, name: string, icon: string|null}>>} Array of supermarkets with code, name, and icon
 */
async function getSupermarkets() {
  const supermarkets = await getSupermarketsJson();
  return supermarkets.map(s => ({
    code: s.n,
    name: s.c,
    icon: s.i || null
  }));
}

/**
 * Get verbose price info for a list of product names.
 * Falls back to average price with isEstimate: true if not found at a supermarket.
 * Rounds all prices to two decimals.
 * Downloads supermarkets.json from checkjebon.nl and caches for 1 hour.
 * @param {string[]} productNames
 * @param {Array<Object|undefined>} searches Optional title and matching rules per query.
 * @returns {Promise<Array>} Array of supermarkets with found products and their verbose info
 */
async function getPricesForProducts(productNames, searches = []) {
  const supermarkets = await getSupermarketsJson();
  const titleIndexes = supermarkets.map(store => indexProductTitles(store.d));

  const allProductMatches = productNames.map((name, index) => {
    const search = searches[index];
    const title = queryTitleKey(name, search);
    const exactMatches = titleIndexes.map(titles => titles.get(title));
    // A pasted product title identifies that listing. Do not fill other
    // stores' prices with a different product merely sharing its words.
    if (search?.specificTitle && exactMatches.some(Boolean)) return exactMatches;

    return supermarkets.map((store, storeIndex) =>
      exactMatches[storeIndex] || findProduct(store.d, name, search)
    );
  });

  return supermarkets.map((supermarket, supermarketIndex) => {
    const foundProducts = productNames.map((name, prodIdx) => {
      const search = searches[prodIdx];
      let match = allProductMatches[prodIdx][supermarketIndex];
      const overrideId = search?.overrides?.[supermarket.n];
      if (overrideId) {
        const title = queryTitleKey(name, search);
        const exactOnly = search.specificTitle && titleIndexes.some(titles => titles.has(title));
        const override = candidateProducts(supermarket.d, name, search, title, exactOnly)
          .find(product => getProductId(product) === overrideId);
        if (override) match = override;
      }
      if (match) {
        return {
          ...describeProduct(match, supermarket),
          isEstimate: false,
          originalQuery: name
        };
      } else {
        // Estimate from automatic matches. A manually chosen pack might have
        // a different size and belongs only to its own store's basket.
        let priceSum = 0;
        let priceCount = 0;
        allProductMatches[prodIdx].forEach((other, i) => {
          if (i !== supermarketIndex && other) {
            priceSum += other.p;
            priceCount++;
          }
        });
        return {
          name: null,
          link: null,
          price: priceCount > 0 ? roundPrice(priceSum / priceCount) : null,
          amount: null,
          isEstimate: priceCount > 0,
          originalQuery: name
        };
      }
    });
    return {
      code: supermarket.n,
      icon: supermarket.i || null,
      name: supermarket.c,
      totalProducts: supermarket.d?.length || 0,
      products: foundProducts
    };
  });
}

async function getProductAlternatives(name, search, storeCode, currentMatch) {
  const supermarkets = await getSupermarketsJson();
  const store = supermarkets.find(supermarket => supermarket.n === storeCode);
  if (!store) return { current: null, alternatives: [] };

  const title = queryTitleKey(name, search);
  const exactOnly = search?.specificTitle && supermarkets.some(supermarket => indexProductTitles(supermarket.d).has(title));
  const choices = candidateProducts(store.d, name, search, title, exactOnly);
  let current = null;
  if (currentMatch?.productId) {
    for (const product of store.d) {
      if (product.n && Number.isFinite(product.p) && getProductId(product) === currentMatch.productId &&
          (!current || product.p < current.p)) current = product;
    }
  }
  const seen = new Set([currentMatch?.productId]);
  const sizes = new Set([packMeasurement(current?.s)]);
  const alternatives = [];
  const sameSize = [];
  // Prefer a few different measured pack sizes before listing near-duplicates.
  for (const candidate of choices) {
    const productId = getProductId(candidate);
    if (seen.has(productId)) continue;
    seen.add(productId);
    const size = packMeasurement(candidate.s);
    if (!size || sizes.has(size)) {
      if (sameSize.length < 3) sameSize.push(candidate);
      continue;
    }
    sizes.add(size);
    alternatives.push(candidate);
    if (alternatives.length === 3) break;
  }
  return {
    current: current ? describeCandidate(current, store) : null,
    alternatives: alternatives.concat(sameSize).slice(0, 3).map(product => describeCandidate(product, store))
  };
}

/**
 * Returns a Checkjebon.nl link for a given shopping list string.
 * @param {string} shoppingList - The shopping list (one item per line)
 * @returns {string} The URL to open on Checkjebon.nl with the list as hash
 */
function getCheckjebonLink(shoppingList) {
  if (Array.isArray(shoppingList)) {
    shoppingList = shoppingList.join('\n');
  }
  // Encode spaces as %20, slashes as %2F, and line breaks as %0A; leave commas and other characters as-is to ensure browsers handles them correctly
  return 'https://www.checkjebon.nl/#' + shoppingList
    .replace(/ /g, '%20')
    .replace(/\//g, '%2F')
    .replace(/\r\n|\n|\r/g, '%0A');
}

/**
 *
 * @returns {Date|null} The last modified date of the prices cache, or null if not available
 */
function pricesLastUpdated() {
  if (cachedCatalogue) return cachedCatalogue.lastModified;

  let lastModified = null;
  if (isNode) {
    try {
      const fs = require('fs');
      if (fs.existsSync(CACHE_KEY)) {
        const raw = fs.readFileSync(CACHE_KEY, 'utf-8');
        const parsed = JSON.parse(raw);
        lastModified = parsed.lastModified || null;
      }
    } catch (e) {}
  } else if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        lastModified = parsed.lastModified || null;
      }
    } catch (e) {}
  }
  return lastModified;
}

/**
 * Get an optimal shopping plan by finding the best combination of supermarkets to minimize total cost.
 * Uses an exhaustive search to evaluate all possible combinations within the maximum store limit.
 * @param {string[]} productNames - List of products to buy
 * @param {number} maxSupermarketVisitCount - Maximum number of supermarkets to visit
 * @param {string[]} selectedSupermarketCodes - Array of supermarket codes to choose from
 * @returns {Promise<{totalCost: number, supermarkets: Array<{code: string, name: string, icon: string|null, products: Array}>}>} Object with totalCost and array of selected supermarkets with their assigned products
 */
async function getOptimalShoppingPlan(productNames, maxSupermarketVisitCount, selectedSupermarketCodes) {
  // Get prices for all products at all supermarkets
  const allPrices = await getPricesForProducts(productNames);
  return getShoppingPlanForPrices(allPrices, maxSupermarketVisitCount, selectedSupermarketCodes);
}

// Plan from the same validated prices shown in the single-store comparison.
function getShoppingPlanForPrices(allPrices, maxSupermarketVisitCount, selectedSupermarketCodes, fixedAssignments = new Map()) {

  // Filter to only selected supermarkets
  const selectedSupermarkets = allPrices.filter(s =>
    selectedSupermarketCodes.includes(s.code)
  );

  if (selectedSupermarkets.length === 0) {
    throw new Error('No matching supermarkets found from selectedSupermarketCodes');
  }

  // Build a matrix of prices: products x supermarkets
  // For each product, track which supermarket has the best price
  const productCount = selectedSupermarkets[0].products.length;
  const supermarketCount = selectedSupermarkets.length;
  const pinnedStores = new Map();
  if (fixedAssignments.size > 0) {
    const storeIndices = new Map(selectedSupermarkets.map((store, index) => [store.code, index]));
    for (let productIndex = 0; productIndex < productCount; productIndex++) {
      const { listIndex } = selectedSupermarkets[0].products[productIndex];
      const storeIndex = storeIndices.get(fixedAssignments.get(listIndex));
      const pinned = selectedSupermarkets[storeIndex]?.products[productIndex];
      if (Number.isFinite(pinned?.price) && !pinned.isEstimate) pinnedStores.set(productIndex, storeIndex);
    }
  }

  // Create price matrix: priceMatrix[productIndex][supermarketIndex] = price (or null)
  const priceMatrix = [];
  for (let p = 0; p < productCount; p++) {
    priceMatrix[p] = [];
    for (let s = 0; s < supermarketCount; s++) {
      const product = selectedSupermarkets[s].products[p];
      priceMatrix[p][s] = product.price;
    }
  }

  // Find optimal assignment using a greedy approach:
  // Iteratively select supermarkets that provide the most products at their cheapest price,
  // minimizing total cost while respecting the maximum number of stores constraint.

  const bestCombination = findBestSupermarketCombination(
    priceMatrix,
    selectedSupermarkets,
    productCount,
    maxSupermarketVisitCount,
    pinnedStores
  );

  return bestCombination;
}

/**
 * Find the best combination of supermarkets using an exhaustive search
 * @param {Array<Array<number|null>>} priceMatrix - Matrix of prices [product][supermarket]
 * @param {Array} supermarkets - Array of supermarket objects
 * @param {string[]} productNames - Product names
 * @param {number} maxStores - Maximum number of stores to visit
 * @param {Map<number, number>} pinnedStores - Store index for each pinned product index
 * @returns {Object} Best combination with totalCost and supermarkets
 */
function findBestSupermarketCombination(priceMatrix, supermarkets, productCount, maxStores, pinnedStores) {
  const supermarketCount = supermarkets.length;
  const supermarketIndices = Array.from({ length: supermarketCount }, (_, i) => i);
  const requiredStores = [...new Set(pinnedStores.values())];
  if (requiredStores.length > maxStores) {
    throw new Error('Pinned stores exceed the maximum number of visits');
  }

  let bestSolution = {
    totalCost: Infinity,
    coveredCount: -1,
    supermarkets: [],
    assignments: []
  };

  // Helper to generate combinations
  function getCombinations(arr, k) {
    const results = [];
    function helper(start, combo) {
      if (combo.length === k) {
        results.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    }
    helper(0, []);
    return results;
  }

  // Iterate over combination sizes from 1 to maxStores
  for (let k = Math.max(1, requiredStores.length); k <= maxStores; k++) {
    const combinations = getCombinations(supermarketIndices, k);
    for (const combination of combinations) {
      if (!requiredStores.every(store => combination.includes(store))) continue;
      let currentCost = 0;
      let currentCoveredCount = 0;
      const currentAssignments = new Array(productCount).fill(-1);

      for (let p = 0; p < productCount; p++) {
        let minPrice = Infinity;
        let bestStore = -1;
        const pinnedStore = pinnedStores.get(p);

        for (const s of combination) {
          if (pinnedStore !== undefined && s !== pinnedStore) continue;
          const price = priceMatrix[p][s];
          if (price !== null && price < minPrice) {
            minPrice = price;
            bestStore = s;
          }
        }

        if (bestStore !== -1) {
          currentCost += minPrice;
          currentAssignments[p] = bestStore;
          currentCoveredCount++;
        } else {
          // Not found in this combination.
          // Assign to first store in combination just to have it somewhere
          currentAssignments[p] = combination[0];
        }
      }

      // Check if this is better
      if (currentCoveredCount > bestSolution.coveredCount) {
        bestSolution = {
          totalCost: currentCost,
          coveredCount: currentCoveredCount,
          supermarkets: combination,
          assignments: currentAssignments
        };
      } else if (currentCoveredCount === bestSolution.coveredCount) {
        if (currentCost < bestSolution.totalCost) {
          bestSolution = {
            totalCost: currentCost,
            coveredCount: currentCoveredCount,
            supermarkets: combination,
            assignments: currentAssignments
          };
        }
      }
    }
  }

  // Construct result
  const result = {
    totalCost: bestSolution.totalCost === Infinity ? 0 : roundPrice(bestSolution.totalCost),
    supermarkets: []
  };

  if (bestSolution.supermarkets.length > 0) {
    for (const storeIndex of bestSolution.supermarkets) {
      const store = supermarkets[storeIndex];
      const storeProducts = [];

      for (let p = 0; p < productCount; p++) {
        if (bestSolution.assignments[p] === storeIndex) {
          storeProducts.push(store.products[p]);
        }
      }

      if (storeProducts.length > 0) {
        result.supermarkets.push({
          code: store.code,
          name: store.name,
          icon: store.icon,
          products: storeProducts
        });
      }
    }
  }

  return result;
}



// --- UNIT CONVERSION HELPERS ---
const unitofmeasures = [
  { unit: "gram", name: "gram", conversion: 1 },
  { unit: "gram", name: "gr", conversion: 1 },
  { unit: "gram", name: "g", conversion: 1 },
  { unit: "gram", name: "kilogram", conversion: 1000 },
  { unit: "gram", name: "kilo", conversion: 1000 },
  { unit: "gram", name: "kg", conversion: 1000 },
  { unit: "gram", name: "k", conversion: 1000 },
  { unit: "gram", name: "pond", conversion: 500 },
  { unit: "milliliter", name: "milliliter", conversion: 1 },
  { unit: "milliliter", name: "mililiter", conversion: 1 },
  { unit: "milliliter", name: "ml", conversion: 1 },
  { unit: "milliliter", name: "liter", conversion: 1000 },
  { unit: "milliliter", name: "l", conversion: 1000 },
  { unit: "milliliter", name: "deciliter", conversion: 100 },
  { unit: "milliliter", name: "dl", conversion: 100 },
  { unit: "milliliter", name: "centiliter", conversion: 10 },
  { unit: "milliliter", name: "cl", conversion: 10 },
];

const unitofmeasurePattern = new RegExp(
  "(?:(\\d+)\\s*[x×]\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(" +
  unitofmeasures.map(unit => unit.name).join("|") + ")\\b", "i"
);

function getAmount(value) {
  const amount = value.match(unitofmeasurePattern);
  return amount ? amount[0] : null;
}

function convertAmountToBase(value) {
  if (value && unitofmeasurePattern.test(value)) {
    const amount = value.match(unitofmeasurePattern);
    const unit = unitofmeasures.find(unit => unit.name === amount[3].toLowerCase());
    const itemCount = Number(amount[1] || 1);
    return (itemCount * parseFloat(amount[2].replace(",", ".")) * unit.conversion) + " " + unit.unit;
  }
  return value;
}

function compareMinimumAmounts(productAmount, searchAmount) {
  if (!productAmount || !searchAmount) return false;
  const productAmountValue = parseFloat(productAmount);
  const searchAmountValue = parseFloat(searchAmount);
  let productAmountUnit = productAmount.match(/([a-z]+)/i);
  let searchAmountUnit = searchAmount.match(/([a-z]+)/i);

  if (productAmountUnit && searchAmountUnit) {
    productAmountUnit = productAmountUnit[0];
    searchAmountUnit = searchAmountUnit[0];
  }
  return (productAmountUnit === searchAmountUnit && productAmountValue >= searchAmountValue);
}

// --- PRODUCT SEARCH LOGIC ---
const indexedTitles = new WeakMap();

function productTitleKey(title) {
  return title.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function queryTitleKey(name, search) {
  return productTitleKey(search?.title ?? name.trim().replace(/^x\s+/i, ''));
}

function getProductId(product) {
  return JSON.stringify([productTitleKey(product.n), String(product.s ?? '').toLowerCase().trim(), product.l ?? '']);
}

function describeProduct(product, store) {
  return {
    productId: getProductId(product),
    name: product.n,
    link: product.l ? (store.u || '') + product.l : null,
    price: roundPrice(product.p),
    amount: product.s
  };
}

function describeCandidate(product, store) {
  const candidate = describeProduct(product, store);
  return {
    ...candidate,
    unitPrice: getUnitPrice(candidate.price, candidate.amount)
  };
}

function packMeasurement(packageSize) {
  if (typeof packageSize !== 'string') return null;

  // Compute the rate only from a measured pack. A capacity in a product's
  // title or a pack counted in pieces does not describe its net contents.
  let label = packageSize.trim().replace(/\b(kilogram|kilo|gram|centiliter|deciliter|milliliter|mililiter|liter)s\b/gi, '$1');
  if (/^per\s+(?:kg|kilo|kilogram|l|liter)$/i.test(label)) label = label.replace(/^per\s+/i, '1 ');
  label = label.replace(/^(?:per\s+|ca\.?\s*|circa\s+)/i, '');
  const amount = getAmount(label);
  if (!amount || !label.startsWith(amount)) return null;
  const remainder = label.slice(amount.length).trim();
  if (remainder && !/^\((?:ca\.?\s*)?\d+\s+stuks?\)$/i.test(remainder)) return null;

  return convertAmountToBase(amount);
}

function getUnitPrice(price, packageSize) {
  const measurement = packMeasurement(packageSize);
  if (!measurement) return null;
  const [quantity, unit] = measurement.split(' ');
  const perUnit = price * 1000 / Number(quantity);
  if (!Number.isFinite(perUnit) || Number(quantity) <= 0) return null;
  return { price: roundPrice(perUnit), unit: unit === 'gram' ? 'kg' : 'L' };
}

function indexProductTitles(products) {
  const cached = indexedTitles.get(products);
  if (cached) return cached;

  const titles = new Map();
  for (const product of products) {
    if (!product.n || !Number.isFinite(product.p)) continue;
    const title = productTitleKey(product.n);
    const current = titles.get(title);
    if (!current || product.p < current.p) titles.set(title, product);
  }
  indexedTitles.set(products, titles);
  return titles;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findProducts(products, value, allowFuzzy = true) {
  // Ignore leading 'x ' (already bought) for search, but keep original for originalQuery
  let searchValue = value.trim().replace(/^x\s+/i, '');
  const amount = getAmount(searchValue);
  if (amount) searchValue = searchValue.replace(amount, "");
  const patterns = searchValue.trim().split(/\s+/).filter(Boolean).map(p => new RegExp(escapeRegExp(p), "i"));
  if (patterns.length === 0) return [];
  let productMatches = products.filter(product =>
    patterns.every(pattern => pattern.test(product.n))
  );
  if (productMatches.length === 0 && allowFuzzy) {
    // Fallback: fuzzy match
    const fallbackPattern = [new RegExp(Array.from(searchValue.replace(/\s/g, ""), escapeRegExp).join(".*"), "i")];
    productMatches = products.filter(product =>
      fallbackPattern.every(pattern => pattern.test(product.n))
    );
  }
  if (amount) {
    const baseAmount = convertAmountToBase(amount);
    productMatches = productMatches.filter(product =>
      compareMinimumAmounts(convertAmountToBase(product.s), baseAmount)
    );
  }
  productMatches.sort((a, b) => {
    const aLength = patterns.reduce((acc, pattern) => acc + (a.n.match(pattern)?.[0]?.length || 0), 0);
    const bLength = patterns.reduce((acc, pattern) => acc + (b.n.match(pattern)?.[0]?.length || 0), 0);
    if (Math.abs(aLength - bLength) < 3) return a.p - b.p;
    return aLength - bLength;
  });
  return productMatches;
}

function isRegularListing(product) {
  return product.n && Number.isFinite(product.p) && product.p > 0.01 && !/\bcoupon\b/i.test(product.n);
}

function scoreProduct(product, search, minimum) {
  if (!isRegularListing(product)) return 0;
  const score = search.scoreName(product.n);
  if (!score || !minimum) return score;

  // Several stores include the pack size only in the product title.
  const amount = getAmount(product.s || '') || getAmount(product.n);
  return compareMinimumAmounts(convertAmountToBase(amount), minimum) ? score : 0;
}

function findProduct(products, name, search) {
  if (!search?.scoreName) return findProducts(products, name)[0];

  const minimum = convertAmountToBase(search.amount);
  let cheapest;
  let bestScore = 0;
  for (const product of products) {
    const score = scoreProduct(product, search, minimum);
    if (score === 0 || score < bestScore) continue;
    if (!cheapest || score > bestScore || product.p < cheapest.p) {
      cheapest = product;
      bestScore = score;
    }
  }
  return cheapest;
}

function candidateProducts(products, name, search, title, exactOnly) {
  const exact = products.filter(product => isRegularListing(product) && productTitleKey(product.n) === title);
  exact.sort((left, right) => left.p - right.p);
  if (exactOnly) return exact;

  const exactProducts = new Set(exact);
  if (!search?.scoreName) {
    const direct = findProducts(products, name, false)
      .filter(product => isRegularListing(product) && !exactProducts.has(product));
    return exact.concat(direct);
  }

  const minimum = convertAmountToBase(search.amount);
  const ranked = [];
  for (const product of products) {
    if (exactProducts.has(product)) continue;
    const score = scoreProduct(product, search, minimum);
    if (score) ranked.push({ product, score });
  }
  ranked.sort((left, right) => right.score - left.score || left.product.p - right.product.p);
  return exact.concat(ranked.map(entry => entry.product));
}

function roundPrice(price) {
  if (typeof price === 'number' && !isNaN(price)) {
    return Math.round(price * 100) / 100;
  }
  return price;
}




// --- NODE.JS AND BROWSER-COMPATIBLE FETCH/CACHE HELPERS ---
const CACHE_KEY = 'supermarkets.cache.json';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cachedCatalogue;
let pendingCatalogue;

function getCache() {
  if (cachedCatalogue && Date.now() - cachedCatalogue.fetchedAt < CACHE_TTL_MS) {
    return cachedCatalogue.data;
  }
  if (isNode) {
    try {
      const fs = require('fs');
      if (fs.existsSync(CACHE_KEY)) {
        const raw = fs.readFileSync(CACHE_KEY, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && Array.isArray(parsed.data) && parsed.fetchedAt) {
          if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
            cachedCatalogue = parsed;
            return parsed.data;
          }
        }
      }
    } catch (e) {}
  } else if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && Array.isArray(parsed.data) && parsed.fetchedAt) {
          if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
          cachedCatalogue = parsed;
            return parsed.data;
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

function setCache(data, lastModified) {
  const cacheObj = { fetchedAt: Date.now(), data, lastModified: lastModified || null };
  // The catalogue may exceed the browser's localStorage limit. Keep it in
  // memory so opening a product picker never has to reload the full feed.
  cachedCatalogue = cacheObj;
  if (isNode) {
    try {
      const fs = require('fs');
      fs.writeFileSync(CACHE_KEY, JSON.stringify(cacheObj), 'utf-8');
    } catch (e) {}
  } else if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
    } catch (e) {}
  }
}

function fetchSupermarketsJson() {
  if (isNode) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      https.get(SUPERMARKETS_URL, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch supermarkets.json. Status code: ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        let lastModified = res.headers['last-modified'] || null;
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            setCache(parsedData, lastModified);
            resolve(parsedData);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  } else if (typeof fetch !== 'undefined') {
    return fetch(SUPERMARKETS_URL)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch supermarkets.json');
        const lastModified = res.headers.get('Last-Modified') || null;
        return res.json().then(data => {
          setCache(data, lastModified);
          return data;
        });
      });
  } else {
    return Promise.reject(new Error('No fetch method available'));
  }
}

async function getSupermarketsJson() {
  const cached = getCache();
  if (cached) return cached;
  if (!pendingCatalogue) {
    pendingCatalogue = fetchSupermarketsJson().finally(() => {
      pendingCatalogue = null;
    });
  }
  return pendingCatalogue;
}


const exported = {
  getAmount,
  getPricesForProducts,
  getProductAlternatives,
  getOptimalShoppingPlan,
  getShoppingPlanForPrices,
  getSupermarkets,
  getCheckjebonLink,
  pricesLastUpdated
};

if (isNode) {
  module.exports = exported;
} else if (typeof window !== 'undefined') {
  window.checkjebon = exported;
}
