/**
 * Gerencia: id (PK), nombre, gerencia_id (entero obligatorio para invocar API externa).
 * user_id solo viene cuando se listan todas para admin (orden: propias primero, luego de clientes).
 */
export interface Gerencia {
  id: number;
  nombre: string;
  gerencia_id: number | null;
  source_type?: "pbadmin" | "manual";
  fair_criterion?: "usage_count" | "messages_received";
  user_id?: string;
}

export interface GerenciaWorkGroup {
  id: number;
  user_id: string;
  name: string;
  gerenciaIds: number[];
  created_at?: string;
  updated_at?: string;
}
