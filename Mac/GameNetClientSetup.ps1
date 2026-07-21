# =========================================================
# اسکریپت مدیریت سیستم کلاینت (برای شبکه GameNet)
# 1) ثبت اطلاعات MAC/IP در مسیر شبکه
# 2) فعال‌سازی امکان Shutdown ریموت
# 3) باز کردن File and Printer Sharing در فایروال
# 4) فعال‌سازی Wake on LAN در سطح ویندوز (آداپتور شبکه)
# نکته: تنظیم WoL در BIOS باید دستی روی هر سیستم انجام شود
# این اسکریپت باید با دسترسی Administrator اجرا شود
# =========================================================

# --- بررسی دسترسی ادمین ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "این اسکریپت باید با دسترسی Administrator اجرا شود. لطفا PowerShell را Run as Administrator اجرا کنید."
    exit
}

# =========================================================
# 1) ثبت اطلاعات سیستم در مسیر شبکه
# =========================================================
$networkPath = "\\192.168.3.100\GameNet-Monitor\Mac"
$userName = $env:USERNAME
$logFile = Join-Path $networkPath ($userName + ".log")

try {
    $adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
    if ($adapter) {
        $macAddress = $adapter.MacAddress
        $ipInfo = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
        $ipAddress = if ($ipInfo) { $ipInfo.IPAddress } else { "Unknown" }
    } else {
        $macAddress = "Unknown"
        $ipAddress = "Unknown"
    }

    if (-not (Test-Path $networkPath)) {
        New-Item -ItemType Directory -Path $networkPath -Force | Out-Null
    }

    $logContent = @"
macadress: $macAddress
Ip Adress: $ipAddress
Computer Name: $env:COMPUTERNAME
User: $userName
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@

    $logContent | Out-File -FilePath $logFile -Encoding UTF8 -Force
    Write-Host "[OK] لاگ ذخیره شد: $logFile"
}
catch {
    Write-Host "[ERROR] ثبت لاگ: $($_.Exception.Message)"
}

# =========================================================
# 2) فعال‌سازی Remote Shutdown
# =========================================================
try {
    New-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" `
        -Name "LocalAccountTokenFilterPolicy" -Value 1 -PropertyType DWord -Force | Out-Null
    Write-Host "[OK] LocalAccountTokenFilterPolicy فعال شد (Remote Shutdown/Admin)."
}
catch {
    Write-Host "[ERROR] تنظیم رجیستری Remote Shutdown: $($_.Exception.Message)"
}

# باز کردن قوانین فایروال File and Printer Sharing
try {
    netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=yes | Out-Null
    Write-Host "[OK] فایروال برای File and Printer Sharing باز شد."
}
catch {
    Write-Host "[ERROR] تنظیم فایروال: $($_.Exception.Message)"
}

# =========================================================
# 3) فعال‌سازی Wake on LAN در سطح ویندوز (آداپتور شبکه)
# نکته: تنظیم معادل در BIOS هر سیستم باید دستی انجام شود
# =========================================================
try {
    $netAdapters = Get-CimInstance -ClassName Win32_NetworkAdapter | Where-Object { $_.NetEnabled -eq $true }
    foreach ($na in $netAdapters) {
        $powerMgmt = Get-CimInstance -ClassName MSPower_DeviceEnable -Namespace root\wmi -ErrorAction SilentlyContinue |
            Where-Object { $_.InstanceName -like "*$($na.PNPDeviceID)*" }
        if ($powerMgmt) {
            $powerMgmt.Enable = $true
            Set-CimInstance -InputObject $powerMgmt -ErrorAction SilentlyContinue
        }
    }
    Write-Host "[OK] تنظیمات Power Management برای Wake on LAN اعمال شد (در صورت پشتیبانی درایور)."
    Write-Host "[!] یادآوری: در BIOS هر سیستم باید Wake on LAN به صورت دستی روی ON تنظیم شود."
}
catch {
    Write-Host "[ERROR] تنظیم Wake on LAN: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== پایان اجرای اسکریپت ==="
