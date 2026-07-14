// Detecta como a entrega de um prêmio deve ser coletada do ganhador no chat.
// "Camisa" no nome = produto físico (endereço em vez de trade link).
// "Camisa PlayerSkins" especificamente = também precisa da camisa escolhida.
export type DeliveryMode = 'trade_link' | 'address' | 'address_and_shirt';

export function getDeliveryMode(prizeName: string): DeliveryMode {
  const lower = prizeName.toLowerCase();
  if (!lower.includes('camisa')) return 'trade_link';
  return lower.includes('playerskins') ? 'address_and_shirt' : 'address';
}
