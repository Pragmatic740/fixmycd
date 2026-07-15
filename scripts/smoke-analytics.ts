async function main() {
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001';

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@fixmydistrict.app', password: 'password123' }),
  });
  const loginBody = await login.text();
  console.log('login status', login.status, loginBody.slice(0, 200));
  if (!login.ok) throw new Error(`login failed: ${login.status}`);

  const cookies =
    typeof login.headers.getSetCookie === 'function'
      ? login.headers.getSetCookie()
      : [];
  const raw = cookies[0] || login.headers.get('set-cookie');
  console.log('set-cookie', raw);
  if (!raw) throw new Error('no session cookie');
  const session = raw.split(';')[0];

  const denied = await fetch(`${base}/api/admin/analytics/summary`);
  console.log('unauth status', denied.status);
  if (denied.status !== 401 && denied.status !== 403) {
    throw new Error(`expected unauth denial, got ${denied.status}`);
  }

  const summary = await fetch(`${base}/api/admin/analytics/summary?datePreset=year`, {
    headers: { Cookie: session },
  });
  const summaryText = await summary.text();
  if (!summary.ok) throw new Error(`summary failed: ${summary.status} ${summaryText}`);
  const body = JSON.parse(summaryText);
  if (!body.data || typeof body.data.totalReports !== 'number') {
    throw new Error(`unexpected summary shape: ${summaryText.slice(0, 300)}`);
  }
  if (body.data.totalReports < 100) {
    throw new Error(`expected rich seed, got ${body.data.totalReports}`);
  }
  console.log('smoke ok — totalReports=', body.data.totalReports);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
