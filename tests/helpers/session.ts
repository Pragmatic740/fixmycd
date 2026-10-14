import { POST as login } from '@/app/api/auth/login/route';
import { cookieJar } from './cookie-jar';
import { call } from './route';
import { createUser, type Role } from './factories';
import { SESSION_COOKIE } from '@/lib/auth';

/** Log in through the real login route; the session cookie lands in the jar. */
export async function loginAs(email: string, password: string) {
  const res = await call(login, { method: 'POST', body: { email, password } });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${res.text}`);
  }
  return res;
}

/** Create a user with a role and sign them in. */
export async function signedInUser(role: Role = 'submitter', overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser({ role, ...overrides });
  cookieJar.clear();
  await loginAs(user.email, user.password);
  return user;
}

export function sessionToken(): string | undefined {
  return cookieJar.get(SESSION_COOKIE);
}

export function signOutLocally() {
  cookieJar.clear();
}
