<script setup lang="ts">
import { ref, h } from 'vue';
import { SteemAuth, SteemTransactions, MeerayTransactions, useAuthStore } from 'steem-auth-vue';
import NavDropdown from './NavDropdown.vue'
import { useRouter, useRoute } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

// Example SVG icon as a functional component
const FarmIcon = {
  render() {
    return h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24' }, [
      h('circle', { cx: 12, cy: 12, r: 10 }),
      h('path', { d: 'M8 12h8m-4-4v8' })
    ])
  }
};

const UserFarmIcon = {
  render() {
    return h('svg', {
      class: 'w-6 h-6',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      viewBox: '0 0 24 24'
    }, [
      h('path', {
        d: 'M12 17c-2 0-4-1-4-3 0-2 2-3 4-3s4 1 4 3c0 2-2 3-4 3z',
        stroke: 'currentColor',
        fill: 'currentColor',
        opacity: '0.2'
      }),
      h('path', {
        d: 'M12 17c-2 0-4-1-4-3 0-2 2-3 4-3s4 1 4 3c0 2-2 3-4 3z',
        stroke: 'currentColor',
        fill: 'none'
      }),
      h('path', {
        d: 'M12 14v-4m0 0l-2-2m2 2l2-2',
        stroke: 'currentColor',
        fill: 'none'
      })
    ]);
  }
};

const menuItems = [
  { label: 'Markets', href: 'markets' },
  { label: 'Explore', href: 'tokens' },
  { label: 'Swap', href: 'swap' },
  { label: 'Pools', href: 'pools' },
  {
    label: 'Farms', dropdown: true, children: [
      {
        icon: FarmIcon,
        title: 'Native Farms',
        description: 'Earn with platform-native pools',
        href: 'farms?native=true'
      },
      {
        icon: UserFarmIcon,
        title: 'User Farms',
        description: 'Explore user-created pools',
        href: 'farms?native=false'
      }
    ]
  }
];

function isActive(item: any) {
  // For exact match or startsWith for subroutes
  if (!item.href) return false;
  const path = item.href.startsWith('/') ? item.href : '/' + item.href;
  return route.path === path || route.path.startsWith(path + '/');
}

const isDarkTheme = ref(false);
const handleThemeChange = (isDark: boolean): void => {
  console.log('Theme changed:', isDark ? 'dark' : 'light');
  isDarkTheme.value = isDark;
};
</script>

<template>
  <nav
    class="fixed top-0 left-0 w-full z-50 bg-white dark:bg-gray-950 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 shadow-sm font-sans h-16">
    <div class="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
      <!-- Logo -->
      <router-link to="/" class="flex items-center space-x-3">
        <slot name="logo">
          <span class="font-extrabold text-2xl tracking-tight text-primary-400 dark:text-white">MeeRayDex</span>
        </slot>
      </router-link>
      <!-- Menu -->
      <ul class="flex items-stretch h-full space-x-6 pb-[1px]">
        <li v-for="item in menuItems" :key="item.label" class="relative flex items-center h-full">
          <template v-if="item.dropdown && item.children">
            <NavDropdown :label="item.label" :items="item.children" @select="(child: any) => router.push(child.href)" />
          </template>
          <template v-else>
            <router-link :to="item.href" :class="[
              'px-3 py-2 font-medium text-base transition-all duration-150 h-full flex items-center',
              isActive(item)
                ? 'border-t-2 border-primary-500 text-primary-500 dark:bg-gray-950'
                : 'hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-primary-400 hover:border-t-2 hover:border-primary-500'
            ]">
              {{ item.label }}
            </router-link>
          </template>
        </li>
      </ul>
      <!-- Actions -->
      <div class="flex items-center space-x-3">
        <button class="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8m-4-4v8" />
          </svg>
        </button>
        <router-link v-if="auth.state.isAuthenticated" :to="`/@${auth.state.username}`"
          class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <svg class="w-6 h-6 text-gray-500 dark:text-gray-300" fill="none" stroke="currentColor" stroke-width="2"
            viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 8-4 8-4s8 0 8 4" />
          </svg>
        </router-link>
        <SteemAuth @theme-change="handleThemeChange" appName="future.app" displayDarkModeToggle
          callbackURL="http://localhost:3000" steemApi="https://testapi.moecki.online"
          :steemApiOptions="{ addressPrefix: 'MTN', chainId: '1aa939649afcc54c67e01a809967f75b8bee5d928aa6bdf237d0d5d6bfbc5c22' }" />
      </div>
    </div>
  </nav>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

nav {
  font-family: 'Inter', 'Satoshi', 'Montserrat', 'Segoe UI', Arial, sans-serif;
}
</style>