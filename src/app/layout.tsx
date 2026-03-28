import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Debtera | Financial Packet Builder',
  description: 'Build and manage your SBA loan application packet',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  )
}