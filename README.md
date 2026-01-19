# Assign to Devin.ai

This is an extension for [Aha! Develop](https://www.aha.io/develop) providing integration with [Devin](https://devin.ai/).
Assign Features and Requirements to [Devin](https://devin.ai/) directly from Aha! Develop.

This extension adds a new Devin.ai field which you can assign to Features and Layouts.

## Demo

[demo.mp4](https://github.com/user-attachments/assets/bf225008-214e-4550-885c-02cf6751c279)

## Screen shots

todo

## Installing the extension

To install the extension authorize Devin.ai with your github account

Make sure Devin has access to your repositories. [Refer to Devins documentation on this](https://docs.devin.ai/onboard-devin/repo-setup#set-up-a-repository)

Setup the extension by specifying the API key, the repo and branch.

Add the extension field to your Feature and Requirement screens.

A link to the created devin.ai session will be displayed after sending.

## Contributions

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
