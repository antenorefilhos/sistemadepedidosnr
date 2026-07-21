function Run-Test {
    param($Name, $Url, $Method, $Body, $Token)
    Write-Host "`n--- Testing: $Name ---" -ForegroundColor Cyan
    $params = @{
        Uri = $Url
        Method = $Method
        ContentType = "application/json"
    }
    if ($Body) { $params.Body = $Body }
    if ($Token) { $params.Headers = @{ Authorization = "Bearer $Token" } }
    
    try {
        $response = Invoke-WebRequest @params -UseBasicParsing
        $status = [int]$response.StatusCode
        Write-Host "Status: $status" -ForegroundColor Green
        $content = $response.Content | ConvertFrom-Json
        return @{ Status = $status; Content = $content }
    } catch {
        $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "Unknown" }
        Write-Host "Error Status: $status" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "Response Body: $($reader.ReadToEnd())"
        }
        return @{ Status = $status; Content = $null }
    }
}

# 1. Login
$loginBody = @{ email = "admin@antenor.com.br"; password = "admin2026" } | ConvertTo-Json
$loginResult = Run-Test "Admin Login" "http://localhost:3001/auth/login" "POST" $loginBody
$token = $loginResult.Content.access_token

if (-not $token) {
    Write-Host "Failed to get access token. Stopping tests." -ForegroundColor Red
    exit
}

# 2. List products
Run-Test "List Admin Products" "http://localhost:3001/products/admin?page=1&limit=5" "GET" $null $token

# 3. Analytics Sales
Run-Test "Analytics Sales" "http://localhost:3001/orders/analytics/sales" "GET" $null $token

# 4. Analytics Status
Run-Test "Analytics Status" "http://localhost:3001/orders/analytics/status" "GET" $null $token

# 5. Integrations Status
Run-Test "Integrations Status" "http://localhost:3001/integrations/solidcom/status" "GET" $null $token

# 6. Top Products
Run-Test "Top Products" "http://localhost:3001/products/analytics/top?limit=5" "GET" $null $token
