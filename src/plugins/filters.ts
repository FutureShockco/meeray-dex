import numeral from 'numeral';
import moment from 'moment';
import BigNumber from 'bignumber.js';
import { computed } from 'vue';
import { useCoinPricesStore } from '../stores/useCoinPrices';
import { useTokenListStore } from '../stores/useTokenList';

import type { App } from 'vue';
import { useTokenUsdPrice } from '../composables/useTokenUsdPrice';

const tokenUsdPriceMap = computed(() => {
  const tokensStore = useTokenListStore();
  const map: Record<string, ReturnType<typeof useTokenUsdPrice>> = {};
  for (const token of tokensStore.tokens) {
    if (token.symbol && !map[token.symbol]) map[token.symbol] = useTokenUsdPrice(token.symbol);
  }
  return map;
});
let coinPricesStore = null;

export default {
  install(app: App) {
    const tokenListStore = useTokenListStore();

    app.config.globalProperties.$numeral = numeral;
    app.config.globalProperties.$moment = moment;

    app.config.globalProperties.$formatNumber = (value: string | number, symbol?: string, format: string = '0,0.00') => {
      const defaultPrecisions: Record<string, number> = { MRY: 8, STEEM: 3, SBD: 3, BTC: 8, ETH: 18, LP_TOKEN: 18 };
      let precision: number | undefined;
      if (symbol) {
        const token = tokenListStore.tokens.find((t) => t.symbol === symbol);
        precision = token?.precision ?? defaultPrecisions[symbol];
      }
      const dynamicFormat = `0,0.${'0'.repeat(Math.min(precision, 8))}`;
      if (precision)
        try {
          return numeral(value).format(dynamicFormat);
        } catch (e) {
          console.warn('format error:', e);
          return numeral(value).format(dynamicFormat);
        }
      if (typeof precision === 'number') {
        try {
          const human = new BigNumber(value).dividedBy(new BigNumber(10).pow(precision));
          const decimalPlaces = Math.min(precision, 8);
          return human.toFixed(decimalPlaces);
        } catch (e) {
          console.warn('format error:', e);
        }
      }
      return numeral(value).format(format);
    };

    app.config.globalProperties.$tokenPrice = (symbol?: string, isNumber?: boolean) => {
      if (!coinPricesStore) {
        coinPricesStore = useCoinPricesStore()
      }
      const cgRaw = coinPricesStore?.prices?.[symbol];
      const poolRaw = tokenUsdPriceMap.value?.[symbol]?.value;
      const cgNum = cgRaw === undefined || cgRaw === null ? NaN : Number(cgRaw);
      const poolNum = poolRaw === undefined || poolRaw === null ? NaN : Number(poolRaw);
      const numericPrice = Number.isFinite(cgNum) ? cgNum : (Number.isFinite(poolNum) ? poolNum : 0);
      if (isNumber) {
        return numericPrice;
      }
      if (coinPricesStore && coinPricesStore.marketCaps && coinPricesStore.marketCaps[symbol] !== undefined) {
        return numeral(numericPrice).format('0,0.00');
      }
      return numeral(numericPrice).format('0,0.000');
    };

    app.config.globalProperties.$tokenAmountPrice = (value: string | number, symbol?: string) => {
      if (!coinPricesStore) {
        coinPricesStore = useCoinPricesStore()
      }
      const defaultPrecisions: Record<string, number> = { MRY: 8, STEEM: 3, SBD: 3, BTC: 8, ETH: 18, LP_TOKEN: 18 };
      let precision: number | undefined;
      // If marketCap is available, return amount * implied price from marketCap? No — we want amount * price
      if (symbol) {
        const token = tokenListStore.tokens.find((t) => t.symbol === symbol);
        precision = token?.precision ?? defaultPrecisions[symbol];
      }

      // Get numeric price (safe) from $tokenPrice
      const price = app.config.globalProperties.$tokenPrice(symbol, true) as number;
      const safePrice = Number.isFinite(price) ? price : 0;
      let amountNum = 0;
      try {
        if (typeof value === 'object' && value !== null) {
          const asAmount = (value as any).amount;
          const asRaw = (value as any).rawAmount;
          if (asAmount !== undefined && asAmount !== null) {
            // Caller already provided parsed/human amount
            amountNum = Number(asAmount) || 0;
          } else if (asRaw !== undefined && asRaw !== null) {
            // Convert raw integer using precision
            if (precision !== undefined && precision !== null) {
              amountNum = new BigNumber(asRaw).dividedBy(new BigNumber(10).pow(precision)).toNumber();
            } else {
              amountNum = Number(asRaw) || 0;
            }
          } else {
            amountNum = 0;
          }
        } else {
          amountNum = Number(value) || 0;
        }
      } catch (e) {
        console.warn('tokenAmountPrice: parse error', e);
        amountNum = 0;
      }

      const total = amountNum * safePrice;

      // Choose formatting: more decimals for very small totals
      const fmt = Math.abs(total) < 0.01 ? '0,0.00000' : '0,0.00';
      return numeral(Number(total)).format(fmt);
    };

    app.config.globalProperties.$tokenMcap = (value: string | number, symbol?: string, isNumber?: boolean) => {
      if (!coinPricesStore) {
        coinPricesStore = useCoinPricesStore()
      }
      if (coinPricesStore && coinPricesStore.marketCaps && coinPricesStore.marketCaps[symbol] !== undefined) {
        // If caller wants a number, return numeric market cap
        if (isNumber) return Number(coinPricesStore.marketCaps[symbol]) || 0;
        return numeral(coinPricesStore.marketCaps[symbol] || 0).format('0,0.00');
      }

      // Use numeric price to compute market cap = supply * price (value is supply)
      const price = app.config.globalProperties.$tokenPrice(symbol, true) as number;
      const safePrice = Number.isFinite(price) ? price : 0;
      const supplyNum = Number(value) || 0;
      const mcap = supplyNum * safePrice;
      if (isNumber) return mcap;
      return numeral(mcap).format('0,0.00');
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
        const result = human.toFixed(decimalPlaces);
        return result;
      } catch (e) {
        console.warn('Filter: format error:', e);
        const value = typeof balanceData === 'object'
          ? balanceData.amount || '0'
          : balanceData;
        return numeral(value).format(format);
      }
    };

    app.config.globalProperties.$formatRawNumber = (value: string | number | bigint, symbol: string, formatSymbol: string) => {
      const token = tokenListStore.tokens.find((t) => t.symbol === symbol);
      const defaultPrecisions: Record<string, number> = { MRY: 8, STEEM: 3, SBD: 3, BTC: 8, ETH: 18, LP_TOKEN: 18 };
      const tokenPrecision = token?.precision ?? defaultPrecisions[symbol] ?? 8;
      // Step 1: Convert value to human using token precision
      let human: BigNumber;
      try {
        human = new BigNumber(value).dividedBy(new BigNumber(10).pow(tokenPrecision));
      } catch (e) {
        console.warn('format error:', e);
        return numeral(value).format('0,0.00');
      }

      // Step 2: If formatSymbol is provided and is a known token, use its precision for formatting
      let formatPrecision = tokenPrecision;
      if (formatSymbol && formatSymbol !== symbol) {
        const formatToken = tokenListStore.tokens.find((t) => t.symbol === formatSymbol);
        formatPrecision = formatToken?.precision ?? defaultPrecisions[formatSymbol] ?? 8;
      }
      const dynamicFormat = `0,0.${'0'.repeat(Math.min(formatPrecision, 8))}`;
      return numeral(human.toFixed(Math.min(formatPrecision, 8))).format(dynamicFormat);
    };

    app.config.globalProperties.$formatDate = (value: string | number | Date, format = 'YYYY-MM-DD HH:mm') => {
      if (!value) return '';
      return moment(value).format(format);
    };

    app.config.globalProperties.$coinPrice = (symbol: string) => {
      const store = useCoinPricesStore();
      return store.prices[symbol] ?? null;
    };

    app.config.globalProperties.$formattedCoinPrice = (symbol: string) => {
      const store = useCoinPricesStore();
      const price = store.prices[symbol];
      if (price == null) return 0;
      return Number(price);
    };

    app.config.globalProperties.$formatUsdValue = (value: number | string, format: string = '0,0.00') => {
      return numeral(Number(value)).format(format);
    };
  }
};
