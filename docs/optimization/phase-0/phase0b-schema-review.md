# Revisión estructural final de Fase 0B

Estado: normalized_with_evidence; pendientes: 0. El orden físico de columnas es la única diferencia física ignorada. Cada diferencia de plataforma se acredita individualmente.

1. relations: public||conversions_config|

   Physical column order only; every named column attribute and every other relation property matches.

2. relations: public||conversions|

   Physical column order only; every named column attribute and every other relation property matches.

3. relations: public||gerencias|

   Physical column order only; every named column attribute and every other relation property matches.

4. relations: public||landings|

   Physical column order only; every named column attribute and every other relation property matches.

5. event_triggers: ||graphql_watch_ddl|

   Official local provider pg_graphql 1.5.11 and its own extension-member event triggers; absent remotely; application code contains no GraphQL calls. Optional provider API difference accepted explicitly; not application/security parity normalization.

6. event_triggers: ||graphql_watch_drop|

   Official local provider pg_graphql 1.5.11 and its own extension-member event triggers; absent remotely; application code contains no GraphQL calls. Optional provider API difference accepted explicitly; not application/security parity normalization.

7. extensions: graphql||pg_graphql|

   Official local provider pg_graphql 1.5.11 and its own extension-member event triggers; absent remotely; application code contains no GraphQL calls. Optional provider API difference accepted explicitly; not application/security parity normalization.

8. provider_hooks: extensions.grant_pg_net_access()

   Exact CLI 2.75.0 hook is retained. Its unconditional CREATE EXTENSION overrides are avoided only during native 0.19.5 installation on an empty isolated database with SET LOCAL event_triggers=false. Trigger is restored immediately. All 12 installed functions and all effective privileges of the five roles match remote after all 268 migrations. Future extension lifecycle changes must rerun this comparison; this is not a generic extension exclusion.

Los nombres, tipos, defaults, nulabilidad, constraints, índices, propietarios, ACL, RLS/FORCE RLS, políticas, funciones y triggers siguen comparándose. pg_net coincide exactamente en versión, namespace, las doce funciones miembro y seguridad de cinco roles, tablas y secuencia. Los snapshots remotos se revalidaron mediante consultas de metadata READ ONLY.

La diferencia del hook tiene límite explícito: ciclo de instalación de plataforma. Se evita en la instalación nativa inicial mediante SET LOCAL event_triggers=false; se restaura on antes del historial. Cualquier cambio futuro de extensión requiere nueva comprobación. No se normaliza ningún cambio desconocido de función, ACL o privilegio.

TRUNCATE y los grants PUBLIC de net se conservan como riesgos para la futura fase de seguridad. Definiciones, comparaciones y fingerprints completos: bootstrap-schema-diff.json, bootstrap-net-final-1.json y bootstrap-net-final-2.json.
