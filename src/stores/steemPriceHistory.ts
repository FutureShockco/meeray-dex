import { defineStore } from 'pinia';

interface PriceData {
  time: number;
  high: number;
  low: number;
  open: number;
  volumefrom: number;
  volumeto: number;
  close: number;
  conversionType: string;
  conversionSymbol: string;
}

interface State {
  priceHistory: PriceData[];
  loading: boolean;
  error: string | null;
}

export const useSteemPriceHistoryStore = defineStore('steemPriceHistory', {
  state: (): State => ({
    priceHistory: [],
    loading: false,
    error: null,
  }),
  actions: {
    async fetchPriceHistory() {
      this.loading = true;
      this.error = null;
      try {
        const res = await fetch('https://min-api.cryptocompare.com/data/histoday?fsym=STEEM&tsym=USD&toTs=1746245874&limit=365');
        const data = await res.json();
        if (data.Response !== 'Success') {
          throw new Error(data.Message || 'Failed to fetch price history');
        }
        this.priceHistory = data.Data;
      } catch (e: any) {
        this.error = e.message || 'Unknown error';
      } finally {
        this.loading = false;
      }
    },
  },
}); 