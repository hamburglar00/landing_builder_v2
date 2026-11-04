/**
 * Gerencia: id (PK), nombre, gerencia_id (entero obligatorio para invocar API externa).
 * user_id solo viene cuando se listan todas para admin (orden: propias primero, luego de clientes).
 */
import type { ReportingCurrency } from "@/lib/currency";
import type {DirectoryBot} from '@/lib/bots/directory';

export interface Gerencia {
  id: number;
  nombre: string;
  gerencia_id: number | null;
  workspace_currency?: ReportingCurrency;
  source_type?: "pbadmin" | "manual";
  fair_criterion?: "usage_count" | "messages_received";
  user_id?: string;
  pbadmin_bots?: DirectoryBot[];
  pbadmin_bots_synced_at?: string|null;
}

export interface GerenciaWorkGroup {
  id: number;
  user_id: string;
  name: string;
  workspace_currency?: ReportingCurrency;
  gerenciaIds: number[];
  created_at?: string;
  updated_at?: string;
}
