import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PROTECTED = ['/api/streamer', '/api/admin'];

export async function middleware(req: NextRequest) {
  const isProtected = PROTECTED.some(p => req.nextUrl.pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get('ps_session')?.value;
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

  // Rotas /api/admin/* exigem isAdmin
  if (req.nextUrl.pathname.startsWith('/api/admin') && !session.isAdmin)
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  // Injeta username no header para as routes usarem
  const headers = new Headers(req.headers);
  headers.set('x-session-username', session.username);
  headers.set('x-session-isadmin', String(session.isAdmin));

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api/streamer/:path*', '/api/admin/:path*'],
};
