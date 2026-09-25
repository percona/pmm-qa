# Linode broker actions

The relay holds `LINODE_TOKEN`; callers receive only credentials for resources they created. Result reads are bound to the initiating `ACTOR`.

| Action | Body | Notes |
| --- | --- | --- |
| `provision` | `role`, `run_id`, optional `ttl_hours`, `pmm_qa_ref` | Starts a VM asynchronously |
| `provision-result` | `run_id` | `202` building, `200` ready, `502` failed |
| `destroy` | `run_id` | Destroys the VM |
| `provision-lke` | `run_id` plus optional LKE/chart/value fields | Starts an HA cluster asynchronously |
| `lke-result` | `run_id` | `202` building, `200` ready, `502` failed |
| `destroy-lke` | `run_id` or `cluster_id` | Destroys the HA cluster |

For polling, preserve the response body and branch on status:

```bash
code=$(R_STATUS "$RUN_DIR/provision.json" linode provision-result \
  "$(jq -n --arg id "$RUN_ID" '{run_id:$id}')")
```

The provisioning skills own run-id selection, local markers, polling deadlines, credential unpacking, keep-alive, and mandatory teardown.
