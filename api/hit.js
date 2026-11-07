// Registro anônimo de acesso: cidade/estado/país vêm dos cabeçalhos do Vercel. Nenhum IP é guardado.
const SB_URL = "https://totdqszpxqdupwbvvmlo.supabase.co";
const SB_KEY = "sb_publishable_7wiZzpEfYuR9lskjJrPB7g_BAlSuLdr";
const dec = s => { try { return decodeURIComponent(s || ''); } catch (e) { return s || ''; } };
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).end(); return; }
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const h = req.headers;
  const ua = String(h['user-agent'] || '');
  if (/bot|crawl|spider|preview|facebookexternalhit|whatsapp|vercel|lighthouse|headless/i.test(ua)) { res.status(204).end(); return; }
  const payload = {
    p_sid: String(b.sid || '').slice(0, 40),
    p_page: String(b.page || '').slice(0, 30),
    p_source: String(b.source || 'direto').slice(0, 30),
    p_device: String(b.device || 'computador'),
    p_logged: !!b.logged,
    p_city: dec(h['x-vercel-ip-city']).slice(0, 80),
    p_region: String(h['x-vercel-ip-country-region'] || '').slice(0, 10),
    p_country: String(h['x-vercel-ip-country'] || '').slice(0, 4)
  };
  try {
    await fetch(SB_URL + '/rest/v1/rpc/log_hit', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
  res.status(204).end();
};
