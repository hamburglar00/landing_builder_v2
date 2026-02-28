/**
 * Gerencia: id (PK), nombre, gerencia_id (entero para referencia externa).
 */
export interface Gerencia {
  id: number;
  nombre: string;
  gerencia_id: number | null;
}
