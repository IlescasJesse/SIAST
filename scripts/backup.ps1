<#
.SYNOPSIS
  Respaldo y restauración de SIAST — base de datos MySQL + configuración.
.DESCRIPTION
  Crea snapshots de la base de datos siast_db usando mysqldump.
  También respalda archivos de configuración clave (.env, schema.prisma).
  Rotación automática: conserva solo los últimos N backups.
.PARAMETER Action
  Acción a ejecutar: backup | restore | list | clean
.PARAMETER Keep
  Número de backups a conservar (default: 10, usado con clean o backup)
.PARAMETER Name
  Nombre específico del backup para restore (opcional, si se omite lista y pide elegir)
.PARAMETER BackupDir
  Directorio donde guardar los backups (default: ./backups/)
.EXAMPLE
  .\scripts\backup.ps1 -Action backup
  .\scripts\backup.ps1 -Action restore
  .\scripts\backup.ps1 -Action list
  .\scripts\backup.ps1 -Action clean -Keep 5
#>

param(
  [ValidateSet("backup", "restore", "list", "clean")]
  [string]$Action = "backup",

  [int]$Keep = 10,

  [string]$Name = "",

  [string]$BackupDir = ""
)

# ─── Configuración ────────────────────────────────────────────────
$PROJECT_ROOT = Resolve-Path "$PSScriptRoot/.."
$DEFAULT_BACKUP_DIR = Join-Path $PROJECT_ROOT "backups"

if (-not $BackupDir) { $BackupDir = $DEFAULT_BACKUP_DIR }

$MYSQL_DUMP = "C:\xampp\mysql\bin\mysqldump.exe"
$MYSQL = "C:\xampp\mysql\bin\mysql.exe"
$DB_HOST = "localhost"
$DB_PORT = 3306
$DB_USER = "root"
$DB_PASS = ""
$DB_NAME = "siast_db"

$CONFIG_FILES = @(
  "apps/api/.env",
  "packages/database/.env",
  "packages/database/prisma/schema.prisma",
  "package.json",
  "apps/api/package.json"
)

# ─── Helper: timestamp ─────────────────────────────────────────────
function Get-Timestamp {
  return Get-Date -Format "yyyyMMdd_HHmmss"
}

