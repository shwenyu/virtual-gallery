// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

// A custom domain serves the site from the root, while a project page serves it
// from /<repo>/. Dropping public/CNAME in place is what switches between the two:
// GitHub Pages needs that file to bind the domain, so keying off it means the
// paths can never disagree with where the site is actually published.
const cnamePath = fileURLToPath(new URL('./public/CNAME', import.meta.url));
const customDomain = existsSync(cnamePath) ? readFileSync(cnamePath, 'utf8').trim() : '';

// When built inside GitHub Actions, GITHUB_REPOSITORY is "owner/repo".
// This lets the site work correctly at https://<owner>.github.io/<repo>/
// without hardcoding your username here.
const repository = process.env.GITHUB_REPOSITORY;
const [owner, repo] = repository ? repository.split('/') : [];

const site = customDomain
  ? `https://${customDomain}`
  : owner
    ? `https://${owner}.github.io`
    : undefined;

// A root user/organization site (repo named "<owner>.github.io") also lives at "/".
const base = customDomain || !repo || repo.endsWith('.github.io') ? '/' : `/${repo}/`;

// https://astro.build/config
export default defineConfig({
  site,
  base,
});
