import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons-ng';
import path from "node:path";
import staticAssetsPlugin from 'vite-static-assets-plugin';
import { host } from "./src/bun/utils";

export default defineConfig(() =>
{
  const production = process.env.NODE_ENV === 'production';
  console.log(`Building Vite in ${process.env.NODE_ENV}`);

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
        autoCodeSplitting: true,
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
      })
    ],
    root: "src/mainview",
    build: {
      outDir: "../../dist",
      minify: production,
      sourcemap: production ? false : 'inline',
      rollupOptions: {
        output: {
          manualChunks: (id
          ) =>
          {
            if (id
              .includes
              ('node_modules'))
            {
              return 'vendor';
            }

            if (id.endsWith('SvgIcon.tsx'))
            {
              return 'icons';
            }

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
      host,
    },
    define: {
      __HOST__: JSON.stringify(host)
    }
  };
});