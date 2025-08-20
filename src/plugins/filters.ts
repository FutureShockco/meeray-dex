import numeral from 'numeral';
import moment from 'moment';
import BigNumber from 'bignumber.js';
import { useCoinPricesStore } from '../stores/useCoinPrices';
import { useTokenListStore } from '../stores/useTokenList';

import type { App } from 'vue';

export default {
  install(app: App) {
    const tokenListStore = useTokenListStore();

    app.config.globalProperties.$numeral = numeral;
    app.config.globalProperties.$moment = moment;

    app.config.globalProperties.$formatNumber = (value: string | number, symbol?: string, format: string = '0,0.00') => {
      if (symbol && tokenListStore.tokens.length > 0) {
        const token = tokenListStore.tokens.find((t) => t.symbol === symbol);
        if (token && typeof token.precision === 'number') {
          try {
            const human = new BigNumber(value)
              .dividedBy(new BigNumber(10).pow(token.precision));
            const decimalPlaces = Math.min(token.precision, 8);
            return human.toFixed(decimalPlaces);
          } catch (e) {
            console.warn('format error:', e);
          }
        }
      }
      return numeral(value).format(format);
    };

    app.config.globalProperties.$formatTokenBalance = (
      balanceData: { amount?: string; rawAmount?: string } | string | number,
      symbol: string,
      format: string = '0,0.00'
    ) => {
      if (tokenListStore.tokens.length === 0) {
        const value = typeof balanceData === 'object'
          ? balanceData.amount || balanceData.rawAmount || '0'
          : balanceData;
        return numeral(value).format(format);
      }

      const token = tokenListStore.tokens.find((t) => t.symbol === symbol);
      const defaultPrecisions: Record<string, number> = { MRY: 8, STEEM: 3, SBD: 3, BTC: 8, ETH: 18, LP_TOKEN: 18 };
      const precision = token?.precision ?? defaultPrecisions[symbol] ?? 8;

      try {
        const rawValue = typeof balanceData === 'object'
          ? balanceData.rawAmount || balanceData.amount || '0'
          : balanceData;

        if (rawValue === "1000000000000000000000000000000") {
          return 'Infinite';
        }

        const human = new BigNumber(rawValue)
          .dividedBy(new BigNumber(10).pow(precision));
        const decimalPlaces = Math.min(precision, 8);
        return human.toFixed(decimalPlaces);
      } catch (e) {
        console.warn('format error:', e);
        const value = typeof balanceData === 'object'
          ? balanceData.amount || '0'
          : balanceData;
        return numeral(value).format(format);
      }
    };

    app.config.globalProperties.$formatRawNumber = (value: string | number, symbol: string, format: string = '0,0.00') => {
      const token = tokenListStore.tokens.find((t) => t.symbol === symbol);
      if (!token || typeof token.precision !== 'number') return numeral(value).format(format);
      try {
        const human = new BigNumber(value)
          .dividedBy(new BigNumber(10).pow(token.precision));
        const decimalPlaces = Math.min(token.precision, 8);
        return human.toFixed(decimalPlaces);
      } catch (e) {
        console.warn('format error:', e);
        return numeral(value).format(format);
      }
    };

    app.config.globalProperties.$formatDate = (value: string | number | Date, format = 'YYYY-MM-DD HH:mm') => {
      if (!value) return '';
      return moment(value).format(format);
    };

    app.config.globalProperties.$coinPrice = (symbol: string) => {
      const store = useCoinPricesStore();
      return store.prices[symbol] ?? null;
    };

    app.config.globalProperties.$formattedCoinPrice = (symbol: string, format = '$0,0.00') => {
      const store = useCoinPricesStore();
      const price = store.prices[symbol];
      if (price == null) return '--';
      return numeral(price).format(format);
    };
  }
};
