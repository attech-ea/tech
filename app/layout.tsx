import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SerwistProvider } from '@serwist/turbopack/react';
import Sidebar from './Sidebar';

export const metadata: Metadata = {
  title: {
    default: 'Attech',
    template: '%s · Attech',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Attech',
  },
};

export const viewport = {
  themeColor: '#1b6fb0',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Link diretto (não next/font): o Canvas 2D precisa do nome literal "Dawning of a New Day"
            em ctx.font, e next/font expõe só um nome de família ofuscado. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Dawning+of+a+New+Day&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        <SerwistProvider swUrl="/serwist/sw.js">
          <Sidebar />
          <div className="pt-14 lg:pt-0 lg:pl-60">{children}</div>
        </SerwistProvider>
      </body>
    </html>
  );
}
