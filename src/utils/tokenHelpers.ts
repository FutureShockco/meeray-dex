import { useCoinPricesStore } from '../stores/useCoinPrices';
import { useTokenListStore } from '../stores/useTokenList';

export const maxValue = '999999999999999999999999999999'; // 30 nines

/**
 * Factory function that creates token helper functions with store access
 * Call this inside your component setup to get the helpers
 */
export function createTokenHelpers() {
  const coinPricesStore = useCoinPricesStore();
  const tokenListStore = useTokenListStore();

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
    getMarketCap(token: any, tokenUsdPriceMap: any): number | string {
      const coingeckoCap = coinPricesStore.marketCaps[token.symbol];
      const price = tokenUsdPriceMap[token.symbol].value;
      const supply = token.supply || token.totalSupply || token.circulatingSupply || token.currentSupply;
      console.log('Calculating market cap for', token.symbol, { coingeckoCap, price, supply, currentSupply: token.currentSupply });
      // First priority: Use CoinGecko market cap if available
      if (coingeckoCap !== undefined && coingeckoCap !== null) {
        return coingeckoCap;
      }

      // Second priority: Calculate from price × supply using pool-based price
      if (price !== undefined && price !== null && supply !== undefined && supply !== null) {
        const cap = Number(price) * Number(supply);
        if (isFinite(cap)) {
          return cap;
        }
      }

      // Third priority: Use currentSupply if available
      if (price && token.currentSupply && token.currentSupply > 0) {
        const cap = Number(price) * Number(token.currentSupply);
        return cap;
      }

      return 0;
    },

    /**
     * Format token price with proper precision
     */
    getTokenPrice(token: any, tokenUsdPriceMap: any): number {
      if (!token) return 0;
      if (!coinPricesStore.prices) return 0;
      const symbol = typeof token === 'string' ? token : token.symbol;
      if (!symbol) return 0;
      const coinPrice = coinPricesStore.prices[symbol];
      if (coinPrice !== undefined && coinPrice !== null && !isNaN(Number(coinPrice))) {
        return Number(coinPrice);
      }
      const poolPrice = tokenUsdPriceMap[symbol];
      if (poolPrice && poolPrice.value !== undefined && poolPrice.value !== null && !isNaN(Number(poolPrice.value))) {
        return Number(poolPrice.value);
      }
      if (typeof token === 'object' && token.price !== undefined && token.price !== null && !isNaN(Number(token.price))) {
        return Number(token.price);
      }
      if (typeof token === 'object' && token.data && token.data.price !== undefined && !isNaN(Number(token.data.price))) {
        return Number(token.data.price);
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
    getTokenIcon(token: any): string {
      const symbol = token.symbol || token;
      if (symbol === 'MRY') return '/icons/mry.svg';
      if (symbol === 'ECH') return '/icons/mry.svg';
      if (symbol === 'STEEM') return '/icons/steem.svg';
      if (symbol === 'SBD') return '/icons/sbd.svg';
      if (symbol === 'TESTS') return '/icons/steem.svg';
      if (symbol === 'TBD') return '/icons/sbd.svg';
      if (symbol === 'USDT') return '/icons/usdt.svg';
      if (symbol === 'USDC') return '/icons/usdc.svg';
      if (symbol === 'BTC') return '/icons/btc.svg';
      if (symbol === 'ETH') return '/icons/eth.svg';
      if (symbol === 'BNB') return '/icons/bnb.svg';
      if (symbol === 'USD') return '/icons/usd.svg';
      // If the token object already includes a logoUrl, normalize and return it
      if (typeof token === 'object' && token.logoUrl) {
        const secure = token.logoUrl.replace(/^http:\/\//i, 'https://');
        // keep the token object's logoUrl normalized
        try { token.logoUrl = secure; } catch (e) { /* ignore if immutable */ }
        return secure;
      }

      // Look up the token by symbol in the token list and return a secure logo URL if present
      const found = tokenListStore.tokens.find(t => t.symbol === symbol && t.logoUrl);
      if (found && found.logoUrl) {
        const secureUrl = found.logoUrl.replace(/^http:\/\//i, 'https://');
        // update store entry to use secure URL
        found.logoUrl = secureUrl;
        return secureUrl;
      }
      return '/icons/na.svg';
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