function Get-HumanDate {
  return Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

# ─── Helper: verificar mysqldump ───────────────────────────────────
function Test-MySQLDump {
  if (-not (Test-Path $MYSQL_DUMP)) {
    Write-Error "No se encuentra mysqldump en: $MYSQL_DUMP"
    Write-Host "Verifica que XAMPP esté instalado o ajusta la ruta en el script." -ForegroundColor Yellow
    return $false
  }
  return $true
}

# ─── Listar backups ─────────────────────────────────────────────────
function Get-Backups {
  param([switch]$Json)

  if (-not (Test-Path $BackupDir)) {
    if (-not $Json) { Write-Host "No hay directorio de backups aún." -ForegroundColor Yellow }
    return @()
  }

  $backups = Get-ChildItem -Path $BackupDir -Filter "*.sql.gz" -File | Sort-Object LastWriteTime -Descending

  $result = foreach ($b in $backups) {
    $infoFile = [System.IO.Path]::ChangeExtension($b.FullName, ".json")
    $size = "{0:N2} MB" -f ($b.Length / 1MB)
    $meta = @{}
    if (Test-Path $infoFile) {
      try { $meta = Get-Content $infoFile -Raw | ConvertFrom-Json } catch {}
    }
    [PSCustomObject]@{
      Name     = $b.BaseName -replace '\.sql$', ''
      File     = $b.Name
      Size     = $size
      SizeBytes = $b.Length
      Date     = $b.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
      Created  = if ($meta.created) { $meta.created } else { "—" }
      Note     = if ($meta.note) { $meta.note } else { "—" }
    }
  }

  if ($Json) { return $result }

  if ($result.Count -eq 0) {
    Write-Host "No hay backups disponibles en: $BackupDir" -ForegroundColor Yellow
    return @()
  }

  Write-Host "`n📦 Backups disponibles:" -ForegroundColor Cyan
  Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
  $i = 1
  foreach ($b in $result) {
    Write-Host "[$i] $($b.Name)" -ForegroundColor White
    Write-Host "    Archivo : $($b.File)  ($($b.Size))" -ForegroundColor Gray
    Write-Host "    Fecha   : $($b.Date)" -ForegroundColor Gray
    if ($b.Note -ne "—") { Write-Host "    Nota    : $($b.Note)" -ForegroundColor Gray }
    $i++
  }
  Write-Host ""

  return $result
}

# ─── Backup ─────────────────────────────────────────────────────────
function Invoke-Backup {
  Write-Host "`n📀 Iniciando respaldo de SIAST..." -ForegroundColor Cyan
  Write-Host "  $(Get-HumanDate)" -ForegroundColor Gray

  # Crear directorio
  if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "  ✓ Directorio creado: $BackupDir" -ForegroundColor Green
  }

  if (-not (Test-MySQLDump)) { return }

  # 1. Backup de base de datos
  $timestamp = Get-Timestamp
  $backupName = "siast_$timestamp"
  $sqlFile = Join-Path $BackupDir "$backupName.sql"
  $gzFile = "$sqlFile.gz"

  Write-Host "  💾 Respaldando base de datos: $DB_NAME" -ForegroundColor Yellow

  $dumpArgs = @(
    "-h", $DB_HOST,
    "-P", $DB_PORT,
    "-u", $DB_USER,
    "--routines",
    "--triggers",
    "--events",
    "--single-transaction",
    "--quick",
    "--lock-tables=false",
    "--set-charset",
    $DB_NAME
  )

  if ($DB_PASS) {
    $dumpArgs = @("-h", $DB_HOST, "-P", $DB_PORT, "-u", $DB_USER, "-p$DB_PASS",
      "--routines", "--triggers", "--events", "--single-transaction",
      "--quick", "--lock-tables=false", "--set-charset", $DB_NAME)
  }

  try {
    $output = & $MYSQL_DUMP @dumpArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Error "mysqldump falló: $output"
      return
    }
    $output | Out-File -FilePath $sqlFile -Encoding utf8NoBOM
    Write-Host "  ✓ Dump SQL creado: $($sqlFile)" -ForegroundColor Green

    # Comprimir
    if (Get-Command gzip -ErrorAction SilentlyContinue) {
      gzip -f $sqlFile
      Write-Host "  ✓ Comprimido: $($gzFile)" -ForegroundColor Green
      $finalFile = $gzFile
    } else {
      Write-Host "  ⚠ gzip no disponible, se deja sin comprimir" -ForegroundColor Yellow
      $finalFile = $sqlFile
    }
  } catch {
    Write-Error "Error durante el dump: $_"
    return
  }

  # 2. Backup de archivos de configuración
  $configBackupDir = Join-Path $BackupDir "$backupName-config"
  New-Item -ItemType Directory -Path $configBackupDir -Force | Out-Null

  foreach ($relPath in $CONFIG_FILES) {
    $fullPath = Join-Path $PROJECT_ROOT $relPath
    if (Test-Path $fullPath) {
      $destDir = (Join-Path $configBackupDir (Split-Path $relPath -Parent))
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
      Copy-Item -Path $fullPath -Destination (Join-Path $configBackupDir $relPath) -Force
    }
  }
  Write-Host "  ✓ Configuración respaldada en: $configBackupDir" -ForegroundColor Green

  # 3. Metadata
  $meta = @{
    created    = (Get-HumanDate)
    database   = $DB_NAME
    host       = "$DB_HOST:$DB_PORT"
    sizeBytes  = (Get-Item $finalFile).Length
    files      = @($CONFIG_FILES)
    note       = "Backup automático SIAST"
  }
  $metaFile = [System.IO.Path]::ChangeExtension($finalFile, ".json")
  $meta | ConvertTo-Json | Set-Content $metaFile -Encoding utf8
  Write-Host "  ✓ Metadata guardada" -ForegroundColor Green

  # 4. Rotación
  Invoke-Clean -Keep $Keep -Silent

  # 5. Resumen
  $size = "{0:N2} MB" -f ((Get-Item $finalFile).Length / 1MB)
  Write-Host "`n✅ Respaldo completado: $backupName ($size)" -ForegroundColor Green
  Write-Host "   Ruta: $finalFile" -ForegroundColor Gray
}

