import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import Pages from 'vite-plugin-pages'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import tailwindcss from '@tailwindcss/vite'

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd())
  return defineConfig({
    server: {
      port: Number(env.VITE_PORT) || 3000,
      allowedHosts: true
    },
    plugins: [
      vue(),
      tailwindcss(),
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