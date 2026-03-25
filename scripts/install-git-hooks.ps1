#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

git config core.hooksPath .githooks
Write-Host "Git hooks configured: core.hooksPath=.githooks"

