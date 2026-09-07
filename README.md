# TekForge

Developer self-service CI/CD platform powered by Tekton.

## MVP

- Application and project management
- Pipeline templates
- Tekton Pipeline/PipelineRun generation
- GitHub webhook integration
- Live pipeline execution status
- Build, test, security scan, container image and Kubernetes deployment stages
- AI-assisted pipeline RCA and optimization (planned)

## Architecture

```text
Developer -> TekForge UI -> Platform API -> Pipeline Compiler -> Tekton
                                           |                    |
                                           +-> GitHub           +-> Kubernetes
```

## Repository layout

- `apps/web` - Next.js dashboard
- `services/api` - platform API
- `packages/types` - shared TypeScript contracts
- `tekton` - Tasks, Pipelines and Triggers
- `deploy` - local/platform deployment manifests
- `docs` - architecture and design documentation

## Development

The first vertical slice targets Node.js/TypeScript applications and a Kubernetes/Tekton execution environment.
