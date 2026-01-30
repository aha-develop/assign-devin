# Agent Guide

## Purpose

This extension lets Aha! Develop users hand off Features and Requirements to Devin so work can continue automatically. The UI embeds inside Aha!, gathers context from the record, builds a Devin session prompt, then stores metadata about the assignment back on the record.

## Key Components

- `src/views/SendToDevinButton.tsx` renders the UI card, validates settings, builds the session prompt, invokes the server event, and records the resulting session metadata.
- `src/lib/buildSessionPrompt.ts` pulls rich context for the selected Feature or Requirement (description, requirements, todos) and assembles the instructions Devin receives, including repository guidance and optional custom instructions.
- `src/events/createDevinSession.ts` runs on the server, validates settings with `zod/mini`, calls Devin's REST API, and returns a `sessionId`, `sessionUrl`, and timestamp. The handler is registered up front so Aha! can execute it on demand.
- `src/lib/events.ts` provides a thin RPC layer: it fires server events, polls extension fields for results, and enforces request/response schemas.
- `src/lib/settings.ts` defines the extension settings contract (API keys, repository, base branch, tags, optional playbook) and helper utilities for tag parsing.
- `src/lib/constants.ts` centralizes IDs shared between client and server.

## Configuration

Account administrators must configure:

- `apiKey` or `personalApiKey` (not exposed client-side)
- `repository` (GitHub org/repo)
- `baseBranch`
- Optional `sessionTags`, `customInstructions`, `playbookId`

Settings live in the extension configuration UI in Aha!. Missing API keys or invalid shapes surface as user-visible errors when the button is pressed.

## Data Flow

1. Aha! renders `sendToDevinButton` with the current record and extension settings.
2. The component checks `SESSION_FIELD` for existing session data and displays the proper state.
3. On "Send to Devin":
   - Fetch full record context and build the prompt.
   - Trigger `createDevinSession` via the shared RPC helper.
   - Server handler posts to `https://api.devin.ai/v1/sessions` with idempotency, tags, and optional playbook.
   - The successful response is stored on the record so subsequent renders know Devin already owns it.

All cross-process communication uses extension fields as a mailbox; the client polls until the server writes back a success or error payload.

## Development Notes

- Install dependencies and manage builds with `aha-cli` (`aha extension:install`, `aha extension:watch`, `aha extension:build`).
- UI components rely on React and the Aha! web components (`aha-button`, `aha-alert`, etc.).
- Server-side fetch runs in the Aha! extension environment; no extra polyfills are required.
- Zod Mini (`zod/mini`) keeps bundle size low while still enforcing schemas on inputs/outputs.

## Operational Tips

- Use existing prompt builders and event helpers when adding new Devin workflows to keep validation and polling consistent.
- Persist any new server results via `EXTENSION_ID` + unique keys to avoid clobbering other data.
- Extend `ExtensionSettingsSchema` and surface new settings in the UI when integrating additional Devin features.
- Manually validate changes by triggering the button on both Features and Requirements to confirm prompt composition and session creation succeed.
