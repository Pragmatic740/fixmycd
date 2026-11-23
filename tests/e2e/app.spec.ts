import { expect, test, type Page } from '@playwright/test';
import { E2E_PASSWORD, E2E_USERS } from './fixtures';

/** Wait until the page is on `pathname` (query strings like ?redirect=/x don't count). */
async function expectPath(page: Page, pathname: string) {
  await page.waitForURL((url) => url.pathname === pathname);
}

async function login(page: Page, email: string, password = E2E_PASSWORD) {
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
}

test('a guest sees upvote counts, is sent to sign in, and comes back', async ({ page }) => {
  await page.goto('/dashboard/reports/e2e_report_1');
  await expect(page.getByRole('heading', { name: 'Broken streetlight on Elm St' })).toBeVisible();

  await page.getByRole('button', { name: /Upvote \(0\)/ }).click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard%2Freports%2Fe2e_report_1/);

  await login(page, E2E_USERS.neighbour.email);
  await expectPath(page, '/dashboard/reports/e2e_report_1');
});

test('a signed-in user upvotes and comments, and the author is notified', async ({ page, browser }) => {
  await page.goto('/login?redirect=/dashboard/reports/e2e_report_1');
  await login(page, E2E_USERS.neighbour.email);
  await expectPath(page, '/dashboard/reports/e2e_report_1');

  await page.getByRole('button', { name: /Upvote \(\d+\)/ }).click();
  await expect(page.getByRole('button', { name: /Upvote \(1\)/ })).toBeVisible();

  await page.getByLabel('Comment text').fill('Still broken tonight <b>!</b>');
  await page.getByRole('button', { name: 'Post Comment' }).click();
  // Rendered as text, attributed to the real user.
  await expect(page.getByText('Still broken tonight <b>!</b>')).toBeVisible();
  await expect(page.locator('.comment-item').first().getByRole('link', { name: 'You' })).toBeVisible();

  const author = await browser.newPage();
  await author.goto('/login?redirect=/dashboard/notifications');
  await login(author, E2E_USERS.citizen.email);
  await expectPath(author, '/dashboard/notifications');
  await expect(author.getByText(/Nia Neighbour.*commented on/)).toBeVisible();
  await expect(author.getByText(/Nia Neighbour.*upvoted/)).toBeVisible();
  await author.close();
});

test('signup waits for approval, an admin approves, then the user can log in', async ({ page, browser }) => {
  const email = `newbie+${Date.now()}@e2e.test`;
  await page.goto('/signup');
  await page.getByLabel('Full Name').fill('New Bie');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill('long-enough-pass');
  // Signing up requires agreeing to the Code of Ethics.
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page.getByText(/agree to the Code of Ethics to join/)).toBeVisible();
  await page.getByRole('checkbox', { name: /Code of Ethics/ }).check();
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page.getByRole('heading', { name: 'Almost there' })).toBeVisible();

  await page.goto('/login');
  await login(page, email, 'long-enough-pass');
  await expect(page.getByText(/pending approval/)).toBeVisible();

  const admin = await browser.newPage();
  await admin.goto('/login?redirect=/dashboard/account/users');
  await login(admin, E2E_USERS.admin.email);
  await expectPath(admin, '/dashboard/account/users');
  const card = admin.locator('.pending-user-card', { hasText: email });
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByText(/Account approved/)).toBeVisible();
  await admin.close();

  await page.goto('/login');
  await login(page, email, 'long-enough-pass');
  await expectPath(page, '/dashboard');
});

