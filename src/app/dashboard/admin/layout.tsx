import { redirect } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }
  if (!isAdmin(user.role)) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
