import { ref, computed } from 'vue';
import { useApiService } from '../composables/useApiService';
import { useCoinPricesStore } from '../stores/coinPrices';
import type { LiquidityPool } from '../types/pool';
/**
 * Returns a computed ref with the USD price of a token using its pools with STEEM, SBD, USDT, USDC, BTC, ETH, BNB, or defaults to 1 USD.
 * @param symbol The token symbol (string)
 */
export function useTokenUsdPrice(symbol: string) {
  const api = useApiService();
  const coinPrices = useCoinPricesStore();
  const price = ref<number|null>(null);
  const loading = ref(false);
  const error = ref('');

  // Order of reference tokens to try
  const referenceTokens = ['STEEM', 'SBD', 'USDT', 'USDC', 'BTC', 'ETH', 'BNB'];

  async function fetchPrice() {
    loading.value = true;
    error.value = '';
    price.value = null;
    try {
      // If symbol is a reference token, use CoinGecko price directly
      if (referenceTokens.includes(symbol)) {
        const refUsd = coinPrices.prices[symbol];
        if (refUsd) {
          price.value = refUsd;
        } else {
          error.value = `No USD price for ${symbol}`;
          price.value = null;
        }
        loading.value = false;
        return;
      }
      const poolsResult = await api.getPoolsList({ limit: 1000 });
      const pools = poolsResult.data as LiquidityPool[];
      let found = false;
      for (const refToken of referenceTokens) {
        const pool = pools.find((p) =>
          (p.tokenA_symbol === symbol && p.tokenB_symbol === refToken) ||
          (p.tokenB_symbol === symbol && p.tokenA_symbol === refToken)
        );
        if (pool) {
          const reserveToken = pool.tokenA_symbol === symbol ? Number(pool.tokenA_reserve) : Number(pool.tokenB_reserve);
          const reserveRef = pool.tokenA_symbol === refToken ? Number(pool.tokenA_reserve) : Number(pool.tokenB_reserve);
          if (!reserveToken || !reserveRef) {
            continue;
          }
          const priceInRef = reserveRef / reserveToken;
          const refUsd = coinPrices.prices[refToken];
          if (!refUsd) {
            continue;
          }
          price.value = priceInRef * refUsd;
          found = true;
          break;
        }
      }
      if (!found) {
        // No pool found, default to 1 USD
        price.value = 1;
        error.value = 'No pool found for token, defaulting to 1 USD';
      }
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch price';
    } finally {
      loading.value = false;
    }
  }

  // Optionally, auto-fetch on composable use
  fetchPrice();

  // Expose a computed ref for reactivity
  const usdPrice = computed(() => price.value);

  return { usdPrice, loading, error, refresh: fetchPrice };
} 