# serverless-api-terraform

A small REST API for items: TypeScript on AWS Lambda behind API Gateway (HTTP API), stored in DynamoDB with optimistic locking, with Terraform modules for the infrastructure. Reference project, not a production service.

## Routes

| Route | Behaviour |
|---|---|
| `GET /items?limit=&cursor=` | page of items, `nextCursor` when there are more |
| `POST /items` | validate and create, `201` (or `400`) |
| `GET /items/{id}` | the item, or `404` |
| `PUT /items/{id}` | body must include the `version` you read, `409` if it's stale |
| `DELETE /items/{id}` | `204`, or `404` if missing |

## Run it locally

Needs Node 20+. No AWS account or Docker; DynamoDB is replaced by an in-memory stand-in.

```bash
npm ci
npm test        # unit tests
npm run demo    # starts the API on 127.0.0.1:8788 and runs a scripted tour
```

`npm run demo -- --serve` keeps the server running so you can `curl` it.

## Layout

- `src/handler.ts` routing and error mapping, `src/validate.ts` input checks, `src/items-repo.ts` DynamoDB access using conditional writes.
- `infra/modules/table`, `infra/modules/iam` and `infra/modules/api`, wired together in `infra/envs/dev`. Outputs are `api_url` and `table_name`.
- IAM allows `GetItem`, `PutItem`, `Query`, `DeleteItem` and `UpdateItem` on the one table, plus log writes to the function's own log group. No wildcard actions.
- CI (`ci.yml`) runs typecheck, lint, tests, the demo, packaging, and `terraform fmt -check`, `init -backend=false` and `validate`. `deploy.yml` plans on pull requests and applies on main using GitHub OIDC.

## Not verified

- Terraform has not been run. It wasn't installed where this was written, so treat the `.tf` files as unvalidated until the CI job passes.
- Never deployed to AWS. The Lambda zip layout (ESM `dist/` plus `package.json`) and the `handler.handler` entry point are untested on the real runtime.
- `deploy.yml` has never run. The OIDC provider, roles, state bucket and lock table it expects don't exist, and `backend.tf` holds placeholders.
- The in-memory DynamoDB only covers what `ItemsRepo` issues. Throttling, 1 MB pages and the like are not exercised.
- There is no authentication. Add an authorizer before exposing it.
- All items share one partition key (`ITEM`) so listing can be a `Query`. That caps throughput and is fine for a reference service, not a big catalogue.

## Deploying

1. Create the state bucket and lock table, then edit `infra/envs/dev/backend.tf`.
2. `npm ci && npm run package`, then `cd infra/envs/dev && terraform init && terraform plan`.
3. For CI deploys, set up the OIDC provider and roles described at the top of `.github/workflows/deploy.yml`.

## Licence

MIT, see [LICENSE](LICENSE).
