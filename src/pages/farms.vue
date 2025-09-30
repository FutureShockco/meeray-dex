<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import AppButton from '../components/AppButton.vue';
import StakeModal from '../components/StakeModal.vue';
// CountUp removed per request — show static computed claimable values
import { useApiService } from '../composables/useApiService';
import { useTokenListStore } from '../stores/useTokenList';
import { createTokenHelpers } from '../utils/tokenHelpers';
import { useAuthStore, TransactionService } from 'steem-auth-vue';

const api = useApiService();
const tokenList = useTokenListStore();
const auth = useAuthStore();
const farms = ref<any[]>([]);
const loading = ref(false);
const error = ref('');
const tokenHelpers = createTokenHelpers();

// Modal state
const showStakeModal = ref(false);
const selectedFarm = ref<any>(null);

// User farm positions state
const userFarmPositions = ref<any[]>([]);
const userFarmPositionsLoading = ref(false);
const userFarmPositionsError = ref('');

// Timer for live updates
const now = ref(Date.now());
let interval: any = null;
onMounted(() => {
  interval = setInterval(() => {
    now.value = Date.now();
  }, 500);
});

// CountUp/animation removed — no liveTick needed

// No live map or per-tick logs needed when CountUp is removed

// Clean up interval if needed (optional, for SPA navigation)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clearInterval(interval);
    try { if (typeof refreshTimer !== 'undefined' && refreshTimer) clearInterval(refreshTimer); } catch (e) { /* noop */ }
  });
}

// Auto-refresh timer for farms and user positions
const refreshIntervalMs = 15000; // 15 seconds
let refreshTimer: any = null;
// Latest block from node (used as fallback when farm.currentBlock is not provided)
// store both the full Block object and a numeric block number for convenience
const latestBlock = ref<any | null>(null);
const latestBlockNumber = ref<number | null>(null);

// Virtual block progression for UI (increment locally every VIRTUAL_BLOCK_MS)
const VIRTUAL_BLOCK_MS = 1000; // user requested 1000ms or less
// Enable this to print helpful debug messages to the browser console (not the server terminal)
const ENABLE_FARMS_DEBUG = false;
const virtualBase = ref<{ num: number; ts: number } | null>(null);
const currentVirtualBlock = ref<bigint | null>(null);
let virtualBlockTimer: any = null;

// Helper: approximate current block number from a known latest block and current time
const approximateCurrentBlockFromLatest = (blockObj: any, blockTimeMs = 3000) => {
  try {
    if (!blockObj) return null;
    // support wrapper responses like { success: true, block: { ... } }
    if (blockObj.block) blockObj = blockObj.block;
    const baseNum = Number(blockObj.blockNum ?? blockObj.number ?? blockObj.height ?? blockObj.id ?? null);
    const baseTs = blockObj.timestamp ?? blockObj.time ?? blockObj.ts ? Number(blockObj.timestamp ?? blockObj.time ?? blockObj.ts) : null;
    if (Number.isFinite(baseNum) && baseTs !== null) {
      const deltaMs = Date.now() - baseTs;
      const addedBlocks = Math.floor(deltaMs / blockTimeMs);
      return BigInt(baseNum + addedBlocks);
    }
    return null;
  } catch {
    return null;
  }
};

onBeforeUnmount(() => {
  try { clearInterval(interval); } catch (e) { /* noop */ }
  try { if (refreshTimer) clearInterval(refreshTimer); } catch (e) { /* noop */ }
});

// Start virtual block timer
onMounted(() => {
  if (virtualBlockTimer) clearInterval(virtualBlockTimer);
  virtualBlockTimer = setInterval(() => {
    try {
      if (virtualBase.value) {
        // increment currentVirtualBlock based on elapsed time
        const added = Math.floor((Date.now() - virtualBase.value.ts) / VIRTUAL_BLOCK_MS);
        currentVirtualBlock.value = BigInt(virtualBase.value.num + added);
        if (ENABLE_FARMS_DEBUG) {
          try {
            console.log('[Farms Debug] virtual tick', {
              virtualBase: virtualBase.value,
              currentVirtualBlock: currentVirtualBlock.value.toString(),
              VIRTUAL_BLOCK_MS,
              now: Date.now()
            });
          } catch (e) { /* noop */ }
        }
      }
    } catch (e) {
      // ignore
    }
  }, VIRTUAL_BLOCK_MS);
});

