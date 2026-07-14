'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface AffiliateEarning {
  id: string;
  orderNumber: string;
  date: string;
  contactName: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
}

const BLUE = 'rgba(0,229,255,0.9)';
const BLUE_DARK = 'rgba(0,150,200,0.9)';

interface AffiliateEarningsPanelProps {
  streamerUsername: string;
}

export default function AffiliateEarningsPanel({ streamerUsername }: AffiliateEarningsPanelProps) {
  const [earnings, setEarnings] = useState<AffiliateEarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, [streamerUsername]);

  async function fetchEarnings() {
    setLoading(true);
    try {
      const res = await fetch(`/api/streamer?action=affiliate-earnings&username=${streamerUsername}`);
      if (!res.ok) throw new Error('Erro ao carregar vendas');
      const data = await res.json();
      setEarnings(data);
    } catch (e) {
      console.error('Erro ao carregar vendas:', e);
    } finally {
      setLoading(false);
    }
  }

  const totalEarnings = earnings.reduce((sum, e) => sum + e.totalPrice, 0);
  const totalQuantity = earnings.reduce((sum, e) => sum + e.quantity, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 style={{ color: BLUE }} className="text-2xl font-bold mb-2">
          💰 Ganhos com Afiliação
        </h2>
        <p className="text-gray-400">Vendas e despesas atribuídas ao seu programa de afiliação</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="rounded-xl p-4 text-center"
          style={{ backgroundColor: `${BLUE_DARK}20`, borderLeft: `4px solid ${BLUE}` }}
        >
          <p style={{ color: BLUE }} className="text-sm font-semibold">Número de Vendas</p>
          <p className="text-2xl font-bold text-white">{earnings.length}</p>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="rounded-xl p-4 text-center"
          style={{ backgroundColor: `${BLUE_DARK}20`, borderLeft: `4px solid ${BLUE}` }}
        >
          <p style={{ color: BLUE }} className="text-sm font-semibold">Quantidade de Itens</p>
          <p className="text-2xl font-bold text-white">{totalQuantity}</p>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="rounded-xl p-4 text-center"
          style={{ backgroundColor: `${BLUE_DARK}20`, borderLeft: `4px solid ${BLUE}` }}
        >
          <p style={{ color: BLUE }} className="text-sm font-semibold">Receita Total</p>
          <p className="text-2xl font-bold text-white">
            R$ {totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </motion.div>
      </div>

      {/* Earnings Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-x-auto rounded-xl border"
        style={{ borderColor: BLUE }}
      >
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : earnings.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma venda de afiliação encontrada</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BLUE_DARK }}>
                <th className="px-4 py-3 text-left text-white">Pedido</th>
                <th className="px-4 py-3 text-left text-white">Data</th>
                <th className="px-4 py-3 text-left text-white">Cliente</th>
                <th className="px-4 py-3 text-left text-white">Produto</th>
                <th className="px-4 py-3 text-center text-white">Qtd</th>
                <th className="px-4 py-3 text-right text-white">Valor Unit.</th>
                <th className="px-4 py-3 text-right text-white">Total</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((earning, idx) => (
                <motion.tr
                  key={earning.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border-t"
                  style={{ borderColor: `${BLUE}30` }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${BLUE}10`)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td className="px-4 py-3 text-white font-mono">{earning.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-300">{earning.date}</td>
                  <td className="px-4 py-3 text-gray-300">{earning.contactName}</td>
                  <td className="px-4 py-3 text-gray-300 truncate max-w-xs" title={earning.productDescription}>
                    {earning.productDescription}
                  </td>
                  <td className="px-4 py-3 text-center text-white">{earning.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    R$ {earning.unitPrice.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: BLUE }}>
                    R$ {earning.totalPrice.toFixed(2)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </motion.div>
  );
}
