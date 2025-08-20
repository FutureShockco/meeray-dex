import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useApiService } from '../composables/useApiService';

export const useTokenListStore = defineStore('tokenList', () => {
  const tokens = ref<any[]>([]);
  const newTokens = ref<any[]>([]); // For new tokens that may be added later
  const loading = ref(false);
  const error = ref('');

  const api = useApiService();

  async function fetchTokens() {
    loading.value = true;
    error.value = '';
    try {
      const res = await api.getTokens();
      tokens.value = Array.isArray(res.data) ? res.data : [];
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch tokens';
    } finally {
      loading.value = false;
    }

    try {
      const res = await api.getNewTokens();
      newTokens.value = Array.isArray(res.data) ? res.data : [];
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch tokens';
    } finally {
      loading.value = false;
    }
  }

  function getTokenPrecision(symbol: string): number {
    const token = tokens.value.find((t: any) => t.symbol === symbol);
    return token?.precision ?? 8;
  }

  function getTokenIdentifier(symbol: string): string {
    const token = tokens.value.find((t: any) => t.symbol === symbol);
    if (!token) return symbol;
    
    // If token has an issuer, return TOKEN@ISSUER format
    // If no issuer (native tokens like STEEM, SBD), return just the symbol
    if (token.issuer && token.issuer !== 'native') {
      return `${symbol}@${token.issuer}`;
    }
    return symbol;
  }

  return { tokens, newTokens, loading, error, fetchTokens, getTokenPrecision, getTokenIdentifier };
});