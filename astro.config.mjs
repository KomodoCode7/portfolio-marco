// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  vite: {
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
