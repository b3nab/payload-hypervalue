import { RootProvider } from 'fumadocs-ui/provider/next'
import './global.css'
import { Inter } from 'next/font/google'
import Script from 'next/script'

const inter = Inter({
  subsets: ['latin'],
})

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}
          <Script
            src={`${process.env.NEXT_PUBLIC_RYBBIT_HOST}/api/script.js`}
            data-site-id={process.env.NEXT_PUBLIC_RYBBIT_ID}
            data-web-vitals="true"
            data-track-errors="true"
            data-session-replay="true"
            strategy="afterInteractive"
          />
        </RootProvider>
      </body>
    </html>
  )
}
