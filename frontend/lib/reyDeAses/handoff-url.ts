/** Extra query data is not an access credential. Validate only our protocol
 * fields, then construct the URL that is allowed to authorize navigation. */
export function canonicalStartHandoffUrl(raw: string, expectedOrigin: string): string {
  const url = new URL(raw);
  const token = url.searchParams.get("t");
  const funnel = url.searchParams.get("ef");
  if (url.protocol !== "https:" || url.origin !== expectedOrigin || url.pathname !== "/start" ||
      url.username || url.password || url.hash || url.searchParams.getAll("t").length !== 1 ||
      !token || token.length > 12000 || url.searchParams.getAll("ef").length > 1 ||
      (url.searchParams.has("ef") && !/^e1\.[A-Za-z0-9_-]{1,2000}$/.test(funnel!))) {
    throw new Error("unexpected handoff");
  }
  url.search = "";
  url.searchParams.set("t", token);
  if (funnel) url.searchParams.set("ef", funnel);
  return url.href;
}
