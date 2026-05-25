export const runtime = 'edge';

// Busca cotação do dólar turismo via AwesomeAPI (BRLT = Real Turismo)
export async function GET() {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRLT', {
      next: { revalidate: 300 }, // cache de 5 min no servidor
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`AwesomeAPI status ${res.status}`);

    const data = await res.json() as Record<string, { bid?: string; ask?: string; name?: string }>;
    const entry = data['USDBRLT'];
    const rate = parseFloat(entry?.bid ?? '0');

    if (!rate || isNaN(rate)) throw new Error('Taxa inválida na resposta');

    return Response.json({ rate, source: 'USD-BRLT (turismo)', fetchedAt: new Date().toISOString() });
  } catch (err) {
    // fallback: tenta dólar comercial
    try {
      const res2 = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
        next: { revalidate: 300 },
        headers: { Accept: 'application/json' },
      });
      const data2 = await res2.json() as Record<string, { bid?: string }>;
      const rate2 = parseFloat(data2['USDBRL']?.bid ?? '0');
      if (!rate2 || isNaN(rate2)) throw new Error('Fallback inválido');
      return Response.json({ rate: rate2, source: 'USD-BRL (comercial, fallback)', fetchedAt: new Date().toISOString() });
    } catch {
      // fallback hardcoded: retorna taxa aproximada para não deixar o cliente sem valor
      return Response.json({ rate: 5.8, source: 'hardcoded (fallback)', fetchedAt: new Date().toISOString() });
    }
  }
}
