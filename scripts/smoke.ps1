$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8000'

function Call($method, $path, $body, $token) {
  $headers = @{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $params = @{ Uri = "$base$path"; Method = $method; Headers = $headers }
  if ($body) {
    $params.ContentType = 'application/json'
    $params.Body = ($body | ConvertTo-Json -Depth 6 -Compress)
  }
  try { $r = Invoke-RestMethod @params; return @{ ok = $true; data = $r } }
  catch {
    $code = $_.Exception.Response.StatusCode.value__
    $err = $_.ErrorDetails.Message
    return @{ ok = $false; code = $code; error = $err }
  }
}

Write-Output '1) health'
$h = Call 'GET' '/api/health' $null $null
Write-Output "   $($h.data | ConvertTo-Json -Compress)"

Write-Output '2) login as demo user'
$demoEmail = if ($env:DEMO_EMAIL) { $env:DEMO_EMAIL } else { 'demo@example.com' }
$demoPassword = if ($env:DEMO_PASSWORD) { $env:DEMO_PASSWORD } else { 'demo1234' }
$login = Call 'POST' '/api/auth/login' @{ email = $demoEmail; password = $demoPassword } $null
if (-not $login.ok) { Write-Output "   FAILED $($login.code): $($login.error)"; exit 1 }
$token = $login.data.access_token
Write-Output "   org=$($login.data.organization.name) role=$($login.data.user.role)"

Write-Output '3) me'
$me = Call 'GET' '/api/auth/me' $null $token
Write-Output "   $($me.data.user.email)"

Write-Output '4) products (search)'
$p = Call 'GET' '/api/products?q=Widget' $null $token
Write-Output "   total=$($p.data.meta.total)"
foreach ($item in $p.data.items) { Write-Output "   - $($item.sku) $($item.name) qty=$($item.total_quantity)" }

$productId = $p.data.items[0].id
$locationId = (Call 'GET' '/api/locations' $null $token).data.items[0].id

Write-Output '5) record an IN movement'
$m = Call 'POST' '/api/movements' @{ product_id = $productId; location_id = $locationId; type = 'in'; quantity = 40; reference = 'SMOKE-1' } $token
Write-Output "   movement #$($m.data.id) type=$($m.data.type) qty=$($m.data.quantity)"

Write-Output '6) record an OUT movement'
$o = Call 'POST' '/api/movements' @{ product_id = $productId; location_id = $locationId; type = 'out'; quantity = 5; reference = 'SMOKE-2' } $token
Write-Output "   movement #$($o.data.id) qty=$($o.data.quantity)"

Write-Output '7) over-draw is rejected'
$bad = Call 'POST' '/api/movements' @{ product_id = $productId; location_id = $locationId; type = 'out'; quantity = 99999 } $token
Write-Output "   http=$($bad.code) body=$($bad.error)"

Write-Output '8) product detail (stock across locations)'
$d = Call 'GET' "/api/products/$productId" $null $token
Write-Output "   total=$($d.data.total_quantity)"
foreach ($s in $d.data.stock) { Write-Output "   - $($s.location_name): $($s.quantity)" }

Write-Output '9) valuation report'
$v = Call 'GET' '/api/reports/valuation' $null $token
Write-Output "   cost=$($v.data.totals.total_cost_value) retail=$($v.data.totals.total_retail_value) units=$($v.data.totals.total_units)"

Write-Output '10) low stock report'
$l = Call 'GET' '/api/reports/low-stock' $null $token
Write-Output "   items=$($l.data.total) est_cost=$($l.data.estimated_cost)"
foreach ($i in $l.data.items) { Write-Output "   - $($i.sku) qty=$($i.quantity) reorder_at=$($i.reorder_point) supplier=$($i.supplier)" }

Write-Output '11) movement summary'
$ms = Call 'GET' '/api/reports/movement-summary' $null $token
foreach ($r in $ms.data.items) { Write-Output "   - $($r.type): $($r.movement_count) movements, $($r.total_quantity) units" }

Write-Output '12) tenant isolation (bad token)'
$iso = Call 'GET' '/api/products' $null 'not-a-real-jwt'
Write-Output "   http=$($iso.code) body=$($iso.error)"