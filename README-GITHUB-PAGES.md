## GitHub Pages copy

This is the static GitHub Pages build of Daily English. The Netlify production package remains separate and unchanged.

### Publish

1. Put these files at the root of the GitHub repository.
2. In Settings -> Pages, choose GitHub Actions as the build source.
3. Push the main branch. The workflow in .github/workflows/pages.yml publishes it.
4. In Supabase Authentication URL settings, allow the final GitHub Pages URL for email confirmation redirects.

This copy uses the Supabase publishable key in github-config.js. That key is intended for browser use; account data remains protected by the existing Row Level Security policies in supabase/schema.sql. Never put a Supabase secret/service-role key in the repository.

This build does not offer account deletion. The service worker uses a relative path so it also works when the project is hosted under a repository subpath.
