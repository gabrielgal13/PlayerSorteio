import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, verifyToken, sessionCookieOptions, clearCookieOptions } from '@/lib/auth';
import { buildSessionProfile } from '@/lib/sessionProfile';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'login') {
    const { username, password, rememberMe = false } = await req.json();
    if (!username || !password)
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });

    const streamer = await prisma.streamer.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    if (!streamer || !(await bcrypt.compare(password, streamer.passwordHash)))
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });

    const token = await signToken({ username: streamer.username, isAdmin: streamer.isAdmin });

    const res = NextResponse.json(buildSessionProfile(streamer));

    res.cookies.set(sessionCookieOptions(token, rememberMe));
    return res;
  }

  if (route === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(clearCookieOptions());
    return res;
  }

  // Sai do MODO TESTE e devolve a sessão de admin. Fica em /api/auth (e não em
  // /api/admin) de propósito: durante o teste a sessão não é admin, então as
  // rotas /api/admin respondem 403.
  if (route === 'exit-test-mode') {
    const current = req.cookies.get('ps_session')?.value;
    const session = current ? await verifyToken(current) : null;
    if (!session?.testMode || !session.adminUsername)
      return NextResponse.json({ error: 'Sessão não está em modo teste' }, { status: 400 });

    const admin = await prisma.streamer.findUnique({ where: { username: session.adminUsername } });
    if (!admin?.isAdmin) {
      const res = NextResponse.json({ error: 'Admin não encontrado' }, { status: 403 });
      res.cookies.set(clearCookieOptions());
      return res;
    }

    const token = await signToken({ username: admin.username, isAdmin: true });
    const res = NextResponse.json(buildSessionProfile(admin));
    res.cookies.set(sessionCookieOptions(token));
    return res;
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
