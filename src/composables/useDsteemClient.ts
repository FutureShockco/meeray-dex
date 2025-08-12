import { Client } from 'dsteem';

let dsteemClient: Client | null = null;

export function useDsteemClient() {
  if (!dsteemClient) {
    dsteemClient = new Client('https://api.steemit.com');
  }
  return dsteemClient;
} 