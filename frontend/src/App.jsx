import { useState } from 'react'
import axios from 'axios'
import './App.css'

const API = 'http://localhost:3001'

const CATEGORIES = [
  { label: 'All', emoji: '' },
  { label: 'Dairy', emoji: '🥛' },
  { label: 'Eggs', emoji: '🥚' },
  { label: 'Bread', emoji: '🍞' },
  { label: 'Cereal', emoji: '🥣' },
  { label: 'Chips', emoji: '🍪' },
  { label: 'Snacks', emoji: '🍿' },
  { label: 'Pantry', emoji: '🧴' },
  { label: 'Meat', emoji: '🥩' },
  { label: 'Produce', emoji: '🍎' },
  { label: 'Frozen', emoji: '🧊' },
  { label: 'Drinks', emoji: '🧃' },
  { label: 'Bakery', emoji: '🥐' },
]

const CATEGORY_TERMS = {
  Dairy: 'milk',
  Eggs: 'eggs',
  Bread: 'bread',
  Cereal: 'cereal',
  Chips: 'chips',
  Snacks: 'snacks',
  Pantry: 'olive oil',
  Meat: 'chicken breast',
  Produce: 'apples',
  Frozen: 'frozen pizza',
  Drinks: 'orange juice',
  Bakery: 'bagels',
}

const PRODUCT_EMOJIS = {
  milk: '🥛', egg: '🥚', bread: '🍞', butter: '🧈',
  cheese: '🧀', chicken: '🍗', beef: '🥩', apple: '🍎',
  banana: '🍌', orange: '🍊', cereal: '🥣', chip: '🍪',
  snack: '🍿', juice: '🧃', pizza: '🍕', bagel: '🥐',
  coffee: '☕', water: '💧', soda: '🥤', yogurt: '🍦',
  default: '🛒'
}

function getEmoji(term) {
  const t = term.toLowerCase()
  const match = Object.keys(PRODUCT_EMOJIS).find(k => t.includes(k))
  return match ? PRODUCT_EMOJIS[match] : PRODUCT_EMOJIS.default
}

