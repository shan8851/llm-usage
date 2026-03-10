export async function fetchOpenRouterSummary({ enabled, apiKey, baseUrl }) {
  if (!enabled || !apiKey) return null;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const out = { provider: 'openrouter' };

  try {
    const keyRes = await fetch(`${baseUrl.replace(/\/$/, '')}/key`, { headers });
    if (keyRes.ok) {
      out.key = await keyRes.json();
    } else {
      out.keyError = `GET /key -> ${keyRes.status}`;
    }
  } catch (err) {
    out.keyError = String(err.message || err);
  }

  try {
    const creditsRes = await fetch(`${baseUrl.replace(/\/$/, '')}/credits`, { headers });
    if (creditsRes.ok) {
      out.credits = await creditsRes.json();
    } else {
      out.creditsError = `GET /credits -> ${creditsRes.status}`;
    }
  } catch (err) {
    out.creditsError = String(err.message || err);
  }

  return out;
}
