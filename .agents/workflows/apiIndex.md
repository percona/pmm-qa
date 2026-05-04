---
description: Common API's to avoid reading the whole pmmApi.json
---

# API Usage Strategy
- Check this file before opening `pmmApi.json`.
- Open `pmmApi.json` ONLY for exact schema/field needs.

# Common Paths

## Users/Auth
- `GET /v1/users/me`
- `GET /v1/users`
- `POST /graph/login` (ONLY for auth flow debugging)

## Inventory & Management
- `GET /v1/inventory/services`
- `GET /v1/management/services`
- `POST /v1/management/services` (Add database/service)
- `DELETE /v1/management/services/{service_id}`
- `GET /v1/management/nodes`
- `DELETE /v1/management/nodes/{node_id}`
- `GET /v1/management/agents`

## QAN and Realtime Analytics
- `GET /v1/qan/health`
- `POST /v1/qan/query:getExample`
- `POST /v1/qan/query:getSchema`
- `POST /v1/qan/metrics:getNames`
- `GET /v1/qan/query/{queryid}/plan`
- `GET /v1/realtimeanalytics/services`
- `GET /v1/realtimeanalytics/sessions`
- `POST /v1/realtimeanalytics/sessions:start`
- `POST /v1/realtimeanalytics/sessions:stop`
- `POST /v1/realtimeanalytics/queries:search`

## Advisors
- `GET /v1/advisors`
- `GET /v1/advisors/checks/failed`
- `POST /v1/advisors/checks:start`
- `GET /v1/advisors/failedServices`

## Alerting
- `POST /v1/alerting/rules`
- `GET /v1/alerting/templates`

## Backup
- `GET /v1/backups/artifacts`
- `POST /v1/backups:start`
- `GET /v1/backups/locations`
- `DELETE /v1/backups/locations/{location_id}`

## Server / Settings
- `GET /v1/server/version`
- `GET /v1/server/settings`
- `GET /v1/server/updates:getStatus`
- `POST /v1/server/updates:start`

## HA
- `GET /v1/ha/status`
- `GET /v1/ha/nodes`