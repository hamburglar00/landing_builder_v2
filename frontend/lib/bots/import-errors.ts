export const DIRECTORY_UNAVAILABLE = "directory_unavailable";

// Compatibility with Atrio's already deployed bridge. Do not treat auth,
// transport or arbitrary provider failures as an unavailable directory.
export function isDirectoryUnavailable(
  status: number,
  payload: { error?: unknown; code?: unknown },
): boolean {
  return (
    status === 503 &&
    (payload.code === DIRECTORY_UNAVAILABLE ||
      payload.error ===
        "La importación requiere publicar el nuevo directorio en API2.")
  );
}

export class BotImportError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}
