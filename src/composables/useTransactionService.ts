import { ref, computed, onUnmounted } from 'vue'
import { useAuthStore } from 'steem-auth-vue'

export interface TransactionStatus {
  id: string
  steemTxId?: string
  sidechainTxId?: string
  status: 'PENDING' | 'STEEM_CONFIRMED' | 'SIDECHAIN_PROCESSING' | 'COMPLETED' | 'FAILED'
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

export const useTransactionService = () => {
  const auth = useAuthStore()
  const pendingTransactions = ref<Map<string, TransactionStatus>>(new Map())
  const eventListeners = ref<Map<string, (status: TransactionStatus) => void>>(new Map())
  const wsConnection = ref<WebSocket | null>(null)
  const isConnected = ref(false)

  // ===== KAFKA WEBSOCKET INTEGRATION =====

  const initializeWebSocket = () => {
    try {
      const wsUrl = import.meta.env.BASE_URL || 'ws://localhost:8080/kafka-events'

      wsConnection.value = new WebSocket(String(wsUrl))

      wsConnection.value.onopen = () => {
        isConnected.value = true
        console.log('Connected to Kafka event stream')

        // Subscribe to user events
        if (auth.state.username) {
          subscribeToUserEvents(auth.state.username)
        }
      }

      wsConnection.value.onmessage = (event) => {
        try {
          const kafkaEvent: KafkaEventData = JSON.parse(event.data)
          handleKafkaEvent(kafkaEvent)
        } catch (error) {
          console.error('Failed to parse Kafka event:', error)
        }
      }

      wsConnection.value.onerror = (error) => {
        console.error('Kafka WebSocket error:', error)
        isConnected.value = false
      }

      wsConnection.value.onclose = () => {
        isConnected.value = false
        console.log('Disconnected from Kafka event stream')

        // Attempt to reconnect after 5 seconds
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

  const subscribeToUserEvents = (userId: string) => {
    if (wsConnection.value?.readyState === WebSocket.OPEN) {
      wsConnection.value.send(JSON.stringify({
        type: 'SUBSCRIBE_USER',
        userId
      }))
    }
  }

  const subscribeToTransaction = (txId: string) => {
    if (wsConnection.value?.readyState === WebSocket.OPEN) {
      wsConnection.value.send(JSON.stringify({
        type: 'SUBSCRIBE_TRANSACTION',
        txId
      }))
    }
  }

  const handleKafkaEvent = (event: KafkaEventData) => {
    // Match events to pending transactions by tracking ID
    const trackingId = event.data?._trackingId || event.data?.transactionId

    if (trackingId && pendingTransactions.value.has(trackingId)) {
      const currentStatus = pendingTransactions.value.get(trackingId)!

      // Update status based on event type
      let newStatus: TransactionStatus['status'] = currentStatus.status

      switch (event.type) {
        case 'TRANSACTION_FAILED':
          newStatus = 'FAILED'
          break
        case 'TRANSACTION_STARTED':
          newStatus = 'SIDECHAIN_PROCESSING'
          break
      }

      const updatedStatus: TransactionStatus = {
        ...currentStatus,
        status: newStatus,
        sidechainTxId: event._id,
        result: event.data,
        error: event.data?.error
      }

      pendingTransactions.value.set(trackingId, updatedStatus)

      // Notify listeners
      const listener = eventListeners.value.get(trackingId)
      if (listener) {
        listener(updatedStatus)
      }

      // Clean up completed transactions after 30 seconds
      if (newStatus === 'COMPLETED' || newStatus === 'FAILED') {
        setTimeout(() => {
          pendingTransactions.value.delete(trackingId)
          eventListeners.value.delete(trackingId)
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



  // Cleanup on unmount
  onUnmounted(() => {
    if (wsConnection.value) {
      wsConnection.value.close()
    }
  })

  return {
    // State
    pendingTransactions: computed(() => pendingTransactions.value),
    isConnected,


    // Utility Methods
    getTransactionStatus,
    getPendingTransactions,
    getPendingTransactionsByType,

    // WebSocket Methods
    subscribeToUserEvents,
    subscribeToTransaction,
  }
}
