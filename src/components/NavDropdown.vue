<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const route = useRoute();

interface DropdownItem {
  icon?: any;
  title: string;
  description: string;
  href?: string;
}

const props = defineProps<{
  label: string;
  items: DropdownItem[];
}>();
const isOpen = ref(false);
function openDropdown() { isOpen.value = true; }
function closeDropdown() { isOpen.value = false; }
function toggleDropdown() { isOpen.value = !isOpen.value; }

</script>

<template>
    <div class="relative group" @mouseleave="closeDropdown">
        <button
            class="px-4 py-2 font-semibold flex items-center focus:outline-none"
            @mouseenter="openDropdown" @click="$emit('label-click'); toggleDropdown()" type="button">
            {{ props.label }}
            <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" />
            </svg>
        </button>
        <div v-show="isOpen"
            class="absolute left-0 mt-0 w-80 bg-white dark:bg-gray-950 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 rounded-xl shadow-lg py-4 z-50 transition-all duration-200"
            @mouseenter="openDropdown" @mouseleave="closeDropdown">
            <ul>
                <li v-for="item in props.items" :key="item.title"
                    class="flex items-start px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer rounded-lg"
                    @click="$emit('select', item)">
                    <span class="mr-4 mt-1 text-primary-500">
                        <component :is="item.icon" class="w-6 h-6" v-if="item.icon" />
                        <span v-else class="w-6 h-6"></span>
                    </span>
                    <div>
                        <div class="font-semibold">{{ item.title }}</div>
                        <div class="text-gray-400 text-sm">{{ item.description }}</div>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</template>
