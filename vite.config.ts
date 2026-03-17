import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons-ng';
import path from "node:path";
import staticAssetsPlugin from 'vite-static-assets-plugin';
import os from 'node:os';
import tsconfigPaths from 'vite-tsconfig-paths';
import { host } from "./src/bun/utils/host";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) =>
{
  const production = process.env.NODE_ENV === 'production';
  console.log(`Building Vite in ${process.env.NODE_ENV}`);
  process.env.VITE_PLATFORM = os.platform();
  process.env.VITE_ARCH = os.arch();

  return {
    base: './',
    plugins: [
      staticAssetsPlugin({
        directory: 'src/mainview/assets/icons',
        outputFile: 'src/mainview/gen/static-icon-assets.gen.ts'
      }),
      tailwindcss(),
      tanstackRouter({
        target: 'react',
        routesDirectory: "./routes/",
        generatedRouteTree: "./gen/routeTree.gen.ts",
        autoCodeSplitting: command === 'build',
        routeFileIgnorePrefix: "-",
        quoteStyle: "single"
      }),
      react({
        babel: {
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      createSvgIconsPlugin({
        // Specify the icon folder to be cached
        iconDirs: [path.resolve(process.cwd(), 'src/mainview/assets/icons')],
      }),
      tsconfigPaths()
    ],
    root: "src/mainview",
    build: {
      outDir: "../../dist",
      minify: production,
      sourcemap: production ? false : 'inline',
      rollupOptions: {
        preserveEntrySignatures: 'strict',
        input: {
          main: 'src/mainview/index.html',
          login: 'src/mainview/auth/qr/index.html',
          emulatorjs: 'src/mainview/emulatorjs/index.html',
        },
        output: {
          manualChunks: (id
          ) =>
          {

            if (id.includes('@emulatorjs'))
              return 'emulatorjs';
            if (id.includes('clients/romm'))
              return 'clients';
            if (id.includes('node_modules/lucide-react'))
              return 'lucide';
            if (id.includes('node_modules/zod'))
              return 'zod';
            if (id.includes('node_modules/@tanstack'))
              return 'tanstack';
            console.log(id);
            if (id.includes('node_modules'))
              return 'vendor';
            if (id.endsWith('SvgIcon.tsx'))
              return 'icons';

            return null;
          },
        }
      },
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      strictPort: true,
      allowedHosts: true,
      cors: true,
      host,
      watch: {
        usePolling: true
      },
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      }
    },
    resolve: {
      alias: {
        "@emulators": path.resolve(__dirname, `vendors/es-de/emulators.${os.platform()}.${os.arch()}.json`)
      }
    },
    define: {
      __HOST__: JSON.stringify(host),
      __PUBLIC__: process.env.PUBLIC_ACCESS ? true : false
    }
  };
});