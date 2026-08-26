// @ts-check
import { defineConfig } from 'astro/config';

// When built inside GitHub Actions, GITHUB_REPOSITORY is "owner/repo".
// This lets the site work correctly at https://<owner>.github.io/<repo>/
// without hardcoding your username here.
const repository = process.env.GITHUB_REPOSITORY;
const [owner, repo] = repository ? repository.split('/') : [];

const site = owner ? `https://${owner}.github.io` : undefined;
// If you deploy to a root user/organization site (repo named "<owner>.github.io"),
// base should be "/" instead — this handles that automatically.
const base = repo && !repo.endsWith('.github.io') ? `/${repo}/` : '/';

// https://astro.build/config
export default defineConfig({
  site,
  base,
});
