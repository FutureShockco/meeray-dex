import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useAuthStore } from 'steem-auth-vue';
import { useApiService, type Account } from '../composables/useApiService';

export const useMeerayAccountStore = defineStore('meerayAccount', () => {
    const auth = useAuthStore();
    const api = useApiService();

    const account = ref<Account | null>(null);
    const error = ref('');
    const loading = ref(false);
    
    // Define refreshAccount function first
    function refreshAccount() {
        if (auth.state.isAuthenticated && auth.state.username) {
            loading.value = true;
            api.getAccountDetails(auth.state.username)
                .then((response) => {
                    account.value = response.account;
                    error.value = '';
                })
                .catch((e) => {
                    error.value = e instanceof Error ? e.message : String(e);
                    account.value = null;
                    console.error('Error refreshing account:', e);
                })
                .finally(() => {
                    loading.value = false;
                });
        }
    }
    
    // Add method to load any user's account
    async function loadAccount(username: string) {
        loading.value = true;
        try {
            const response = await api.getAccountDetails(username);
            account.value = response.account;
            error.value = '';
        } catch (e) {
            error.value = e instanceof Error ? e.message : String(e);
            account.value = null;
            console.error('Error loading account:', e);
        } finally {
            loading.value = false;
        }
    }
    
    // Watch for username changes (login, logout, account switching)
    watch(
        () => auth.state.username,
        async (newUsername, oldUsername) => {
            if (newUsername) {
                // User logged in or switched accounts
                refreshAccount();
            } else {
                // User logged out
                account.value = null;
                error.value = '';
                console.log('User logged out, clearing account data');
            }
        },
        { immediate: true }
    );

    return { account, error, loading, refreshAccount, loadAccount };
});