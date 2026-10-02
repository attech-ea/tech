import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Attech',
    short_name: 'Attech',
    description: 'Ferramentas Attech: pedido de mesa, cálculo de horas e recibos.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f1ea',
    theme_color: '#1b6fb0',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
