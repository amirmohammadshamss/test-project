import { NotificationOrder } from '../../../../features/notification-order';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NotificationOrder id={id} />;
}
