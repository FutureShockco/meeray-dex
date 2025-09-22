const ALLOWED_FEE_TIERS: bigint[] = [BigInt(5), BigInt(30), BigInt(100), BigInt(500)];
const DEFAULT_FEE_TIER: bigint = BigInt(30);
const MAX_INTEGER_LENGTH = 30;
/**
 * Generates a deterministic, human-readable ID by sorting string components and joining them.
 * @param components An array of strings to be included in the ID.
 * @returns A string ID with components sorted alphabetically and joined by an underscore.
 */
export function generateDeterministicId(...components: string[]): string {
  if (!components || components.length === 0) {
    throw new Error('Cannot generate ID from empty components.');
  }
  // Filter out any null, undefined, or empty strings to prevent issues like "__" or trailing/leading underscores.
  const validComponents = components.filter(c => c && c.trim() !== '');
  if (validComponents.length === 0) {
    throw new Error('Cannot generate ID from only empty or invalid components.');
  }
  return validComponents.sort().join('_');
}

export function generatePoolId(tokenA_symbol, tokenB_symbol) {
    // Ensure canonical order to prevent duplicate pools (e.g., A-B vs B-A)
    const [token1, token2] = [tokenA_symbol, tokenB_symbol].sort();
    return `${token1}_${token2}`;
  }

export function toString(value: bigint, padLength: number = MAX_INTEGER_LENGTH): string {
    const str = value.toString();
    // Ensure positive numbers are properly padded for lexicographical sorting
    return str.startsWith('-') 
        ? '-' + str.slice(1).padStart(padLength, '0')
        : str.padStart(padLength, '0');
}