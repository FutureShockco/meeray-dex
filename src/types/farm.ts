import type { Block } from './block';

export interface FarmCreateData {
  farmId: string;
  stakingToken: string;
  rewardToken: string;
  startBlock: number;
  totalRewards: string | bigint;
  rewardsPerBlock: string | bigint;
  minStakeAmount?: string | bigint;
  maxStakeAmount?: string | bigint;
}

export interface FarmStakeData {
  farmId: string;
  tokenAmount: number;
}

export interface FarmUnstakeData {
  farmId: string;
  tokenAmount: number;
}

export interface FarmClaimRewardsData {
  farmId: string;
}

export interface Farm {
  _id: string;
  farmId?: string;
  stakingToken?: { symbol: string; issuer?: string };
  rewardToken?: { symbol: string; issuer?: string };
  startTime?: string;
  endTime?: string;
  rewardsPerBlock?: string;
  totalRewards?: string;
  rewardsRemaining?: string | null;
  rewardBalance?: string;
  totalStaked?: string;
  minStakeAmount?: string;
  maxStakeAmount?: string;
  rawRewardsPerBlock?: string;
  rawTotalRewards?: string;
  rawRewardsRemaining?: string | null;
  rawRewardBalance?: string;
  rawTotalStaked?: string;
  rawMinStakeAmount?: string;
  rawMaxStakeAmount?: string;
  // bookkeeping
  /** current block can be a simple block number or a full Block object returned by the node */
  currentBlock?: number | Block;
  isExhausted?: boolean;
  status?: string;
  createdAt?: string;
  lastUpdatedAt?: string;
}

export interface UserFarmPosition {
  _id: string;
  userId?: string;
  farmId?: string;
  stakedAmount?: string;
  rewardsEarned?: string;
  claimedRewards?: string;
  pendingRewards?: string;
  rawStakedAmount?: string;
  rawRewardsEarned?: string;
  rawClaimedRewards?: string;
  rawPendingRewards?: string;
  lastHarvestTime?: string;
  rawLastHarvestBlock?: number | null;
  /** optional full block object for the last harvest (if the API returns it) */
  lastHarvestBlock?: number | Block | null;
  farmStatus?: string;
  rawFarmRewardBalance?: string | null;
  createdAt?: string;
  lastUpdatedAt?: string;
}