onBeforeUnmount(() => {
  try { if (virtualBlockTimer) clearInterval(virtualBlockTimer); } catch (e) { /* noop */ }
});

// Helper function to format token amounts
const extractSymbol = (maybeToken: any) => {
  if (!maybeToken) return undefined;
  if (typeof maybeToken === 'string') return maybeToken;
  if (typeof maybeToken === 'object') {
    // support shapes like { symbol: 'MRY', issuer: '...' }
    return (maybeToken.symbol ?? maybeToken.symbolName ?? maybeToken.name) as string | undefined;
  }
  return undefined;
};

// Helper function to format token amounts
const formatTokenAmount = (rawAmount: any, symbol: any) => {
  try {
    if (rawAmount === undefined || rawAmount === null || rawAmount === '') return '0';
    const sym = extractSymbol(symbol) || 'MRY';
    const precision = tokenList.getTokenPrecision(sym) ?? 8;
    const amountNumber = typeof rawAmount === 'bigint' ? Number(rawAmount.toString()) : Number(rawAmount);
    if (Number.isNaN(amountNumber)) return String(rawAmount);
    const amount = amountNumber / Math.pow(10, precision);
    return amount.toLocaleString(undefined, {
      maximumFractionDigits: precision,
      minimumFractionDigits: precision
    });
  } catch {
    return String(rawAmount);
  }
};

