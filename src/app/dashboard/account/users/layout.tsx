import { redirect } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login?redirect=%2Fdashboard%2Faccount%2Fusers');
  }
  if (!isAdmin(user.role)) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
