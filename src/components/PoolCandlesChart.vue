<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import { useApiService } from '../composables/useApiService';
import { Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { ChartConfiguration } from 'chart.js';


// register core chart.js features and zoom plugin
Chart.register(...registerables);
Chart.register(zoomPlugin);
console.log('[PoolCandlesChart] module loaded');

// dynamic import of financial plugin and date adapter
const financialLoaded = ref(false);
const pluginLoadError = ref<string | null>(null);
async function ensureFinancial() {
    console.log('[PoolCandlesChart] ensureFinancial called, loaded=', financialLoaded.value);
    if (financialLoaded.value) return;
    try {
        const mod: any = await import('chartjs-chart-financial');
        // try to auto-register any controllers/elements exported by the module
        try {
            if (mod) {
                for (const k of Object.keys(mod)) {
                    const exp = (mod as any)[k];
                    if (typeof exp === 'function' && /controller|element/i.test(k)) {
                        try { Chart.register(exp); } catch (e) { /* ignore */ }
                    }
                }
                // also check default export
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
        // date adapter
        // @ts-ignore
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
            // leave financialLoaded false
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
const debugEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugCharts') === '1';

const candlesCache: Record<string, { ts: number; data: any[] }> = {};
const currentMappedCandles = ref<any[]>([]);

async function fetchCandles() {
    if (!props.selectedPair) {
        error.value = 'No trading pair selected';
        // still emit an empty summary so parent knows there's no data
        emit('summary', { lastPrice: null, totalVolume: 0, priceChange: null, totalTrades: 0, priceDataLength: 0, lastTradeTs: null });
        return [];
    }
    loading.value = true;
    error.value = '';
    const interval = props.interval || '1h';
    const cacheKey = `${props.selectedPair}_${interval}`;
    // Always fetch fresh data when interval changes (do not use cache)
    // const cached = candlesCache[cacheKey];
    // if (cached && Date.now() - cached.ts < 30_000) { loading.value = false; return cached.data; }
    try {
    const resp = await api.getCandles(props.selectedPair, { interval });
    lastRawCandles.value = resp && Array.isArray((resp as any).candles) ? (resp as any).candles : Array.isArray(resp) ? resp as any[] : null;
        console.log('[PoolCandlesChart] getCandles response for', props.selectedPair, interval, resp);
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
            // update current mapped candles for SVG fallback
            currentMappedCandles.value = mapped;
            return mapped;
        }
        console.debug('[PoolCandlesChart] getCandles returned no candles', resp);
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
        // if plugin not loaded, destroy any existing chart and just return (SVG fallback will render)
            if (!financialLoaded.value) {
                try { if (chart) { chart.destroy(); chart = null; } } catch (e) { console.warn('Error destroying chart', e); }
                return;
            }
        if (!canvasRef.value) return;
        try { if (chart) chart.destroy(); } catch (e) { console.warn('Error destroying previous chart', e); }


        // Calculate 10th and 90th percentile for y-axis clamp
        const allPrices = data.flatMap((d: any) => [d.o, d.h, d.l, d.c]).sort((a: number, b: number) => a - b);
        let minY = Math.min(...allPrices), maxY = Math.max(...allPrices);
        if (allPrices.length > 10) {
            minY = allPrices[Math.floor(allPrices.length * 0.10)];
            maxY = allPrices[Math.ceil(allPrices.length * 0.90) - 1];
        }
        // Enforce a minimum range for aesthetics
        let minRange = 0.05; // You can adjust this value for your use case
        if (maxY - minY < minRange) {
            const mid = (maxY + minY) / 2;
            minY = mid - minRange / 2;
            maxY = mid + minRange / 2;
        }
        // Add a small margin
        const margin = (maxY - minY) * 0.05;
        minY -= margin;
        maxY += margin;

        // Map interval to Chart.js time unit
        const interval = props.interval || '1h';
    let timeUnit: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' = 'minute';
    if (interval.endsWith('m')) timeUnit = 'minute';
    else if (interval.endsWith('h')) timeUnit = 'hour';
    else if (interval.endsWith('d')) timeUnit = 'day';
    else if (interval.endsWith('w')) timeUnit = 'week';
    else if (interval.endsWith('M')) timeUnit = 'month';

        // For category scale, use formatted date strings as x labels
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
                        c: d.c
                    }))
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
                            mode: 'x', // Only allow horizontal panning
                        },
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'x', // Only allow horizontal zoom
                        },
                        limits: {
                            x: { minRange: 1 } // At least 1 candle visible
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
                            callback: function(value: any, index: number) {
                                // Show only every Nth label for clarity
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

        // emit summary even if empty so parent can react
        let lastPrice = null; let lastTradeTs = null; let totalVolume = 0;
        if (Array.isArray(data) && data.length) {
            const latest = data.reduce((a: any, b: any) => (a.x > b.x ? a : b));
            lastPrice = latest.c; lastTradeTs = latest.x; totalVolume = data.reduce((s: number, d: any) => s + (d.v || 0), 0);
        }
        const summary = { lastPrice, totalVolume, priceChange: null, totalTrades: 0, priceDataLength: Array.isArray(data) ? data.length : 0, lastTradeTs };
        emit('summary', summary);
    } finally {
        _rendering = false;
    }
}

let refresh: NodeJS.Timeout | null = null;
onMounted(() => { renderChart(); refresh = setInterval(() => renderChart(), 6000); });
onUnmounted(() => { if (refresh) clearInterval(refresh); if (chart) chart.destroy(); });

watch(() => [props.selectedPair, props.interval], () => renderChart(), { immediate: true });

const svgWidth = 600;
const svgHeight = 300;
const svgPadding = { left: 40, right: 20, top: 20, bottom: 20 };

const svgScale = computed(() => {
    const data = currentMappedCandles.value || [];
    if (!data.length) return { minP: 0, maxP: 1, xStep: 0 };
    const prices = data.flatMap(d => [d.h, d.l, d.o, d.c]);
    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    // Clamp outliers: ignore top/bottom 10% for a much tighter range
    const sorted = prices.slice().sort((a, b) => a - b);
    const n = sorted.length;
    if (n > 10) {
        minP = sorted[Math.floor(n * 0.10)];
        maxP = sorted[Math.ceil(n * 0.90) - 1];
    }
    // Add a small margin for aesthetics
    const margin = (maxP - minP) * 0.05;
    minP -= margin;
    maxP += margin;
    // Add minimum range to avoid flat lines
    if (maxP - minP < 1e-6) {
        const mid = (maxP + minP) / 2;
        minP = mid - 0.5;
        maxP = mid + 0.5;
    }
    // Clamp to positive values if all prices are positive
    if (minP < 0 && maxP > 0 && Math.abs(minP) > 10 * maxP) minP = 0;
    const xStep = (svgWidth - svgPadding.left - svgPadding.right) / Math.max(data.length - 1, 1);
    return { minP, maxP, xStep };
});

const svgCandles = computed(() => {
    console.debug('[PoolCandlesChart] svgCandles computed property running');
    const data = currentMappedCandles.value || [];
    if (!data.length) {
        console.debug('[PoolCandlesChart] svgCandles: no data');
        return [];
    }
    const { minP, maxP, xStep } = svgScale.value;
    const ordered = data.slice().sort((a: any, b: any) => (new Date(a.x).getTime() - new Date(b.x).getTime()));
    const candleWidthClamped = Math.max(2, Math.min(6, xStep * 0.7));
    const mapped = ordered.map((d: any, i: number) => {
        const x = svgPadding.left + i * xStep;
        const clamp = (v: number) => Math.max(minP, Math.min(maxP, v));
        const y = (val: number) => svgPadding.top + (1 - (clamp(val) - minP) / Math.max(maxP - minP, 1e-9)) * (svgHeight - svgPadding.top - svgPadding.bottom);
        let openY = y(d.o), closeY = y(d.c), highY = y(d.h), lowY = y(d.l);
        if (Math.abs(maxP - minP) < 1e-6) {
            openY = closeY = highY = lowY = svgPadding.top + (svgHeight - svgPadding.top - svgPadding.bottom) / 2;
        }
        return {
            x,
            openY,
            closeY,
            highY,
            lowY,
            isUp: d.c >= d.o,
            raw: d,
            width: candleWidthClamped
        };
    });
    console.debug('[PoolCandlesChart] svgCandles mapped preview', mapped.length, mapped.slice(0,5));
    return mapped;
});

const debugMetrics = computed(() => {
    const { xStep } = svgScale.value || { xStep: 0 };
    const candleWidth = Math.max(2, Math.min(12, xStep * 0.25));
    return { xStep, candleWidth };
});

// hover state for SVG tooltip
const hoverIndex = ref<number | null>(null);
const tooltipX = ref(0);
const tooltipY = ref(0);
const hoveredCandle = computed(() => (hoverIndex.value !== null ? svgCandles.value[hoverIndex.value] : null));

function onCandleMove(ev: MouseEvent, idx: number) {
    hoverIndex.value = idx;
    const rect = (ev.currentTarget as Element).closest('svg')?.getBoundingClientRect();
    if (rect) {
        tooltipX.value = ev.clientX - rect.left;
        tooltipY.value = ev.clientY - rect.top;
    }
}
function onCandleLeave() { hoverIndex.value = null; }
</script>

<template>
    <div class="relative h-full w-full">
            <div v-if="debugEnabled" class="absolute right-2 top-2 z-50 p-2 bg-black/60 text-white text-xs rounded-md max-w-xs break-words">
            <div class="font-semibold">Candles Debug</div>
            <div>SelectedPair: {{ props.selectedPair || '-' }}</div>
            <div>Interval: {{ props.interval || '-' }}</div>
            <div>Raw count: {{ lastRawCandles ? lastRawCandles.length : '—' }}</div>
            <div>Mapped count: {{ (chart && chart.data && chart.data.datasets && chart.data.datasets[0] && chart.data.datasets[0].data) ? (chart.data.datasets[0].data.length) : (lastRawCandles ? lastRawCandles.length : 0) }}</div>
            <div v-if="lastRawCandles && lastRawCandles.length">First: {{ lastRawCandles[0] }}</div>
                <div class="mt-1 text-xs">xStep: {{ debugMetrics.xStep.toFixed(2) }} | candleW: {{ debugMetrics.candleWidth.toFixed(2) }}</div>
                <div class="mt-1 text-xs">candles preview (first 5):</div>
                <pre class="text-xs mt-1 whitespace-pre-wrap">{{ svgCandles.slice(0,5).map(c => ({ x: Math.round(c.x), highY: Math.round(c.highY), lowY: Math.round(c.lowY), openY: Math.round(c.openY), closeY: Math.round(c.closeY), w: Math.round(c.width) })) }}</pre>
        </div>
        <div v-if="pluginLoadError && debugEnabled" class="absolute left-2 top-2 z-50 p-2 bg-yellow-400 text-black text-xs rounded-md max-w-xs break-words">
            <div class="font-semibold">Chart plugin failed to load</div>
            <div>{{ pluginLoadError }}</div>
            <div class="mt-1 text-xs">Try restarting the dev server (vite) after installing dependencies.</div>
        </div>
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
        </div>
        <div v-else-if="error" class="p-4 text-red-500">{{ error }}</div>
        <div v-else>
            <div v-if="!financialLoaded && currentMappedCandles && currentMappedCandles.length">
                <svg :width="svgWidth" :height="svgHeight" :viewBox="`0 0 ${svgWidth} ${svgHeight}`" :style="{ width: svgWidth + 'px', height: svgHeight + 'px' }" preserveAspectRatio="xMidYMid meet">
                    <rect :x="0" :y="0" :width="svgWidth" :height="svgHeight" fill="transparent" />
                    <!-- grid lines -->
                    <g>
                        <line v-for="i in 5" :key="i" :x1="svgPadding.left" :x2="svgWidth - svgPadding.right" :y1="svgPadding.top + (i-1) * ((svgHeight - svgPadding.top - svgPadding.bottom) / 4)" :y2="svgPadding.top + (i-1) * ((svgHeight - svgPadding.top - svgPadding.bottom) / 4)" stroke="#334155" stroke-width="0.5" opacity="0.4" />
                    </g>
                    <!-- candles -->
                    <g>
                        <g v-for="(c, idx) in svgCandles" :key="idx">
                            <!-- wick -->
                            <line :x1="c.x" :x2="c.x" :y1="c.highY" :y2="c.lowY" :stroke="c.isUp ? '#10b981' : '#ef4444'" stroke-width="1" />
                            <!-- body -->
                            <rect :x="c.x - c.width/2" :y="Math.min(c.openY, c.closeY)" :width="c.width" :height="Math.max(2, Math.abs(c.openY - c.closeY))" :fill="c.isUp ? '#10b981' : '#ef4444'" :stroke="c.isUp ? '#065f46' : '#991b1b'" rx="1"
                                @mousemove="(e) => onCandleMove(e, idx)" @mouseleave="onCandleLeave" />
                        </g>
                    </g>
                    <!-- y axis labels (top/mid/bottom) -->
                    <text :x="6" :y="svgPadding.top + 12" fill="#94a3b8" font-size="10">{{ svgScale.maxP.toFixed(6) }}</text>
                    <text :x="6" :y="svgPadding.top + (svgHeight - svgPadding.top - svgPadding.bottom)/2 + 4" fill="#94a3b8" font-size="10">{{ ((svgScale.maxP + svgScale.minP)/2).toFixed(6) }}</text>
                    <text :x="6" :y="svgHeight - svgPadding.bottom" fill="#94a3b8" font-size="10">{{ svgScale.minP.toFixed(6) }}</text>
                </svg>
            </div>
            <canvas v-else ref="canvasRef" />
        </div>
    </div>
</template>

<style scoped>
.relative {
    position: relative;
}

canvas {
    width: 100% !important;
    height: 300px !important;
}
</style>
