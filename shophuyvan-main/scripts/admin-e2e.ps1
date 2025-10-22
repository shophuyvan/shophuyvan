
# admin-e2e.ps1
param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [Parameter(Mandatory=$true)][string]$AdminToken
)

function New-Idem { "idem-"+(Get-Date -UFormat %s)+"-"+([Guid]::NewGuid().ToString('n').Substring(0,6)) }

Write-Host "Base: $BaseUrl"

# 1) Create order
$headers = @{ "Idempotency-Key" = (New-Idem) }
$bodyObj = @{
  customer = @{ name="E2E User"; phone="0909"; address="12 X"; province_code="79"; district_code="769"; commune_code="00001" }
  items = @(@{ name="Áo thun"; price=120000; qty=2 })
  totals = @{ shipping_fee = 15000 }
}
$body = $bodyObj | ConvertTo-Json -Depth 6 -Compress
$orderRes = Invoke-RestMethod -Uri "$BaseUrl/api/orders" -Method Post -ContentType "application/json" -Headers $headers -Body $body
if(-not $orderRes.ok){ throw "Create order failed" }
$orderId = $orderRes.id
Write-Host "Created order:" $orderId

# 2) Admin list orders (auth)
$adminH = @{ "x-token" = $AdminToken }
$list = Invoke-RestMethod -Uri "$BaseUrl/api/orders" -Method Get -Headers $adminH
if(-not $list.ok){ throw "Admin list failed" }
$latest = $list.items[0]
Write-Host "Latest order id:" $latest.id

# 3) Create waybill
$wbHeaders = @{ "Idempotency-Key" = (New-Idem); "x-token" = $AdminToken }
$wbBody = @{ order_id = $latest.id } | ConvertTo-Json -Compress
$wb = Invoke-RestMethod -Uri "$BaseUrl/admin/shipping/create" -Method Post -ContentType "application/json" -Headers $wbHeaders -Body $wbBody
$wb | ConvertTo-Json -Depth 6
