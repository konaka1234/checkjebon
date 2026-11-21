# Checkjebon.nl

Comparing food prices across multiple supermarkets is made a lot simpler using Checkjebon.nl. Simply scan your receipt, or enter your shopping list manually and you can instantly compare how much you would spend at each supermarket on the exact same products. You can query for generic products like `milk` or be more exact and specify the brand and amount.

The project can freely be used on https://www.checkjebon.nl/

<img src="./images/screenshot1.png" width="300" title="Shopping list editor">

This will bring up the amount due per supermarket for the shopping list.

<img src="./images/screenshot2.png" width="300" title="Prices per supermarket">

After setting up your shopping list and selecting your preferred supermarket, simply check off items as you collect them from the store.

<img src="./images/screenshot3.png" width="300" title="Shopping list">

You can share your current shopping list with family members or friends at any time, or use the sharing functionality to use the shopping list created on your desktop or tablet to your phone as you go out to get groceries.

# Language and local development

Choose **English** in the language menu or open the page with `?lang=en`. The
site remembers your language preference. You can mix Dutch and common English
grocery terms in either interface, such as `500 g chicken drumsticks` and
`Oatly haverdrank`.
Results show the supermarket's original product names. Items without a reliable
match are flagged for review and left out of the total. You can edit the search
term from the result and try the supermarket's Dutch product name.

Use the pencil in a store's basket to compare up to three other matches.
When the catalogue gives the pack weight or volume, the picker shows the unit
price as well as the pack price. Choosing a product changes that store's quote
and saves the choice with your list. Partial totals show how many prices were
matched, estimated or unavailable.

To run the site locally, run `python3 -m http.server 8000` from the repository
root and open `http://localhost:8000/?lang=en`. The app uses a local copy of
`checkjebon-js` with support for stricter search rules. It still fetches price
data from Checkjebon.nl. Run `node --test` to audit catalogue titles and check the
bilingual search and shopping-plan regression cases.

# Including in other products

To include Checkjebon.nl in other products, use the [checkjebon-js](https://github.com/supermarkt/checkjebon-js) library as a starting point. This library will take care of loading the latest data and exposing it in a format that is easy to use.

# Supported supermarkets

Checkjebon.nl is aimed at the Dutch market, and currently aims to provide accurate and recent prices for:

* [AH](https://www.ah.nl/)
* [ALDI](https://www.aldi.nl/) - Note; limited assortment due to not all products being available online.
* [Coop](https://www.coop.nl/)
* [DekaMarkt](https://www.dekamarkt.nl/) - Note; limited assortment due to not all products being available online.
* [Dirk](https://www.dirk.nl/)
* [Hoogvliet](https://www.hoogvliet.com/)
* [Jan Linders](https://www.janlinders.nl/)
* [Jumbo](https://www.jumbo.com/)
* [Picnic](http://picnic.nl/) - Note; no links to products
* [Plus](https://www.plus.nl/)
* [SPAR](https://www.spar.nl/)
* [Vomar](https://www.vomar.nl/)

Some supermarkets do not provide prices for their products online or are not yet indexed on a daily basis, and therefor are currently not included in the data set:

* [Boni](https://bonisupermarkt.nl/) - No online assortment.
* [Boon's Markt (MCD)](https://www.boonsmarkt.nl/) - No online assortment.
* [Butlon](https://butlon.com/) - Not yet indexed.
* [Crisp](https://www.crisp.nl/) - No online assortment without an account.
* [Dagwinkel](https://www.lekkermakkelijk.nl/) - Not yet indexed.
* [EkoPlaza](https://www.ekoplaza.nl/) - Not yet indexed.
* [Flink](https://www.goflink.com/) -  Not yet indexed.
* [GORILLAS](https://gorillas.io/nl) - No online assortment without an account.
* [Hanos](https://hanos.nl/) - No online assortment without an account.
* [Makro](https://www.makro.nl/) - Not yet indexed.
* [Marqt](https://www.marqt.nl/) - No online assortment.
* [LIDL](https://www.lidl.nl/) - No online assortment.
* [Nettorama](https://www.nettorama.nl/) - No online assortment.
* [Odin](https://www.odin.nl/) -  Not yet indexed.
* [Poiesz](https://www.poiesz-supermarkten.nl/) - Not yet indexed.
* [Sligro](https://www.sligro.nl/) - No online assortment without an account.

# Product selection algorithm

An exact supermarket product title takes priority over grocery aliases. Matching
ignores case and extra spaces. If a supermarket lists the same title at several
prices, the comparison uses the cheapest listing. Add a minimum package size
to distinguish sizes when they share a title, for example `500 g rode linzen`.

For general items, the grocery dictionary maps English and Dutch terms to the
relevant Dutch catalogue terms. English mode also accepts literal Dutch names
when a term is outside the dictionary. The Dutch mode keeps fuzzy search for
unrecognized terms. When a supermarket lacks a match, any price estimate is based
on matches at other supermarkets. Items flagged for review have no price in the total.

# Receipt scanning

When scanning receipts, [Tesseract.js](https://github.com/naptha/tesseract.js/) is used in order to detect text. After that, some processing is done to align the recognized text with true product names. Adjust any errors where necessary.

# Privacy

When entering your shopping list, you data never leaves your computer. All processing is done in the browser. This means no one can keep track of your purchases or build an advertisement profile based on your searches. Upon opening Checkjebon.nl, all available prices will be downloaded. You will notice that reloading the page will not empty your shopping list; this is stored in your browser using the [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

# Open data

Product [price data](https://github.com/supermarkt/checkjebon/blob/main/data/supermarkets.json?raw=true) is updated frequently and may be reused in other projects. For example, you can get a price alert when a product you don't buy often is discounted, such as cleaning supplies or personal care products, or more expensive products with long expiration dates such as (soft) drinks or bake-off pizzas. Data journalists may use the data to see trends or verify claims from supermarkets.
