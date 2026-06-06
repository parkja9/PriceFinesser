require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: ['https://pricefinesser.vercel.app', 'http://localhost:5173']
}));
app.use(express.json());

const KROGER_BASE = 'https://api.kroger.com/v1';
let tokenCache = { token: null, expires: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) {
    return tokenCache.token;
  }
  const credentials = Buffer.from(
    `${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`
  ).toString('base64');

  const res = await axios.post(
    `${KROGER_BASE}/connect/oauth2/token`,
    'grant_type=client_credentials&scope=product.compact',
    {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    }
  );
  tokenCache = {
    token: res.data.access_token,
    expires: Date.now() + (res.data.expires_in * 1000) - 60000
  };
  return tokenCache.token;
}

app.get('/api/locations', async (req, res) => {
  const { zip, radius = 10 } = req.query;
  try {
    const token = await getToken();
    const response = await axios.get(`${KROGER_BASE}/locations`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        'filter.zipCode.near': zip,
        'filter.radiusInMiles': radius,
        'filter.limit': 10,
      }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  const { term, locationId } = req.query;
  try {
    const token = await getToken();
    const response = await axios.get(`${KROGER_BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        'filter.term': term,
        'filter.locationId': locationId,
        'filter.limit': 5,
      }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Walmart product search
app.get('/api/walmart', async (req, res) => {
  const { term, zip } = req.query;
  try {
    const response = await axios.get(
      'https://www.walmart.com/search/api/preso', {
        params: {
          query: term,
          ps: 5,
          cat_id: 0,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    );

    const items = response.data?.items?.props?.pageProps?.initialData?.searchResult?.itemStacks?.[0]?.items || [];
    const results = items.slice(0, 5).map(item => ({
      storeName: 'Walmart',
      productName: item.name,
      price: item.priceInfo?.currentPrice?.price ?? null,
      regularPrice: item.priceInfo?.wasPrice?.price ?? item.priceInfo?.currentPrice?.price ?? null,
      onSale: !!(item.priceInfo?.wasPrice),
      imageUrl: item.image,
      address: 'Visit walmart.com',
      distance: '?',
    })).filter(r => r.price !== null);

    res.json({ data: results });
  } catch (err) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

// Target product search
app.get('/api/target', async (req, res) => {
  const { term } = req.query;
  try {
    const response = await axios.get(
      'https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2', {
        params: {
          key: 'ff457966e64d5e877fdbad070f276d18ecec4a01',
          keyword: term,
          count: 5,
          default_purchasability_filter: true,
          include_sponsored: false,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      }
    );

    const items = response.data?.data?.search?.products || [];
    const results = items.slice(0, 5).map(item => ({
      storeName: 'Target',
      productName: item.item?.product_description?.title,
      price: item.price?.current_retail ?? null,
      regularPrice: item.price?.reg_retail ?? item.price?.current_retail ?? null,
      onSale: !!(item.price?.reg_retail && item.price.reg_retail > item.price?.current_retail),
      imageUrl: item.item?.enrichment?.images?.primary_image_url,
      address: 'Visit target.com',
      distance: '?',
    })).filter(r => r.price !== null);

    res.json({ data: results });
  } catch (err) {
    res.status(500).json({ error: err.message, data: [] });
  }
});

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);