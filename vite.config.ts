import * as path from "path";
import { defineConfig, loadEnv } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Pages from 'vite-plugin-pages'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd())
  return defineConfig({
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@pages": path.resolve(__dirname, "./src/pages"),
        "@api": path.resolve(__dirname, "./src/api"),
        "@modules": path.resolve(__dirname, "./src/modules"),
        "@composables": path.resolve(__dirname, "./src/composables"),
        "@store": path.resolve(__dirname, "./src/store"),
        "@plugins": path.resolve(__dirname, "./src/plugins"),
        "@assets": path.resolve(__dirname, "./src/assets"),
        "@utils": path.resolve(__dirname, "./src/utils"),
      },
    },
    server: {
      port: Number(env.VITE_PORT) || 3000,
      allowedHosts: true
    },
    plugins: [
      Vue(),
      Pages({
        extensions: ['vue', 'tsx', 'ts'],
      }),
      Components({
        dirs: ['src/components'],
        deep: true,
        dts: 'src/components.d.ts',
      }),
      AutoImport({
        imports: [
          'vue',
          'vue-router',
        ],
        dts: 'src/auto-imports.d.ts',
        vueTemplate: true,
      }),
    ],
  })
}