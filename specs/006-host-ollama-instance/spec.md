# Feature Specification: Use Host Ollama Instance for the AI Dashboard

**Feature Branch**: `006-host-ollama-instance`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "The Generative AI Dashboard uses a containerized ollama instance. On the host machine there is already a local ollama instance that shall be used instead."

## Context

Today the Burndown stack ships its own dedicated AI runtime (Ollama) as a separate service. It downloads and stores its own copy of the language model (~5 GB) and needs about 8 GB of RAM. The host that runs the stack already has its own Ollama instance, so the machine ends up running two copies of the same model. This feature removes the bundled AI runtime and points the AI Dashboard at the Ollama instance that already runs on the host.

## Clarifications

### Session 2026-11-21

- Context (user): The host Ollama runs on `macmini.local`. Verified: the Burndown stack (port 6088) runs on the same Mac mini, which runs macOS and acts as the Docker host. The host Ollama (v0.40.17) already accepts LAN connections on port 11434. Its only installed model is `qwen3-vl:8b`.
- Q: Which model should the dashboard use on the host Ollama? → A: Keep `qwen2.5:7b`. The operator pulls it once on macmini. `qwen3-vl:8b` was tested and rejected: its output was correct, but it took 36.9 s because of about 1,000 hidden reasoning tokens, which exceeds the 30 s generation timeout.
- Q: What should the default AI service address be? → A: The Docker host's own address (`host.docker.internal`), so traffic stays on the machine and no LAN name lookup is involved. `http://macmini.local:11434` is documented as an override example only.
- Q: How exposed should the host Ollama be on the LAN? → A: Leave it LAN-reachable, as it is today. Record this in the security policy as an accepted risk that relies on the private-network boundary. The feature does not change the host's network binding.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI Dashboard runs on the host's existing Ollama (Priority: P1)

As the operator of the Burndown stack, I want the AI Dashboard to use the Ollama instance that already runs on the host. Then the host only keeps one copy of the language model, and I don't have to run, update and monitor a second AI runtime.

**Why this priority**: This is the whole point of the feature. Without it, nothing changes.

**Independent Test**: Deploy the stack on a host where Ollama is running and has the configured model. Open the dashboard, switch to the AI view, and check that a layout is generated. Check that the stack no longer contains its own AI runtime service.

**Acceptance Scenarios**:

1. **Given** the host's Ollama instance is running and has the configured model, **When** the operator deploys the stack with default settings, **Then** the AI Dashboard status reports "ready" and generating a layout works the same way it did before.
2. **Given** the stack has been redeployed with this feature, **When** the operator lists the running services of the stack, **Then** there is no bundled AI runtime service, and the stack does not reserve storage for model files.
3. **Given** the stack is deployed, **When** an AI layout is generated, **Then** the request goes to the host's Ollama instance, which the debug/diagnostic output confirms by showing the address that was used.

---

### User Story 2 - Clear feedback when the host instance can't be used (Priority: P2)

As the operator, I want the dashboard to tell me clearly when the host's Ollama instance can't be reached or doesn't have the required model. Then I can fix the host setup instead of waiting for a model download that will never happen.

**Why this priority**: Before, the bundled runtime downloaded the model by itself, and the UI showed "pulling" while that happened. With a host-managed instance, the stack no longer downloads models. A missing model therefore needs a clear message that tells the operator what to do, not a status that suggests waiting.

**Independent Test**: Stop the host's Ollama instance (or remove the configured model from it), then open the AI Dashboard and check the status message shown.

**Acceptance Scenarios**:

1. **Given** the host's Ollama instance is not running or can't be reached, **When** the operator opens the AI Dashboard, **Then** the AI view is disabled and the status says the AI service is unavailable. The rest of the dashboard keeps working.
2. **Given** the host's Ollama instance is reachable but doesn't have the configured model, **When** the operator opens the AI Dashboard, **Then** the status says the model is missing on the AI service and names the model. It does not suggest that a download is in progress.
3. **Given** the host's Ollama instance becomes available again, **When** the operator reloads the AI Dashboard, **Then** the AI view becomes available, and the stack does not need to be restarted.

---

### User Story 3 - Configurable address for the AI service (Priority: P3)

As the operator, I want to override the address of the AI service through the stack configuration. Then I can point the dashboard to another machine or port without changing or rebuilding the application.

**Why this priority**: The default (the host machine) covers the main use case. An override is a cheap safety net for setups that differ from it.

**Independent Test**: Set the AI service address in the stack configuration to a different reachable Ollama instance, redeploy, and check in the diagnostic output that the configured address is used.

**Acceptance Scenarios**:

1. **Given** no AI service address is configured, **When** the stack starts, **Then** the dashboard connects to the Ollama instance on the Docker host through the host's internal address (`host.docker.internal`) by default. It does not depend on LAN name resolution such as `macmini.local`.
2. **Given** the operator configures a custom AI service address, **When** the stack starts, **Then** the dashboard uses that address instead.

