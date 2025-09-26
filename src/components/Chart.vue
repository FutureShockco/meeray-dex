<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Chart } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

const canvasRef = ref<HTMLCanvasElement | null>(null);
let chart: any = null;

// Sample candle data
const data = [
  { timestamp: '2025-09-01T00:00:00Z', o: 27000, h: 27500, l: 26500, c: 27200, v: 100 },
  { timestamp: '2025-09-02T00:00:00Z', o: 27200, h: 28000, l: 27000, c: 26900, v: 50 },
  { timestamp: '2025-09-03T00:00:00Z', o: 26900, h: 27400, l: 26800, c: 27100, v: 75 },
];

async function renderChart() {
  if (!canvasRef.value) return;

  // Dynamically import the financial plugin
  const mod: any = await import('chartjs-chart-financial');
  const { CandlestickController, CandlestickElement } = mod;

  // Register the plugin elements and zoom
  Chart.register(CandlestickController, CandlestickElement, zoomPlugin);

  // Map data to proper candlestick format
  const candles = data.map(d => ({
    x: new Date(d.timestamp), // x must be Date or timestamp
    o: d.o,
    h: d.h,
    l: d.l,
    c: d.c,
    v: d.v
  }));

  const cfg: any = {
    type: 'candlestick',
    data: {
      datasets: [
        {
          label: 'BTC/USDT',
          data: candles,
        },
      ],
    },
    options: {
      responsive: true,
      parsing: false, // we already provide x,o,h,l,c
      elements: {
        candlestick: {
          upColor: '#26a69a',   // bullish green
          downColor: '#ef5350', // bearish red
          borderColor: '#000000',
          color: '#333333',      // wick color
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day' },
          title: { display: true, text: 'Date' },
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: 'Price' },
        },
      },
      plugins: {
        legend: { display: false },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
        },
      },
    },
  };

  if (chart) chart.destroy();
  chart = new Chart(canvasRef.value.getContext('2d')!, cfg);
}

onMounted(() => renderChart());
onUnmounted(() => { if (chart) chart.destroy(); });
</script>

<template>
  <div class="relative w-full h-64">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<style scoped>
canvas {
  width: 100% !important;
  height: 100% !important;
}
</style>
