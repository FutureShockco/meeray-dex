import { defineStore } from 'pinia';

interface OrderBookEntry {
  price: string;
  amount: string;
  total: string;
}
interface TradeEntry {
  price: string;
  amount: string;
  time: string;
  side: 'buy' | 'sell';
}
interface CandleEntry {
  // Add fields as needed
  [key: string]: any;
}

interface State {
  orderBook: { asks: OrderBookEntry[]; bids: OrderBookEntry[] };
  trades: TradeEntry[];
  candles: CandleEntry[];
}

export const useAppStore = defineStore('appStore', {
  state: (): State => ({
    orderBook: { asks: [], bids: [] },
    trades: [],
    candles: [],
  }),
  actions: {
    /**
     * Handle a WebSocket event from the backend.
     * @param data The event object (should contain tx, ts, etc)
     */
    handleWsEvent(data: any) {
      if (!data || !data.tx) return;
      const { tx } = data;
      // Example: route by tx.type or tx.operation
      switch (tx.type || tx.operation) {
        case 'orderbook_update':
          if (tx.asks && tx.bids) {
            this.orderBook.asks = tx.asks;
            this.orderBook.bids = tx.bids;
          }
          break;
        case 'trade':
          if (tx.trade) {
            this.trades.unshift(tx.trade);
            this.trades = this.trades.slice(0, 100); // keep last 100
          }
          break;
        case 'candle':
          if (tx.candle) {
            this.candles.push(tx.candle);
            if (this.candles.length > 200) this.candles.shift();
          }
          break;
        // Add more cases as needed
        default:
          // Optionally: handle generic or unknown events
          break;
      }
    },
  },
});
