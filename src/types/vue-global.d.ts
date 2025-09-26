import { ComponentCustomProperties } from 'vue';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $numeral: typeof import('numeral').default;
    $moment: typeof import('moment');
    $formatNumber: (value: number | string, symbol?: string, format?: string) => string;
    $tokenPrice: (symbol?: string, isNumber?: boolean) => string | number;
    $tokenMcap: (value: number | string, symbol?: string, isNumber?: boolean) => string | number;
    $tokenAmountPrice: (value: number | string, symbol?: string, isNumber?: boolean) => string | number;
    $formatTokenBalance: (balanceData: { amount?: string; rawAmount?: string } | string | number, symbol: string, format?: string) => string;
    $formatRawNumber: (value: string | number | bigint, symbol: string, formatSymbol?: string) => string;
    $formatDate: (value: string | Date, format?: string) => string;
    $formattedCoinPrice: (symbol: string, format?: string) => number;
    $formatUsdValue: (value: number | string, symbol?: string, format?: string) => string;
  }
} 