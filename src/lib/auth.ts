import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE = 'ps_session';
const EXPIRES_IN = 60 * 60 * 24 * 7; // 7 dias

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

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
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
    ...(rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
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
