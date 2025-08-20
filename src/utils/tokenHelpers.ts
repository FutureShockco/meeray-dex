import { useCoinPricesStore } from '../stores/useCoinPrices';

/**
 * Factory function that creates token helper functions with store access
 * Call this inside your component setup to get the helpers
 */
export function createTokenHelpers() {
  const coinPricesStore = useCoinPricesStore();

  return {
    /**
     * Get token precision from token object
     */
    getTokenPrecision(token: any): number {
      return typeof token.precision === 'number' ? token.precision : 0;
    },

    /**
     * Calculate and format market cap for a token
     */
    getMarketCap(token: any, tokenUsdPriceMap: any): string {
      const coingeckoCap = coinPricesStore.marketCaps[token.symbol];
      const price = tokenUsdPriceMap[token.symbol];
      const supply = token.supply || token.totalSupply || token.circulatingSupply;
      const precision = this.getTokenPrecision(token);

      // First priority: Use CoinGecko market cap if available
      if (coingeckoCap !== undefined && coingeckoCap !== null) {
        return `$${Number(coingeckoCap).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
      }

      // Second priority: Calculate from price × supply using pool-based price
      if (price !== undefined && price !== null && supply !== undefined && supply !== null) {
        const cap = Number(price) * Number(supply);
        if (isFinite(cap)) {
          return `$${cap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        }
      }

      // Third priority: Use currentSupply if available
      if (price && token.currentSupply && token.currentSupply > 0) {
        const cap = Number(price) * Number(token.currentSupply);
        return `$${cap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
      }

      return '--';
    },

    /**
     * Format token price with proper precision
     */
    getTokenPrice(token: any, tokenUsdPriceMap: any): number {
      if (!tokenUsdPriceMap[token.symbol]) return 0;

      const price = tokenUsdPriceMap[token.symbol].value;

      if (price !== undefined && price !== null) {
        return Number(price);
      }

      return 0;
    },

    /**
     * Get token price change percentage
     */
    getTokenChange(token: any): string {
      const change = coinPricesStore.changes[token.symbol];

      if (change !== undefined && change !== null) {
        const val = Number(change).toFixed(2);
        return (change > 0 ? '+' : '') + val + '%';
      }

      return null;
    },

    /**
     * Get CSS class for token price change styling
     */
    getTokenChangeClass(token: any): string {
      const change = coinPricesStore.changes?.[token.symbol];

      if (typeof change === 'number') {
        if (change > 0) return 'text-green-500';
        if (change < 0) return 'text-red-500';
      }

      return '';
    },

    /**
     * Get token icon path
     */
    getTokenIcon(token: any): string | false {
      if (token.symbol === 'MRY') return '/icons/mry.svg';
      if (token.symbol === 'STEEM') return '/icons/steem.svg';
      if (token.symbol === 'SBD') return '/icons/sbd.svg';
      if (token.symbol === 'TESTS') return '/icons/steem.svg';
      if (token.symbol === 'TBD') return '/icons/sbd.svg';
      if (token.symbol === 'USDT') return '/icons/usdt.svg';
      if (token.symbol === 'USDC') return '/icons/usdc.svg';
      if (token.symbol === 'BTC') return '/icons/btc.svg';
      if (token.symbol === 'ETH') return '/icons/eth.svg';
      if (token.symbol === 'BNB') return '/icons/bnb.svg';

      return false;
    },

    /**
     * Format USD amount with proper formatting
     */
    formatUSD(amount: number | string, decimals: number = 2): string {
      const num = Number(amount);
      if (isNaN(num) || !isFinite(num)) return '--';

      return `$${num.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
    },

    /**
     * Format percentage change
     */
    formatPercentage(change: number | string): string {
      const num = Number(change);
      if (isNaN(num) || !isFinite(num)) return '--';

      const formatted = num.toFixed(2);
      return (num > 0 ? '+' : '') + formatted + '%';
    },

    /**
     * Get token balance with proper formatting
     */
    formatTokenBalance(balance: string | number, precision: number = 8): string {
      const num = Number(balance);
      if (isNaN(num) || !isFinite(num)) return '--';

      return num.toLocaleString(undefined, { maximumFractionDigits: precision });
    },

    /**
     * Check if token is a reference token (has direct USD price)
     */
    isReferenceToken(symbol: string): boolean {
      const referenceTokens = ['STEEM', 'SBD', 'USDT', 'USDC', 'BTC', 'ETH', 'BNB'];
      return referenceTokens.includes(symbol);
    },

    /**
     * Get price source label for a token
     */
    getPriceSource(token: any): string {
      if (this.isReferenceToken(token.symbol)) {
        return 'CoinGecko';
      }
      return 'Pool-based';
    }
  };
}
