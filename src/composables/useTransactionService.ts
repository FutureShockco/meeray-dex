import { ref, computed, watch } from 'vue'
import { useAuthStore } from 'steem-auth-vue'
import { useToast } from './useToast'
import { triggerTransactionRefresh } from './useTransactionRefresh'

export interface TransactionStatus {
  id: string
  steemTxId?: string
  sidechainTxId?: string
  status: 'PENDING' | 'STEEM_CONFIRMED' | 'SIDECHAIN_PROCESSING' | 'COMPLETED' | 'FAILED' | 'VALIDATION_FAILED'
  error?: string
  result?: any
  timestamp: number
  type: string
}

export interface KafkaEventData {
  _id: string
  type: string
  timestamp: string
  actor: string
  data: any
}

export interface NFTCollectionData {
  symbol: string
  name: string
  maxSupply?: number
  royaltyBps?: number
  description?: string
  logoUrl?: string
  transferable?: boolean
  burnable?: boolean
}

export interface NFTListingData {
  collectionSymbol: string
  instanceId: string
  price: string
  paymentTokenSymbol: string
  paymentTokenIssuer?: string
  listingType?: 'FIXED_PRICE' | 'AUCTION' | 'RESERVE_AUCTION'
  auctionEndTime?: string
  reservePrice?: string
  allowBuyNow?: boolean
  minimumBidIncrement?: string
}

export interface NFTBidData {
  listingId: string
  bidAmount: string
  bidType?: 'BID' | 'FULL_PRICE'
}

export interface BatchOperation {
  operation: 'LIST' | 'DELIST' | 'BUY' | 'BID' | 'TRANSFER'
  data: any
}

// Module-level state
const pendingTransactions = ref<Map<string, TransactionStatus>>(new Map())
const eventListeners = ref<Map<string, (status: TransactionStatus) => void>>(new Map())
const wsConnection = ref<WebSocket | null>(null)
const isConnected = ref(false)
let initialized = false
let authWatcherInitialized = false

// Keep a recent log of ALL events
const kafkaEventLog = ref<any[]>([])
const MAX_KAFKA_LOG = 500

// Store all events by category
const eventsByCategory = ref<Map<string, any[]>>(new Map())

// Toast notification IDs mapped to transaction IDs
const transactionToasts = ref<Map<string, string>>(new Map())

