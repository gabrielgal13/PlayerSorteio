import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE = 'ps_session';

/**
 * Duração da sessão. O cookie e o JWT dentro dele usam SEMPRE o mesmo valor —
 * antes o cookie do "lembrar de mim" durava 30 dias com um JWT de 7 dentro,
 * então no oitavo dia o streamer continuava "logado" na tela com uma sessão que
 * a API já recusava.
 *
 * Sem "lembrar de mim" o cookie também tem prazo agora (7 dias). Antes era
 * cookie de sessão de navegador: fechou o Chrome, perdeu o login — foi assim que
 * o streamer caiu no `{"error":"Não autenticado"}` cru do popup da Twitch.
 */
const SESSION_TTL = 60 * 60 * 24 * 7;   // 7 dias
const REMEMBER_TTL = 60 * 60 * 24 * 30; // 30 dias ("Lembrar de mim")

function ttl(rememberMe: boolean) {
  return rememberMe ? REMEMBER_TTL : SESSION_TTL;
}

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  username: string;
  isAdmin: boolean;
  /**
   * MODO TESTE: o admin está logado na conta de `username` só pra olhar/testar.
   * O middleware recusa qualquer escrita enquanto isso for true — é aqui que
   * mora a garantia de que nada do modo teste chega no banco.
   */
  testMode?: boolean;
  /** Quem entrou no modo teste — usado pra devolver a sessão de admin na saída. */
  adminUsername?: string;
}

/** `rememberMe` tem que ser o MESMO valor passado pro `sessionCookieOptions`. */
export async function signToken(payload: SessionPayload, rememberMe = false): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttl(rememberMe)}s`)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function sessionCookieOptions(token: string, rememberMe = false) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ttl(rememberMe),
  };
}

export function clearCookieOptions() {
  return {
    name: COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}
