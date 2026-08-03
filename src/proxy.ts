import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PROTECTED = ['/api/streamer', '/api/admin'];

// MODO TESTE: rotas que gravam no banco, gastam PSC, compram skin de verdade ou
// mandam mensagem no chat do streamer. Enquanto a sessão está em modo teste,
// nenhuma delas aceita método de escrita — o admin vê tudo, mas não muda nada.
// Toda rota listada aqui precisa estar no `matcher` lá embaixo.
const TEST_MODE_READONLY = [
  '/api/streamer',
  '/api/admin',
  '/api/marketplace',
  '/api/chat-trade-link',
  '/api/twitch/notify',
  '/api/youtube/notify',
  '/api/kick/notify',
];

// Estas são GET mas gravam no banco (salvam/renovam o token de OAuth do
// streamer), então a regra por método não pega — têm que ser barradas pelo
// caminho. Como são ação explícita do usuário, respondem erro de verdade em vez
// do "ok silencioso" das escritas normais.
const TEST_MODE_BLOCKED_PATHS = [
  '/api/streamer/twitch-streamer-auth',
  '/api/streamer/twitch-streamer-callback',
  '/api/streamer/twitch-subscribers',
];

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Rotas abertas como janela do navegador (popup do OAuth), não por fetch. Um 401
// em JSON aqui aparece como `{"error":"Não autenticado"}` cru na tela do
// streamer — devolve HTML explicando o que fazer e avisa a janela que abriu.
const POPUP_PATHS = [
  '/api/streamer/twitch-streamer-auth',
  '/api/streamer/twitch-streamer-callback',
];

function popupSessionExpired() {
  const msg = JSON.stringify({ type: 'twitch-streamer-oauth', ok: false, reason: 'session-expired' });
  return new NextResponse(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Sessão expirada</title></head>
    <body style="font-family:system-ui,monospace;background:#0a0a0a;color:#FF4444;padding:2rem;line-height:1.6">
    <h2 style="margin:0 0 .5rem">Sua sessão expirou</h2>
    <p style="color:#ccc">Feche esta janela, faça login de novo no painel e tente conectar a Twitch outra vez.</p>
    <script>
      if (window.opener) window.opener.postMessage(${msg}, window.location.origin);
      setTimeout(function () { window.close(); }, 6000);
    </script>
    </body></html>`,
    { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED.some(p => path.startsWith(p));

  const token = req.cookies.get('ps_session')?.value;
  const session = token ? await verifyToken(token) : null;

  if (isProtected && !session) {
    if (POPUP_PATHS.some(p => path.startsWith(p))) return popupSessionExpired();
    if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }

  // Rotas /api/admin/* exigem isAdmin
  if (path.startsWith('/api/admin') && !session?.isAdmin)
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  if (session?.testMode && TEST_MODE_BLOCKED_PATHS.some(p => path.startsWith(p)))
    return NextResponse.json(
      { error: 'MODO TESTE: essa ação gravaria no banco e está bloqueada.' },
      { status: 403 },
    );

  // Escrita bloqueada no modo teste. Responde 200 com o marcador em vez de erro
  // pra UI seguir o fluxo normal (o estado local continua igual ao de verdade),
  // só que nada foi persistido.
  if (
    session?.testMode &&
    !READ_METHODS.has(req.method) &&
    TEST_MODE_READONLY.some(p => path.startsWith(p))
  ) {
    return NextResponse.json({ ok: true, testMode: true, persisted: false });
  }

  if (!session) return NextResponse.next();

  // Injeta username no header para as routes usarem
  const headers = new Headers(req.headers);
  headers.set('x-session-username', session.username);
  headers.set('x-session-isadmin', String(session.isAdmin));

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    '/api/streamer/:path*',
    '/api/admin/:path*',
    '/api/marketplace/:path*',
    '/api/chat-trade-link',
    '/api/twitch/notify',
    '/api/youtube/notify',
    '/api/kick/notify',
  ],
};