test('report titles are shown as text on the explore map (stored XSS regression)', async ({ page }) => {
  await page.goto('/login?redirect=/dashboard');
  await login(page, E2E_USERS.citizen.email);
  await expectPath(page, '/dashboard');

  // Post from inside the page so the browser sends its (Secure) session cookie.
  const status = await page.evaluate(async () => {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '<img src=x onerror="window.__xss=1">Pothole',
        description: '<script>window.__xss=2</script>',
        latitude: 40.713,
        longitude: -74.005,
      }),
    });
    return res.status;
  });
  expect(status).toBe(201);

  await page.goto('/dashboard/explore');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

  await page.goto('/dashboard');
  await expect(page.locator('.feed-list').getByText('<img src=x onerror="window.__xss=1">Pothole')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

test('a forged session cookie does not unlock the admin area', async ({ page, context }) => {
  await context.addCookies([
    { name: 'session_user_id', value: E2E_USERS.admin.id, domain: 'localhost', path: '/' },
    { name: 'fmd_session', value: E2E_USERS.admin.id, domain: 'localhost', path: '/' },
  ]);
  const api = await page.request.get('/api/admin/users');
  expect(api.status()).toBe(401);
  await page.goto('/dashboard/admin');
  await expectPath(page, '/login');
});

test('security headers are sent', async ({ request }) => {
  const res = await request.get('/login');
  const h = res.headers();
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['content-security-policy-report-only']).toContain("frame-ancestors 'none'");
  expect(h['x-powered-by']).toBeUndefined();
});

test('Account groups profile and admin pages, with a breadcrumb trail', async ({ page }) => {
  await page.goto('/login?redirect=/dashboard/account');
  await login(page, E2E_USERS.neighbour.email);
  await expectPath(page, '/dashboard/account');

  // A standard user sees Profile, but not the admin pages.
  await expect(page.locator('.account-sections').getByRole('link', { name: /Profile/ })).toBeVisible();
  await expect(page.locator('.account-sections').getByRole('link', { name: /Users & approvals/ })).toHaveCount(0);

  await page.locator('.account-sections').getByRole('link', { name: /Profile/ }).click();
  await expectPath(page, '/dashboard/account/profile');
  const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(trail).toContainText('Home');
  await expect(trail).toContainText('Account');
  await expect(trail.locator('[aria-current="page"]')).toHaveText('Profile');

  // Old links (e.g. in emails) still work.
  await page.goto('/dashboard/profile');
  await expectPath(page, '/dashboard/account/profile');

  // Admin pages stay closed to standard users.
  await page.goto('/dashboard/account/users');
  await expectPath(page, '/dashboard');
});

test('a standard user can open analytics without seeing reporter details', async ({ page }) => {
  await page.goto('/login?redirect=/dashboard/analytics');
  await login(page, E2E_USERS.neighbour.email);
  await expectPath(page, '/dashboard/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reporters' })).toHaveCount(0);
  await expect(page.getByPlaceholder('Reporter name')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share this dashboard' })).toBeVisible();
});

test('a new user can skip the approval wait with the $1 check (demo)', async ({ page }) => {
  const email = `payer-${Date.now()}@e2e.test`;
  await page.goto('/signup');
  await page.getByLabel('Full Name').fill('Paying Person');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill('long-enough-pass');
  await page.getByRole('checkbox', { name: /Code of Ethics/ }).check();
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await expect(page.getByText('Demo — no real charge.')).toBeVisible();
  await page.getByLabel('Name on card').fill('Paying Person');
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await page.getByLabel('Expiry').fill('12/30');
  await page.getByLabel('CVC').fill('123');
  await page.getByRole('button', { name: 'Pay $1 and start posting' }).click();
  await expectPath(page, '/dashboard');
  await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();
});

test('light is the default theme, and a chosen theme is kept after reload', async ({ browser }) => {
  // A device set to dark still starts in light until the user picks something else.
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);

  await page.goto('/');
  expect(await theme()).toBe('light');
  await expect(page.getByRole('radio', { name: 'Light theme' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', { name: 'Dark theme' }).click();
  expect(await theme()).toBe('dark');
  await page.reload();
  expect(await theme()).toBe('dark');
  await expect(page.getByRole('radio', { name: 'Dark theme' })).toHaveAttribute('aria-checked', 'true');

  // Kept on other pages; "System" follows the device (dark here); light again on request.
  await page.goto('/dashboard');
  expect(await theme()).toBe('dark');
  await page.getByRole('radio', { name: 'System theme' }).click();
  expect(await theme()).toBe('dark');
  await page.getByRole('radio', { name: 'Light theme' }).click();
  expect(await theme()).toBe('light');
  await page.reload();
  expect(await theme()).toBe('light');
  await context.close();
});
