const BASE_URL = process.env.CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1';

let accessToken = null;
let accessTokenExpiresAt = 0;

function requireKey() {
  if (!process.env.CJ_API_KEY) throw new Error('CJ_API_KEY manquante dans Render');
}

async function rawRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`CJ ${response.status}: ${data.message || text}`);
  return data;
}

async function getAccessToken() {
  requireKey();
  if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken;

  const data = await rawRequest('/authentication/getAccessToken', {
    method: 'POST',
    body: JSON.stringify({ apiKey: process.env.CJ_API_KEY }),
  });

  const token = data?.data?.accessToken || data?.data?.access_token || data?.accessToken || data?.access_token;
  if (!token) throw new Error(`CJ authentification réussie mais Access Token introuvable: ${JSON.stringify(data)}`);

  accessToken = token;
  accessTokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return accessToken;
}

async function request(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': token,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`CJ ${response.status}: ${data.message || text}`);
  return data;
}

async function listProducts({ page = 1, size = 5, keyword = '', categoryId = '' } = {}) {
  const params = new URLSearchParams({ pageNum: String(page), pageSize: String(size) });
  if (keyword) params.set('productNameEn', keyword);
  if (categoryId) params.set('categoryId', categoryId);
  return request(`/product/list?${params.toString()}`);
}

async function getProduct(pid) { return request(`/product/query?pid=${encodeURIComponent(pid)}`); }
async function getVariant(vid) { return request(`/product/variant/queryByVid?vid=${encodeURIComponent(vid)}`); }

module.exports = { getAccessToken, listProducts, getProduct, getVariant };
