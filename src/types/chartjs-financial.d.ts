declare module 'chartjs-chart-financial';
declare module 'chartjs-adapter-date-fns';

import 'chart.js';

declare module 'chart.js' {
  interface ElementOptionsByType {
    candlestick: {
      upColor?: string;
      downColor?: string;
      borderColor?: string;
      color?: string;
    };
  }

  interface ChartTypeRegistry {
    candlestick: {
      chartOptions: any;
      datasetOptions: any;
      defaultDataPoint: any;
      scales: 'x' | 'y';
    };
  }
}