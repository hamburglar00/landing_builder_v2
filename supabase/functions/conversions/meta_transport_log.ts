/** Diagnostics only: never persist an endpoint URL, query string, or credentials. */
export type MetaTransportLogFields = {
  meta_api_version: string | null;
  meta_http_status: number | null;
  meta_attempt: number | null;
};

export function metaTransportLog(
  apiUrl: string,
  attempt: number,
  response?: Pick<Response, "status" | "headers">,
): MetaTransportLogFields {
  const reportedVersion = response?.headers.get("facebook-api-version")?.trim() ?? "";
  let requestedVersion = "";
  try { requestedVersion = new URL(apiUrl).pathname.split("/")[1] ?? ""; } catch { /* Diagnostics must not interrupt delivery. */ }
  const validVersion = (value: string) => /^v\d{1,3}\.\d{1,3}$/.test(value);
  return {
    meta_api_version: validVersion(reportedVersion) ? reportedVersion
      : validVersion(requestedVersion) ? requestedVersion : null,
    meta_http_status: response && Number.isInteger(response.status) && response.status >= 100 && response.status <= 599
      ? response.status : null,
    // Within this HTTP execution. A later cron execution starts at 1 again.
    meta_attempt: Number.isSafeInteger(attempt) && attempt > 0 ? attempt : null,
  };
}
