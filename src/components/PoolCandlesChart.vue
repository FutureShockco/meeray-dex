<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { useApiService } from '../composables/useApiService';
import { Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { ChartConfiguration } from 'chart.js';

Chart.register(...registerables);
Chart.register(zoomPlugin);
console.log('[PoolCandlesChart] module loaded');

const financialLoaded = ref(false);
const pluginLoadError = ref<string | null>(null);
async function ensureFinancial() {
    console.log('[PoolCandlesChart] ensureFinancial called, loaded=', financialLoaded.value);
    if (financialLoaded.value) return;
    try {
        const mod: any = await import('chartjs-chart-financial');
        try {
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
        } catch (regErr) {
            console.warn('Financial plugin: auto-registration attempted but failed', regErr);
        }
        await import('chartjs-adapter-date-fns');
        financialLoaded.value = true;
        pluginLoadError.value = null;
    } catch (e) {
        console.warn('Financial plugin or adapter not available, trying explicit ESM fallback:', e);
        try {
            const mod2: any = await import('chartjs-chart-financial/dist/chartjs-chart-financial.esm.js');
            try {
                if (mod2) {
                    for (const k of Object.keys(mod2)) {
                        const exp = (mod2 as any)[k];
                        if (typeof exp === 'function' && /controller|element/i.test(k)) {
                            try { Chart.register(exp); } catch (e) { /* ignore */ }
                        }
                    }
                    if (mod2.default && typeof mod2.default === 'object') {
                        for (const k of Object.keys(mod2.default)) {
                            const exp = (mod2.default as any)[k];
                            if (typeof exp === 'function' && /controller|element/i.test(k)) {
                                try { Chart.register(exp); } catch (e) { /* ignore */ }
                            }
                        }
                    }
                }
            } catch (regErr2) {
                console.warn('Fallback registration failed', regErr2);
            }
            // @ts-ignore
            await import('chartjs-adapter-date-fns');
            financialLoaded.value = true;
            pluginLoadError.value = null;
        } catch (e2) {
            console.error('Financial plugin import failed:', e2);
            pluginLoadError.value = String(e2?.message || e2);
        }
    }
}

const props = defineProps<{ selectedPair?: string; interval?: string }>();
const emit = defineEmits<{
    (e: 'summary', payload: any): void
}>();

const api = useApiService();
const canvasRef = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;
const loading = ref(false);
const error = ref('');
const lastRawCandles = ref<any[] | null>(null);

const candlesCache: Record<string, { ts: number; data: any[] }> = {};
const currentMappedCandles = ref<any[]>([]);

async function fetchCandles() {
    if (!props.selectedPair) {
        error.value = 'No trading pair selected';
        emit('summary', { lastPrice: null, totalVolume: 0, priceChange: null, totalTrades: 0, priceDataLength: 0, lastTradeTs: null });
        return [];
    }
    loading.value = true;
    error.value = '';
    const interval = props.interval || '1h';
    const cacheKey = `${props.selectedPair}_${interval}`;
    try {
        const resp = await api.getCandles(props.selectedPair, { interval });
        lastRawCandles.value = resp && Array.isArray((resp as any).candles) ? (resp as any).candles : Array.isArray(resp) ? resp as any[] : null;
        if (resp && Array.isArray(resp.candles)) {
            const mapped = resp.candles.map((c: any) => ({
                x: new Date(c.timestamp),
                o: parseFloat(String(c.open)),
                h: parseFloat(String(c.high)),
                l: parseFloat(String(c.low)),
                c: parseFloat(String(c.close)),
                v: parseFloat(String(c.volume)),
            }));
            candlesCache[cacheKey] = { ts: Date.now(), data: mapped };
            currentMappedCandles.value = mapped;
            return mapped;
        }
        return [];
    } catch (e: any) {
        error.value = e?.message || 'Failed to fetch candles';
        console.error(e);
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
        const data = await fetchCandles();
        if (!financialLoaded.value) {
            try { if (chart) { chart.destroy(); chart = null; } } catch (e) { console.warn('Error destroying chart', e); }
            return;
        }
        if (!canvasRef.value) return;
        try { if (chart) chart.destroy(); } catch (e) { console.warn('Error destroying previous chart', e); }


        const allPrices = data.flatMap((d: any) => [d.o, d.h, d.l, d.c]).sort((a: number, b: number) => a - b);
        let minY = Math.min(...allPrices), maxY = Math.max(...allPrices);
        if (allPrices.length > 10) {
            minY = allPrices[Math.floor(allPrices.length * 0.10)];
            maxY = allPrices[Math.ceil(allPrices.length * 0.90) - 1];
        }
        let minRange = 0.05;
        if (maxY - minY < minRange) {
            const mid = (maxY + minY) / 2;
            minY = mid - minRange / 2;
            maxY = mid + minRange / 2;
        }
        const margin = (maxY - minY) * 0.05;
        minY -= margin;
        maxY += margin;

        const interval = props.interval || '1h';
        let timeUnit: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' = 'minute';
        if (interval.endsWith('m')) timeUnit = 'minute';
        else if (interval.endsWith('h')) timeUnit = 'hour';
        else if (interval.endsWith('d')) timeUnit = 'day';
        else if (interval.endsWith('w')) timeUnit = 'week';
        else if (interval.endsWith('M')) timeUnit = 'month';

        const labels = data.map((d: any) => {
            const ts = d.rawTimestamp || d.timestamp || (d.x instanceof Date ? d.x.getTime() : d.x);
            const date = new Date(ts);
            return date.toLocaleString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        });
        const cfg: ChartConfiguration = {
            type: 'candlestick',
            data: {
                labels,
                datasets: [{
                    label: props.selectedPair || 'candles',
                    data: data.map((d: any, i: number) => ({
                        x: i,
                        o: d.o,
                        h: d.h,
                        l: d.l,
                        c: d.c,
                    })),
                },
                {
                    label: 'close',
                    data: data.map((d: any, i: number) => ({
                        x: i,
                        y: d.o,
                    })),
                    type: 'line',
                    hidden: false,
                    borderColor: '#fff',
                    borderWidth: 1,

                }
                ],
            },
            options: {
                parsing: false,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        filter: (tooltipItem) => tooltipItem.datasetIndex !== 1,
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
                        title: { display: true, text: 'Price' },
                        min: minY,
                        max: maxY
                    }
                }
            }
        };

        chart = new Chart(canvasRef.value!.getContext('2d') as CanvasRenderingContext2D, cfg);
        chart.config.options.scales.y.type = 'linear';

        // @ts-ignore
        chart.config.data.datasets[0].backgroundColors = {
            border: '#fff',
            up: '#16c557b5',
            down: '#c51616b5',
            unchanged: '#999',
        };
        // @ts-ignore
        chart.config.type = type;
        chart.config.data.datasets[1].hidden = false;

        let lastPrice = null; let lastTradeTs = null; let totalVolume = 0;
        if (Array.isArray(data) && data.length) {
            const latest = data.reduce((a: any, b: any) => (a.x > b.x ? a : b));
            lastPrice = latest.c; lastTradeTs = latest.x; totalVolume = data.reduce((s: number, d: any) => s + (d.v || 0), 0);
        }
        const summary = { lastPrice, totalVolume, priceChange: null, totalTrades: 0, priceDataLength: Array.isArray(data) ? data.length : 0, lastTradeTs };
        emit('summary', summary);
    } finally {
        chart.update();
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
