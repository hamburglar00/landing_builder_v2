import type { ConversionRow } from "@/lib/conversionsDb";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import {
  columnLabel,
  friendlyPixelAttributionSource,
  friendlyPurchaseType,
  friendlySourcePlatform,
  formatIntegerWithThousands,
  truncateId,
  type ConversionColumnKey,
} from "@/components/conversiones/conversionPageShared";
import type { DateRange } from "@/components/conversiones/DateRangeFilter";

type ExportConversionTablePdfOptions = {
  rows: ConversionRow[];
  columns: ConversionColumnKey[];
  filters: string[];
  workspaceName?: string;
};

const PAGE_MARGIN = 10;
const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 7.4;
const TABLE_HEADER_HEIGHT = 8.5;

function formatDateTime(value: string | number | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDateOnly(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatConversionPdfDateRange(range: DateRange | null): string {
  if (!range) return "Maximo";
  const start = formatDateOnly(range.start);
  const end = formatDateOnly(range.end);
  return start === end ? start : `${start} - ${end}`;
}

function valueForColumn(row: ConversionRow, column: ConversionColumnKey): string {
  const raw = row as unknown as Record<string, unknown>;
  switch (column) {
    case "timestamp":
      return formatDateTime(row.created_at);
    case "phone":
      return row.phone || "-";
    case "email":
      return row.email || "-";
    case "from_meta_ads":
      return row.from_meta_ads ? "Si" : "No";
    case "meta_pixel_id":
      return row.meta_pixel_id || row.pixel_id || "-";
    case "pixel_attribution_source":
      return friendlyPixelAttributionSource(row.pixel_attribution_source);
    case "pixel_attribution_conversion_id":
      return row.pixel_attribution_conversion_id ? truncateId(row.pixel_attribution_conversion_id) : "-";
    case "source_platform":
      return friendlySourcePlatform(row.source_platform);
    case "contact_event_time":
      return formatDateTime(row.contact_event_time);
    case "lead_event_time":
      return formatDateTime(row.lead_event_time);
    case "purchase_event_time":
      return formatDateTime(row.purchase_event_time);
    case "registration_event_time":
      return formatDateTime(row.registration_event_time);
    case "sendContactPixel":
      return row.sendContactPixel ? "Si" : "No";
    case "estado":
      return row.estado || "-";
    case "valor":
      return Number(row.valor || 0) > 0
        ? formatCurrencyAmount(Number(row.valor || 0), normalizeCurrencyCode(row.currency))
        : "-";
    case "currency":
      return normalizeCurrencyCode(row.currency);
    case "purchase_type":
      return friendlyPurchaseType(row.purchase_type);
    case "contact_payload_raw":
    case "lead_payload_raw":
    case "purchase_payload_raw":
    case "registration_payload_raw":
      return String(raw[column] ?? "").trim() ? "Ver payload tecnico" : "-";
    case "contact_event_id":
    case "lead_event_id":
    case "purchase_event_id":
    case "external_id":
    case "lead_attribution_conversion_id":
    case "purchase_attribution_conversion_id":
    case "registration_attribution_conversion_id": {
      const value = String(raw[column] ?? "").trim();
      return value ? truncateId(value) : "-";
    }
    case "clientIP":
      return row.client_ip || "-";
    case "agentuser":
      return row.agent_user || "-";
    default: {
      const value = raw[column];
      if (value === null || value === undefined || value === "") return "-";
      return String(value);
    }
  }
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}

export async function exportConversionTablePdf(options: ExportConversionTablePdfOptions): Promise<void> {
  const { rows, columns, filters, workspaceName } = options;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - PAGE_MARGIN * 2;
  const primary = [121, 255, 77] as const;
  const primaryDark = [9, 18, 24] as const;
  const secondaryDark = [13, 24, 32] as const;
  const tableHead = [20, 32, 43] as const;
  const border = [43, 58, 74] as const;
  const text = [225, 232, 240] as const;
  const muted = [139, 154, 173] as const;
  const paper = [7, 12, 18] as const;
  const rowEven = [12, 19, 27] as const;
  const rowOdd = [16, 24, 34] as const;

  const purchases = rows.filter((row) => row.estado === "purchase");
  const leads = rows.filter((row) => row.estado === "lead");
  const contacts = rows.filter((row) => row.estado === "contact");
  const currencies = Array.from(new Set(purchases.map((row) => normalizeCurrencyCode(row.currency))));
  const totalValue = purchases.reduce((sum, row) => sum + Number(row.valor || 0), 0);
  const totalValueLabel =
    currencies.length === 1
      ? formatCurrencyAmount(totalValue, currencies[0])
      : currencies.length === 0
        ? "-"
        : "Varias monedas";
  const title = "Conversiones - tabla reducida";
  const exportedAt = formatDateTime(new Date().toISOString());
  doc.setProperties({ title, subject: "Exportacion de conversiones filtradas" });

  const fitText = (value: string, maxWidth: number): string => {
    const clean = String(value ?? "").replace(/\s+/g, " ").trim();
    const lines = doc.splitTextToSize(clean || "-", Math.max(maxWidth, 4));
    return Array.isArray(lines) ? String(lines[0] ?? "-") : String(lines ?? "-");
  };
  const fitLines = (value: string, maxWidth: number, maxLines = 2): string[] => {
    const clean = String(value ?? "").replace(/\s+/g, " ").trim();
    const lines = doc.splitTextToSize(clean || "-", Math.max(maxWidth, 4));
    return (Array.isArray(lines) ? lines : [String(lines ?? "-")]).slice(0, maxLines).map(String);
  };
  const drawPageBackground = () => {
    doc.setFillColor(...paper);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  };
  const drawHeader = () => {
    doc.setFillColor(...primaryDark);
    doc.roundedRect(PAGE_MARGIN, 9, tableWidth, HEADER_HEIGHT, 4, 4, "F");
    doc.setFillColor(...primary);
    doc.rect(PAGE_MARGIN, 35, tableWidth, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text(title, PAGE_MARGIN + 8, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`Workspace: ${workspaceName || "-"}`, PAGE_MARGIN + 8, 29);
    doc.text(`Exportado: ${exportedAt}`, pageWidth - PAGE_MARGIN - 8, 29, { align: "right" });

    doc.setFontSize(7.2);
    let chipX = pageWidth - PAGE_MARGIN - 8;
    let chipY = 18;
    filters.slice().reverse().forEach((filter) => {
      const chipText = fitText(filter, 64);
      const chipWidth = Math.min(doc.getTextWidth(chipText) + 8, 68);
      if (chipX - chipWidth < PAGE_MARGIN + 108) {
        chipX = pageWidth - PAGE_MARGIN - 8;
        chipY += 7.2;
      }
      chipX -= chipWidth;
      doc.setFillColor(...secondaryDark);
      doc.setDrawColor(...border);
      doc.roundedRect(chipX, chipY - 4.5, chipWidth, 6.2, 3, 3, "FD");
      doc.setTextColor(...text);
      doc.text(chipText, chipX + 4, chipY);
      chipX -= 3;
    });
  };
  const drawSummary = (startY: number) => {
    const cards = [
      { label: "Registros", value: formatIntegerWithThousands(rows.length) },
      { label: "Contactos", value: formatIntegerWithThousands(contacts.length) },
      { label: "Leads", value: formatIntegerWithThousands(leads.length) },
      { label: "Purchases", value: formatIntegerWithThousands(purchases.length) },
      { label: "Total cargado", value: totalValueLabel },
    ];
    const gap = 3.2;
    const cardWidth = (tableWidth - gap * (cards.length - 1)) / cards.length;
    cards.forEach((card, index) => {
      const x = PAGE_MARGIN + index * (cardWidth + gap);
      doc.setFillColor(...secondaryDark);
      doc.setDrawColor(...border);
      doc.roundedRect(x, startY, cardWidth, 15.5, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.3);
      doc.setTextColor(...muted);
      doc.text(card.label.toUpperCase(), x + 4, startY + 5.2);
      doc.setFontSize(10.5);
      doc.setTextColor(...text);
      doc.text(fitText(card.value, cardWidth - 8), x + 4, startY + 11.8);
    });
  };

  const columnWeights = columns.map((column) => {
    if (column === "timestamp") return 1.28;
    if (column === "email" || column === "observaciones" || column === "utm_campaign") return 1.5;
    if (column === "telefono_asignado" || column === "assigned_gerencia_label") return 1.22;
    if (column === "valor") return 1.05;
    return 1;
  });
  const totalWeight = columnWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const normalizedColumns = columns.map((column, index) => ({
    key: column,
    label: columnLabel(column, "friendly"),
    width: (columnWeights[index] / totalWeight) * tableWidth,
  }));

  const drawTableHead = (startY: number) => {
    let x = PAGE_MARGIN;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.7);
    normalizedColumns.forEach((column) => {
      doc.setFillColor(...tableHead);
      doc.setDrawColor(...border);
      doc.rect(x, startY, column.width, TABLE_HEADER_HEIGHT, "FD");
      doc.setTextColor(...text);
      const labelLines = fitLines(column.label, column.width - 2.4, 2);
      doc.text(labelLines, x + 1.7, startY + (labelLines.length > 1 ? 3.4 : 5.5));
      x += column.width;
    });
  };

  const drawRow = (row: ConversionRow, startY: number, rowIndex: number) => {
    let x = PAGE_MARGIN;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    const fill: readonly [number, number, number] = rowIndex % 2 === 0 ? rowEven : rowOdd;
    normalizedColumns.forEach((column) => {
      doc.setFillColor(...fill);
      doc.setDrawColor(...border);
      doc.rect(x, startY, column.width, ROW_HEIGHT, "FD");
      const value = valueForColumn(row, column.key);
      doc.setTextColor(column.key === "valor" ? primary[0] : text[0], column.key === "valor" ? primary[1] : text[1], column.key === "valor" ? primary[2] : text[2]);
      doc.text(fitText(value, column.width - 2.2), x + 1.7, startY + 4.9);
      x += column.width;
    });
  };

  const drawFooter = (pageNumber: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(`Pagina ${pageNumber}`, pageWidth - PAGE_MARGIN, pageHeight - 5, { align: "right" });
  };

  let pageNumber = 1;
  drawPageBackground();
  drawHeader();
  drawSummary(45);
  let y = 67;
  drawTableHead(y);
  y += TABLE_HEADER_HEIGHT;

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text("No hay conversiones para los filtros aplicados.", PAGE_MARGIN, y + 10);
  } else {
    rows.forEach((row, index) => {
      if (y + ROW_HEIGHT > pageHeight - 12) {
        drawFooter(pageNumber);
        doc.addPage();
        pageNumber += 1;
        drawPageBackground();
        drawHeader();
        y = 46;
        drawTableHead(y);
        y += TABLE_HEADER_HEIGHT;
      }
      drawRow(row, y, index);
      y += ROW_HEIGHT;
    });
  }
  drawFooter(pageNumber);

  doc.save(safeFilename(`conversiones-tabla-reducida-${new Date().toISOString().slice(0, 10)}.pdf`));
}
