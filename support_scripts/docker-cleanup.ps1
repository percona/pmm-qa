$ErrorActionPreference = 'Stop'

docker info *> $null
docker ps -aq | ForEach-Object { docker rm -fv $_ }

docker network prune -f
docker volume prune -af
docker builder prune -af
docker buildx history rm --all

Write-Host 'Docker cleanup complete.'
