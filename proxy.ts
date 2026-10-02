import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protege o app com usuário/senha (HTTP Basic Auth) quando APP_USER e
// APP_PASSWORD estão definidos. Sem essas variáveis (ex.: `next dev` local),
// tudo fica liberado.
export function proxy(request: NextRequest) {
  const user = process.env.APP_USER;
  const password = process.env.APP_PASSWORD;
  if (!user || !password) return NextResponse.next();

  const header = request.headers.get('authorization');
  if (header?.startsWith('Basic ')) {
    const [u, ...rest] = atob(header.slice(6)).split(':');
    if (u === user && rest.join(':') === password) return NextResponse.next();
  }

  return new NextResponse('Autenticação necessária', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Attech", charset="UTF-8"' },
  });
}

export const config = {
  // Arquivos estáticos, service worker e manifesto do PWA ficam de fora.
  matcher: ['/((?!_next/static|_next/image|serwist|manifest.webmanifest|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)'],
};
