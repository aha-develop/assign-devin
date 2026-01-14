# Assign to Devin.ai

Assign Features and Requirements to [Devin](https://devin.ai/) directly from Aha! Develop.

## Contributions

- Command: **Assign to Devin.ai** – available on Features and Requirements to create a Devin session for the selected record.
- Attribute view: **Devin** – renders on Feature and Requirement sidebars to show assignment status and trigger new sessions.

## Configuration

1. Configure the **GitHub Repository** and optional **Base Branch** so Devin knows where to work.
2. Set the **Devin API Token** secret (starts with `apk_`) in the extension settings.
3. Optionally provide default session tags (comma separated), custom prompt instructions, and a playbook ID.

## Development

```sh
npx aha-cli extension:install
npx aha-cli extension:watch
```

## Building

```sh
npx aha-cli extension:build
```

For more help see the [Aha! Develop Extension API docs](https://www.aha.io/support/develop/extensions).
