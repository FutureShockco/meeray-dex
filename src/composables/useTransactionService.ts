import { ref, computed, onUnmounted } from 'vue'
import { useAuthStore } from 'steem-auth-vue'
import { TransactionService } from 'steem-auth-vue'

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
        case 'nft_create_collection':
        case 'nft_mint':
        case 'nft_list_item':
        case 'nft_buy_item':
        case 'nft_delist_item':
        case 'nft_transfer':
        case 'nft_accept_bid':
        case 'nft_close_auction':
        case 'nft_batch_operations':
          newStatus = 'COMPLETED'
          break
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

  // ===== CORE TRANSACTION METHODS =====

  const sendNFTTransaction = async (
    contract: string,
    payload: any,
    transactionType: string
  ) => {
    if (!auth.state.username) {
      throw new Error('User not authenticated')
    }

    // Generate unique tracking ID
    const trackingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const customJsonOperation = {
      required_auths: [auth.state.username],
      required_posting_auths: [],
      id: 'sidechain',
      json: JSON.stringify({
        contract,
        payload: {
          ...payload,
          _trackingId: trackingId
        },
      }),
    }

    try {
      // Send to Steem blockchain
      const steemResult = await TransactionService.send('custom_json', customJsonOperation, { 
        requiredAuth: 'active' 
      })
      
      // Initialize tracking
      const initialStatus: TransactionStatus = {
        id: trackingId,
        steemTxId: steemResult.id,
        status: 'STEEM_CONFIRMED',
        timestamp: Date.now(),
        type: transactionType
      }
      
      pendingTransactions.value.set(trackingId, initialStatus)
      
      // Subscribe to this specific transaction
      subscribeToTransaction(trackingId)

      return {
        txId: trackingId,
        steemTxId: steemResult.id,
        onStatusChange: (callback: (status: TransactionStatus) => void) => {
          eventListeners.value.set(trackingId, callback)
        },
        waitForCompletion: (timeout = 60000) => waitForTransactionCompletion(trackingId, timeout)
      }
    } catch (error) {
      console.error(`Failed to send ${transactionType} transaction:`, error)
      throw error
    }
  }

  const waitForTransactionCompletion = async (txId: string, timeout: number): Promise<TransactionStatus> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Transaction ${txId} timed out after ${timeout}ms`))
      }, timeout)

      const checkStatus = () => {
        const status = pendingTransactions.value.get(txId)
        if (status) {
          if (status.status === 'COMPLETED') {
            clearTimeout(timeoutId)
            resolve(status)
          } else if (status.status === 'FAILED') {
            clearTimeout(timeoutId)
            reject(new Error(status.error || 'Transaction failed'))
          }
        }
      }

      // Set up listener
      eventListeners.value.set(txId, (status) => {
        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
          clearTimeout(timeoutId)
          if (status.status === 'COMPLETED') {
            resolve(status)
          } else {
            reject(new Error(status.error || 'Transaction failed'))
          }
        }
      })

      // Check immediately in case it's already completed
      checkStatus()
    })
  }

  // ===== NFT TRANSACTION METHODS =====

  const createCollection = async (data: NFTCollectionData) => {
    return sendNFTTransaction('nft_create_collection', {
      ...data,
      creator: auth.state.username,
    }, 'CREATE_COLLECTION')
  }

  const mintNFT = async (collectionSymbol: string, owner: string, properties?: any, uri?: string) => {
    return sendNFTTransaction('nft_mint', {
      collectionSymbol,
      owner,
      properties,
      uri,
    }, 'MINT_NFT')
  }

  const listNFT = async (data: NFTListingData) => {
    return sendNFTTransaction('nft_list_item', data, 'LIST_NFT')
  }

  const buyNFT = async (data: NFTBidData) => {
    return sendNFTTransaction('nft_buy_item', {
      ...data,
      bidType: data.bidAmount ? 'BID' : 'FULL_PRICE',
    }, 'BUY_NFT')
  }

  const delistNFT = async (listingId: string) => {
    return sendNFTTransaction('nft_delist_item', {
      listingId,
    }, 'DELIST_NFT')
  }

  const transferNFT = async (collectionSymbol: string, instanceId: string, to: string) => {
    return sendNFTTransaction('nft_transfer', {
      collectionSymbol,
      instanceId,
      to,
    }, 'TRANSFER_NFT')
  }

  const updateCollection = async (collectionSymbol: string, updates: Partial<NFTCollectionData>) => {
    return sendNFTTransaction('nft_update_collection', {
      collectionSymbol,
      ...updates,
    }, 'UPDATE_COLLECTION')
  }

  const acceptBid = async (bidId: string, listingId: string) => {
    return sendNFTTransaction('nft_accept_bid', {
      bidId,
      listingId,
    }, 'ACCEPT_BID')
  }

  const closeAuction = async (listingId: string, winningBidId?: string, force?: boolean) => {
    return sendNFTTransaction('nft_close_auction', {
      listingId,
      winningBidId,
      force,
    }, 'CLOSE_AUCTION')
  }

  const batchOperations = async (operations: BatchOperation[], atomic: boolean = true) => {
    return sendNFTTransaction('nft_batch_operations', {
      operations,
      atomic,
    }, 'BATCH_OPERATIONS')
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
    
    // NFT Transaction Methods
    createCollection,
    mintNFT,
    listNFT,
    buyNFT,
    delistNFT,
    transferNFT,
    updateCollection,
    acceptBid,
    closeAuction,
    batchOperations,
    
    // Utility Methods
    getTransactionStatus,
    getPendingTransactions,
    getPendingTransactionsByType,
    
    // WebSocket Methods
    subscribeToUserEvents,
    subscribeToTransaction,
  }
}
