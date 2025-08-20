import { useApiService } from './useApiService'

export interface TokenInfo {
  symbol: string
  precision: number
  issuer: string
}

// Default precisions for common tokens
const DEFAULT_PRECISIONS: Record<string, number> = {
  'STEEM': 3,
  'SBD': 3,
  'MRY': 8,
}

// Native tokens that don't require an issuer (sidechain native tokens)
const NATIVE_TOKENS = ['MRY']

/**
 * Formats a decimal amount to BigInt string according to token precision
 * @param amount - The decimal amount (e.g., "1.234")
 * @param precision - Token precision (e.g., 3 for STEEM)
 * @returns BigInt string representation
 */
export function formatAmountToBigInt(amount: string | number, precision: number): string {
  const amountStr = amount.toString()
  const [integerPart = '0', fractionalPart = ''] = amountStr.split('.')
  
  // Pad or trim fractional part to match precision
  const paddedFractional = fractionalPart.padEnd(precision, '0').slice(0, precision)
  
  // Combine and convert to BigInt string
  const combinedStr = integerPart + paddedFractional
  return BigInt(combinedStr).toString()
}

/**
 * Formats a BigInt string to decimal display according to token precision
 * @param amountBigInt - BigInt string representation
 * @param precision - Token precision
 * @returns Formatted decimal string
 */
export function formatBigIntToAmount(amountBigInt: string, precision: number): string {
  const bigIntValue = BigInt(amountBigInt)
  const divisor = 10n ** BigInt(precision)
  
  const integerPart = bigIntValue / divisor
  const fractionalPart = bigIntValue % divisor
  
  if (fractionalPart === 0n) {
    return integerPart.toString()
  }
  
  const fractionalStr = fractionalPart.toString().padStart(precision, '0')
  // Remove trailing zeros
  const trimmedFractional = fractionalStr.replace(/0+$/, '')
  
  return trimmedFractional ? `${integerPart}.${trimmedFractional}` : integerPart.toString()
}

/**
 * Get token precision, with fallback to defaults or API lookup
 */
export function useTokenFormatting() {
  const api = useApiService()
  const tokenCache = new Map<string, TokenInfo>()

  /**
   * Get token precision from cache, defaults, or API
   */
  async function getTokenPrecision(symbol: string): Promise<number> {
    console.log(`[getTokenPrecision] Getting precision for token: ${symbol}`)
    
    // Check cache first (might be populated by getTokenIssuer)
    if (tokenCache.has(symbol)) {
      const cachedPrecision = tokenCache.get(symbol)!.precision
      console.log(`[getTokenPrecision] Found in cache: ${symbol} -> precision: ${cachedPrecision}`)
      return cachedPrecision
    }

    // Check defaults
    if (DEFAULT_PRECISIONS[symbol]) {
      const tokenInfo: TokenInfo = {
        symbol,
        precision: DEFAULT_PRECISIONS[symbol],
        issuer: '' // Default issuer
      }
      tokenCache.set(symbol, tokenInfo)
      console.log(`[getTokenPrecision] Using default precision: ${symbol} -> ${tokenInfo.precision}`)
      return tokenInfo.precision
    }

    // Fetch from API (this should be rare if getTokenIssuer was called first)
    try {
      console.log(`[getTokenPrecision] Fetching from API for: ${symbol}`)
      const tokenData = await api.getTokenDetails(symbol)
      const precision = tokenData.precision ?? 8 // Default to 8 if not specified
      const tokenInfo: TokenInfo = {
        symbol,
        precision,
        issuer: tokenData.issuer
      }
      tokenCache.set(symbol, tokenInfo)
      console.log(`[getTokenPrecision] Cached from API: ${symbol} ->`, tokenInfo)
      return precision
    } catch (error) {
      console.warn(`Failed to get precision for token ${symbol}, using default 8`)
      const defaultInfo: TokenInfo = { symbol, precision: 8, issuer: '' }
      tokenCache.set(symbol, defaultInfo)
      return 8
    }
  }

  /**
   * Format user input amount to BigInt string for API
   */
  async function formatAmountForApi(amount: string | number, tokenSymbol: string): Promise<string> {
    console.log(`[formatAmountForApi] Formatting amount ${amount} for token ${tokenSymbol}`)
    const precision = await getTokenPrecision(tokenSymbol)
    const result = formatAmountToBigInt(amount, precision)
    console.log(`[formatAmountForApi] ${amount} ${tokenSymbol} -> ${result} (precision: ${precision})`)
    return result
  }

  /**
   * Format API BigInt string to display format
   */
  async function formatAmountForDisplay(amountBigInt: string, tokenSymbol: string): Promise<string> {
    const precision = await getTokenPrecision(tokenSymbol)
    return formatBigIntToAmount(amountBigInt, precision)
  }

  /**
   * Get token issuer from cache or API
   */
  async function getTokenIssuer(symbol: string): Promise<string | undefined> {
    console.log(`[getTokenIssuer] Getting issuer for token: ${symbol}`)
    
    // Check cache first
    if (tokenCache.has(symbol)) {
      const cachedIssuer = tokenCache.get(symbol)!.issuer
      console.log(`[getTokenIssuer] Found in cache: ${symbol} -> issuer: ${cachedIssuer}`)
      return cachedIssuer
    }

    // Check if it's a native token (these don't have an issuer)
    if (NATIVE_TOKENS.includes(symbol)) {
      console.log(`[getTokenIssuer] ${symbol} is a native token, no issuer needed`)
      return undefined
    }

    // Fetch from API for all other tokens (including STEEM, SBD)
    try {
      console.log(`[getTokenIssuer] Fetching token details from API for: ${symbol}`)
      const tokenData = await api.getTokenDetails(symbol)
      console.log(`[getTokenIssuer] API response for ${symbol}:`, tokenData)
      
      const tokenInfo: TokenInfo = {
        symbol,
        precision: tokenData.precision ?? DEFAULT_PRECISIONS[symbol] ?? 8,
        issuer: tokenData.issuer
      }
      tokenCache.set(symbol, tokenInfo)
      
      console.log(`[getTokenIssuer] Cached token info for ${symbol}:`, tokenInfo)
      return tokenInfo.issuer
    } catch (error) {
      console.warn(`Failed to get issuer for token ${symbol}`, error)
      return undefined
    }
  }

  return {
    getTokenPrecision,
    getTokenIssuer,
    formatAmountForApi,
    formatAmountForDisplay,
    formatAmountToBigInt,
    formatBigIntToAmount
  }
}
