import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Game of Bones - Admin',
  description: 'Admin panel for Game of Bones',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {/* Sidebar now wraps the page content directly — this is what fixes the
            overlap/reflow bugs, since margin-left on <main> is calculated
            inside the same component that controls collapsed/expanded width. */}
        <Sidebar>{children}</Sidebar>
      </body>
    </html>
  );
}
