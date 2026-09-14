// Product and pack costs transcribed from "Updated cost sheet.xlsx".
// Keys are intentionally normalised because historical order rows use mixed
// forms such as "60 g", "60G", "1 Piece" and "1 piece".
export const SHEET_COGS_SOURCE = 'Updated cost sheet.xlsx'

const costs: Record<string, Record<string, number>> = {
  'whole quail': { '1piece': 161, '2piece': 321, '3piece': 482, '4piece': 642 },
  'chicken wings': { '5piece': 107, '10piece': 214, '15piece': 322 },
  'goat trachea': { '2piece': 150, '4piece': 301, '6piece': 451 },
  'goat trotter': { '1piece': 148, '2piece': 296, '3piece': 444, '4piece': 592 },
  'goat ear': { '5piece': 75, '10piece': 151, '15piece': 225, '20piece': 301 },
  'chicken neck': { '70g': 111, '140g': 223, '210g': 334, '280g': 445 },
  'chicken feet': { '70g': 95, '140g': 190, '210g': 284, '280g': 378 },
  'chicken jerky': { '60g': 114, '150g': 285, '250g': 475 },
  'chicken neck & feet': { '70g': 111, '140g': 223, '210g': 334, '280g': 445 },
  'chicken bones': { '100g': 43, '200g': 85, '300g': 128 },
  'chicken gizzards': { '60g': 86, '150g': 214, '250g': 357 },
  'chicken heart & liver': { '60g': 86, '150g': 214, '250g': 357 },
  'chicken liver': { '60g': 86, '150g': 214, '250g': 357 },
  'chicken bites': { '60g': 114, '150g': 285, '250g': 475 },
  'goat liver': { '60g': 203, '150g': 508, '250g': 846 },
  'goat lungs': { '60g': 164, '150g': 410, '250g': 683 },
  'goat heart & kidney mix': { '60g': 242, '150g': 605, '250g': 1008 },
  'goat spleen': { '60g': 190, '150g': 475, '250g': 792 },
  'bombay duck': { '60g': 162, '150g': 487, '250g': 812 },
  'whole mackerel': { '100g': 150, '200g': 300, '300g': 450 },
  'anchovies': { '60g': 82, '150g': 205, '250g': 342 },
  'prawns': { '60g': 376, '150g': 940, '250g': 1567 },
  'sardines': { '60g': 152, '150g': 379, '250g': 632 },
  'tuna': { '60g': 235, '150g': 586, '250g': 977 },
  'fish bites': { '60g': 235, '150g': 587, '250g': 978 },
  'mackerel fillet': { '60g': 145, '150g': 362, '250g': 603 },
  'buff jerky': { '60g': 147, '150g': 366, '250g': 476 },
}

function normalise(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\(pack of\s*/g, '')
    .replace(/pieces?/g, 'piece')
    .replace(/grams?/g, 'g')
    .replace(/[^a-z0-9&]/g, '')
}

function productKey(value: unknown) {
  const name = String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (name === 'quail quarter') return 'whole quail'
  if (name === 'trachea chew') return 'goat trachea'
  return name
}

export function getSheetCogs(productName: unknown, packLabel: unknown) {
  const productCosts = costs[productKey(productName)]
  if (!productCosts) return null
  const exact = productCosts[normalise(packLabel)]
  if (Number.isFinite(exact)) return exact

  const numericPack = String(packLabel ?? '').match(/\d+(?:\.\d+)?\s*(?:g|grams?|pieces?)/i)?.[0]
  const matched = numericPack ? productCosts[normalise(numericPack)] : undefined
  return Number.isFinite(matched) ? matched : null
}
