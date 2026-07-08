import sharp from "sharp";
import { fetchPromotionBySlug, type PromotionRow } from "@/lib/promotionsDb";

type ShareImageRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

const WIDTH = 1200;
const HEIGHT = 630;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}…` : value;
}

function wrapText(value: string, maxLineLength: number, maxLines: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxLineLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && currentLine) lines.push(currentLine);
  if (lines.length > 0 && words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], maxLineLength);
  }
  return lines.slice(0, maxLines);
}

async function fetchBackgroundBuffer(promotion: PromotionRow | null): Promise<Buffer | null> {
  const backgroundUrl = cleanText(promotion?.background_image_url);
  if (!backgroundUrl) return null;

  try {
    const response = await fetch(backgroundUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function buildBaseSvg(hasBackground: boolean): Buffer {
  const content = hasBackground
    ? `<rect width="${WIDTH}" height="${HEIGHT}" fill="rgba(5,5,7,0.16)"/>`
    : `
      <rect width="${WIDTH}" height="${HEIGHT}" fill="#07070b"/>
      <circle cx="1030" cy="110" r="260" fill="#f59e0b" opacity="0.20"/>
      <circle cx="170" cy="540" r="270" fill="#78350f" opacity="0.42"/>
      <path d="M0 470 C220 410 385 650 620 560 C850 470 930 360 1200 420 L1200 630 L0 630 Z" fill="#111827" opacity="0.74"/>
      <g opacity="0.24" fill="none" stroke="#fbbf24" stroke-width="5">
        <rect x="830" y="235" width="250" height="132" rx="30" transform="rotate(-9 955 301)"/>
        <path d="M875 272 L1045 245 M888 326 L1060 300"/>
        <circle cx="870" cy="301" r="13"/>
        <circle cx="1040" cy="300" r="13"/>
      </g>
    `;

  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#050507" stop-opacity="0.50"/>
          <stop offset="55%" stop-color="#050507" stop-opacity="0.62"/>
          <stop offset="100%" stop-color="#050507" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      ${content}
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#shade)"/>
      <rect x="44" y="44" width="1112" height="542" rx="42" fill="none" stroke="#f59e0b" stroke-opacity="0.46" stroke-width="3"/>
    </svg>
  `);
}

function buildTextSvg(promotion: PromotionRow | null): Buffer {
  const title = cleanText(promotion?.title, "Sorteo Golden").toUpperCase();
  const message = cleanText(promotion?.message, "Completá tus datos y participá por premios exclusivos.");
  const prize = cleanText(promotion?.prize, "Premio sorpresa");
  const titleLines = wrapText(title, 17, 2);
  const messageLines = wrapText(message, 58, 2);
  const titleSize = titleLines.length > 1 ? 86 : 104;
  const titleStartY = titleLines.length > 1 ? 176 : 205;
  const messageStartY = titleStartY + titleLines.length * (titleSize * 0.92) + 22;

  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .eyebrow { fill: #fcd34d; font: 800 28px Arial, sans-serif; letter-spacing: 9px; }
        .title { fill: #ffffff; font: 950 ${titleSize}px Impact, 'Arial Black', Arial, sans-serif; letter-spacing: 2px; }
        .message { fill: #d4d4d8; font: 600 30px Arial, sans-serif; }
        .label { fill: #fcd34d; font: 800 23px Arial, sans-serif; letter-spacing: 7px; }
        .prize { fill: #fff7ed; font: 950 56px Impact, 'Arial Black', Arial, sans-serif; letter-spacing: 1px; }
        .brand { fill: #fbbf24; font: 900 26px Arial, sans-serif; letter-spacing: 7px; }
      </style>
      <text x="86" y="120" class="eyebrow">PARTICIPÁ POR</text>
      ${titleLines
        .map(
          (line, index) =>
            `<text x="84" y="${titleStartY + index * (titleSize * 0.92)}" class="title">${escapeXml(line)}</text>`,
        )
        .join("")}
      ${messageLines
        .map((line, index) => `<text x="88" y="${messageStartY + index * 42}" class="message">${escapeXml(line)}</text>`)
        .join("")}
      <g transform="translate(86 420)">
        <rect width="540" height="122" rx="28" fill="#f59e0b" fill-opacity="0.16" stroke="#f59e0b" stroke-opacity="0.72" stroke-width="3"/>
        <text x="34" y="47" class="label">PREMIO</text>
        <text x="34" y="101" class="prize">${escapeXml(truncate(prize, 20))}</text>
      </g>
      <g transform="translate(890 480)">
        <circle cx="54" cy="54" r="54" fill="#f59e0b"/>
        <path d="M31 54h46M54 31v46" stroke="#111827" stroke-width="13" stroke-linecap="round"/>
        <text x="-138" y="151" class="brand">SORTEOS GOLDEN</text>
      </g>
    </svg>
  `);
}

async function buildShareImage(promotion: PromotionRow | null): Promise<Buffer> {
  const backgroundBuffer = await fetchBackgroundBuffer(promotion);
  const base = backgroundBuffer
    ? sharp(backgroundBuffer).resize(WIDTH, HEIGHT, { fit: "cover", position: "center" })
    : sharp({
        create: {
          width: WIDTH,
          height: HEIGHT,
          channels: 4,
          background: "#07070b",
        },
      });

  return base
    .composite([
      { input: buildBaseSvg(Boolean(backgroundBuffer)), left: 0, top: 0 },
      { input: buildTextSvg(promotion), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

export async function GET(_request: Request, context: ShareImageRouteContext) {
  const { slug } = await context.params;
  const promotion = await fetchPromotionBySlug(slug).catch(() => null);
  const image = await buildShareImage(promotion);
  const body = image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) as ArrayBuffer;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
