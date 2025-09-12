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
      console.log('TokenList: Fetching tokens...');
      const res = await api.getTokens();
      console.log('TokenList: Tokens response:', res);
      tokens.value = Array.isArray(res.data) ? res.data : [];
      console.log('TokenList: Tokens loaded:', tokens.value.length);
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch tokens';
      console.error('TokenList: Error fetching tokens:', e);
    } finally {
      loading.value = false;
    }

    try {
      console.log('TokenList: Fetching new tokens...');
      const res = await api.getNewTokens();
      console.log('TokenList: New tokens response:', res);
      newTokens.value = Array.isArray(res.data) ? res.data : [];
      console.log('TokenList: New tokens loaded:', newTokens.value.length);
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch tokens';
      console.error('TokenList: Error fetching new tokens:', e);
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

  return { tokens, newTokens, loading, error, fetchTokens, getTokenPrecision, getTokenIdentifier };
});