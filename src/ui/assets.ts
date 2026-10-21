/**
 * Resolves a site-root asset path ("/artwork/x.webp") against the deployed
 * base URL, so the same data works at "/" locally and at "/<repo>/" on
 * GitHub Pages.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
