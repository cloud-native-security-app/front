# ci-cd-deploy

- Master plan: repo `infra`, `odd/tasks/cloud-native-deploy.md` (Engram `odd/cloud-native-deploy/tasks`)
- Engram topic (this feature): `odd/ci-cd-deploy/tasks` (project: `front`)
- Branch: `v1`
- Status: planned

## Objective

Add GitHub Actions pipelines to `front`: a CI workflow that validates every pull request, and a deploy workflow that builds the image, pushes it to ECR and rolls out a new ECS task-definition revision of the `front` service.

## Why

The master plan deploys the platform to AWS (ECS Fargate behind an ALB). Terraform (repo `infra`) provisions the infrastructure; each service repo must ship its own artifacts so a merge to `main` reaches the cluster without manual steps.

## Scope

In:
- `.aws/task-definition.json` (template rendered by CI).
- `.github/workflows/ci.yml` (pull requests).
- `.github/workflows/deploy.yml` (push to `main` and `workflow_dispatch`).
- README / docs updates describing the pipeline, required secrets and variables.

Out:
- Terraform resources (ECR, ECS service, ALB, IAM): owned by `infra`.
- Runtime (non build-time) configuration of the Gateway URL.
- Other services' pipelines.

## Constraints

- AWS Academy Learner Lab: no OIDC provider. Credentials are temporary and stored as GitHub secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, refreshed with `refresh-gh-secrets.sh` from `infra`. Tasks run with `LabRole`.
- Terraform owns the ECS service; CI only registers new task-definition revisions and updates the service to them.
- `VITE_GATEWAY_BASE_URL` is baked into the bundle at build time and also drives the nginx CSP `connect-src`. It depends on the ALB DNS: set the repository variable `GATEWAY_PUBLIC_URL` from `terraform output gateway_public_url`.
- Optional future work: load the Gateway URL at runtime (config endpoint or entrypoint templating) so the image is environment-agnostic.
- Target: cluster `security-app-cluster-v2`, service `front`.

## Tooling

- TDD: Strict (source: user global configuration).
- Runner: `vitest` (`npm test`), `playwright` (`npm run test:e2e`), `npm run typecheck`, `npm run lint`, `npm run verify`.
- Workflow linting: `actionlint`.

## Checklist

- [ ] CI-01: `.aws/task-definition.json` (family, container `front`, port, log config, image placeholder).
- [ ] CI-02: `ci.yml` on PR: lint, typecheck, unit tests, e2e with Playwright (if feasible in CI), docker build without push.
- [ ] CI-03: `deploy.yml` skeleton: triggers `push` to `main` + `workflow_dispatch`, concurrency group.
- [ ] CI-04: `deploy.yml` steps: `configure-aws-credentials` -> ECR login -> build with `--build-arg VITE_GATEWAY_BASE_URL=${{ vars.GATEWAY_PUBLIC_URL }}` -> push `:${{ github.sha }}`.
- [ ] CI-05: `deploy.yml` steps: render task definition -> deploy to `front` service in `security-app-cluster-v2`, wait for service stability.
- [ ] CI-06: Docs: README section on CI/CD, required secrets/variables, refresh procedure.
- [ ] CI-07: `actionlint` clean on both workflows.

## Acceptance criteria

- A pull request runs lint, typecheck, unit tests, e2e and a docker build; all must pass.
- A merge to `main` pushes an image tagged with the commit SHA and the `front` service reaches a stable state on the new revision.
- No credentials in the repository; only secrets/variables documented above.
- The built bundle targets the ALB DNS given by `GATEWAY_PUBLIC_URL`.

## Checks

- `actionlint .github/workflows/*.yml`
- `npm run verify`
- `docker build --build-arg VITE_GATEWAY_BASE_URL=https://example.test .`
- Real deploy run after infra is applied (manual `workflow_dispatch`).

## Dependencies

Repo `infra`: TF-07 (ECR), TF-08 (ECS cluster/roles), TF-12 (front service/ALB), TF-15 (outputs consumed as repo variables).

## Progress

Planned. No task started.

## Next step

CI-01: author `.aws/task-definition.json` from infra `deploy/aws/task-defs/front.json`.
