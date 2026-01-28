# Assign to Devin.ai

This is an extension for [Aha! Develop](https://www.aha.io/develop) providing integration with [Devin.ai](https://devin.ai/).
Assign Features and Requirements to [Devin.ai](https://devin.ai/) directly from Aha! Develop.

## Screen shots

<img width="577" height="72" alt="image" src="https://github.com/user-attachments/assets/c4c3a3e0-a724-4af1-9796-4e3c33b5e2da" />

<img width="579" height="93" alt="image" src="https://github.com/user-attachments/assets/427bcab2-2767-4fb8-aca1-64b455e4ded6" />

## Demo

[demo.mp4](https://github.com/user-attachments/assets/bf225008-214e-4550-885c-02cf6751c279)

## Installing the extension

1. Authorize Devin with your GitHub account, via the [Devin.ai admin interface](https://docs.devin.ai/onboard-devin/repo-setup#set-up-a-repository).

2. Setup the extension **Account Settings -> Extensions -> Devin** by specifying your Devon.ai **API key**, the **GitHub repository** and **Base branch**.

3. Add the extension field to your Feature and Requirement screens.

[setup-extension-fied.mp4](https://github.com/user-attachments/assets/f2745b85-d038-4371-86a3-3beabdf4103d)

## Working on the extension

Install [`aha-cli`](https://github.com/aha-app/aha-cli):

```sh
npm install -g aha-cli
```

Clone the repo:

```sh
git clone git@github.com:aha-develop/assign-devin.git
```

**Note: In order to install an extension into your Aha! Develop account, you must be an account administrator.**

Install the extension into Aha! and set up a watcher:

```sh
aha extension:install
aha extension:watch
```

Now, any change you make inside your working copy will automatically take effect in your Aha! account.

## Building

When you have finished working on your extension, package it into a `.gz` file so that others can install it:

```sh
aha extension:build
```

After building, you can upload the `.gz` file to a publicly accessible URL, such as a GitHub release, so that others can install it using that URL.

To learn more about developing Aha! Develop extensions, including the API reference, the full documentation is located here: [Aha! Develop Extension API](https://www.aha.io/support/develop/extensions)
