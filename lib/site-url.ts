// Resolves the site's canonical base URL for use in metadataBase, robots, and
// sitemap. Priority:
//   1. NEXT_PUBLIC_SITE_URL — explicit override for hosted deployments.
//   2. Scriptlook's custom production domain on production Vercel builds.
//   3. VERCEL_PROJECT_PRODUCTION_URL — auto-set by Vercel to the production
//      alias. Works without manual config.
//   4. localhost fallback for dev.
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return stripTrailingSlash(explicit);

  if (process.env.VERCEL_ENV === "production") {
    return "https://www.scriptlook.com";
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${stripTrailingSlash(vercel)}`;

  return "http://localhost:3000";
}

function stripTrailingSlash(u: string): string {
  return u.endsWith("/") ? u.slice(0, -1) : u;
}
