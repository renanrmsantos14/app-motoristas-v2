$keyPath = Join-Path $PSScriptRoot "DriverRecordSharing.snk"

if (Test-Path $keyPath) {
    Write-Host "Strong-name key already exists at $keyPath"
    exit 0
}

$rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider 2048
[System.IO.File]::WriteAllBytes($keyPath, $rsa.ExportCspBlob($true))

Write-Host "Strong-name key created at $keyPath"
