/**
 * Global Transaction Hook Setup
 * 
 * If you modify steem-auth-vue to support transaction hooks, initialize them here.
 * This will automatically track ALL transactions without modifying individual components.
 */

import { TransactionServiceClass } from 'steem-auth-vue'
import { useTransactionService } from './composables/useTransactionService'

let hookInitialized = false

/**
 * Initialize global transaction tracking
 * Call this once in your app setup (e.g., main.ts)
 */
export function initializeGlobalTransactionTracking() {
  console.log('[Global Hook] initializeGlobalTransactionTracking called')
  
  if (hookInitialized) {
    console.log('[Global Hook] Already initialized, skipping')
    return
  }
  
  console.log('[Global Hook] Checking if TransactionServiceClass.registerTransactionHook exists...')
  console.log('[Global Hook] TransactionServiceClass:', TransactionServiceClass)
  console.log('[Global Hook] registerTransactionHook type:', typeof TransactionServiceClass.registerTransactionHook)
  
  // Check if steem-auth-vue supports transaction hooks
  if (typeof TransactionServiceClass.registerTransactionHook === 'function') {
    console.log('[Global Hook] ✅ registerTransactionHook is available! Setting up...')
    
    const txService = useTransactionService()
    console.log('[Global Hook] Transaction service instance created:', txService)
    
    const hookCallback = (txId: string, operation: string, params: any, options?: any) => {
      console.log('🎣 [Global Hook] HOOK TRIGGERED!', {
        txId,
        operation,
        params,
        options,
        timestamp: new Date().toISOString()
      })
      
      if (!txId) {
        console.error('❌ [Global Hook] Transaction hook called but no txId provided!')
        return
      }
      
      console.log('✅ [Global Hook] Transaction ID received:', txId)
      
      // Infer transaction type
      const type = inferTypeFromOperation(operation, params)
      
      console.log('📋 [Global Hook] Inferred type:', type)
      
      // Register for tracking
      console.log('📝 [Global Hook] Registering transaction with txService...')
      txService.registerPendingTransaction({
        id: txId,
        status: 'PENDING',
        timestamp: Date.now(),
        type,
        steemTxId: txId
      })
      
      console.log('✅ [Global Hook] Transaction registered successfully!')
    }
    
    console.log('[Global Hook] Registering hook callback...')
    TransactionServiceClass.registerTransactionHook(hookCallback)
    
    hookInitialized = true
    console.log('🎉 [Global Hook] Transaction tracking initialized successfully!')
  } else {
    console.error(
      '❌ [Global Hook] steem-auth-vue does not support transaction hooks. ' +
      'registerTransactionHook is not a function. ' +
      'Type: ' + typeof TransactionServiceClass.registerTransactionHook
    )
    console.log('[Global Hook] TransactionServiceClass methods:', Object.keys(TransactionServiceClass))
  }
}

/**
 * Infer transaction type from operation and parameters
 */
function inferTypeFromOperation(operation: string, params: any): string {
  console.log('[inferType] Operation:', operation)
  console.log('[inferType] Params:', params)
  
  if (operation !== 'custom_json') {
    console.log('[inferType] Not custom_json, returning operation:', operation)
    return operation // 'transfer', 'vote', etc.
  }

  // Try to extract from custom_json
  try {
    const json = typeof params.json === 'string' ? JSON.parse(params.json) : params.json
    console.log('[inferType] Parsed JSON:', json)
    const contract = json?.contract || ''
    console.log('[inferType] Contract:', contract)
    
    // Map contracts to readable types
    const contractMap: Record<string, string> = {
      'token_create': 'token_create',
      'token_issue': 'token_issue',
      'token_transfer': 'token_transfer',
      'token_stake': 'token_stake',
      'token_unstake': 'token_unstake',
      'token_burn': 'token_burn',
      
      'market_swap': 'swap',
      'market_buy': 'market_buy',
      'market_sell': 'market_sell',
      'market_cancel_order': 'market_cancel_order',
      
      'pool_swap': 'swap', // Also handle pool_swap contract
      'pool_create': 'pool_create',
      'pool_add_liquidity': 'pool_add_liquidity',
      'pool_remove_liquidity': 'pool_remove_liquidity',
      
      'farm_create': 'farm_create',
      'farm_stake': 'farm_stake',
      'farm_unstake': 'farm_unstake',
      'farm_claim_rewards': 'farm_claim_rewards',
      
      'nft_create_collection': 'nft_create_collection',
      'nft_mint': 'nft_mint',
      'nft_transfer': 'nft_transfer',
      'nft_list': 'nft_list',
      'nft_delist': 'nft_delist',
      'nft_buy': 'nft_buy',
      'nft_bid': 'nft_bid',
      
      'witness_vote': 'witness_vote',
      'witness_unvote': 'witness_unvote',
      'witness_register': 'witness_register',
      'witness_update': 'witness_update',
    }
    
    const result = contractMap[contract] || contract || 'custom_json'
    console.log('[inferType] Result:', result)
    return result
  } catch (e) {
    console.error('[inferType] Error parsing:', e)
    return 'custom_json'
  }
}
