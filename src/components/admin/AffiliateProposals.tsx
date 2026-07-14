'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BLUE = 'rgba(0,229,255,0.9)';
const BLUE_DARK = 'rgba(0,150,200,0.9)';
const GOLD = 'rgba(255,180,0,0.9)';

interface Proposal {
  id: string;
  streamerName: string;
  coupon: string | null;
  profitPct: number;
  status: 'pending' | 'accepted' | 'refused';
  accountConfirmed: boolean;
  shirtsConfirmed: boolean;
  startedAt: string | null;
  contractMonths: number | null;
  createdAt: string;
}

function buildProposalHtml(streamer: string, profitPct: number, coupon: string, logoUrl: string, startISO?: string, months?: number) {
  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const name = streamer.trim() || 'Streamer';
  const pct = Number.isFinite(profitPct) ? profitPct : 0;
  const code = coupon.trim().toUpperCase();
  const cpm = code || '________';
  // Duração do contrato em meses (definida na criação) — padrão 6
  const mo = (months && months > 0) ? Math.round(months) : 6;
  // Dia inicial da afiliação (definido pelo botão "Iniciar") — se não houver, usa hoje
  const startBase = startISO ? new Date(startISO) : new Date();
  const startDate = startBase.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const end = new Date(startBase);
  end.setMonth(end.getMonth() + mo);
  const endDate = end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Proposta de Afiliação - ${name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@600;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { background: #ffffff; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1c2c; }

  @page { size: A4; margin: 0; }

  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #ffffff;
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .header {
    background: linear-gradient(135deg, #050816 0%, #0a0f2e 55%, #11163b 100%);
    padding: 38px 46px 30px;
    position: relative;
  }
  .header::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 4px;
    background: linear-gradient(90deg, #FFB400 0%, #ff8a00 100%);
  }
  .header img { height: 46px; width: auto; display: block; }
  .header .kicker {
    margin-top: 22px;
    font-family: 'Orbitron', sans-serif;
    font-size: 11px;
    letter-spacing: 5px;
    color: #FFB400;
    font-weight: 700;
    text-transform: uppercase;
  }
  .header h1 {
    margin-top: 6px;
    font-family: 'Orbitron', sans-serif;
    font-size: 30px;
    font-weight: 900;
    color: #ffffff;
    letter-spacing: 1px;
  }

  /* ── Body ── */
  .body { padding: 40px 46px 0; flex: 1; }

  .meta {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 1px solid #e7e9f0;
    padding-bottom: 18px;
    margin-bottom: 28px;
  }
  .meta .to-label {
    font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
    color: #9095a8; font-weight: 600;
  }
  .meta .to-name {
    font-family: 'Orbitron', sans-serif;
    font-size: 22px; font-weight: 700; color: #11163b; margin-top: 4px;
  }
  .meta .date { font-size: 12px; color: #9095a8; text-align: right; }
  .meta .coupon { margin-top: 8px; font-size: 11px; color: #6b7090; letter-spacing: .3px; }
  .meta .coupon span {
    font-family: 'Orbitron', sans-serif; font-weight: 700; color: #8a6500;
    background: #fff2cc; border: 1px solid #ffe39a; border-radius: 6px;
    padding: 2px 8px; margin-left: 4px; letter-spacing: 1px;
  }

  .intro { font-size: 13.5px; line-height: 1.75; color: #3a3d52; margin-bottom: 30px; }
  .intro strong { color: #11163b; }

  .clause { font-size: 11.5px; line-height: 1.7; color: #3a3d52; margin-bottom: 11px; text-align: justify; }
  .clause strong { color: #11163b; }

  .section-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 13px; letter-spacing: 2px; text-transform: uppercase;
    color: #11163b; font-weight: 700;
    margin-bottom: 18px;
    display: flex; align-items: center; gap: 10px;
  }
  .section-title::before {
    content: ''; width: 22px; height: 3px; background: #FFB400; border-radius: 2px;
  }

  /* ── Highlight metrics ── */
  .metrics { display: flex; gap: 16px; margin-bottom: 30px; }
  .metric {
    flex: 1;
    background: linear-gradient(135deg, #0a0f2e 0%, #11163b 100%);
    border-radius: 14px;
    padding: 22px 24px;
    position: relative;
    overflow: hidden;
  }
  .metric::after {
    content: ''; position: absolute; top: 0; right: 0; width: 80px; height: 80px;
    background: radial-gradient(circle, rgba(255,180,0,0.18) 0%, transparent 70%);
  }
  .metric .val {
    font-family: 'Orbitron', sans-serif;
    font-size: 34px; font-weight: 900; color: #FFB400; line-height: 1;
  }
  .metric .lbl { font-size: 11.5px; color: #c7cbe0; margin-top: 10px; line-height: 1.45; }

  /* ── Benefits ── */
  .benefits { list-style: none; margin-bottom: 30px; }
  .benefit {
    display: flex; gap: 14px; align-items: flex-start;
    padding: 15px 18px;
    border: 1px solid #e7e9f0;
    border-radius: 12px;
    margin-bottom: 12px;
    background: #fafbfd;
  }
  .benefit .tick {
    flex-shrink: 0;
    width: 26px; height: 26px; border-radius: 8px;
    background: linear-gradient(135deg, #FFB400 0%, #ff8a00 100%);
    color: #11163b; font-weight: 900; font-size: 15px;
    display: flex; align-items: center; justify-content: center;
  }
  .benefit .txt { font-size: 13px; line-height: 1.55; color: #3a3d52; padding-top: 3px; }
  .benefit .txt b { color: #11163b; }

  /* ── Shirts box ── */
  .shirts {
    background: linear-gradient(135deg, #fff8e6 0%, #fff2cc 100%);
    border: 1px solid #ffe39a;
    border-radius: 14px;
    padding: 22px 24px;
    margin-bottom: 14px;
  }
  .shirts .h {
    font-family: 'Orbitron', sans-serif; font-size: 12px; letter-spacing: 1.5px;
    text-transform: uppercase; color: #8a6500; font-weight: 700; margin-bottom: 12px;
  }
  .shirts ul { list-style: none; }
  .shirts li { font-size: 12.5px; color: #5c4a00; line-height: 1.7; padding-left: 18px; position: relative; }
  .shirts li::before { content: '👕'; position: absolute; left: 0; }

  /* ── Footer ── */
  .footer {
    margin-top: 36px;
    background: #050816;
    padding: 22px 46px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer .brand {
    font-family: 'Orbitron', sans-serif; font-size: 11px; letter-spacing: 3px;
    color: #FFB400; font-weight: 700;
  }
  .footer .note { font-size: 10.5px; color: #6b7090; }

  @media print {
    .page { box-shadow: none; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img src="${logoUrl}" alt="PlayerSkins" />
      <div class="kicker">Programa de Afiliados</div>
      <h1>Proposta de Afiliação</h1>
    </div>

    <div class="body">
      <div class="meta">
        <div>
          <div class="to-label">Proposta para</div>
          <div class="to-name">${name}</div>
          ${code ? `<div class="coupon">Cupom de desconto: <span>${code}</span></div>` : ''}
        </div>
        <div class="date">Emitida em<br/>${today}</div>
      </div>

      <p class="intro">
        Prezado(a) <strong>${name}</strong>, é com satisfação que a <strong>PlayerSkins</strong>
        apresenta esta proposta de afiliação. Nosso objetivo é construir uma parceria direta e
        lucrativa, na qual a sua audiência converte-se em receita recorrente e em prêmios reais
        para a sua comunidade${code ? `, por meio do seu cupom de desconto exclusivo <strong>${code}</strong>` : ''}.
        A seguir, apresentamos os termos e benefícios desta parceria.
      </p>

      <div class="section-title">Ganho sobre o lucro das vendas</div>
      <div class="metrics">
        <div class="metric">
          <div class="val">${pct}%</div>
          <div class="lbl">de ganho sobre o lucro de todas as vendas realizadas com o seu cupom de desconto</div>
        </div>
        <div class="metric">
          <div class="val">+10%</div>
          <div class="lbl">destinados a sorteios sobre as vendas na plataforma de sorteio PlayerSkins</div>
        </div>
      </div>

      <div class="section-title">Benefícios da parceria</div>
      <ul class="benefits">
        <li class="benefit">
          <div class="tick">✓</div>
          <div class="txt"><b>${pct}% de ganho sobre o lucro das vendas.</b> Você recebe uma comissão fixa sobre o lucro de todas as vendas realizadas através do seu cupom de desconto${code ? ` <b>${code}</b>` : ''}.</div>
        </li>
        <li class="benefit">
          <div class="tick">✓</div>
          <div class="txt"><b>+10% para sorteio sobre as vendas.</b> Um adicional de 10% sobre as vendas é revertido em sorteios na plataforma de sorteio PlayerSkins, aquecendo e fidelizando a sua comunidade.</div>
        </li>
        <li class="benefit">
          <div class="tick">✓</div>
          <div class="txt"><b>Camisas para sorteio mensal.</b> 1 camisa no primeiro mês e 2 camisas a partir do segundo mês, destinadas a sorteio ao final de cada mês.</div>
        </li>
        <li class="benefit">
          <div class="tick">✓</div>
          <div class="txt"><b>Bônus de início.</b> O afiliado recebe 2 camisas ao iniciar a afiliação.</div>
        </li>
      </ul>

      <div class="section-title">Pagamento</div>
      <p class="intro" style="margin-bottom: 24px;">
        Os valores são apurados mensalmente e o pagamento é realizado ao final de cada mês,
        no <strong>último dia útil</strong>.
      </p>

      <div class="shirts">
        <div class="h">Resumo das camisas</div>
        <ul>
          <li><b>Ao iniciar a afiliação:</b> 2 camisas de bônus para o afiliado.</li>
          <li><b>Primeiro mês:</b> 1 camisa destinada a sorteio ao final do mês.</li>
          <li><b>A partir do segundo mês:</b> 2 camisas destinadas a sorteio ao final de cada mês.</li>
        </ul>
      </div>

      <div class="section-title">Compromisso e Vigência</div>
      <p class="clause">O afiliado assume o compromisso de realizar o serviço de propaganda/marketing das camisas da marca <strong>PlayerSkins</strong> por meio do cupom de desconto exclusivo <strong>${cpm}</strong> em suas plataformas digitais aos seus seguidores e da realização de sorteios de camisas oferecidas pela PlayerSkins até o último dia de cada mês, no prazo de ${mo} meses, iniciando esse projeto de afiliação no dia <strong>${startDate}</strong> e encerrando no dia <strong>${endDate}</strong> de acordo com a forma estabelecida no presente contrato.</p>
      <p class="clause">Fica estabelecido desde já a prorrogação automática do contrato por um novo período de três meses, a contar do dia <strong>${endDate}</strong>, nos mesmos termos aqui estabelecidos, caso as partes não se manifestem em sentido contrário. Se qualquer das partes não quiser a renovação automática, deverá a mesma manifestar sua intenção até quinze dias antes do término do contrato (${endDate}), sem qualquer ônus.</p>
      <p class="clause">Poderá o presente instrumento ser rescindido por qualquer uma das partes, em qualquer momento, sem justa causa, inobstante seja necessário avisar previamente a outra parte por escrito, no prazo de 10 (dez) dias corridos, sem o que a rescisão não produzirá qualquer efeito.</p>
      <p class="clause">Caso a <strong>PlayerSkins</strong> seja a responsável pela rescisão imotivada, fica obrigada ainda a pagar a comissão fixa sobre o lucro de todas as vendas realizadas através do cupom de desconto <strong>${cpm}</strong>, durante 30 (trinta) dias após a comunicação de manifestação de rescisão ao afiliado.</p>
    </div>

    <div class="footer">
      <div class="brand">PLAYERSKINS</div>
      <div class="note">Proposta de afiliação — documento confidencial</div>
    </div>
  </div>
</body>
</html>`;
}

function openProposalPdf(name: string, pct: number, coupon: string, startISO?: string, months?: number) {
  const logoUrl = `${window.location.origin}/wordmark.png`;
  const html = buildProposalHtml(name, pct, coupon, logoUrl, startISO, months);
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  const triggerPrint = () => { win.focus(); win.print(); };
  const img = win.document.querySelector('img');
  if (img && !img.complete) {
    img.addEventListener('load', () => setTimeout(triggerPrint, 350));
    img.addEventListener('error', () => setTimeout(triggerPrint, 350));
  } else {
    setTimeout(triggerPrint, 500);
  }
  return true;
}

// ── Status helpers ──────────────────────────────────────────────────────────
function secondaryStatus(p: Proposal): { label: string; tone: 'ok' | 'wait' } {
  if (!p.accountConfirmed) return { label: 'Aguardando criar conta', tone: 'wait' };
  if (!p.shirtsConfirmed) return { label: 'Aguardando camisas', tone: 'wait' };
  return { label: 'TUDO OK', tone: 'ok' };
}

export default function AffiliateProposals() {
  const [streamer, setStreamer] = useState('');
  const [coupon, setCoupon] = useState('');
  const [profit, setProfit] = useState('');
  const [months, setMonths] = useState('6');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'afiliados' | 'aguardando' | 'recusaram'>('aguardando');

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/affiliate-proposals');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
      setProposals(Array.isArray(data) ? data : []);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carga inicial: sincroniza o dashboard com o servidor (uso legítimo de effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProposals();
  }, [fetchProposals]);

  const generate = async () => {
    setError(null);
    const name = streamer.trim();
    const pct = parseFloat(profit.replace(',', '.'));
    if (!name) { setError('Informe o nome do streamer.'); return; }
    if (!Number.isFinite(pct) || pct <= 0) { setError('Informe uma porcentagem de lucro valida.'); return; }

    const code = coupon.trim().toUpperCase();
    const mo = parseInt(months) > 0 ? parseInt(months) : 6;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/affiliate-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamerName: name, profitPct: pct, coupon: code, contractMonths: mo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);

      const ok = openProposalPdf(name, pct, code, undefined, mo);
      if (!ok) setError('Proposta salva, mas permita pop-ups para abrir o PDF.');

      setStreamer('');
      setCoupon('');
      setProfit('');
      setMonths('6');
      setProposals(prev => [data, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar proposta.');
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    // Atualização otimista
    setProposals(prev => prev.map(p => (p.id === id ? { ...p, ...body } as Proposal : p)));
    try {
      const res = await fetch(`/api/admin/affiliate-proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);
      setProposals(prev => prev.map(p => (p.id === id ? data : p)));
    } catch {
      fetchProposals();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setProposals(prev => prev.filter(p => p.id !== id));
    try {
      await fetch(`/api/admin/affiliate-proposals/${id}`, { method: 'DELETE' });
    } catch {
      fetchProposals();
    } finally {
      setBusyId(null);
    }
  };

  const pending = proposals.filter(p => p.status === 'pending');
  const accepted = proposals.filter(p => p.status === 'accepted');
  const refused = proposals.filter(p => p.status === 'refused');

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  };

  return (
    <motion.div
      key="afiliados"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.22 }}
      className="max-w-3xl"
    >
      {/* ── Card Nova Proposta ── */}
      <motion.div
        layout
        className="rounded-2xl overflow-hidden mb-8 flex flex-col"
        style={{
          background: `linear-gradient(135deg, rgba(0,100,150,0.2) 0%, rgba(0,150,200,0.1) 100%)`,
          border: `1px solid ${BLUE_DARK}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="px-8 py-6 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, rgba(0,229,255,0.2) 0%, rgba(0,150,200,0.1) 100%)`,
                border: `1px solid ${BLUE}`,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <h3 className="font-orbitron text-lg font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.95)' }}>
                Nova Proposta
              </h3>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Gere uma proposta e acompanhe a afiliação
              </p>
            </div>
          </div>
          {loading ? null : (
            <div className="text-right">
              <p className="text-xs tracking-widest font-orbitron" style={{ color: 'rgba(255,255,255,0.35)' }}>
                AGUARDANDO
              </p>
              <p className="font-orbitron text-3xl font-bold" style={{ color: BLUE, lineHeight: 1 }}>
                {pending.length}
              </p>
            </div>
          )}
        </div>

        <div className="px-8 py-6 border-t flex flex-col gap-5" style={{ borderColor: `${BLUE_DARK}20` }}>
          <div className="flex flex-col gap-2">
            <label className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
              NOME DO STREAMER
            </label>
            <input
              value={streamer}
              onChange={e => setStreamer(e.target.value)}
              placeholder="Ex: ShadowGanjaKing"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
              CUPOM DE DESCONTO
            </label>
            <input
              value={coupon}
              onChange={e => setCoupon(e.target.value)}
              placeholder="Ex: GANJA10"
              style={{ ...inputStyle, textTransform: 'uppercase' }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
              % DE GANHO SOBRE O LUCRO DAS VENDAS
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={profit}
                onChange={e => setProfit(e.target.value)}
                placeholder="Ex: 15"
                inputMode="decimal"
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              <span
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  color: BLUE, fontWeight: 700, fontSize: 14,
                }}
              >
                %
              </span>
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Fixo na proposta: +10% para sorteio sobre vendas, 2 camisas ao iniciar, 1 camisa no 1o mes e 2 a partir do 2o mes.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
              DURAÇÃO DO CONTRATO (MESES)
            </label>
            <input
              value={months}
              onChange={e => setMonths(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Ex: 6"
              inputMode="numeric"
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Define o prazo no contrato e a data de encerramento (início + meses).
            </p>
          </div>

          {error && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.25)', color: 'rgba(255,120,120,0.95)' }}
            >
              {error}
            </div>
          )}

          <button
            onClick={generate}
            disabled={creating}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-orbitron text-xs font-bold tracking-widest transition-all w-full"
            style={{ background: `linear-gradient(135deg, rgba(0,229,255,0.2) 0%, rgba(0,150,200,0.1) 100%)`, border: `1px solid ${BLUE}`, color: BLUE, opacity: creating ? 0.5 : 1 }}
            onMouseEnter={e => { if (!creating) (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, rgba(0,229,255,0.25) 0%, rgba(0,150,200,0.15) 100%)`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, rgba(0,229,255,0.2) 0%, rgba(0,150,200,0.1) 100%)`; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
            </svg>
            {creating ? 'GERANDO...' : 'GERAR PDF E SALVAR'}
          </button>
        </div>
      </motion.div>

      {/* ── Abas ── */}
      <div className="mt-10">
        <div className="flex gap-4 mb-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {[
            { id: 'afiliados' as const, label: 'Afiliados', count: accepted.length },
            { id: 'aguardando' as const, label: 'Aguardando', count: pending.length },
            { id: 'recusaram' as const, label: 'Recusaram', count: refused.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="font-orbitron text-xs font-bold tracking-widest pb-3 px-1 transition-all relative"
              style={{
                color: activeTab === tab.id ? BLUE : 'rgba(255,255,255,0.35)',
                borderBottom: activeTab === tab.id ? `2px solid ${BLUE}` : 'none',
              }}
            >
              {tab.label.toUpperCase()}
              {tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    background: activeTab === tab.id ? `${BLUE}20` : 'rgba(255,255,255,0.06)',
                    color: activeTab === tab.id ? BLUE : 'rgba(255,255,255,0.5)',
                  }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo das abas */}
        {loading ? (
          <p className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando...</p>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'aguardando' && (
              <motion.div
                key="aguardando"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3"
              >
                {pending.length === 0 ? (
                  <p className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Nenhuma proposta aguardando resposta.
                  </p>
                ) : (
                  pending.map(p => (
                    <PendingRow key={p.id} p={p} busy={busyId === p.id}
                      onAccept={() => patch(p.id, { status: 'accepted' })}
                      onRefuse={() => patch(p.id, { status: 'refused' })}
                      onPdf={() => openProposalPdf(p.streamerName, p.profitPct, p.coupon ?? '', undefined, p.contractMonths ?? undefined)}
                      onDelete={() => remove(p.id)}
                    />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'afiliados' && (
              <motion.div
                key="afiliados"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3"
              >
                {accepted.length === 0 ? (
                  <p className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Nenhum afiliado aceito ainda.
                  </p>
                ) : (
                  accepted.map(p => (
                    <AcceptedRow key={p.id} p={p} busy={busyId === p.id}
                      onToggleAccount={() => patch(p.id, { accountConfirmed: !p.accountConfirmed })}
                      onToggleShirts={() => patch(p.id, { shirtsConfirmed: !p.shirtsConfirmed })}
                      onStart={() => patch(p.id, { startedAt: new Date().toISOString() })}
                      onPdf={() => openProposalPdf(p.streamerName, p.profitPct, p.coupon ?? '', p.startedAt ?? undefined, p.contractMonths ?? undefined)}
                      onDelete={() => remove(p.id)}
                    />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'recusaram' && (
              <motion.div
                key="recusaram"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3"
              >
                {refused.length === 0 ? (
                  <p className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Nenhuma recusa registrada.
                  </p>
                ) : (
                  refused.map(p => (
                    <RefusedRow key={p.id} p={p} busy={busyId === p.id}
                      onReopen={() => patch(p.id, { status: 'pending' })}
                      onDelete={() => remove(p.id)}
                    />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function RowShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl px-5 py-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {children}
    </motion.div>
  );
}

function NameBlock({ p }: { p: Proposal }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center font-orbitron text-sm font-bold flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}>
        {p.streamerName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="font-orbitron text-sm font-bold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {p.streamerName}
        </p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {p.profitPct}% sobre lucro · +10% sorteio{p.coupon ? ` · ${p.coupon}` : ''}
        </p>
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700, letterSpacing: 1,
  cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
};

function PdfBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="Gerar PDF novamente" className="font-orbitron"
      style={{ ...smallBtn, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
      PDF
    </button>
  );
}

function DeleteBtn({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} title="Excluir proposta"
      className="flex items-center justify-center"
      style={{ ...smallBtn, padding: '7px 9px', background: 'transparent', border: '1px solid rgba(255,90,90,0.2)', color: 'rgba(255,90,90,0.7)' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}

function PendingRow({ p, busy, onAccept, onRefuse, onPdf, onDelete }: {
  p: Proposal; busy: boolean; onAccept: () => void; onRefuse: () => void; onPdf: () => void; onDelete: () => void;
}) {
  return (
    <RowShell>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <NameBlock p={p} />
        <div className="flex items-center gap-2" style={{ opacity: busy ? 0.5 : 1 }}>
          <span className="font-orbitron px-2.5 py-1 rounded-full" style={{ fontSize: 10, letterSpacing: 1, background: `rgba(0,229,255,0.12)`, border: `1px solid ${BLUE_DARK}`, color: BLUE }}>
            AGUARDANDO
          </span>
          <PdfBtn onClick={onPdf} />
          <button onClick={onAccept} disabled={busy} className="font-orbitron"
            style={{ ...smallBtn, background: `rgba(0,229,255,0.14)`, border: `1px solid ${BLUE_DARK}`, color: BLUE }}>
            CONFIRMAR
          </button>
          <button onClick={onRefuse} disabled={busy} className="font-orbitron"
            style={{ ...smallBtn, background: 'rgba(255,90,90,0.12)', border: '1px solid rgba(255,90,90,0.3)', color: 'rgba(255,120,120,0.95)' }}>
            RECUSAR
          </button>
          <DeleteBtn onClick={onDelete} busy={busy} />
        </div>
      </div>
    </RowShell>
  );
}

function CheckToggle({ done, label, onClick, busy }: { done: boolean; label: string; onClick: () => void; busy: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className="flex items-center gap-2 font-orbitron"
      style={{
        ...smallBtn,
        background: done ? 'rgba(80,220,140,0.12)' : 'rgba(255,255,255,0.04)',
        border: done ? '1px solid rgba(80,220,140,0.35)' : '1px solid rgba(255,255,255,0.12)',
        color: done ? 'rgba(80,220,140,0.95)' : 'rgba(255,255,255,0.5)',
      }}>
      <span style={{
        width: 14, height: 14, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: done ? 'none' : '1px solid rgba(255,255,255,0.3)', background: done ? 'rgba(80,220,140,0.9)' : 'transparent',
        color: '#08110a', fontSize: 10, fontWeight: 900,
      }}>{done ? '✓' : ''}</span>
      {label}
    </button>
  );
}

function AcceptedRow({ p, busy, onToggleAccount, onToggleShirts, onStart, onPdf, onDelete }: {
  p: Proposal; busy: boolean; onToggleAccount: () => void; onToggleShirts: () => void; onStart: () => void; onPdf: () => void; onDelete: () => void;
}) {
  const sec = secondaryStatus(p);
  const isOk = sec.tone === 'ok';
  return (
    <RowShell>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <NameBlock p={p} />
        <span className="font-orbitron px-3 py-1 rounded-full" style={{
          fontSize: 10, letterSpacing: 1,
          background: isOk ? 'rgba(80,220,140,0.16)' : 'rgba(255,180,0,0.1)',
          border: isOk ? '1px solid rgba(80,220,140,0.4)' : '1px solid rgba(255,180,0,0.25)',
          color: isOk ? 'rgba(80,220,140,0.95)' : GOLD,
        }}>
          {sec.label.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap" style={{ opacity: busy ? 0.5 : 1 }}>
        <CheckToggle done={p.accountConfirmed} label="CONTA CRIADA" onClick={onToggleAccount} busy={busy} />
        <CheckToggle done={p.shirtsConfirmed} label="CAMISAS ENTREGUES" onClick={onToggleShirts} busy={busy} />
        {p.startedAt ? (
          <button onClick={onStart} disabled={busy} title="Clique para redefinir o início para hoje" className="font-orbitron flex items-center gap-1.5"
            style={{ ...smallBtn, background: 'rgba(0,229,255,0.12)', border: `1px solid ${BLUE_DARK}`, color: BLUE }}>
            🚀 INÍCIO {new Date(p.startedAt).toLocaleDateString('pt-BR')}
          </button>
        ) : (
          <button onClick={onStart} disabled={busy} className="font-orbitron flex items-center gap-1.5"
            style={{ ...smallBtn, background: 'rgba(0,229,255,0.14)', border: `1px solid ${BLUE}`, color: BLUE }}>
            ▶ INICIAR AFILIAÇÃO
          </button>
        )}
        <div className="ml-auto flex items-center gap-2"><PdfBtn onClick={onPdf} /><DeleteBtn onClick={onDelete} busy={busy} /></div>
      </div>
    </RowShell>
  );
}

function RefusedRow({ p, busy, onReopen, onDelete }: {
  p: Proposal; busy: boolean; onReopen: () => void; onDelete: () => void;
}) {
  return (
    <RowShell>
      <div className="flex items-center justify-between gap-4 flex-wrap" style={{ opacity: 0.7 }}>
        <NameBlock p={p} />
        <div className="flex items-center gap-2" style={{ opacity: busy ? 0.5 : 1 }}>
          <span className="font-orbitron px-2.5 py-1 rounded-full" style={{ fontSize: 10, letterSpacing: 1, background: 'rgba(255,90,90,0.1)', border: '1px solid rgba(255,90,90,0.28)', color: 'rgba(255,120,120,0.95)' }}>
            RECUSOU
          </span>
          <button onClick={onReopen} disabled={busy} className="font-orbitron"
            style={{ ...smallBtn, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}>
            REABRIR
          </button>
          <button onClick={onDelete} disabled={busy} className="font-orbitron"
            style={{ ...smallBtn, background: 'transparent', border: '1px solid rgba(255,90,90,0.2)', color: 'rgba(255,90,90,0.7)' }}>
            EXCLUIR
          </button>
        </div>
      </div>
    </RowShell>
  );
}
