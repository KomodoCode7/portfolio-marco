// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://marcomolina.cl',
  integrations: [
    tailwind(),
    sitemap()
  ],
  vite: {
    build: {
      sourcemap: false, // Desactiva source maps en producción
    },
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    ssr: {
      noExternal: ['@fontsource-variable/montserrat', 'gsap'] // Especifica el paquete que necesita ser excluido del procesamiento en SSR
    }
  }
});
