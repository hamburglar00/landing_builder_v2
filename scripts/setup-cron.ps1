# Configura el cron de sync-phones (una sola vez).
# Uso: .\setup-cron.ps1 -SupabaseUrl "https://TU_PROJECT_REF.supabase.co" -BootstrapSecret "TU_BOOTSTRAP_SECRET"
# O con .env: lee SUPABASE_URL y BOOTSTRAP_SECRET si existen.

param(
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$BootstrapSecret = $env:BOOTSTRAP_SECRET
)

if (-not $SupabaseUrl -or -not $BootstrapSecret) {
  Write-Host "Uso: .\setup-cron.ps1 -SupabaseUrl 'https://TU_PROJECT_REF.supabase.co' -BootstrapSecret 'TU_BOOTSTRAP_SECRET'"
  Write-Host "O definí variables de entorno SUPABASE_URL y BOOTSTRAP_SECRET."
  exit 1
}

$url = $SupabaseUrl.TrimEnd('/') + '/functions/v1/bootstrap-cron-config'
$body = @{ bootstrap_secret = $BootstrapSecret } | ConvertTo-Json

try {
  $r = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $body
  Write-Host "OK: $($r.message)"
} catch {
  Write-Host "Error: $_"
  exit 1
}
