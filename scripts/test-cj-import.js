const { listProducts } = require('../services/providers/cj');

async function main() {
  const result = await listProducts({ page: 1, size: 5 });
  const list = result?.data?.content || result?.data?.list || result?.data || [];
  console.log(JSON.stringify({ ok: true, count: Array.isArray(list) ? list.length : 0, sample: Array.isArray(list) ? list.slice(0, 5) : list }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
