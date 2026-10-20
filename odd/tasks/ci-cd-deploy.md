# ci-cd-deploy

- Master plan: repo `infra`, `odd/tasks/cloud-native-deploy.md` (Engram `odd/cloud-native-deploy/tasks`)
- Engram topic (this feature): `odd/ci-cd-deploy/tasks` (project: `front`)
- Branch: `feature/ci_cd`
- Status: implemented locally; live checks pending

## Objective

Add GitHub Actions pipelines to `front`: a CI workflow that validates every pull request, and a deploy workflow that builds the image, pushes it to ECR and rolls out a new ECS task-definition revision of the `front` service.

## Why

The master plan deploys the platform to AWS (ECS Fargate behind an ALB). Terraform (repo `infra`) provisions the infrastructure; each service repo must ship its own artifacts so a merge to `main` reaches the cluster without manual steps.

## Scope

In:
- `.github/workflows/ci.yml` (pull requests).
- `.github/workflows/deploy.yml` (push to `main` and `workflow_dispatch`).
- README / docs updates describing the pipeline, required secrets and variables.

Out:
- Terraform resources (ECR, ECS service, ALB, IAM): owned by `infra`.
- Runtime (non build-time) configuration of the Gateway URL.
- Other services' pipelines.

## Constraints

- AWS Academy Learner Lab: no OIDC provider. Credentials are temporary and stored as GitHub secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, refreshed with `refresh-gh-secrets.sh` from `infra`. Tasks run with `LabRole`.
- Terraform owns the task definition and the ECS service; CI only swaps the image of the revision the service runs (D1).
- `VITE_GATEWAY_BASE_URL` is baked into the bundle at build time and also drives the nginx CSP `connect-src`. It depends on the ALB DNS, which deploy derives at build time (D2).
- Optional future work: load the Gateway URL at runtime (config endpoint or entrypoint templating) so the image is environment-agnostic.
- Target: cluster `security-app-cluster-v2`, service `front`.

## Tooling

- TDD: Strict (source: user global configuration).
- Runner: `vitest` (`npm test`), `playwright` (`npm run test:e2e`), `npm run typecheck`, `npm run lint`, `npm run verify`.
- Workflow linting: `actionlint`.

## Checklist

- [x] CI-01: repo-owned `.aws/task-definition.json`: superseded by D1 (done-by-design); the task definition lives in Terraform.
- [x] CI-02: `ci.yml` on PR and push to `develop`: `npm run verify` (incl. Playwright e2e, self-contained) + docker build without push.
- [x] CI-03: `deploy.yml` skeleton: `push` to `main` + `workflow_dispatch`, concurrency `deploy-front`.
- [x] CI-04: `deploy.yml`: `configure-aws-credentials` -> ECR login -> resolve gateway URL from ALB `security-app-alb` (D2) -> build with `--build-arg VITE_GATEWAY_BASE_URL=https://<dns>:8080` -> push `:<sha>` and `:latest`.
- [x] CI-05: `deploy.yml`: download current task definition, jq strip, render image swap, deploy to `front` in `security-app-cluster-v2`, wait for stability.
- [x] CI-06: README CI/CD section (secrets/variables, refresh, D2, redeploy, rollback).
- [x] CI-07: `actionlint` clean on both workflows.

## Decisions

- D1 (2026-10-19, user): Terraform owns the task definition; CI owns only the image. Deploy downloads the service's current task definition, strips read-only fields with jq, swaps the image of container `front` to `${{ github.sha }}` (`:latest` also pushed) and deploys with wait-for-service-stability. Supersedes CI-01.
- D2 (2026-10-19, parent): `VITE_GATEWAY_BASE_URL` is derived at deploy time, not from a manual repo variable: after AWS login, read the DNS of ALB `security-app-alb` and build with `https://<dns>:8080` (same as Terraform output `gateway_public_url`). Fails clearly if unresolved. After recreating the ALB, re-run the deploy.

## Acceptance criteria

- A pull request runs lint, typecheck, unit tests, e2e and a docker build; all must pass.
- A merge to `main` pushes an image tagged with the commit SHA and the `front` service reaches a stable state on the new revision (image swap only).
- No credentials in the repository; only secrets/variables documented above.
- The built bundle targets the ALB DNS resolved at deploy time (D2).

## Checks

- `actionlint .github/workflows/*.yml`
- `npm run verify`
- `docker build --build-arg VITE_GATEWAY_BASE_URL=https://example.test .`
- Real deploy run after infra is applied (manual `workflow_dispatch`).

## Dependencies

Repo `infra`: TF-07 (ECR), TF-08 (ECS cluster/roles), TF-12 (front service/ALB), TF-15 (outputs consumed as repo variables).

## Progress

CI-01 superseded by D1. CI-02..07 implemented locally; local checks passed. Not committed. Live checks pending: green PR run and real deploy (need the user to open a PR / merge to `main`).

## CI/CD evidence

Route: delegated writer (single bounded writer). Strict TDD = observable checks first.

- Baseline (before): `mise exec actionlint@1.7.12 shellcheck@latest -- actionlint .github/workflows/*.yml` -> no workflow files (`.github/` absent).
- After: same command -> clean, exit 0.
- `CI=true npm run verify` (format:check, lint, typecheck, vitest 133 tests, build, Playwright e2e 14 passed) -> exit 0. `node_modules` was current, `npm ci` skipped locally; Chromium already installed.
- First attempt with job-level `VITE_GATEWAY_BASE_URL` failed `tests/api/config.test.ts` (it requires the variable unset); fixed by passing the placeholder only to the docker build step.
- E2E kept in CI: self-contained (contract server + `vite preview`), Chromium only.
- `docker build --build-arg VITE_GATEWAY_BASE_URL=https://gateway.ci.invalid:8080 -t front:ci-check .` -> exit 0; image removed afterwards.
- `git status --short` -> ` M README.md`, ` M odd/tasks/ci-cd-deploy.md`, `?? .github/` (dist/, test-results/, playwright-report/ ignored).
- Pinned actions (full SHA, same as nmap-service): configure-aws-credentials v6.3.0, amazon-ecr-login v2.1.7, amazon-ecs-render-task-definition v1.9.1, amazon-ecs-deploy-task-definition v2.6.4; `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`.
- Pending (needs user): green PR run of `ci.yml`; real `deploy.yml` rollout . The ALB DNS lookup is already proven: `aws elbv2 describe-load-balancers --names security-app-alb` worked with the Learner Lab credentials on 2026-10-19 (infra first-apply diagnosis).

## Next step

Commit (user), push and open a PR to verify CI live; run infra `refresh-gh-secrets.sh` before the first deploy.
