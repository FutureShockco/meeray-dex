import { defineStore } from 'pinia';

interface State {
  prices: Record<string, number>;
  changes: Record<string, number | null>;
  marketCaps: Record<string, number | null>;
  loading: boolean;
  error: string | null;
}

// Map your symbols to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  STEEM: 'steem',
  SBD: 'steem-dollars',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  BNB: 'binancecoin',
  USDC: 'usd-coin',
};
const FIAT = 'usd';

export const useCoinPricesStore = defineStore('coinPrices', {
  state: (): State => ({
    prices: {},
    changes: {},
    marketCaps: {},
    loading: false,
    error: null,
  }),
  actions: {
    async fetchPrices() {
      this.loading = true;
      this.error = null;
      try {
        const ids = Object.values(COINGECKO_IDS).join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${FIAT}&include_24hr_change=true&include_market_cap=true`;
        const res = await fetch(url);
        const data = await res.json();
        this.prices = {};
        this.changes = {};
        this.marketCaps = {};
        for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
          if(symbol === 'STEEM') {
            this.prices['TESTS'] = Number(data[id]?.[FIAT] ?? 0);
            this.changes['TESTS'] = Number(data[id]?.[`${FIAT}_24h_change`] ?? 0);
            this.marketCaps['TESTS'] = Number(data[id]?.[`${FIAT}_market_cap`] ?? 0);
          }
          if(symbol === 'SBD') {
            this.prices['TBD'] = Number(data[id]?.[FIAT] ?? 0);
            this.changes['TBD'] = Number(data[id]?.[`${FIAT}_24h_change`] ?? 0);
            this.marketCaps['TBD'] = Number(data[id]?.[`${FIAT}_market_cap`] ?? 0);
          }
          this.prices[symbol.toUpperCase()] = Number(data[id]?.[FIAT] ?? 0);
          this.changes[symbol.toUpperCase()] = Number(data[id]?.[`${FIAT}_24h_change`] ?? 0);
          this.marketCaps[symbol.toUpperCase()] = Number(data[id]?.[`${FIAT}_market_cap`] ?? 0);

        }
      } catch (e: any) {
        this.error = e.message || 'Unknown error';
      } finally {
        this.loading = false;
      }
    },
  },
}); 