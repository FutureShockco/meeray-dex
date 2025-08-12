import { defineStore } from 'pinia';

interface State {
  pendingTxIds: string[];
}

export const useTransactionStore = defineStore('transactionStore', {
  state: (): State => ({
    pendingTxIds: [],
  }),
  actions: {
    addPendingTx(id: string) {
      this.pendingTxIds.push(id);
    },
    removePendingTx(id: string) {
      this.pendingTxIds = this.pendingTxIds.filter(txid => txid !== id);
    },
    handleWsEvent(data: any) {
      if (data.tx && data.tx.steemTxId) {
        this.removePendingTx(data.tx.steemTxId);
        // Optionally: trigger a UI notification here
      }
    },
  },
});
