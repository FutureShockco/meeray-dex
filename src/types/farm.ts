export interface FarmCreateData {
  farmId: string;
  name: string;
  stakingToken: {
    symbol: string;
    issuer: string;
  };
  rewardToken: {
    symbol: string;
    issuer: string;
  };
  startTime: string;          // ISO date string
  endTime: string;           // ISO date string
  totalRewards: string | bigint;      // Total rewards to be distributed
  rewardsPerBlock: string | bigint;   // Rewards distributed per block
  minStakeAmount?: string | bigint;   // Minimum amount that can be staked
  maxStakeAmount?: string | bigint;   // Maximum amount that can be staked per user
}

export interface FarmStakeData {
  farmId: string;             // Identifier of the farm
  staker: string;             // Account staking the LP tokens (sender)
  lpTokenAmount: number;      // Amount of LP tokens to stake
}

export interface FarmUnstakeData {
  farmId: string;             // Identifier of the farm
  staker: string;             // Account unstaking the LP tokens (sender)
  lpTokenAmount: number;      // Amount of LP tokens to unstake
  // withdrawRewards: boolean; // Default true, also claim pending rewards
}

export interface FarmClaimRewardsData {
  farmId: string;             // Identifier of the farm
  staker: string;             // Account claiming rewards (sender)
}

// Represents a Farm in the cache/database
export interface FarmData {
  _id: string;               // Unique farm ID
  name: string;
  stakingToken: {
    symbol: string;
    issuer: string;
  };
  rewardToken: {
    symbol: string;
    issuer: string;
  };
  startTime: string;         // ISO date string
  endTime: string;          // ISO date string
  totalRewards: string | bigint;     // Total rewards to be distributed
  rewardsPerBlock: string | bigint;  // Rewards distributed per block
  totalStaked: string | bigint;      // Total amount of staking tokens deposited
  minStakeAmount: string | bigint;   // Minimum amount that can be staked
  maxStakeAmount: string | bigint;   // Maximum amount that can be staked per user
  status: 'active' | 'ended' | 'cancelled';
  createdAt: string;
  lastUpdatedAt?: string;
  // Optional fields for runtime accounting
  rewardsRemaining?: string | bigint;
  vaultAccount?: string;
}

// Represents a user's staking position in a Farm
export interface UserFarmPositionData {
  _id: string;              // userId-farmId
  userId: string;
  farmId: string;
  stakedAmount: string | bigint;     // Current staked amount
  pendingRewards: string | bigint;   // Unclaimed rewards
  lastHarvestTime: string;  // ISO date string of last reward claim
  createdAt: string;
  lastUpdatedAt?: string;
}