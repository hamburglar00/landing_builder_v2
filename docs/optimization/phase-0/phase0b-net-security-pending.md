# Bloqueo restante: seguridad de pg_net

<!-- phase0b-pg-net-current:start -->
## Estado vigente después de resolver pg_net

Fase 0B cerrada. Dos reconstrucciones de 268/268, fingerprints iguales, 446 comprobaciones distintas aprobadas y cero diferencias pendientes. pg_net 0.19.5 se instala nativamente en la base local vacía; sus funciones y permisos coinciden con remoto. Detalle: phase0b-bootstrap-report.md y phase0b-pg-net-resolution.md. No se inició Fase 0C ni Fase 1.

Los resultados inferiores son antecedentes históricos; no reemplazan este dictamen.
<!-- phase0b-pg-net-current:end -->


La capa autorizada reproduce correctamente rls_auto_enable, ensure_rls y el estado de las cuatro tablas. La comprobación adicional exigida para normalizar pg_net encontró diferencias que afectan seguridad y no pueden tratarse como una diferencia de namespace.

| Función | Local | Remoto |
| --- | --- | --- |
| net.http_get(text,jsonb,jsonb,integer) | SECURITY DEFINER; search_path=net | SECURITY INVOKER; sin search_path fijado |
| net.http_post(text,jsonb,jsonb,jsonb,integer) | SECURITY DEFINER; search_path=net | SECURITY INVOKER; sin search_path fijado |

Ambas conservan el mismo cuerpo y propietario supabase_admin. Sin embargo, las ACL locales conceden EXECUTE explícitamente a supabase_admin, supabase_functions_admin, postgres, anon, authenticated y service_role; el ACL remoto es NULL, que utiliza los permisos predeterminados de función, incluido EXECUTE a PUBLIC. Esto cambia el contexto de ejecución y el alcance de acceso. No se normaliza NULL como equivalente a la lista local.

La diferencia surge al comparar las doce funciones miembro de la extensión. Diez coinciden; estas dos no. Las definiciones completas, sin credenciales, están en bootstrap-net-security-local.json y bootstrap-net-security-remote.json. El resumen es bootstrap-net-security-diff.json; la consulta READ ONLY está en scripts/phase0/bootstrap-net-security.sql. No se invocaron estas funciones ni se generó tráfico HTTP para probarlas.

El comparador deja pendientes tanto las dos entradas de extnamespace de pg_net como las dos funciones concretas, en lugar de declarar válida la excepción de plataforma. Se aceptan individualmente los tres objetos GraphQL acreditados y el orden físico de columnas; ninguna diferencia de RLS, ACL, función o trigger se oculta.

No se alteraron las funciones net ni sus permisos. La autorización concreta de reproducción cubre los objetos RLS y las cuatro tablas enumeradas; pg_net pertenece al runtime del proveedor. Adaptar su SECURITY DEFINER/INVOKER, search_path y ACL requiere una decisión adicional, con revisión de los privilegios dependientes del esquema net para no introducir otra divergencia de comportamiento. No basta con reescribir el hash o aceptar el mismo número de versión de extensión.

Fase 0B permanece bloqueada por estas dos funciones. No es un defecto del replay de las 268 migraciones ni un fallo de las pruebas de acceso a las cuatro tablas. No se propone modificar producción, optimizar o iniciar Fase 0C/Fase 1.
