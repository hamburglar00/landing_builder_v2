# Excepción autorizada: sincronización de conversions_internal_id_seq

La autorización del usuario permite corregir exclusivamente la expresión setval de `20260325201000_add_internal_id_to_conversions.sql`. La columna numérica es `internal_id`; `id` es UUID. No se modifica el backfill, el índice, la secuencia declarada ni los datos existentes.

Antes de modificar, PostgreSQL confirmó mínimo 1, inicio 1 e incremento 1, mediante metadata en una transacción remota READ ONLY. Evidencia: `bootstrap-sequence-remote-proof.json`. Los tests consultan también el mínimo real de cada secuencia local, incluyendo un caso con mínimo 37.

## Diferencia exacta

Argumentos anteriores de setval:

```sql
coalesce((select max(internal_id) from public.conversions), 0),
true
```

Argumentos corregidos:

```sql
coalesce(
  (select max(internal_id) from public.conversions),
  (select seqmin from pg_sequence where seqrelid = 'public.conversions_internal_id_seq'::regclass)
),
exists (select 1 from public.conversions)
```

La causa histórica es setval(0, true) sobre una secuencia cuyo mínimo es 1. En vacío se usa el mínimo del catálogo e is_called=false: el primer nextval devuelve ese mínimo. Si hay filas, el backfill previo asegura internal_id no nulo; se conserva MAX(internal_id), is_called=true y el siguiente valor MAX+1. No se insertan filas para permitir el bootstrap.

## Procedencia y hashes

- MD5 de la serialización del ledger remoto histórico: `309aa67e73dffb3b91235f037f9a140c` (seis statements).
- SHA256 del archivo histórico en Git: `27e0a385c7790d07449435fb89faa30efa9df0a789ef36803dbaf12971c37f12`.
- SHA256 del archivo local corregido: `9a97b61ee91045c20fb62f9daddd1124592ceb8f2bd389b2aebf6e1eef233b9f`.

Las serializaciones remota y de archivo son distintas; no se comparan sus hashes como si fueran el mismo formato. La excepción y el nuevo hash se registran explícitamente en el manifiesto, cuyo sello se actualizó por esta autorización concreta.

## Pruebas reproducibles

Comando: `node scripts/phase0/run-sequence-contracts.mjs`.

Se ejecuta el archivo histórico completo y el corregido en fixtures independientes del bootstrap, exclusivamente en una base temporal local aislada. Se comparan las filas antes y después, is_called y nextval. Resultado: seis casos aprobados, cero fallidos.

| Caso | Histórica | Corregida |
| --- | --- | --- |
| Vacía, mínimo 1 | Error esperado fuera de rango | nextval=1, is_called previo=false |
| Una fila, ID numérico 7 | nextval=8 | nextval=8 |
| IDs no consecutivos 2, 9, 31 | nextval=32 | nextval=32 |
| Secuencia atrasada, IDs 4 y 19 | nextval=20 | nextval=20 |
| Secuencia adelantada, mismos IDs | nextval=20 | nextval=20 |
| Vacía, mínimo 37 | Error esperado fuera de rango | nextval=37, is_called previo=false |

En los cuatro escenarios poblados ambas variantes conservan exactamente las filas del fixture y el mismo siguiente valor. La secuencia adelantada conserva el comportamiento histórico de sincronizar al máximo; no se cambia esa regla. Los errores históricos esperados forman parte de las aserciones, no son pruebas fallidas.

Los resultados completos están en `bootstrap-sequence-contracts.json`. Las reconstrucciones consecutivas del historial completo se informan separadamente en `bootstrap-validation.json`; estos seis casos no prueban por sí solos que las 268 migraciones finalicen.
