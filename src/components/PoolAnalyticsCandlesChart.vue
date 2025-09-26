<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { ChartConfiguration } from 'chart.js';
import { useApiService } from '../composables/useApiService';

Chart.register(...registerables);
Chart.register(zoomPlugin);

const financialLoaded = ref(false);
const pluginLoadError = ref<string | null>(null);
async function ensureFinancial() {
    if (financialLoaded.value) return;
    try {
        const mod: any = await import('chartjs-chart-financial');
        if (mod) {
            for (const k of Object.keys(mod)) {
                const exp = (mod as any)[k];
                if (typeof exp === 'function' && /controller|element/i.test(k)) {
                    try { Chart.register(exp); } catch (e) { /* ignore */ }
                }
            }
            if (mod.default && typeof mod.default === 'object') {
                for (const k of Object.keys(mod.default)) {
                    const exp = (mod.default as any)[k];
                    if (typeof exp === 'function' && /controller|element/i.test(k)) {
                        try { Chart.register(exp); } catch (e) { /* ignore */ }
                    }
                }
            }
        }
        await import('chartjs-adapter-date-fns');
        financialLoaded.value = true;
        pluginLoadError.value = null;
    } catch (e) {
        pluginLoadError.value = String(e?.message || e);
    }
}

const props = defineProps<{ selectedPair?: string; interval?: string }>();
const api = useApiService();
const canvasRef = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;
const loading = ref(false);
const error = ref('');
const priceData = ref<any[]>([]);

async function fetchAnalyticsCandles() {
    if (!props.selectedPair) {
        error.value = 'No trading pair selected';
        return [];
    }
    loading.value = true;
    error.value = '';
    try {
        // Use the analytics API (like PoolAnalyticsChart)
        const response = await api.getTradeHistory(props.selectedPair, 200, props.interval === 'hour' ? 'hour' : 'week');
        let trades: any[] = [];
        if (response.trades) trades = response.trades;
        else if (response.data) trades = response.data;
        else if (Array.isArray(response)) trades = response;
        priceData.value = trades.map((trade: any, index: number) => {
            const price = parseFloat(trade.price);
            const volume = parseFloat(trade.volume || 0);
            const timestamp = trade.timestamp;
            return {
                timestamp,
                price,
                volume,
                o: price, // For demo, use price as open/close/high/low
                h: price,
                l: price,
                c: price
            };
        });
        return priceData.value;
    } catch (e: any) {
        error.value = e?.message || 'Failed to fetch analytics candles';
        return [];
    } finally {
        loading.value = false;
    }
}

let _rendering = false;
async function renderChart() {
    if (_rendering) return;
    _rendering = true;
    try {
        await ensureFinancial();
        const data = await fetchAnalyticsCandles();
        if (!financialLoaded.value) {
            try { if (chart) { chart.destroy(); chart = null; } } catch (e) {}
            return;
        }
        if (!canvasRef.value) return;
        try { if (chart) chart.destroy(); } catch (e) {}

        const labels = data.map((d: any) => {
            const date = new Date(d.timestamp);
            return date.toLocaleString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        });
        const cfg: ChartConfiguration = {
            type: 'candlestick',
            data: {
                labels,
                datasets: [{
                    label: props.selectedPair || 'analytics candles',
                    data: data.map((d: any, i: number) => ({
                        x: i,
                        o: d.o,
                        h: d.h,
                        l: d.l,
                        c: d.c
                    })),
                    backgroundColors: {
                        up: '#10b981',
                        down: '#ef4444',
                        unchanged: '#e5e7eb'
                    },
                    borderColors: {
                        up: '#065f46',
                        down: '#991b1b',
                        unchanged: '#a3a3a3'
                    }
                }]
            },
            options: {
                parsing: false,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (ctx: any) => {
                                const d = ctx.raw;
                                return `O:${d.o} H:${d.h} L:${d.l} C:${d.c}`;
                            }
                        }
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x',
                        },
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'x',
                        },
                        limits: {
                            x: { minRange: 1 }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        grid: { display: true },
                        title: { display: true, text: 'Time' },
                        ticks: {
                            autoSkip: true,
                            maxRotation: 0,
                            callback: function (value: any, index: number) {
                                const step = Math.ceil(labels.length / 10);
                                return index % step === 0 ? labels[index] : '';
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'right',
                        grid: { display: true },
                        title: { display: true, text: 'Price' }
                    }
                }
            }
        };
        chart = new Chart(canvasRef.value!.getContext('2d') as CanvasRenderingContext2D, cfg);
    } finally {
        _rendering = false;
    }
}

let refresh: NodeJS.Timeout | null = null;
onMounted(() => { renderChart(); refresh = setInterval(() => renderChart(), 60000); });
onUnmounted(() => { if (refresh) clearInterval(refresh); if (chart) chart.destroy(); });
watch(() => [props.selectedPair, props.interval], () => renderChart(), { immediate: true });
</script>

<template>
    <div class="relative h-full w-full">
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
        </div>
        <div v-else-if="error" class="p-4 text-red-500">{{ error }}</div>
        <div v-else>
            <canvas ref="canvasRef" />
        </div>
    </div>
</template>

<style scoped>
.relative {
    position: relative;
}

canvas {
    width: 100% !important;
    height: 30vh !important;
}
</style>