export default function App() {
  const [product, setProduct] = useState('')
  const [zip, setZip] = useState('')
  const [radius, setRadius] = useState('10')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [tripsPerYear, setTripsPerYear] = useState(52)
  const [activeCategory, setActiveCategory] = useState('All')

  async function handleSearch(term) {
    const searchTerm = term || product
    if (!searchTerm.trim() || !zip.trim()) {
      if (!zip.trim()) { alert('Please enter your zip code first!'); return }
      return
    }
    setLoading(true)
    setError('')
    setResults([])
    setSearched(true)
    if (term) setProduct(term)

    try {
      const [locRes, walmartRes, targetRes] = await Promise.all([
        axios.get(`${API}/api/locations`, { params: { zip, radius } }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/api/walmart`, { params: { term: searchTerm, zip } }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/api/target`, { params: { term: searchTerm } }).catch(() => ({ data: { data: [] } })),
      ])

      const locations = locRes.data.data || []
      const walmartItems = walmartRes.data.data || []
      const targetItems = targetRes.data.data || []

      const krogerResults = await Promise.all(
        locations.slice(0, 3).map(async (loc) => {
          try {
            const prodRes = await axios.get(`${API}/api/products`, {
              params: { term: searchTerm, locationId: loc.locationId }
            })
            const items = prodRes.data.data
            if (!items || items.length === 0) return null
            const item = items[0]
            const price = item.items?.[0]?.price?.regular ?? null
            const salePrice = item.items?.[0]?.price?.promo ?? null
            const imageUrl = item.images?.[0]?.sizes?.find(s => s.size === 'thumbnail')?.url ?? null
            return {
              storeName: loc.name,
              address: `${loc.address.addressLine1}, ${loc.city}`,
              distance: loc.geolocation?.distanceInMiles?.toFixed(1) ?? '?',
              lat: loc.geolocation?.latitude,
              lng: loc.geolocation?.longitude,
              productName: item.description,
              price: salePrice && salePrice < price ? salePrice : price,
              regularPrice: price,
              onSale: !!(salePrice && salePrice < price),
              imageUrl,
            }
          } catch (err) { return null }
        })
      )

      const allResults = [
        ...krogerResults.filter(r => r !== null && r.price !== null),
        ...walmartItems.slice(0, 1),
        ...targetItems.slice(0, 1),
      ].sort((a, b) => a.price - b.price)

      setResults(allResults)
      if (allResults.length === 0) setError('No pricing data found. Try a different product.')
    } catch (err) {
      setError('Something went wrong. Make sure your backend server is running.')
    }
    setLoading(false)
  }

  function handleCategory(cat) {
    setActiveCategory(cat.label)
    if (cat.label !== 'All' && zip.trim()) {
      handleSearch(CATEGORY_TERMS[cat.label])
    }
  }

  function openMap(r) {
    if (r.lat && r.lng) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`, '_blank')
    }
  }

  const savings = results.length > 1
    ? results[results.length - 1].price - results[0].price
    : 0
  const yearlySavings = (savings * tripsPerYear).toFixed(2)
  const fiveYearSavings = (savings * tripsPerYear * 5).toFixed(2)
  const emoji = getEmoji(product)

  return (
    <div className="pf">
      <div className="hero">
        <div className="hero-ring r1" />
        <div className="hero-ring r2" />
        <div className="hero-ring r3" />
        <h1>Price<span>Finesser</span></h1>
        <p>Outsmart the grocery store. Every single time.</p>
        <div className="bubble">
          <div className="irow">
            <div className="iw">
              <label>Product</label>
              <input
                type="text"
                placeholder="milk, chips, cereal…"
                value={product}
                onChange={e => setProduct(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="iw">
              <label>Zip Code</label>
              <input
                type="text"
                placeholder="e.g. 95202"
                maxLength={5}
                value={zip}
                onChange={e => setZip(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <div className="irow">
            <div className="iw">
              <label>Radius</label>
              <select value={radius} onChange={e => setRadius(e.target.value)}>
                <option value="5">Within 5 miles</option>
                <option value="10">Within 10 miles</option>
                <option value="25">Within 25 miles</option>
              </select>
            </div>
            <div className="iw">
              <label>Sort by</label>
              <select><option>Lowest price</option></select>
            </div>
          </div>
          <button className="gbtn" onClick={() => handleSearch()} disabled={loading}>
            {loading ? '⏳ Searching...' : '⚡ Finesse the Price'}
          </button>
        </div>
      </div>

      <div className="content">
        <div className="cats">
          {CATEGORIES.map(cat => (
            <button
              key={cat.label}
              className={`cat ${activeCategory === cat.label ? 'active' : ''}`}
              onClick={() => handleCategory(cat)}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {error && <div className="error-msg">{error}</div>}

        {results.length > 1 && (
          <>
            <div className="scard">
              <div className="scard-icon">💰</div>
              <div className="scard-text">
                <h3>Save ${savings.toFixed(2)} on {product}</h3>
                <p>Buy at {results[0].storeName} vs the most expensive nearby</p>
              </div>
            </div>
            <div className="calc-section">
              <div className="calc-label">
                <span>Trips per year:</span>
                <strong>{tripsPerYear}</strong>
                <input
                  type="range" min="1" max="200" step="1"
                  value={tripsPerYear}
                  onChange={e => setTripsPerYear(Number(e.target.value))}
                  className="slider"
                />
              </div>
              <div className="crow">
                <div className="cc"><div className="val">${savings.toFixed(2)}</div><div className="lbl">Per trip</div></div>
                <div className="cc"><div className="val">${yearlySavings}</div><div className="lbl">Per year</div></div>
                <div className="cc"><div className="val">${fiveYearSavings}</div><div className="lbl">5 years</div></div>
              </div>
            </div>
          </>
        )}

        {results.length > 0 && (
          <div className="mbar">
            <span>🗺️</span>
            <div><strong>{results.length} stores</strong> compared near {zip} — click any result to open in Maps</div>
          </div>
        )}

        {results.map((r, i) => (
          <div
            key={i}
            className={`rc ${i === 0 ? 'best' : ''}`}
            onClick={() => openMap(r)}
            title="Open in Google Maps"
          >
            <div className="pimg">
              {r.imageUrl
                ? <img src={r.imageUrl} alt={r.productName} />
                : <span>{emoji}</span>
              }
            </div>
            <div className="si">
              <div className="bgs">
                {i === 0 && <span className="bdg bbest">Best price</span>}
                {r.onSale && <span className="bdg bsale">On sale</span>}
              </div>
              <div className="sn">{r.storeName}</div>
              <div className="pn">{r.productName}</div>
              <div className="sa">📍 {r.distance} mi — {r.address}</div>
            </div>
            <div className="pc">
              <div className="pr">${r.price.toFixed(2)}</div>
              {r.onSale && <div className="wp">was ${r.regularPrice.toFixed(2)}</div>}
            </div>
          </div>
        ))}

        {searched && !loading && results.length === 0 && !error && (
          <div className="empty">No results found. Try a different product or zip code.</div>
        )}
      </div>
    </div>
  )
}