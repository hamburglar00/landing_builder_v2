/** Query selection applies only to public constructor landing entry points. */
export function constructorLandingOverride(url: URL): { pathname: string } | null | "invalid" {
  if (url.pathname !== "/" && !/^\/l(?:\/[^/]+)?\/?$/.test(url.pathname)) return null;

  const values = url.searchParams.getAll("landing");
  if (!values.length || (values.length === 1 && !values[0].trim())) return null;
  if (values.length !== 1) return "invalid";

  const slug = values[0].trim();
  if (slug.length > 160 || /[\x00-\x1f\x7f/\\?#%]/.test(slug) || slug === "." || slug === "..") {
    return "invalid";
  }
  return { pathname: `/l/${encodeURIComponent(slug)}` };
}