---

### Edge Cases

- **Host instance only accepts local connections**: On the macOS Docker host the default address still reaches an Ollama that listens only on loopback, so this works. If the stack is ever moved to a host where it doesn't, the dashboard shows "unavailable", and the operator documentation explains how to make the host instance reachable from the stack.
- **Host instance reachable from the whole LAN**: The host Ollama has no authentication and accepts connections from the LAN (current state on `macmini.local`). This is accepted and documented, not changed by this feature.
- **Host instance is slow or busy** (e.g., other applications are using it at the same time): The existing generation timeout and error handling still apply. A timeout produces the existing user-facing error and doesn't crash the stack.
- **Model name differs only by tag** (e.g., the host has another size or version of the same model family): The status check must not report "ready" unless the exact configured model is available.
- **Upgrading an existing deployment**: After redeploying, the old AI runtime service and its stored model data are no longer part of the stack. The documentation tells the operator how to remove the leftover data.
- **Local development without Ollama on the developer machine**: The AI view degrades to "unavailable" the same way it does in production. Nothing else in the stack depends on the AI service.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The stack MUST NOT include, build or publish a dedicated AI runtime service.
- **FR-002**: By default, the AI Dashboard MUST connect to the Ollama instance on the Docker host through the host's internal address (`host.docker.internal`, port 11434), without any extra configuration by the operator. The default MUST NOT depend on the host's LAN name (e.g. `macmini.local`) or on mDNS resolution inside containers.
- **FR-003**: The operator MUST be able to override the AI service address through stack configuration, without rebuilding images. The documentation MUST give `http://macmini.local:11434` as an example override for reaching Ollama by LAN name.
- **FR-004**: The stack MUST NOT try to download or manage models on the host's Ollama instance. The host owns provisioning and updating of models.
- **FR-005**: The AI status MUST tell apart three states: "ready" (service reachable and exact configured model present), "model missing" (service reachable but the configured model is absent) and "unavailable" (service not reachable). The "model missing" state MUST name the expected model.
- **FR-006**: When the AI service is unavailable or the model is missing, the AI view MUST stay disabled, and all non-AI dashboard features MUST keep working.
- **FR-007**: The stack MUST pick up when the AI service becomes available again on the next status check, without a restart.
- **FR-008**: The diagnostic output MUST show which AI service address is in use.
- **FR-009**: Existing AI Dashboard behaviour MUST stay the same once the host instance is reachable and has the model: layout generation, streaming, caching, declaration editing and timeouts.
- **FR-010**: The operator documentation MUST explain:
  - the prerequisites on the host (Ollama running, required model installed, reachable from the stack)
  - how to override the address
  - how to clean up the old AI runtime data after upgrading
- **FR-011**: The security policy MUST list the unauthenticated, LAN-reachable host Ollama as an accepted risk. It MUST name what the risk covers (anyone on the LAN can run inference and manage models on it) and say that the private-network boundary is the control. It MAY mention loopback-only binding as an optional hardening step that still works with the default address.
### Key Entities

- **AI Service Endpoint**: The address of the Ollama instance the dashboard uses. It defaults to the host machine and the operator can override it.
- **AI Status**: The readiness state reported to the dashboard: ready, model missing or unavailable. In the "model missing" case it includes the name of the expected model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After deployment, the stack runs exactly one service fewer than before, and it uses no storage for AI model files (saving about 5 GB of disk on the host).
- **SC-002**: The host machine keeps only one copy of the language model in memory and on disk, instead of two.
- **SC-003**: With the host instance ready, an AI layout is generated in the same time as before, or faster (no regression against the previous baseline).
- **SC-004**: In 100% of the test cases (instance stopped, instance not reachable, model missing), the dashboard shows the correct status within one status check and the non-AI features keep working.
- **SC-005**: An operator can deploy the stack against an existing host Ollama instance by following the documentation alone, without changing any code.

## Assumptions

- Ollama is already installed on the host and runs as a long-lived service that the operator manages outside this stack. The target host is `macmini.local` (macOS). It runs both the Docker/Portainer stack and Ollama.
- The model stays `qwen2.5:7b`. The operator installs it on the host instance once (`ollama pull qwen2.5:7b`) before or during rollout. The stack never pulls it. Other models already on the host (e.g. `qwen3-vl:8b`) are not used. Reasoning ("thinking") models don't fit the generation timeout without code changes, which are out of scope.
- The host instance is, or can be configured to be, reachable from the stack's services. Making it reachable (e.g., letting it accept connections beyond the host itself) is a host-side setup step, not part of this stack.
- The default model name and the existing model override setting don't change.
- There is no authentication between the dashboard and the host's Ollama instance. The host Ollama stays LAN-reachable (accepted risk, FR-011).
- Portainer deployments are redeployed manually after the change (see existing deployment practice).
- Supporting several AI services or automatic failover between them is out of scope.