# ─── Restore ───────────────────────────────────────────────────────
function Invoke-Restore {
  $backups = Get-Backups
  if ($backups.Count -eq 0) { return }

  $selected = $null

  if ($Name) {
    $selected = $backups | Where-Object { $_.Name -eq $Name -or $_.File -eq $Name } | Select-Object -First 1
    if (-not $selected) { Write-Error "No se encontró backup con nombre: $Name"; return }
  } else {
    $choice = Read-Host "Selecciona el número de backup a restaurar (1-$($backups.Count))"
    $idx = [int]::TryParse($choice, [ref]$null) ? [int]$choice : -1
    if ($idx -lt 1 -or $idx -gt $backups.Count) { Write-Error "Selección inválida"; return }
    $selected = $backups[$idx - 1]
  }

  Write-Host "`n⚠  VAS A RESTAURAR: $($selected.Name)" -ForegroundColor Red
  Write-Host "   Fecha : $($selected.Date)" -ForegroundColor Yellow
  Write-Host "   Tamaño: $($selected.Size)" -ForegroundColor Yellow
  $confirm = Read-Host "`n¿Continuar? (s/N)"
  if ($confirm -ne "s" -and $confirm -ne "S") { Write-Host "Restauración cancelada." -ForegroundColor Yellow; return }

  $sqlFile = Join-Path $BackupDir $selected.File
  $configDir = Join-Path $BackupDir "$($selected.Name)-config"

  # Descomprimir si es necesario
  $restoreFile = $sqlFile
  if ($sqlFile -like "*.gz") {
    if (Get-Command gzip -ErrorAction SilentlyContinue) {
      Write-Host "  Descomprimiendo..." -ForegroundColor Yellow
      gzip -dkf $sqlFile
      $restoreFile = $sqlFile -replace '\.gz$', ''
    } else {
      Write-Error "No se puede descomprimir (gzip no disponible): $sqlFile"
      return
    }
  }

  # Verificar que mysql esté disponible
  if (-not (Test-Path $MYSQL)) {
    Write-Error "No se encuentra mysql en: $MYSQL"
    return
  }

  # Restaurar base de datos
  Write-Host "  Restaurando base de datos: $DB_NAME" -ForegroundColor Yellow

  $mysqlArgs = @("-h", $DB_HOST, "-P", $DB_PORT, "-u", $DB_USER, $DB_NAME)
  if ($DB_PASS) { $mysqlArgs = @("-h", $DB_HOST, "-P", $DB_PORT, "-u", $DB_USER, "-p$DB_PASS", $DB_NAME) }

  try {
    $type = Get-Content $restoreFile -TotalCount 1
    Get-Content $restoreFile -Raw | & $MYSQL @mysqlArgs 2>&1
    if ($LASTEXITCODE -ne 0) { throw "mysql restore falló con código $LASTEXITCODE" }
    Write-Host "  ✓ Base de datos restaurada" -ForegroundColor Green
  } catch {
    Write-Error "Error al restaurar: $_"
    return
  }

  # Restaurar configuración (opcional)
  if (Test-Path $configDir) {
    Write-Host "  Backup de configuración encontrado en: $configDir" -ForegroundColor Yellow
    $confirmConfig = Read-Host "  ¿Restaurar archivos de configuración? (s/N)"
    if ($confirmConfig -eq "s" -or $confirmConfig -eq "S") {
      foreach ($relPath in $CONFIG_FILES) {
        $src = Join-Path $configDir $relPath
        $dst = Join-Path $PROJECT_ROOT $relPath
        if (Test-Path $src) {
          Copy-Item -Path $src -Destination $dst -Force
          Write-Host "  ✓ Restaurado: $relPath" -ForegroundColor Green
        }
      }
    }
  }

  # Regenerar Prisma Client
  Write-Host "  Regenerando Prisma Client..." -ForegroundColor Yellow
  try {
    Push-Location (Join-Path $PROJECT_ROOT "packages/database")
    & "npx.cmd" prisma generate 2>&1 | Out-Null
    Pop-Location
    Write-Host "  ✓ Prisma Client regenerado" -ForegroundColor Green
  } catch {
    Write-Host "  ⚠ No se pudo regenerar Prisma Client (puedes hacerlo manualmente)" -ForegroundColor Yellow
  }

  Write-Host "`n✅ Restauración completada: $($selected.Name)" -ForegroundColor Green
}

# ─── Limpieza / Rotación ───────────────────────────────────────────
function Invoke-Clean {
  param([int]$KeepCount, [switch]$Silent)

  if (-not (Test-Path $BackupDir)) { return }

  $backups = Get-ChildItem -Path $BackupDir -Filter "*.sql*" -File | Sort-Object LastWriteTime -Descending

  if ($backups.Count -le $KeepCount) {
    if (-not $Silent) { Write-Host "  ✓ Solo hay $($backups.Count) backups, no se requiere limpieza (límite: $KeepCount)" -ForegroundColor Green }
    return
  }

  $toDelete = $backups | Select-Object -Skip $KeepCount
  $deletedCount = 0

  foreach ($b in $toDelete) {
    # Eliminar archivos relacionados
    $baseName = $b.BaseName
    if ($baseName -like "*.sql") { $baseName = $baseName -replace '\.sql$', '' }
    else { $baseName = $b.Name -replace '\.sql\.gz$', '' -replace '\.sql$', '' }

    $null = Remove-Item -Path $b.FullName -Force -ErrorAction SilentlyContinue

    # Metadata
    $metaFile = Join-Path $BackupDir "$baseName.json"
    $null = Remove-Item -Path $metaFile -Force -ErrorAction SilentlyContinue

    # Directorio de configuración
    $configDir = Join-Path $BackupDir "$baseName-config"
    if (Test-Path $configDir) {
      Remove-Item -Path $configDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    $deletedCount++
  }

  if (-not $Silent) {
    Write-Host "  🗑 Backups antiguos eliminados: $deletedCount" -ForegroundColor Yellow
    Write-Host "  Conservados: $KeepCount" -ForegroundColor Green
  }
}

# ─── Entry Point ────────────────────────────────────────────────────
switch ($Action) {
  "backup" { Invoke-Backup }
  "restore" { Invoke-Restore }
  "list" { Get-Backups }
  "clean" { Invoke-Clean -KeepCount $Keep }
}
