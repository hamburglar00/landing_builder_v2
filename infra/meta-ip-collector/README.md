# Meta client IP collector

Colector dual-stack para obtener la IP pública que el navegador usa al llegar al
edge y emitir una prueba HMAC de corta duración. Los motores de landing solo
priorizan esta IP sobre la observada por Vercel cuando la firma es válida.

## Despliegue

1. Autenticar Wrangler con la cuenta de Cloudflare:

   ```bash
   npx wrangler login
   ```

2. Instalar dependencias y configurar un secreto aleatorio de al menos 32 bytes:

   ```bash
   npm install
   npx wrangler secret put META_IP_PROOF_SECRET
   ```

3. Desplegar:

   ```bash
   npm run deploy
   ```

4. Configurar el mismo secreto como `META_IP_PROOF_SECRET` en ambos proyectos
   Vercel y la URL pública del Worker como
   `NEXT_PUBLIC_META_IP_COLLECTOR_URL`.

Mientras esas variables no existan, ambos motores conservan el comportamiento
actual y usan la IP pública observada por Vercel.
