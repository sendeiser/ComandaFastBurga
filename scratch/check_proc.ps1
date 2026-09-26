Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*whatsapp*" } | Select-Object ProcessId, CommandLine
