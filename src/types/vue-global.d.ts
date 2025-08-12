import { ComponentCustomProperties } from 'vue';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $numeral: typeof import('numeral').default;
    $moment: typeof import('moment');
    $formatNumber: (value: number | string, symbol?: string, format?: string) => string;
    $formatTokenBalance: (balanceData: { amount?: string; rawAmount?: string } | string | number, symbol: string, format?: string) => string;
    $formatRawNumber: (value: string | number, symbol: string, format?: string) => string;
    $formatDate: (value: string | Date, format?: string) => string;
    $coinPrice: (symbol: string) => number | null;
    $formattedCoinPrice: (symbol: string, format?: string) => string;
  }
} 