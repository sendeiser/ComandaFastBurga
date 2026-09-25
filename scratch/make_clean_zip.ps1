$stage = "scratch\stage_bot"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item -Path "ComandaFast-Bot-Portatil\*" -Destination $stage -Recurse
$authFolder = Join-Path $stage "data\baileys_auth"
if (Test-Path $authFolder) { Remove-Item $authFolder -Recurse -Force }
Compress-Archive -Path "$stage\*" -DestinationPath "ComandaFast-Bot-Portatil.zip" -Force
Remove-Item $stage -Recurse -Force
Write-Output "Clean zip created: ComandaFast-Bot-Portatil.zip"
