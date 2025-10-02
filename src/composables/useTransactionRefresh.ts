import { ref } from 'vue'
import { useTransactionService } from './useTransactionService'
import type { TransactionStatus } from './useTransactionService'

/**
 * Transaction completion callbacks by type
 * Allows components to register refresh callbacks for specific transaction types
 */
const refreshCallbacks = ref<Map<string, Array<() => void | Promise<void>>>>(new Map())

let listenerInitialized = false

/**
 * Hook for components to register refresh callbacks for specific transaction types
 * 
 * @example
 * // In a component:
 * const { onTransactionComplete } = useTransactionRefresh()
 * 
 * onMounted(() => {
 *   // Refresh balances when swap completes
 *   onTransactionComplete('swap', async () => {
 *     await refreshBalances()
 *     await refreshPools()
 *   })
 * })
 */
export const useTransactionRefresh = () => {
  const txService = useTransactionService()

  // Initialize global listener once
  if (!listenerInitialized) {
    listenerInitialized = true
    
    // Listen to all transaction status updates
    txService.eventsByCategory.value.forEach((events, category) => {
      if (category === 'transaction') {
        console.log('[TransactionRefresh] Setting up global listener')
      }
    })
  }

  /**
   * Register a callback to be called when a specific transaction type completes
   * 
   * @param transactionType - The transaction type (e.g., 'swap', 'token_create', 'pool_add_liquidity')
   * @param callback - Function to call when transaction completes
   * @returns Cleanup function to unregister the callback
   */
  const onTransactionComplete = (
    transactionType: string,
    callback: () => void | Promise<void>
  ): (() => void) => {
    if (!refreshCallbacks.value.has(transactionType)) {
      refreshCallbacks.value.set(transactionType, [])
    }
    
    const callbacks = refreshCallbacks.value.get(transactionType)!
    callbacks.push(callback)
    
    console.log(`[TransactionRefresh] Registered callback for type: ${transactionType}`)
    
    // Return cleanup function
    return () => {
      const cbs = refreshCallbacks.value.get(transactionType)
      if (cbs) {
        const index = cbs.indexOf(callback)
        if (index > -1) {
          cbs.splice(index, 1)
          console.log(`[TransactionRefresh] Unregistered callback for type: ${transactionType}`)
        }
      }
    }
  }

  /**
   * Register callbacks for multiple transaction types
   */
  const onTransactionCompleteMultiple = (
    transactionTypes: string[],
    callback: () => void | Promise<void>
  ): (() => void) => {
    const cleanups = transactionTypes.map(type => onTransactionComplete(type, callback))
    
    // Return combined cleanup function
    return () => {
      cleanups.forEach(cleanup => cleanup())
    }
  }

  return {
    onTransactionComplete,
    onTransactionCompleteMultiple
  }
}

/**
 * Internal function to trigger refresh callbacks
 * Called by useTransactionService when a transaction completes
 */
export function triggerTransactionRefresh(transactionType: string, txStatus: TransactionStatus) {
  const callbacks = refreshCallbacks.value.get(transactionType)
  
  if (callbacks && callbacks.length > 0) {
    console.log(`[TransactionRefresh] Triggering ${callbacks.length} callbacks for type: ${transactionType}`)
    
    callbacks.forEach(async (callback) => {
      try {
        await callback()
      } catch (error) {
        console.error(`[TransactionRefresh] Error in callback for ${transactionType}:`, error)
      }
    })
  } else {
    console.log(`[TransactionRefresh] No callbacks registered for type: ${transactionType}`)
  }
}
