$ErrorActionPreference = 'Continue'

function Convert-ToPlainObject {
    param($Value, [int]$Depth = 0)

    if ($Depth -gt 10) {
        if ($null -eq $Value) { return $null }
        return [string]$Value
    }
    if ($null -eq $Value) { return $null }
    if ($Value -is [string] -or $Value -is [bool] -or $Value -is [byte] -or $Value -is [int16] -or $Value -is [uint16] -or $Value -is [int] -or $Value -is [uint32] -or $Value -is [long] -or $Value -is [int64] -or $Value -is [uint64] -or $Value -is [decimal] -or $Value -is [single] -or $Value -is [double]) {
        return $Value
    }
    if ($Value -is [datetime]) { return $Value.ToUniversalTime().ToString('o') }
    if ($Value -is [timespan] -or $Value -is [guid] -or $Value -is [version] -or $Value -is [enum]) { return $Value.ToString() }
    if ($Value -is [byte[]]) {
        return [ordered]@{
            encoding = 'base64'
            length = $Value.Length
            data = if ($Value.Length -le 4096) { [Convert]::ToBase64String($Value) } else { $null }
        }
    }
    if ($Value -is [System.Security.SecureString]) { return [ordered]@{ redacted = $true } }
    if ($Value -is [System.Collections.IDictionary]) {
        $map = [ordered]@{}
        foreach ($key in $Value.Keys) {
            $name = [string]$key
            if ([string]::IsNullOrWhiteSpace($name)) { continue }
            $map[$name] = Convert-ToPlainObject -Value $Value[$key] -Depth ($Depth + 1)
        }
        return $map
    }

    $typeNames = @()
    try { $typeNames = @($Value.PSObject.TypeNames) } catch { $typeNames = @() }
    if ($typeNames -match 'CimInstance') {
        $map = [ordered]@{}
        try {
            foreach ($property in $Value.CimInstanceProperties) {
                $map[$property.Name] = Convert-ToPlainObject -Value $property.Value -Depth ($Depth + 1)
            }
        } catch {
            foreach ($property in $Value.PSObject.Properties) {
                if ($property.Name -in @('CimClass', 'CimInstanceProperties', 'CimSystemProperties')) { continue }
                $map[$property.Name] = Convert-ToPlainObject -Value $property.Value -Depth ($Depth + 1)
            }
        }
        return $map
    }

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $arr = @()
        foreach ($item in $Value) {
            $arr += ,(Convert-ToPlainObject -Value $item -Depth ($Depth + 1))
        }
        return $arr
    }

    if ($null -ne $Value.PSObject -and $Value.PSObject.Properties.Count -gt 0) {
        $map = [ordered]@{}
        foreach ($property in $Value.PSObject.Properties) {
            if ($property.MemberType -notin @('NoteProperty', 'Property', 'AliasProperty')) { continue }
            if ($property.Name -in @('CimClass', 'CimInstanceProperties', 'CimSystemProperties', 'PSComputerName', 'RunspaceId', 'PSShowComputerName')) { continue }
            try {
                $map[$property.Name] = Convert-ToPlainObject -Value $property.Value -Depth ($Depth + 1)
            } catch {
                $map[$property.Name] = [string]$property.Value
            }
        }
        if ($map.Count -gt 0) { return $map }
    }

    return [string]$Value
}

function Invoke-Capture {
    param([scriptblock]$Block)
    try {
        $data = & $Block
        return [ordered]@{ ok = $true; data = (Convert-ToPlainObject -Value $data) }
    } catch {
        return [ordered]@{ ok = $false; error = $_.Exception.Message }
    }
}

function Get-RegistryTree {
    param([string]$Path, [int]$Depth = 0)
    if ($Depth -gt 4) { return [ordered]@{ truncated = $true } }
    if (-not (Test-Path -LiteralPath $Path)) { return $null }

    $map = [ordered]@{}
    try {
        $item = Get-ItemProperty -LiteralPath $Path -ErrorAction Stop
        foreach ($property in $item.PSObject.Properties) {
            if ($property.Name -in @('PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider')) { continue }
            $map[$property.Name] = Convert-ToPlainObject -Value $property.Value
        }
    } catch {}

    $children = [ordered]@{}
    try {
        Get-ChildItem -LiteralPath $Path -ErrorAction SilentlyContinue | ForEach-Object {
            $childName = $_.PSChildName
            $children[$childName] = Get-RegistryTree -Path (Join-Path $Path $childName) -Depth ($Depth + 1)
        }
    } catch {}
    if ($children.Count -gt 0) { $map['_children'] = $children }
    return $map
}

Import-Module PrintManagement -ErrorAction SilentlyContinue | Out-Null

$hostCapture = Invoke-Capture {
    $os = Get-CimInstance Win32_OperatingSystem -OperationTimeoutSec 8
    $computer = Get-CimInstance Win32_ComputerSystem -OperationTimeoutSec 8
    [ordered]@{
        os = Convert-ToPlainObject -Value $os
        computer = Convert-ToPlainObject -Value $computer
        powershell = $PSVersionTable.PSVersion.ToString()
        user = $env:USERNAME
        domain = $env:USERDOMAIN
        computerName = $env:COMPUTERNAME
    }
}

