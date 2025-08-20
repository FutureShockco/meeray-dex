import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useAuthStore } from 'steem-auth-vue';
import { useApiService, type Account } from '../composables/useApiService';

export const useMeerayAccountStore = defineStore('meerayAccount', () => {
    const auth = useAuthStore();
    const api = useApiService();

    const account = ref<Account | null>(null);
    const publicAccount = ref<Account | null>(null); // For viewing other users' profiles
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
            console.log('Store: Loading account for username:', username);
            console.log('Store: Current auth username:', auth.state.username);
            
            const response = await api.getAccountDetails(username);
            console.log('Store: API response:', response);
            
            // If loading own account, update the main account ref
            if (username === auth.state.username) {
                console.log('Store: Updating main account');
                account.value = response.account;
            } else {
                // If loading someone else's account, update the public account ref
                console.log('Store: Updating public account');
                publicAccount.value = response.account;
            }
            
            console.log('Store: Account after update:', account.value);
            console.log('Store: Public account after update:', publicAccount.value);
            
            error.value = '';
        } catch (e) {
            error.value = e instanceof Error ? e.message : String(e);
            if (username === auth.state.username) {
                account.value = null;
            } else {
                publicAccount.value = null;
            }
            console.error('Store: Error loading account:', e);
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

    return { account, publicAccount, error, loading, refreshAccount, loadAccount };
});