import type { Config } from 'prettier';
import type { PluginConfig as SvelteConfig } from 'prettier-plugin-svelte';
import type { PluginOptions as TailwindConfig } from 'prettier-plugin-tailwindcss';

const config: Config & SvelteConfig & TailwindConfig = {
  singleQuote: true,
  plugins: ['prettier-plugin-svelte', 'prettier-plugin-tailwindcss'],
  overrides: [
    {
      files: '*.svelte',
      options: {
        parser: 'svelte',
      },
    },
  ],
  tailwindStylesheet: './src/routes/layout.css',
};

export default config;
