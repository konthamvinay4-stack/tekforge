# TekForge user flow

TekForge hides Tekton implementation details from application developers while exposing the important delivery state.

## 1. Create an application

User enters:
- application name
- Git repository
- default branch
- runtime (Node.js first)
- container registry
- deployment environment

The UI explains why each value is needed instead of asking for raw Tekton YAML.

## 2. TekForge generates the pipeline

The platform converts the user's choices into a canonical `TekForgePipelineSpec` and compiles that specification into Tekton Tasks and a Pipeline.

The user sees a readable plan:

`Checkout → Build → Test → Security → Image → Deploy`

## 3. A code push starts a run

A Git webhook reaches a Tekton EventListener. Tekton Triggers maps event fields through a TriggerBinding and creates a PipelineRun from a TriggerTemplate. This is the event-driven execution path.

## 4. The run page explains progress

Every stage has:
- plain-English purpose
- current state
- duration
- logs
- artifacts/findings
- retry action when supported

Example:

`Security — Running`

"TekForge is scanning dependencies and source code for HIGH and CRITICAL vulnerabilities. Deployment is waiting for this gate."

## 5. Failure experience

Never show only `TaskRun failed`. Show:
- failed stage
- likely reason
- relevant log excerpt
- Kubernetes event, when available
- suggested next action
- retry button

## 6. Deployment experience

The user sees an environment timeline:

`DEV ✓ → QA ✓ → PROD 🔒`

A protected environment can require an approval before the final deployment stage is allowed to run.

## Design principle

The UI should answer three questions at every point:

1. **What is happening?**
2. **Why is it happening?**
3. **What happens next?**
