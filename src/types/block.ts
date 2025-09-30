export interface Block {
  blockNum: number;
  phash?: string;
  timestamp: number; // epoch ms
  steemBlockNum?: number;
  steemBlockTimestamp?: number;
  txs?: any[];
  witness?: string;
  missedBy?: string;
  dist?: string;
  sync?: boolean;
  signature?: string;
  hash?: string;
  id?: string | number;
}