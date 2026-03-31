import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from './components/Sidebar'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Game of Bones - Admin',
  description: 'Admin panel for Game of Bones',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={geist.className} style={{ margin: 0, padding: 0, display: 'flex', background: '#f9f6f2', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, minHeight: '100vh', overflowX: 'hidden' }}>
          {children}
        </main>
      </body>
    </html>
  )
}