export const useTransactionService = () => {
  const auth = useAuthStore()
  const toast = useToast()

  // ===== KAFKA WEBSOCKET INTEGRATION =====

  const initializeWebSocket = () => {
    if (initialized) return
    initialized = true

    try {
      const wsUrl = import.meta.env.VITE_WS_BASE
      if (!wsUrl) {
        console.warn('VITE_WS_BASE not set, cannot connect to Kafka WebSocket')
        return
      }

      wsConnection.value = new WebSocket(String(wsUrl))

      wsConnection.value.onopen = () => {
        isConnected.value = true
        console.log('Connected to Kafka event stream')

        // Subscribe to all-events to receive everything
        subscribeToTopic('all-events')
        
        // Re-subscribe to any pending transaction IDs
        pendingTransactions.value.forEach((tx) => {
          subscribeToTransaction(tx.id)
        })
      }

      wsConnection.value.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
        const receivedAt = new Date().toISOString()

        let parsed: any = null
        try {
          parsed = JSON.parse(raw)
          console.log('[Kafka] Event received:', parsed)
        } catch (err) {
          console.warn('[Kafka] received non-JSON message:', raw)
        }

        // Store in event log
        try {
          kafkaEventLog.value.unshift({ raw, parsed, receivedAt })
          if (kafkaEventLog.value.length > MAX_KAFKA_LOG) {
            kafkaEventLog.value = kafkaEventLog.value.slice(0, MAX_KAFKA_LOG)
          }
        } catch (e) {}

        if (parsed) {
          handleKafkaEvent(parsed)
        }
      }

      wsConnection.value.onerror = (error) => {
        console.error('Kafka WebSocket error:', error)
        isConnected.value = false
      }

      wsConnection.value.onclose = () => {
        isConnected.value = false
        initialized = false
        console.log('Disconnected from Kafka event stream')

        // Reconnect after 5 seconds
        setTimeout(() => {
          if (!isConnected.value) {
            initializeWebSocket()
          }
        }, 5000)
      }
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error)
    }
  }

  const ensureInitialized = () => {
    if (!wsConnection.value) initializeWebSocket()
  }

  const subscribeToTopic = (topic: string) => {
    if (wsConnection.value?.readyState === WebSocket.OPEN) {
      wsConnection.value.send(JSON.stringify({
        type: 'SUBSCRIBE_TOPIC',
        topic
      }))
      console.log(`[Kafka] Subscribed to topic: ${topic}`)
    }
  }

  const subscribeToTransaction = (txId: string) => {
    if (wsConnection.value?.readyState === WebSocket.OPEN) {
      wsConnection.value.send(JSON.stringify({
        type: 'SUBSCRIBE_TRANSACTION',
        txId
      }))
      console.log(`[Kafka] Subscribed to transaction: ${txId}`)
    }
  }

  const registerPendingTransaction = (tx: TransactionStatus) => {
    if (!tx || !tx.id) return
    pendingTransactions.value.set(tx.id, tx)
    ensureInitialized()
    subscribeToTransaction(tx.id)
    
    // Create a toast notification for this transaction
    const toastId = toast.transaction(getTitleForTransaction(tx), tx.steemTxId || tx.id)
    transactionToasts.value.set(tx.id, toastId)
  }

  const getTitleForTransaction = (tx: TransactionStatus): string => {
    switch (tx.type) {
      case 'token_create':
        return 'Creating token'
      case 'farm_claim_rewards':
        return 'Claiming farm rewards'
      case 'pool_add_liquidity':
        return 'Adding liquidity'
      case 'pool_remove_liquidity':
        return 'Removing liquidity'
      case 'token_transfer':
        return 'Transferring tokens'
      case 'token_stake':
        return 'Staking tokens'
      case 'swap':
        return 'Swapping tokens'
      default:
        return 'Processing transaction'
    }
  }

  const getSuccessMessageForTransaction = (tx: TransactionStatus): string => {
    switch (tx.type) {
      case 'token_create':
        return 'Token created successfully!'
      case 'farm_claim_rewards':
        return 'Rewards claimed successfully!'
      case 'pool_add_liquidity':
        return 'Liquidity added successfully!'
      case 'pool_remove_liquidity':
        return 'Liquidity removed successfully!'
      case 'token_transfer':
        return 'Transfer completed!'
      case 'token_stake':
        return 'Tokens staked successfully!'
      case 'swap':
        return 'Swap completed!'
      default:
        return 'Transaction completed successfully!'
    }
  }

  const addEventListener = (txId: string, cb: (status: TransactionStatus) => void) => {
    if (!txId) return
    eventListeners.value.set(txId, cb)
  }

  const removeEventListener = (txId: string) => {
    eventListeners.value.delete(txId)
  }

  const handleKafkaEvent = (event: any) => {
    // Event structure:
    // {
    //   t: 'NOTIFICATION',
    //   topic: 'notifications',
    //   d: {
    //     _id: 'tx-hash',
    //     category: 'transaction' | 'nft' | 'token' | 'defi' | 'market',
    //     action: 'executed' | 'failed' | 'error',
    //     type: 'TRANSACTION_EXECUTED' | 'TRANSACTION_FAILED' | 'nft_listed' | etc.,
    //     timestamp: '2025-10-01T...',
    //     actor: 'username',
    //     data: { transactionId, txType, sender, error?, txData? },
    //     transactionId: 'tx-hash'
    //   }
    // }

    const eventData = event.d || event.data

    if (!eventData) return

    // Store events by category
    const category = eventData.category || 'unknown'
    if (!eventsByCategory.value.has(category)) {
      eventsByCategory.value.set(category, [])
    }
    const categoryEvents = eventsByCategory.value.get(category)!
    categoryEvents.unshift(eventData)
    if (categoryEvents.length > 100) {
      eventsByCategory.value.set(category, categoryEvents.slice(0, 100))
    }

    // Handle transaction status updates
    const txId = eventData.transactionId || eventData.data?.transactionId || eventData._id

    if (txId && pendingTransactions.value.has(txId)) {
      const currentStatus = pendingTransactions.value.get(txId)!

      let newStatus: TransactionStatus['status'] = currentStatus.status

      // Map event types to status
      switch (eventData.type) {
        case 'TRANSACTION_EXECUTED':
          newStatus = 'COMPLETED'
          break
        case 'TRANSACTION_VALIDATION_FAILED':
        case 'TRANSACTION_VALIDATION_ERROR':
        case 'TRANSACTION_INVALID_HANDLER':
          newStatus = 'VALIDATION_FAILED'
          break
        case 'TRANSACTION_FAILED':
        case 'TRANSACTION_ERROR':
          newStatus = 'FAILED'
          break
        case 'TRANSACTION_CONFIRMED':
        case 'STEEM_CONFIRMED':
          newStatus = 'STEEM_CONFIRMED'
          break
        default:
          // For specific success events (defi:swap, nft:listed, etc.)
          if (eventData.action && !eventData.action.includes('failed') && !eventData.action.includes('error')) {
            newStatus = 'COMPLETED'
          } else {
            // For other events, keep processing status
            newStatus = 'SIDECHAIN_PROCESSING'
          }
      }

      const updatedStatus: TransactionStatus = {
        ...currentStatus,
        status: newStatus,
        sidechainTxId: eventData._id,
        result: eventData.data || eventData,
        error: eventData.data?.error || eventData.error,
        timestamp: eventData.timestamp
      }

      pendingTransactions.value.set(txId, updatedStatus)

      // Update toast progress based on status
      const toastId = transactionToasts.value.get(txId)
      if (toastId) {
        if (updatedStatus.status === 'STEEM_CONFIRMED') {
          toast.updateToast(toastId, {
            progress: 33,
            message: 'Confirmed on blockchain...'
          })
        } else if (updatedStatus.status === 'SIDECHAIN_PROCESSING') {
          toast.updateToast(toastId, {
            progress: 66,
            message: 'Processing on sidechain...'
          })
        } else if (updatedStatus.status === 'COMPLETED') {
          // Set progress to 100% and change to success
          toast.updateToast(toastId, {
            type: 'success',
            progress: 100,
            message: getSuccessMessageForTransaction(currentStatus),
            showProgress: false
          })
          
          // Remove after 5 seconds
          setTimeout(() => {
            toast.removeToast(toastId)
            transactionToasts.value.delete(txId)
          }, 5000)
        } else if (updatedStatus.status === 'VALIDATION_FAILED') {
          // Set progress to 100% and change to warning (validation errors are not critical failures)
          toast.updateToast(toastId, {
            type: 'warning',
            progress: 100,
            message: updatedStatus.error || 'Transaction validation failed',
            showProgress: false
          })
          
          // Remove after 7 seconds
          setTimeout(() => {
            toast.removeToast(toastId)
            transactionToasts.value.delete(txId)
          }, 7000)
        } else if (updatedStatus.status === 'FAILED') {
          // Set progress to 100% and change to error
          toast.updateToast(toastId, {
            type: 'error',
            progress: 100,
            message: updatedStatus.error || 'Transaction failed',
            showProgress: false
          })
          
          // Remove after 7 seconds
          setTimeout(() => {
            toast.removeToast(toastId)
            transactionToasts.value.delete(txId)
          }, 7000)
        }
      }

      // Notify listeners
      const listener = eventListeners.value.get(txId)
      if (listener) {
        listener(updatedStatus)
      }

      // Console logs
      if (newStatus === 'COMPLETED') {
        console.log(`✅ Transaction ${txId} completed successfully`)
        
        // Trigger refresh callbacks for this transaction type
        triggerTransactionRefresh(currentStatus.type, updatedStatus)
      } else if (newStatus === 'VALIDATION_FAILED') {
        console.warn(`⚠️ Transaction ${txId} validation failed: ${updatedStatus.error}`)
      } else if (newStatus === 'FAILED') {
        console.error(`❌ Transaction ${txId} failed: ${updatedStatus.error}`)
      }

      // Clean up completed/failed transactions after 30 seconds
      if (newStatus === 'COMPLETED' || newStatus === 'FAILED' || newStatus === 'VALIDATION_FAILED') {
        setTimeout(() => {
          pendingTransactions.value.delete(txId)
          eventListeners.value.delete(txId)
        }, 30000)
      }
    }
  }

  // ===== UTILITY METHODS =====

  const getTransactionStatus = (txId: string): TransactionStatus | null => {
    return pendingTransactions.value.get(txId) || null
  }

  const getPendingTransactions = computed((): TransactionStatus[] => {
    return Array.from(pendingTransactions.value.values())
  })

  const getPendingTransactionsByType = (type: string) => {
    return Array.from(pendingTransactions.value.values()).filter(tx => tx.type === type)
  }

  const getEventsByCategory = (category: string) => {
    return eventsByCategory.value.get(category) || []
  }

  const getAllCategories = () => {
    return Array.from(eventsByCategory.value.keys())
  }

  // Auto initialize
  if (!authWatcherInitialized) {
    authWatcherInitialized = true
    ensureInitialized()
  }

  return {
    // State
    pendingTransactions: computed(() => pendingTransactions.value),
    isConnected,
    kafkaEventLog: computed(() => kafkaEventLog.value),
    eventsByCategory: computed(() => eventsByCategory.value),

    // Methods
    getTransactionStatus,
    getPendingTransactions,
    getPendingTransactionsByType,
    getEventsByCategory,
    getAllCategories,

    // WebSocket Methods
    initializeWebSocket,
    ensureInitialized,
    subscribeToTopic,
    subscribeToTransaction,
    registerPendingTransaction,
    addEventListener,
    removeEventListener,

    // Event log utilities
    getKafkaEventLog: () => kafkaEventLog.value.slice(),
    clearKafkaEventLog: () => { kafkaEventLog.value.length = 0 },
  }
}