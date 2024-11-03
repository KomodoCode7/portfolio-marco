// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  vite: {
    ssr: {
      noExternal: ['@fontsource-variable/montserrat'] // Especifica el paquete que necesita ser excluido del procesamiento en SSR
    }
  }
});
