import { Client } from 'dsteem';

let dsteemClient: Client | null = null;

export function useDsteemClient() {
  if (!dsteemClient) {
    dsteemClient = new Client(import.meta.env.VITE_STEEM_API || 'https://api.steemit.com');
  }
  return dsteemClient;
} 