// Helper function to format time
const formatTime = (timeString: string) => {
  if (!timeString) return 'N/A';
  try {
    const date = new Date(timeString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timeString;
  }
};

// Helper function to get time remaining
const getTimeRemaining = (endTime: string) => {
  if (!endTime) return 'N/A';
  try {
    const end = new Date(endTime);
    const nowDate = new Date(now.value);
    const diff = end.getTime() - nowDate.getTime();

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  } catch {
    return 'N/A';
  }
};

// Helper function to get status badge color
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-500';
    case 'inactive':
      return 'bg-gray-500';
    case 'ended':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

// Helper function to extract pair name from staking token
const getPairName = (stakingToken: any) => {
  if (!stakingToken) return 'Unknown';
  // stakingToken may be an object with .symbol or a string like 'LP_TOKENA_TOKENB'
  if (typeof stakingToken === 'object') {
    return stakingToken.symbol || stakingToken.id || 'Unknown';
  }
  if (typeof stakingToken === 'string') {
    return stakingToken;
  }
  return 'Unknown';
};

// Open stake modal
const openStakeModal = (farm: any) => {
  selectedFarm.value = farm;
  showStakeModal.value = true;
};

// Close stake modal
const closeStakeModal = () => {
  showStakeModal.value = false;
  selectedFarm.value = null;
};

// Retry function for loading farms
// showLoading: if false, do not toggle the global `loading` UI (used for silent periodic refresh)
const retryLoadFarms = async (showLoading: boolean = true) => {
  if (showLoading) {
    loading.value = true;
    error.value = '';
  }

  try {
    // Ensure tokens are loaded for formatting
    if (!tokenList.tokens.length) {
      await tokenList.fetchTokens();
    }

    const res = await api.getFarmsList();
    farms.value = Array.isArray(res.data) ? res.data : [];
    // If we don't have a latestBlock yet, try to initialize virtual base from any farm.currentBlock
    if (!virtualBase.value) {
      let candidateBlock: number | null = null;
      for (const f of farms.value) {
        try {
          const cb = f?.currentBlock ?? f?.lastUpdatedBlock ?? f?.lastUpdatedAt ?? null;
          if (cb !== null && cb !== undefined) {
            const num = typeof cb === 'object' ? (cb.blockNum ?? cb.number ?? cb.height ?? cb.id) : cb;
            const n = Number(num);
            if (Number.isFinite(n)) {
              candidateBlock = Math.max(candidateBlock ?? 0, n);
            }
          }
        } catch {
          // ignore
        }
      }
      if (candidateBlock !== null) {
        virtualBase.value = { num: candidateBlock, ts: Date.now() };
        try { currentVirtualBlock.value = BigInt(virtualBase.value.num); } catch { currentVirtualBlock.value = BigInt(Number(candidateBlock)); }
      }
    }
  } catch (err: any) {
    console.error('Failed to fetch farms:', err);
    if (showLoading) error.value = err?.message || 'Failed to fetch farms';
    farms.value = [];
  } finally {
    if (showLoading) loading.value = false;
  }
};

// Fetch user farm positions
const fetchUserFarmPositions = async (showLoading: boolean = true) => {
  if (!auth.state.username) return;
  if (showLoading) {
    userFarmPositionsLoading.value = true;
    userFarmPositionsError.value = '';
  }
  try {
    const res = await api.getFarmPositionsByUser(auth.state.username);
    userFarmPositions.value = Array.isArray(res.data) ? res.data : [];
  } catch (err: any) {
    if (showLoading) userFarmPositionsError.value = err?.message || 'Failed to fetch user farm positions';
    userFarmPositions.value = [];
  } finally {
    if (showLoading) userFarmPositionsLoading.value = false;
  }
};

// Compute claimable rewards exactly using BigInt arithmetic and raw fields
function computeClaimableForPosition(position: any) {
  if (!position) return { claimableRaw: 0n, claimableFormatted: '0', frozen: false };
  const farm = farms.value.find(f => f.farmId === position.farmId || f._id === position.farmId);
  if (!farm) return { claimableRaw: 0n, claimableFormatted: '0', frozen: false };

  const rewardSymbol = extractSymbol(farm.rewardToken) || 'MRY';
  const precision = tokenList.getTokenPrecision(rewardSymbol) ?? 8;

  // Parse raw BigInt values (strings -> BigInt)
  const toBig = (v: any) => {
    try {
      if (v === undefined || v === null || v === '') return null;
      // already BigInt
      if (typeof v === 'bigint') return v;
      // numeric string
      return BigInt(String(v));
    } catch {
      return null;
    }
  };

  const rawRewardsPerBlock = toBig(farm.rawRewardsPerBlock) ?? 0n;
  const rawStaked = toBig(position.rawStakedAmount) ?? 0n;
  const rawTotalStaked = toBig(farm.rawTotalStaked) ?? 0n;
  const rawPending = toBig(position.rawPendingRewards) ?? 0n;
  const rawLastHarvestBlock = (position.rawLastHarvestBlock !== undefined && position.rawLastHarvestBlock !== null) ? toBig(position.rawLastHarvestBlock) : null;
  // support farm.currentBlock being either a number or a full Block object
  const extractBlockNum = (b: any) => {
    if (b === undefined || b === null) return null;
    if (typeof b === 'number' || typeof b === 'string' || typeof b === 'bigint') return toBig(b);
    // object: try common fields
    if (typeof b === 'object') {
      const candidate = b.blockNum ?? b.number ?? b.height ?? b.id ?? b.blockNumber ?? null;
      return toBig(candidate);
    }
    return null;
  };

  const rawRewardsRemaining = farm.rawRewardsRemaining !== undefined && farm.rawRewardsRemaining !== null ? toBig(farm.rawRewardsRemaining) : null;
  // treat farm reward balance that is an all-zero string (e.g. "0000000...") as absent, to avoid accidental freeze
  let rawFarmRewardBalance: bigint | null = null;
  if (position.rawFarmRewardBalance !== undefined && position.rawFarmRewardBalance !== null) {
    const asStr = String(position.rawFarmRewardBalance);
    const allZeros = /^0+$/.test(asStr);
    if (allZeros) {
      // consider absent; log for debugging
      console.debug('[Farms] computeClaimableForPosition: rawFarmRewardBalance is zero-only string, treating as null', { farmId: farm._id || farm.farmId, positionId: position._id });
      rawFarmRewardBalance = null;
    } else {
      rawFarmRewardBalance = toBig(position.rawFarmRewardBalance);
    }
  } else {
    rawFarmRewardBalance = null;
  }

  // Determine if UI should freeze calculations
  let frozen = false;
  if (farm.isExhausted === true) frozen = true;
  const farmStatus = position.farmStatus || farm.status;
  if (farmStatus === 'ended') frozen = true;
  if (rawRewardsRemaining !== null && rawRewardsRemaining <= 0n) frozen = true;
  if (rawFarmRewardBalance !== null && rawFarmRewardBalance <= 0n) frozen = true;

  if (frozen) {
    // display only pending (from rawPending if available, else formatted pendingRewards)
  const formatted = position.pendingRewards || formatTokenAmount(String(position.rawPendingRewards || rawPending || '0'), rewardSymbol);
    return { claimableRaw: rawPending, claimableFormatted: formatted, frozen: true };
  }

  const BLOCK_TIME_MS = 3000;
  const extractBlockInfo = (b: any) => {
    if (b === undefined || b === null) return { num: null as bigint | null, ts: null as number | null };
    // if it's a raw number or string
    if (typeof b === 'number' || typeof b === 'string' || typeof b === 'bigint') {
      const n = toBig(b);
      return { num: n, ts: null };
    }
    if (typeof b === 'object') {
      const numCandidate = b.blockNum ?? b.number ?? b.height ?? b.id ?? b.blockNumber ?? null;
      const tsCandidate = b.timestamp ?? b.time ?? b.ts ?? null;
      return { num: toBig(numCandidate), ts: tsCandidate !== undefined && tsCandidate !== null ? Number(tsCandidate) : null };
    }
    return { num: null as bigint | null, ts: null as number | null };
  };

  let lastHarvestInfo = { num: null as bigint | null, ts: null as number | null };
  if (rawLastHarvestBlock !== null) {
    lastHarvestInfo = { num: rawLastHarvestBlock, ts: null };
  } else if (position.lastHarvestBlock) {
    lastHarvestInfo = extractBlockInfo(position.lastHarvestBlock);
  } else if (position.lastHarvestTime) {
    const ts = (() => { try { return new Date(position.lastHarvestTime).getTime(); } catch { return null; } })();
    lastHarvestInfo = { num: null, ts };
  } else {
    lastHarvestInfo = { num: toBig(farm.startBlock) ?? 0n, ts: null };
  }
  let currentBlockInfo = { num: null as bigint | null, ts: (virtualBase.value && virtualBase.value.ts) ? Number(virtualBase.value.ts) : (latestBlock.value && latestBlock.value.timestamp) ? Number(latestBlock.value.timestamp) : null };
  if (farm.currentBlock !== undefined && farm.currentBlock !== null) {
    currentBlockInfo = extractBlockInfo(farm.currentBlock);
    } else if (virtualBase.value) {
      // prefer virtual base timestamp/num
      const approxNum = currentVirtualBlock.value ?? (virtualBase.value ? BigInt(virtualBase.value.num) : null);
      currentBlockInfo = { num: approxNum, ts: virtualBase.value ? Number(virtualBase.value.ts) : null };
    } else if (latestBlock.value) {
      // approximate using the last known latestBlock and current time
      const approx = approximateCurrentBlockFromLatest(latestBlock.value, 3000);
      currentBlockInfo = { num: approx, ts: (latestBlock.value && latestBlock.value.timestamp) ? Number(latestBlock.value.timestamp) : null };
  } else if (latestBlockNumber.value !== null) {
    currentBlockInfo = { num: toBig(latestBlockNumber.value), ts: (latestBlock.value && latestBlock.value.timestamp) ? Number(latestBlock.value.timestamp) : null };
  }

  if ((currentBlockInfo.num === null && currentBlockInfo.ts === null) || rawTotalStaked === 0n || rawTotalStaked === null) {
    // Debug: missing fields for accrual calculation
    console.debug('[Farms] computeClaimableForPosition: missing raw fields, skipping accrual', {
      farmId: farm._id || farm.farmId,
      positionId: position._id,
      currentBlockInfo,
      lastHarvestInfo,
      rawTotalStaked,
      rawRewardsPerBlock,
      rawPending
    });
    const formatted = position.pendingRewards || formatTokenAmount(String(position.rawPendingRewards || rawPending || '0'), rewardSymbol);
    return { claimableRaw: rawPending, claimableFormatted: formatted, frozen: false };
  }

  let blocksElapsed: bigint = 0n;
  if (currentBlockInfo.num !== null && lastHarvestInfo.num !== null) {
    blocksElapsed = (currentBlockInfo.num as bigint) - (lastHarvestInfo.num as bigint);
  } else if (currentBlockInfo.ts !== null && lastHarvestInfo.ts !== null) {
    const elapsedMs = currentBlockInfo.ts - lastHarvestInfo.ts;
    const blkCount = Math.floor(elapsedMs / BLOCK_TIME_MS);
    blocksElapsed = BigInt(Math.max(0, blkCount));
  } else if (currentBlockInfo.num !== null && lastHarvestInfo.ts !== null) {
    blocksElapsed = 0n;
  } else if (currentBlockInfo.ts !== null && lastHarvestInfo.num !== null) {
    blocksElapsed = 0n;
  }

  if (blocksElapsed <= 0n) {
    const formatted = position.pendingRewards || formatTokenAmount(String(position.rawPendingRewards || rawPending || '0'), rewardSymbol);
    return { claimableRaw: rawPending, claimableFormatted: formatted, frozen: false };
  }

  let newlyAccruedRaw = 0n;
  if (rawRewardsPerBlock !== 0n && rawStaked !== 0n && rawTotalStaked !== 0n) {
    newlyAccruedRaw = (rawRewardsPerBlock * blocksElapsed * rawStaked) / rawTotalStaked;
  }

  const totalProposedRaw = rawPending + newlyAccruedRaw;
  let capRaw = rawRewardsRemaining;
  if (capRaw === null) {
    const altCandidates = [
      farm.supplyLeft,
      farm.supply_left,
      farm.supplyRemaining,
      farm.supply_remaining,
      farm.supplyLeftRaw,
      farm.rawSupplyLeft,
    ];
    for (const c of altCandidates) {
      const v = toBig(c);
      if (v !== null) {
        capRaw = v;
        console.debug('[Farms] computeClaimableForPosition: using supply-based cap', { farmId: farm._id || farm.farmId, candidate: c });
        break;
      }
    }
  }

  let claimableRaw = totalProposedRaw;
  if (capRaw !== null) {
    claimableRaw = totalProposedRaw <= capRaw ? totalProposedRaw : capRaw;
  }

  const claimableFormatted = formatTokenAmount(String(claimableRaw.toString()), rewardSymbol);

  return {
    claimableRaw,
    claimableFormatted,
    frozen: false,
    newlyAccruedRaw,
    totalProposedRaw,
  };
}

function isClaimableNonZero(position: any) {
  const res = computeClaimableForPosition(position);
  try {
    return res && typeof res.claimableRaw === 'bigint' ? res.claimableRaw > 0n : Number(res.claimableFormatted || 0) > 0;
  } catch {
    return false;
  }
}

function computeLiveClaimable(position: any) {
  void now.value;
  try {
    if (!position) return 0;
    const farm = farms.value.find(f => f.farmId === position.farmId || f._id === position.farmId);
    if (!farm) return '0';

    const rewardSymbol = extractSymbol(farm.rewardToken) || 'MRY';
  const precision = tokenList.getTokenPrecision(rewardSymbol) ?? 8;
  // Block time for real chain block (3 seconds per block)
  const BLOCK_TIME_MS = 3000; // 3000 ms per block

    const toBig = (v: any) => {
      try {
        if (v === undefined || v === null || v === '') return null;
        if (typeof v === 'bigint') return v;
        return BigInt(String(v));
      } catch {
        return null;
      }
    };

  const rawRewardsPerBlock = farm.rawRewardsPerBlock ?? farm.rawRewardsPerBlock === 0 ? farm.rawRewardsPerBlock : 0;
  const rawStaked = position.rawStakedAmount ?? 0;
  const rawTotalStaked = farm.rawTotalStaked ?? 0;
  const rawPending = position.rawPendingRewards ?? 0;

    // determine elapsed milliseconds (prefer lastHarvestTime). Use BLOCK_TIME_MS (real chain block time)
    let elapsedMs = 0;
    const lastHarvestNum = position.rawLastHarvestBlock !== undefined && position.rawLastHarvestBlock !== null ? toBig(position.rawLastHarvestBlock) : (position.lastHarvestBlock ? (typeof position.lastHarvestBlock === 'object' ? toBig(position.lastHarvestBlock.blockNum ?? position.lastHarvestBlock.number ?? position.lastHarvestBlock.id ?? null) : toBig(position.lastHarvestBlock)) : null);
    const lastHarvestTs = position.lastHarvestTime ? (new Date(position.lastHarvestTime).getTime()) : null;

    const nowMs = Number(now.value) || Date.now();

    // If we have an explicit last harvest timestamp, prefer it (most accurate)
    if (lastHarvestTs !== null) {
      elapsedMs = Math.max(0, nowMs - lastHarvestTs);
    } else {
      // Otherwise try to estimate last harvest time from block numbers and virtual base
      // Compute a floating current block number using virtualBase (which records a known block num at a ts) and BLOCK_TIME_MS
      let currentBlockFloat: number | null = null;
      if (virtualBase.value) {
        currentBlockFloat = virtualBase.value.num + ((nowMs - virtualBase.value.ts) / BLOCK_TIME_MS);
      } else if (farm.currentBlock !== undefined && farm.currentBlock !== null) {
        if (typeof farm.currentBlock === 'object') {
          const cb = farm.currentBlock.blockNum ?? farm.currentBlock.number ?? farm.currentBlock.id ?? null;
          currentBlockFloat = cb !== null ? Number(cb) : null;
        } else {
          currentBlockFloat = Number(farm.currentBlock);
        }
      } else if (latestBlock.value) {
        const approx = approximateCurrentBlockFromLatest(latestBlock.value, BLOCK_TIME_MS);
        currentBlockFloat = approx !== null ? Number(approx) : null;
      } else if (latestBlockNumber.value !== null) {
        currentBlockFloat = Number(latestBlockNumber.value);
      }

      const lastHarvestNumN = lastHarvestNum !== null ? Number(lastHarvestNum) : null;
      if (currentBlockFloat !== null && lastHarvestNumN !== null) {
        const blocksDiffFloat = Math.max(0, currentBlockFloat - lastHarvestNumN);
        elapsedMs = Math.max(0, blocksDiffFloat * BLOCK_TIME_MS);
      } else {
        // as a last resort, zero elapsed
        elapsedMs = 0;
      }
    }

    // convert raw smallest-unit numbers to display-number using token precision
    const pendingDisplay = rawToDisplayNumber(rawPending, farm.rewardToken);
    const rewardsPerBlockDisplay = rawToDisplayNumber(rawRewardsPerBlock, farm.rewardToken);
    const stakedDisplay = rawToDisplayNumber(rawStaked, farm.stakingToken);
    const totalStakedDisplay = rawToDisplayNumber(rawTotalStaked, farm.stakingToken);

    if (totalStakedDisplay === 0) return pendingDisplay;

    // compute in display units (token units) to preserve decimals
    const rewardPerMsDisplay = rewardsPerBlockDisplay / BLOCK_TIME_MS; // tokens per ms
    const userShare = stakedDisplay / totalStakedDisplay;
    const newlyAccruedDisplay = rewardPerMsDisplay * elapsedMs * userShare; // tokens
    let totalProposedDisplay = pendingDisplay + newlyAccruedDisplay;

    // apply cap if present
    if (farm.rawRewardsRemaining !== undefined && farm.rawRewardsRemaining !== null) {
      const capDisplay = rawToDisplayNumber(farm.rawRewardsRemaining, farm.rewardToken);
      if (totalProposedDisplay > capDisplay) totalProposedDisplay = capDisplay;
    }

  // return numeric display value (tokens)
    return totalProposedDisplay || 0;
  } catch (e) {
    // fallback to exact computation numeric
    const fallback = computeClaimableForPosition(position).claimableFormatted;
    return Number(String(fallback).replace(/,/g, '')) || 0;
  }
}

// Helper to get user position for a farm
const getUserPositionForFarm = (farmId: string) => {
  return userFarmPositions.value.find(pos => pos.farmId === farmId || pos.farmId === farmId?.toString());
};

// Computed map of formatted claimable values per position key.
// This ensures the UI re-renders when `currentVirtualBlock`, `now`, `farms` or `userFarmPositions` change.
const claimableFormattedMap = computed(() => {
  const map: Record<string, string> = {};
  try {
    // touch reactive dependencies
    void currentVirtualBlock.value;
    void now.value;
    void farms.value;
    void userFarmPositions.value;
    for (const pos of userFarmPositions.value) {
      const key = pos._id || pos.farmId || 'unknown';
      try {
        // Prefer fractional live display (per-ms accrual) so UI updates smoothly without CountUp
        const liveVal = computeLiveClaimable(pos);
        if (liveVal !== null && liveVal !== undefined) {
          // format using token precision for the reward token
          const farm = farms.value.find(f => f.farmId === pos.farmId || f._id === pos.farmId);
          const rewardSym = farm ? extractSymbol(farm.rewardToken) || 'MRY' : 'MRY';
          const precision = tokenList.getTokenPrecision(rewardSym) ?? 8;
          // ensure numeric
          const n = Number(liveVal) || 0;
          map[key] = n.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
          continue;
        }
        const res = computeClaimableForPosition(pos);
        map[key] = (res && res.claimableFormatted) ? String(res.claimableFormatted) : '0';
      } catch (e) {
        map[key] = '0';
      }
    }
  } catch (e) {
    // noop
  }
  return map;
});

function getClaimableFormattedForFarm(farm: any) {
  const pos = getUserPositionForFarm(farm.farmId);
  if (!pos) return '0';
  const key = pos._id || pos.farmId || 'unknown';
  return claimableFormattedMap.value[key] ?? computeClaimableForPosition(pos)?.claimableFormatted ?? '0';
}

// Convert raw smallest-unit value (BigInt|string|number) to display-number using token precision
function rawToDisplayNumber(raw: any, symbol: any) {
  if (raw === undefined || raw === null || raw === '') return 0;
  const sym = extractSymbol(symbol) || 'MRY';
  const precision = tokenList.getTokenPrecision(sym) ?? 8;
  try {
    // Accept BigInt, number, or numeric string
    const rawNum = typeof raw === 'bigint' ? Number(raw.toString()) : Number(String(raw));
    if (Number.isNaN(rawNum)) return 0;
    return rawNum / Math.pow(10, precision);
  } catch {
    return 0;
  }
}

onMounted(async () => {
  await retryLoadFarms();
  await fetchUserFarmPositions();
  try {
    refreshTimer = setInterval(async () => {
      await retryLoadFarms(false);
      await fetchUserFarmPositions(false);
    }, refreshIntervalMs);
  } catch (e) {
    console.error('Failed to start refresh timer', e);
  }
 
});

async function claimFarmRewards(farmId: string) {
  if (!auth.state.username) return;
  const contract = 'farm_claim_rewards';
  const payload = { farmId };
  const customJsonOperation = {
    required_auths: [auth.state.username],
    required_posting_auths: [],
    id: 'sidechain',
    json: JSON.stringify({ contract, payload }),
  };
  try {
    await TransactionService.send('custom_json', customJsonOperation, { requiredAuth: 'active' });
    await fetchUserFarmPositions();
  } catch (err) {
    console.error('Failed to claim rewards:', err);
  }
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 py-10 px-2">
    <div class="max-w-7xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Farms</h1>
        <router-link to="/createfarm">
          <AppButton variant="primary" size="lg">
            🌾 Create Farm
          </AppButton>
        </router-link>
      </div>

      <div v-if="loading" class="text-center py-16">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Loading farms...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-16">
        <div class="text-6xl mb-4">⚠️</div>
        <h3 class="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Error Loading Farms</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{{ error }}</p>
        <AppButton @click="() => retryLoadFarms()" variant="primary" size="lg">
          Retry
        </AppButton>
      </div>


      <!-- Farms Grid -->
      <div v-else-if="farms.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div v-for="farm in farms" :key="farm._id"
          class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg p-6 flex flex-col relative">

          <!-- Status Badge -->
          <div class="absolute top-4 left-4">
            <span :class="['px-3 py-1 rounded-full text-white text-xs font-bold shadow', getStatusColor(farm.status)]">
              {{ farm.status?.toUpperCase() || 'UNKNOWN' }}
            </span>
          </div>

          <!-- Farm Header -->
          <div class="mt-6 mb-4 flex flex-col items-center text-center">
            <div v-if="farm && farm.stakingToken && getPairName(farm.stakingToken).includes('_')"
              class="text-lg font-semibold text-gray-900 dark:text-white text-center">
              <PairIcon class="ml-3" :size="16"
                :src1="tokenHelpers.getTokenIcon({ symbol: getPairName(farm.stakingToken).split('_')[0] }) || ''"
                :src2="tokenHelpers.getTokenIcon({ symbol: getPairName(farm.stakingToken).split('_')[1] }) || ''" />
              {{ farm.name || getPairName(farm.stakingToken) }}
            </div>
            <div v-else class="text-lg font-semibold text-gray-900 dark:text-white text-center">
              <TokenIcon :size="16" :src="tokenHelpers.getTokenIcon({ symbol: getPairName(farm.stakingToken) }) || ''"
                :alt="getPairName(farm.stakingToken)" />
            </div>
            <div class="text-xs text-primary-400 text-center">Stake {{ getPairName(farm.stakingToken) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
              Earn <span class="font-bold text-primary-400">
                {{ extractSymbol(farm.rewardToken) || 'Unknown' }}</span>
              <TokenIcon :size="12" :src="tokenHelpers.getTokenIcon({ symbol: extractSymbol(farm.rewardToken) }) || ''"
                :alt="extractSymbol(farm.rewardToken)" />
            </div>
          </div>

          <!-- Farm Stats -->
          <div class="space-y-3 mb-4">
            <!-- Total Staked -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Total Staked:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ formatTokenAmount(farm.rawTotalStaked, extractSymbol(farm.stakingToken) || 'LP') }}
              </span>
            </div>

            <!-- Rewards Per Block -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Rewards/Block:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ farm.rewardsPerBlock || formatTokenAmount(farm.rawRewardsPerBlock, extractSymbol(farm.rewardToken) || 'MRY') }} {{
                  extractSymbol(farm.rewardToken) || 'MRY' }}
              </span>
            </div>

            <!-- Rewards Remaining -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Rewards Left:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ (farm.rewardsRemaining ?? null) !== null ? (farm.rewardsRemaining || '0') : formatTokenAmount(farm.rawRewardsRemaining, extractSymbol(farm.rewardToken) || 'MRY') }} {{
                  extractSymbol(farm.rewardToken) || 'MRY' }}
              </span>
            </div>

            <!-- Min/Max Stake -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Stake Range:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ farm.minStakeAmount || formatTokenAmount(farm.rawMinStakeAmount, farm.stakingToken || 'LP') }} -
                {{ farm.maxStakeAmount || formatTokenAmount(farm.rawMaxStakeAmount, farm.stakingToken || 'LP') }}
              </span>
            </div>

            <!-- Time Remaining -->
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-500 dark:text-gray-400">Time Left:</span>
              <span class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ getTimeRemaining(farm.endTime) }}
              </span>
            </div>

            <div
              class="text-xs text-gray-500 dark:text-gray-400 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>Start: {{ formatTime(farm.startTime) }}</div>
              <div>End: {{ formatTime(farm.endTime) }}</div>
            </div>
          </div>

          <!-- User Position (if exists) -->
          <div v-if="getUserPositionForFarm(farm.farmId)"
            class="mb-4 rounded-lg bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div class="flex flex-col gap-1">
              <div class="flex justify-between items-center">
                <span class="text-xs text-primary-600 dark:text-primary-300 font-semibold">Your Staked:</span>
                <span class="text-sm font-bold text-primary-700 dark:text-primary-200">
                  {{ formatTokenAmount(getUserPositionForFarm(farm.farmId)?.rawStakedAmount, extractSymbol(farm.stakingToken) || 'MRY') }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs text-primary-600 dark:text-primary-300 font-semibold">Your Pending Rewards:</span>
                <span class="text-sm font-bold text-primary-700 dark:text-primary-200">
                  <!-- Show computed claimable value (no animation) -->
                  {{ getClaimableFormattedForFarm(farm) }}
                </span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-xs text-primary-600 dark:text-primary-300 font-semibold">Last Harvest:</span>
                <span class="text-xs text-primary-700 dark:text-primary-200">
                  {{ formatTime(getUserPositionForFarm(farm.farmId)?.lastUpdatedAt) }}
                </span>
              </div>
              <AppButton class="btn btn-primary btn-blue mt-3" variant="primary"
                :disabled="!isClaimableNonZero(getUserPositionForFarm(farm.farmId))"
                @click="claimFarmRewards(farm.farmId)">
                Claim
              </AppButton>
            </div>
          </div>

          <div class="mt-auto space-y-2">
            <AppButton v-if="farm.status === 'active'" class="w-full" variant="primary" size="lg"
              @click="openStakeModal(farm)">
              Stake Now
            </AppButton>

            <AppButton v-else class="w-full" variant="secondary" size="lg">
              {{ farm.status === 'ended' ? 'Farm Ended' : 'Coming Soon' }}
            </AppButton>

            <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
              Farm ID: {{ farm._id?.substring(0, 20) }}...
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-16">
        <div class="text-6xl mb-4">🌾</div>
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Farms Found</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">Be the first to create a farm and start earning rewards</p>
        <router-link to="/createfarm">
          <AppButton variant="primary" size="lg">
            Create Your First Farm
          </AppButton>
        </router-link>
      </div>
    </div>

    <!-- Stake Modal -->
    <StakeModal :show="showStakeModal" :farm="selectedFarm" @close="closeStakeModal" />
  </div>
</template>