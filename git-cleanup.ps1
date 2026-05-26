# git-cleanup.ps1
# Uso: ejecutar en PowerShell desde la carpeta del repo

# 1) Configura tu identidad si aún no lo has hecho
git config --global user.name "Tu Nombre"
git config --global user.email "tu@correo.com"

# 2) Asegúrate de tener este .gitignore en el repo
# Ya está presente en el proyecto y excluye node_modules, .next, .env y artefactos comunes.

# 3) Quita node_modules del índice sin borrarlos del disco
git rm -r --cached frontend/node_modules
git rm -r --cached node_modules 2>$null

# 4) Añade .gitignore y confirma el cambio
git add .gitignore
git add .
git commit -m "Remove node_modules from index and add .gitignore"

# 5) Para limpiar el historial del archivo grande y volver a empujar, ejecuta la sección opcional.
# WARNING: esto reescribe el historial y debe usarse con cuidado.

<#
# Opción rápida usando git filter-branch (si no tienes BFG)
git filter-branch --force --index-filter "git rm -r --cached --ignore-unmatch frontend/node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node" --prune-empty --tag-name-filter cat -- --all

git reflog expire --expire=now --all
git gc --prune=now --aggressive

git push origin --force --all
git push origin --force --tags
#>

Write-Host "Script finalizado. Revisa los commits y ejecuta la sección opcional solo si necesitas purgar la historia."