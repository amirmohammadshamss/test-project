import { ui } from '../lib/ui';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  title: 'نارنج | RestaurantOS',
  description: 'مدیریت میز، سفارش و آشپزخانه رستوران',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body {...ui('body')}>{children}</body>
    </html>
  );
}
