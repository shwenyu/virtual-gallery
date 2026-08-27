// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// The gallery renders on Cloudflare Workers and reads its content from D1, so
// pages are server-rendered rather than baked at build time: an edit in the
// admin shows up immediately instead of waiting for a rebuild.
//
// `platformProxy` gives `astro dev` the same D1/R2 bindings the deployed Worker
// gets, so local development runs against a real (local) database.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  site: 'https://echogallery.art',
});
