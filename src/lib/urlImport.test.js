import test from 'node:test'
import assert from 'node:assert/strict'
import { extractIngredientsFromJsonLd } from './urlImport.js'

test('extractIngredientsFromJsonLd parses recipe ingredients from schema.org JSON-LD', () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "recipeIngredient": [
              "2 tbsp olive oil",
              "1 onion, diced"
            ]
          }
        </script>
      </head>
    </html>
  `

  assert.deepEqual(extractIngredientsFromJsonLd(html), ['2 tbsp olive oil', '1 onion, diced'])
})
