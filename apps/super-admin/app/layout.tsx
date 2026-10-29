import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'نارنج | مدیریت سامانه',
  description: 'پنل آزمایشی مدیریت RestaurantOS',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="m-0 bg-[#f6f7f4] font-[family-name:Tahoma,Arial,sans-serif] text-sm leading-relaxed text-[#243e36]">
        {children}
      </body>
    </html>
  );
}
