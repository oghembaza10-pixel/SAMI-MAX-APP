const BASE_URL = process.env.CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1';

function requireKey() {
  if (!process.env.CJ_API_KEY) throw new Error('CJ_API_KEY manquante dans Render');
}

async function request(path, options = {}) {
  requireKey();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': process.env.CJ_API_KEY,
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

module.exports = { listProducts, getProduct, getVariant };
