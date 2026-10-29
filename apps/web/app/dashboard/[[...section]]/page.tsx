import { redirect } from 'next/navigation';
import RestaurantAdminPanel from '../../../features/restaurant-admin';
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  if (section?.join('/') === 'menu/ai-drafts') redirect('/dashboard/menu');
  return <RestaurantAdminPanel />;
}
