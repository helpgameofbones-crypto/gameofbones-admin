import type { Metadata } from 'next';
import Sidebar from '@/app/components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Game of Bones - Admin',
  description: 'Admin panel for Game of Bones',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Sidebar is self-contained — it renders itself AND injects the CSS
            that pushes this page content over by the correct amount. It does
            NOT take children as a prop. Just render it as a sibling like this. */}
        <Sidebar />
        <main>{children}</main>
      </body>
    </html>
  );
}
