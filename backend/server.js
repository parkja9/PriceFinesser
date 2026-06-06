require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
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

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);