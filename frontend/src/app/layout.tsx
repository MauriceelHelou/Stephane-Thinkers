import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/lib/providers'
import { PreventBrowserZoom } from '@/components/PreventBrowserZoom'

export const metadata: Metadata = {
  title: 'Intellectual Genealogy Mapper',
  description: 'A minimalist timeline-based knowledge graph for Harvard PhD research',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <PreventBrowserZoom />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
