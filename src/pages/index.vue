<script setup lang="ts">
import { useTokenListStore } from '../stores/useTokenList';

const tokensStore = useTokenListStore();

const hotCoins = computed(() => tokensStore.tokens.slice(0, 3));

const appDescription = 'Discover, trade, and earn with the next generation decentralized exchange on Steem.';

const stats = [
  { label: 'Tokens', value: tokensStore.tokens.length || 0 },
  { label: 'Users', value: '8,500+' },
  { label: 'Volume (24h)', value: '$3.2M' },
  { label: 'Pools', value: '42' },
];

const hotList = [
  { symbol: 'BTC', price: '$67,000', change: '+2.1%' },
  { symbol: 'STEEM', price: '$0.23', change: '+1.2%' },
  { symbol: 'SBD', price: '$2.80', change: '-0.5%' },
];
const newTokens = [
  { symbol: 'OZTK', price: '$0.12', change: '+10.2%' },
  { symbol: 'HYPE', price: '$0.03', change: '+5.8%' },
];
const topGainers = [
  { symbol: 'MOON', price: '$0.45', change: '+22.5%' },
  { symbol: 'SUN', price: '$1.10', change: '+18.3%' },
];

const features = [
  { title: 'Trade Instantly', description: 'Swap tokens with low fees and deep liquidity.', icon: '🔄' },
  { title: 'Earn Rewards', description: 'Provide liquidity and earn a share of trading fees.', icon: '💸' },
  { title: 'Farms', description: 'Stake LP tokens to earn extra rewards.', icon: '🌾' },
  { title: 'Secure & Transparent', description: 'All transactions are on-chain and auditable.', icon: '🔒' },
];

const howItWorks = [
  { icon: '🛡️', title: 'Secure Asset Storage', desc: 'Your tokens are always in your wallet, not on a centralized server.' },
  { icon: '⚡', title: 'Fast Transactions', desc: 'Experience near-instant swaps and liquidity actions.' },
  { icon: '🔍', title: 'Full Transparency', desc: 'All trades and pools are visible on the blockchain.' },
  { icon: '🤝', title: 'Community Driven', desc: 'Governance and new features are decided by the community.' },
];

const faqs = [
  { q: 'What is MeeRayDEX?', a: 'MeeRayDEX is a decentralized exchange for trading Steem-based tokens.' },
  { q: 'How do I add liquidity?', a: 'Go to the Pools page, select a pair, and click "Add Liquidity".' },
  { q: 'Is MeeRayDEX safe?', a: 'Yes, your funds never leave your wallet and all actions are on-chain.' },
  { q: 'How do I earn rewards?', a: 'Provide liquidity or stake LP tokens in farms to earn rewards.' },
];
</script>

<template>
  <div class="min-h-screen md:px-0 ">
    <!-- Hero Section -->
    <section class="py-16 bg-primary-50 dark:bg-primary-900">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-5xl font-extrabold mb-4 text-gray-900 dark:text-white">
          Find the Next <span class="text-primary-500">Steem Gem</span>
        </h1>
        <p class="text-xl text-gray-600 dark:text-gray-300 mb-8">{{ appDescription }}</p>
        <div class="flex justify-center space-x-4">
          <button class="bg-primary-500 text-white hover:bg-primary-600 px-6 py-2 rounded font-semibold shadow transition">Get Started</button>
          <button class="border border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white px-6 py-2 rounded font-semibold shadow transition bg-transparent">Learn More</button>
        </div>
      </div>
    </section>

    <!-- Stats Section -->
    <section class="py-8">
      <div class="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        <div v-for="stat in stats" :key="stat.label" class="rounded-xl shadow p-6 border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <div class="text-2xl font-bold text-primary-500 mb-1">{{ stat.value }}</div>
          <div class="text-gray-700 dark:text-gray-200 text-sm">{{ stat.label }}</div>
        </div>
      </div>
    </section>

    <!-- Market Overview -->
    <section class="py-12">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">Crypto Market Today</h2>
        <div class="grid md:grid-cols-3 gap-8">
          <div class="rounded-xl shadow p-6 border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <h3 class="text-lg font-bold mb-4 text-gray-900 dark:text-white">Hot List</h3>
            <ul>
              <li v-for="item in hotList" :key="item.symbol" class="flex justify-between py-1">
                <span class="font-mono text-gray-900 dark:text-white">{{ item.symbol }}</span>
                <span class="text-gray-700 dark:text-gray-200">{{ item.price }}</span>
                <span :class="item.change.startsWith('+') ? 'text-green-500' : 'text-red-500'">{{ item.change }}</span>
              </li>
            </ul>
          </div>
          <div class="rounded-xl shadow p-6 border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <h3 class="text-lg font-bold mb-4 text-gray-900 dark:text-white">New Tokens</h3>
            <ul>
              <li v-for="item in newTokens" :key="item.symbol" class="flex justify-between py-1">
                <span class="font-mono text-gray-900 dark:text-white">{{ item.symbol }}</span>
                <span class="text-gray-700 dark:text-gray-200">{{ item.price }}</span>
                <span :class="item.change.startsWith('+') ? 'text-green-500' : 'text-red-500'">{{ item.change }}</span>
              </li>
            </ul>
          </div>
          <div class="rounded-xl shadow p-6 border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <h3 class="text-lg font-bold mb-4 text-gray-900 dark:text-white">Top Gainers</h3>
            <ul>
              <li v-for="item in topGainers" :key="item.symbol" class="flex justify-between py-1">
                <span class="font-mono text-gray-900 dark:text-white">{{ item.symbol }}</span>
                <span class="text-gray-700 dark:text-gray-200">{{ item.price }}</span>
                <span :class="item.change.startsWith('+') ? 'text-green-500' : 'text-red-500'">{{ item.change }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-12 bg-primary-50 dark:bg-primary-900">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">Explore MeeRayDEX Features</h2>
        <div class="grid md:grid-cols-4 gap-8">
          <div v-for="feature in features" :key="feature.title" class="rounded-xl shadow p-6 border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-center">
            <div class="text-4xl mb-4 text-primary-500">{{ feature.icon }}</div>
            <h3 class="text-lg font-bold mb-2 text-gray-900 dark:text-white">{{ feature.title }}</h3>
            <p class="text-gray-700 dark:text-gray-200 text-sm">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works / Security Section -->
    <section class="py-12">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">How It Works</h2>
        <div class="grid md:grid-cols-4 gap-8">
          <div v-for="item in howItWorks" :key="item.title" class="rounded-xl shadow p-6 border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-center">
            <div class="text-3xl mb-3 text-primary-500">{{ item.icon }}</div>
            <h4 class="text-lg font-bold mb-1 text-gray-900 dark:text-white">{{ item.title }}</h4>
            <p class="text-gray-700 dark:text-gray-200 text-sm">{{ item.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="py-12 bg-primary-50 dark:bg-primary-900">
      <div class="max-w-3xl mx-auto">
        <h2 class="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">FAQ</h2>
        <div>
          <div v-for="(faq, i) in faqs" :key="faq.q" class="mb-4">
            <details class="rounded-xl shadow p-6 border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 p-4">
              <summary class="text-lg font-bold cursor-pointer text-gray-900 dark:text-white">{{ faq.q }}</summary>
              <div class="text-gray-700 dark:text-gray-200 mt-2">{{ faq.a }}</div>
            </details>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
</style> 