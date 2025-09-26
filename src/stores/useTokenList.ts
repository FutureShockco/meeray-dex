import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApiService } from '../composables/useApiService';

export const useTokenListStore = defineStore('tokenList', () => {
  const tokens = ref<any[]>([]);
  const newTokens = ref<any[]>([]);
  const hotTokens = ref<any[]>([]);
  const topGainersTokens = ref<any[]>([]);
  const topVolumeTokens = ref<any[]>([]);
  const loading = ref(false);
  const error = ref('');

  const api = useApiService();

  async function fetchTokens() {
    loading.value = true;
    error.value = '';
    try {
      const res = await api.getTokens({ limit: 1000 });
      tokens.value = Array.isArray(res.data) ? res.data : [];
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch tokens';
      console.error('TokenList: Error fetching tokens:', e);
    }

    try {
      const res = await api.getNewTokens();
      newTokens.value = Array.isArray(res.data) ? res.data : [];
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch tokens';
      console.error('TokenList: Error fetching new tokens:', e);
    }
    try {
      const res = await api.getHotTokens({ limit: 10 });
      hotTokens.value = Array.isArray(res.data) ? res.data : [];
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch hot tokens';
      console.error('TokenList: Error fetching hot tokens:', e);
    }
    try {
      const res = await api.getTopGainersTokens({ limit: 10 });
      topGainersTokens.value = Array.isArray(res.data) ? res.data : [];
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch top gainers tokens';
      console.error('TokenList: Error fetching top gainers tokens:', e);
    }
    try {
      const res = await api.getTopVolumeTokens({ limit: 10 });
      topVolumeTokens.value = Array.isArray(res.data) ? res.data : [];
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch top volume tokens';
      console.error('TokenList: Error fetching top volume tokens:', e);
    } finally {
      loading.value = false;
    }
  }

  function getTokenPrecision(symbol: string): number {
    const token = tokens.value.find((t: any) => t.symbol === symbol);
    return token?.precision ?? 8;
  }

  function getTokenIdentifier(symbol: string, swap: boolean = false): string {
    const token = tokens.value.find((t: any) => t.symbol === symbol);
    if (!token) return symbol;

    return token.symbol;
  }

  return { tokens, hotTokens, topGainersTokens, topVolumeTokens, newTokens, loading, error, fetchTokens, getTokenPrecision, getTokenIdentifier };
});