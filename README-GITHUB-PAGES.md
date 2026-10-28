## GitHub Pages copy

This is the static GitHub Pages build of Daily English. The Netlify production package remains separate and unchanged.

### Publish

1. Put these files at the root of the GitHub repository.
2. In Settings -> Pages, choose GitHub Actions as the build source.
3. Push the main branch. The workflow in .github/workflows/pages.yml publishes it.
4. In Supabase Authentication URL settings, allow the final GitHub Pages URL for email confirmation redirects.

This copy uses the Supabase publishable key in github-config.js. That key is intended for browser use; account data remains protected by the existing Row Level Security policies in supabase/schema.sql. Never put a Supabase secret/service-role key in the repository.

This build does not offer account deletion. The service worker uses a relative path so it also works when the project is hosted under a repository subpath.

### Progress safety for future releases

- Keep the project URL and hosting origin unchanged. Browser progress is stored locally by origin; replacing site files does not clear it.
- For every app release, increment `BUILD_VERSION` in `storage-service.js` before changing data behavior. On the first load of a new build, the app snapshots all four progress stores before other scripts can write to them. Keep this version bump in the release checklist.
- Increment the cache name in `sw.js` when replacing cached app assets. Service worker cache cleanup must not remove local storage or the safety-backup keys.
- Before replacing local progress with a cloud copy, the app saves a recovery snapshot. If local data and cloud data cannot be safely compared, it asks the user to choose instead of silently discarding one side.
- In Profile, use **Download copy** before a large release or when moving between GitHub Pages and Netlify. Those hosts have different browser origins. The same account can sync progress across them when cloud sync is configured; the JSON copy can also be restored from Profile.