$defaultPrinter = $null
try {
    $defaultPrinter = (Get-CimInstance Win32_Printer -Filter 'Default=true' -OperationTimeoutSec 8 | Select-Object -First 1).Name
} catch {}

$printersRaw = @()
try {
    $printersRaw = @(Get-Printer -ErrorAction Stop)
} catch {
    try { $printersRaw = @(Get-CimInstance Win32_Printer -OperationTimeoutSec 8) } catch { $printersRaw = @() }
}

$portsCapture = Invoke-Capture { Get-PrinterPort }
if (-not $portsCapture.ok) {
    $portsCapture = Invoke-Capture { Get-CimInstance Win32_TCPIPPrinterPort -OperationTimeoutSec 8 }
}

$driversCapture = Invoke-Capture { Get-PrinterDriver }
if (-not $driversCapture.ok) {
    $driversCapture = Invoke-Capture { Get-CimInstance Win32_PrinterDriver -OperationTimeoutSec 8 }
}

$pnpCapture = Invoke-Capture { Get-PnpDevice -Class Printer, PrintQueue }
$pnpEntityCapture = Invoke-Capture {
    Get-CimInstance Win32_PnPEntity -OperationTimeoutSec 8 | Where-Object {
        $_.PNPClass -eq 'Printer' -or $_.Name -match 'Printer|Print'
    }
}

$printerRecords = @()
foreach ($printerObject in $printersRaw) {
    $plainPrinter = Convert-ToPlainObject -Value $printerObject
    $name = $null
    if ($plainPrinter.Name) { $name = [string]$plainPrinter.Name }
    elseif ($plainPrinter.DeviceID) { $name = [string]$plainPrinter.DeviceID }
    if ([string]::IsNullOrWhiteSpace($name)) { continue }

    $escaped = $name.Replace("'", "''")
    $errors = [ordered]@{}
    $sources = [ordered]@{ printer = $plainPrinter }

    $configuration = Invoke-Capture { Get-PrintConfiguration -PrinterName $name }
    if ($configuration.ok) { $sources.configuration = $configuration.data } else { $errors.configuration = $configuration.error }

    $properties = Invoke-Capture { Get-PrinterProperty -PrinterName $name }
    if ($properties.ok) { $sources.properties = $properties.data } else { $errors.properties = $properties.error }

    $jobs = Invoke-Capture { Get-PrintJob -PrinterName $name }
    if ($jobs.ok) { $sources.jobs = $jobs.data } else { $errors.jobs = $jobs.error }

    $win32Printer = Invoke-Capture { Get-CimInstance Win32_Printer -Filter ("Name='$escaped'") -OperationTimeoutSec 8 }
    if ($win32Printer.ok) { $sources.win32Printer = $win32Printer.data } else { $errors.win32Printer = $win32Printer.error }

    $win32Configuration = Invoke-Capture { Get-CimInstance Win32_PrinterConfiguration -Filter ("Name='$escaped'") -OperationTimeoutSec 8 }
    if ($win32Configuration.ok) { $sources.win32Configuration = $win32Configuration.data } else { $errors.win32Configuration = $win32Configuration.error }

    $driverName = $plainPrinter.DriverName
    if ($driverName) {
        $driver = Invoke-Capture { Get-PrinterDriver -Name $driverName }
        if ($driver.ok) {
            $sources.driver = $driver.data
        } else {
            $escapedDriver = ([string]$driverName).Replace("'", "''")
            $driverCim = Invoke-Capture { Get-CimInstance Win32_PrinterDriver -Filter ("Name='$escapedDriver'") -OperationTimeoutSec 8 }
            if ($driverCim.ok) { $sources.driver = $driverCim.data } else { $errors.driver = $driver.error }
        }
    }

    $portName = $plainPrinter.PortName
    if ($portName) {
        $port = Invoke-Capture { Get-PrinterPort -Name $portName }
        if ($port.ok) {
            $sources.port = $port.data
        } else {
            $escapedPort = ([string]$portName).Replace("'", "''")
            $portCim = Invoke-Capture { Get-CimInstance Win32_TCPIPPrinterPort -Filter ("Name='$escapedPort'") -OperationTimeoutSec 8 }
            if ($portCim.ok) { $sources.port = $portCim.data } else { $errors.port = $port.error }
        }
    }

    $msft = Invoke-Capture { Get-CimInstance -Namespace root/StandardCimv2 -ClassName MSFT_Printer -Filter ("Name='$escaped'") -OperationTimeoutSec 8 }
    if ($msft.ok) { $sources.msftPrinter = $msft.data } else { $errors.msftPrinter = $msft.error }

    $registry = Invoke-Capture { Get-RegistryTree -Path ("HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers\$name") }
    if ($registry.ok) { $sources.registry = $registry.data } else { $errors.registry = $registry.error }

    $printerRecords += ,[ordered]@{
        name = $name
        sources = $sources
        errors = $errors
    }
}

[ordered]@{
    host = $hostCapture
    defaultPrinter = $defaultPrinter
    printers = $printerRecords
    catalogs = [ordered]@{
        ports = $portsCapture
        drivers = $driversCapture
        pnpPrinters = $pnpCapture
        pnpEntities = $pnpEntityCapture
    }
} | ConvertTo-Json -Depth 20 -Compress
