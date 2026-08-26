export type TrackingFilterKind = "pixel" | "dataset";

type TrackingFilterRow = {
  meta_pixel_id?: unknown;
  pixel_id?: unknown;
  dataset_id?: unknown;
};

export function trackingFilterKindForSource(sourcePlatform: unknown): TrackingFilterKind {
  return String(sourcePlatform ?? "").trim().toLowerCase() === "whatsapp_cloud_api"
    ? "dataset"
    : "pixel";
}

export function trackingFilterLabel(kind: TrackingFilterKind): string {
  return kind === "dataset" ? "Dataset" : "Pixel";
}

export function trackingFilterAllLabel(kind: TrackingFilterKind): string {
  return kind === "dataset" ? "Todos los datasets" : "Todos los pixeles";
}

export function trackingFilterValue(row: TrackingFilterRow, kind: TrackingFilterKind): string {
  if (kind === "dataset") return String(row.dataset_id ?? "").trim();
  return String(row.meta_pixel_id ?? row.pixel_id ?? "").trim();
}
