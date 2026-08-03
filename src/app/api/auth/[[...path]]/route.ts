import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, verifyToken, sessionCookieOptions, clearCookieOptions } from '@/lib/auth';
import { buildSessionProfile } from '@/lib/sessionProfile';

// GET /api/auth/me → perfil da sessão do cookie, ou 401 se não há sessão.
//
// O client guarda `isLoggedIn`/`currentUser` no localStorage pra não piscar a
// tela de login a cada F5, mas quem manda de verdade é o cookie `ps_session` —
// e ele morre antes (fecha o navegador sem "lembrar-me", ou 7 dias de JWT).
// Sem esta rota o app ficava "logado" com uma sessão morta: toda chamada de API
// respondia 401 e o streamer só descobria ao ver o JSON cru do 401 no popup do
// OAuth da Twitch.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const route = path?.[0];

  if (route === 'me') {
    const token = req.cookies.get('ps_session')?.value;
    const session = token ? await verifyToken(token) : null;
    if (!session) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });

    const streamer = await prisma.streamer.findUnique({ where: { username: session.username } });
    if (!streamer) {
      // Conta apagada com o cookie ainda vivo — derruba a sessão.
      const res = NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
      res.cookies.set(clearCookieOptions());
      return res;
    }

    return NextResponse.json({
      ...buildSessionProfile(streamer),
      testMode: session.testMode ?? false,
      testModeAdmin: session.adminUsername ?? null,
    });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

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

    // Mesmo `remember` nos dois: cookie e JWT têm que vencer juntos.
    const remember = Boolean(rememberMe);
    const token = await signToken({ username: streamer.username, isAdmin: streamer.isAdmin }, remember);

    const res = NextResponse.json(buildSessionProfile(streamer));

    res.cookies.set(sessionCookieOptions(token, remember));
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
