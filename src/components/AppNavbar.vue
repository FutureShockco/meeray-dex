<script setup lang="ts">
import { ref } from 'vue';
import { SteemAuth, SteemTransactions, MeerayTransactions, useAuthStore } from 'steem-auth-vue';
import NavDropdown from './NavDropdown.vue'
import { useTransactionService } from '../composables/useTransactionService';
import { useRouter, useRoute } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const isDarkTheme = ref(false);
const toggleTheme = () => { isDarkTheme.value = !isDarkTheme.value; handleThemeChange(isDarkTheme.value); };
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
  { label: 'Swap', href: 'swap?tokenIn=MRY&tokenOut=TESTS' },
  { label: 'Pools', href: 'pools' },
  {
    label: 'Farms', dropdown: true, href: 'farms', children: [
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
const THEME_STORAGE_KEY = 'steem-auth-theme';

function isActive(item: any) {
  // For exact match or startsWith for subroutes
  if (!item.href) return false;
  const path = item.href.startsWith('/') ? item.href : '/' + item.href;
  return route.path === path || route.path.startsWith(path + '/');
}

const handleThemeChange = (isDark: boolean): void => {
  console.log('Theme changed:', isDark ? 'dark' : 'light');
  isDarkTheme.value = isDark;
  applyTheme(isDark);
};

const applyTheme = (isDark: boolean) => {
  if (typeof document !== 'undefined') {
    if (isDark) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  }
};

// Theme management

const initTheme = () => {
  if (typeof window === 'undefined') return;
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme) {
    isDarkTheme.value = storedTheme === 'dark';
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // Use system preference if no stored theme
    isDarkTheme.value = true;
  }

  applyTheme(isDarkTheme.value);

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        isDarkTheme.value = e.matches;
        applyTheme(isDarkTheme.value);
      }
    });
  }
};

function handleModalOpen() {
  document.body.classList.add('steem-auth-modal-open');
  setTimeout(() => {
    const row = document.querySelector('.steem-auth-accounts-row') as (Element & { _wheelHandler?: (e: WheelEvent) => void, scrollLeft?: number });
    if (row && !row._wheelHandler) {
      row._wheelHandler = function (e: WheelEvent) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          if (typeof row.scrollLeft === 'number') {
            row.scrollLeft += e.deltaY;
          }
        }
      };
      row.addEventListener('wheel', row._wheelHandler, { passive: false });
    }
  }, 0);
}

function handleModalClose() {
  document.body.classList.remove('steem-auth-modal-open');
  const row = document.querySelector('.steem-auth-accounts-row') as (Element & { _wheelHandler?: (e: WheelEvent) => void });
  if (row && row._wheelHandler) {
    row.removeEventListener('wheel', row._wheelHandler);
    delete row._wheelHandler;
  }
}

onMounted(() => {
  initTheme();

});

// Transaction / Kafka status
const txService = useTransactionService();
const isKafkaConnected = txService.isConnected;

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
            <NavDropdown :label="item.label" :items="item.children"
              @label-click="() => {
                if (!item || !item.href) return;
                const target = item.href.startsWith('/') ? item.href : '/' + item.href;
                router.push(target);
              }"
              @select="(child: any) => {
                if (!child || !child.href) return;
                const target = child.href.startsWith('/') ? child.href : '/' + child.href;
                router.push(target);
              }" />
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
        <!-- Kafka connection indicator -->
        <div class="flex items-center mr-2" title="Kafka connection status">
          <span :class="['inline-block w-3 h-3 rounded-full mr-2', isKafkaConnected ? 'bg-green-500' : 'bg-red-500']"></span>
          <span class="text-sm text-gray-500 dark:text-gray-300">Kafka</span>
        </div>
        <button class="steem-auth-theme-toggle" @click="toggleTheme" type="button">
          {{ isDarkTheme ? '☀️' : '🌙' }}
        </button>
        <router-link v-if="auth.state.isAuthenticated" :to="`/@${auth.state.username}`"
          class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <svg class="w-6 h-6 text-gray-500 dark:text-gray-300" fill="none" stroke="currentColor" stroke-width="2"
            viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 8-4 8-4s8 0 8 4" />
          </svg>
        </router-link>
        <SteemAuth @modalOpen="handleModalOpen" @modalClose="handleModalClose" appName="future.app"
          callbackURL="http://localhost:3000" steemApi="https://testapi.moecki.online"
          :steemApiOptions="{ addressPrefix: 'MTN', chainId: '1aa939649afcc54c67e01a809967f75b8bee5d928aa6bdf237d0d5d6bfbc5c22' }" />
      </div>
    </div>
  </nav>
</template>
