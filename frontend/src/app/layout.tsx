import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/providers/Providers'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'InitiaBet | On-Chain Casino',
  description: 'InitiaBet - Provably Fair On-Chain Gaming Casino on Initia. Every bet is a transaction. Every outcome is verifiable.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#ffb000" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-4 focus:left-4
                       focus:px-4 focus:py-2 focus:bg-amber focus:text-bg focus:rounded-lg focus:font-mono focus:text-sm"
          >
            Skip to main content
          </a>
          <div className="min-h-screen flex flex-col bg-bg noise-bg">
            <Header />
            <main id="main-content" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
