declare module "meta-capi-param-builder-clientjs" {
  export function processAndCollectParams(url?: string): Record<string, string>;

  export function processAndCollectAllParams(
    url?: string,
    getIpFn?: () => Promise<string> | string,
  ): Promise<Record<string, string>>;

  export function getFbc(): string;
  export function getFbp(): string;
  export function getClientIpAddress(): string;
  export function getNormalizedAndHashedPII(
    piiValue: string,
    dataType: string,
  ): string | null;
}
