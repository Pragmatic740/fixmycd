import { redirect } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login?redirect=%2Fdashboard%2Fadmin');
  }
  if (!isAdmin(user.role)) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
