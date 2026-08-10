$ErrorActionPreference = 'Stop'

docker info *> $null
docker ps -aq | ForEach-Object { docker rm -fv $_ }

$keptImageIds = @(
    docker image ls --filter 'reference=pmm-qa/ps:*' --format '{{.ID}}'
    docker image ls --filter 'reference=pmm-qa/psmdb:*' --format '{{.ID}}'
    docker image ls --filter 'reference=pmm-qa/pdpgsql:*' --format '{{.ID}}'
) | Sort-Object -Unique

$imageIds = docker image ls -aq | Sort-Object -Unique | Where-Object { $_ -notin $keptImageIds }
if ($imageIds) { docker image rm -f $imageIds }

docker network prune -f
docker volume prune -af
docker builder prune -af

Write-Host 'Docker cleanup complete.'
