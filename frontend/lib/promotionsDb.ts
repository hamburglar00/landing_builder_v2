import { supabase } from "@/lib/supabaseClient";

export type PromotionStatus = "active" | "closed";

export interface PromotionRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  message: string;
  prize: string;
  draw_at: string;
  status: PromotionStatus;
  winner_participant_id: string | null;
  winner_username: string;
  winner_selected_at: string | null;
  winner_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionParticipantRow {
  id: string;
  promotion_id: string;
  user_id: string;
  username: string;
  phone: string;
  email: string;
  visitor_token: string;
  matched_conversion_count: number;
  matched_conversion_ids: string[];
  created_at: string;
}

export interface PromotionWithCount extends PromotionRow {
  participant_count: number;
}

export type PromotionInput = {
  user_id: string;
  title: string;
  slug: string;
  message: string;
  prize: string;
  draw_at: string;
  status: PromotionStatus;
};

const PROMOTIONS_SELECT =
  "id, user_id, title, slug, message, prize, draw_at, status, winner_participant_id, winner_username, winner_selected_at, winner_notified_at, created_at, updated_at";

export function slugifyPromotion(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || `promo-${Date.now().toString(36)}`;
}

export function formatLocalDateTimeForInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTimeInputToIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

async function fetchParticipantCount(promotionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("promotion_participants")
    .select("id", { count: "exact", head: true })
    .eq("promotion_id", promotionId);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchPromotions(userId: string): Promise<PromotionWithCount[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select(PROMOTIONS_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as PromotionRow[];
  const counts = await Promise.all(rows.map((row) => fetchParticipantCount(row.id)));
  return rows.map((row, index) => ({ ...row, participant_count: counts[index] ?? 0 }));
}

export async function fetchPromotionBySlug(slug: string): Promise<PromotionRow | null> {
  const { data, error } = await supabase
    .from("promotions")
    .select(PROMOTIONS_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as PromotionRow | null;
}

export async function createPromotion(input: PromotionInput): Promise<PromotionRow> {
  const { data, error } = await supabase
    .from("promotions")
    .insert(input)
    .select(PROMOTIONS_SELECT)
    .single();
  if (error) throw error;
  return data as PromotionRow;
}

export async function updatePromotion(id: string, input: Omit<PromotionInput, "user_id">): Promise<PromotionRow> {
  const { data, error } = await supabase
    .from("promotions")
    .update(input)
    .eq("id", id)
    .select(PROMOTIONS_SELECT)
    .single();
  if (error) throw error;
  return data as PromotionRow;
}

export async function deletePromotion(id: string): Promise<void> {
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPromotionParticipants(
  promotionId: string,
): Promise<PromotionParticipantRow[]> {
  const { data, error } = await supabase
    .from("promotion_participants")
    .select(
      "id, promotion_id, user_id, username, phone, email, visitor_token, matched_conversion_count, matched_conversion_ids, created_at",
    )
    .eq("promotion_id", promotionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PromotionParticipantRow[];
}
