# Assign to Devin.ai

This is an extension for [Aha! Develop](https://www.aha.io/develop) providing integration with [Devin.ai](https://devin.ai/).
Assign Features and Requirements to [Devin.ai](https://devin.ai/) directly from Aha! Develop.


## Screen shots


<img width="577" height="72" alt="image" src="https://github.com/user-attachments/assets/c4c3a3e0-a724-4af1-9796-4e3c33b5e2da" />

<img width="579" height="93" alt="image" src="https://github.com/user-attachments/assets/427bcab2-2767-4fb8-aca1-64b455e4ded6" />

## Demo

[demo.mp4](https://github.com/user-attachments/assets/bf225008-214e-4550-885c-02cf6751c279)


## Installing the extension

To install the extension with your github account

1. Authorize Devin.ai with your GitHub account, via the [Devin.ai admin interface](https://docs.devin.ai/onboard-devin/repo-setup#set-up-a-repository).

2. Setup the extension **Account Settings -> Extensions -> Devin.ai** by specifying your Devon.ai **API key**, the **GitHub repository** and **Base branch**.

3. Add the extension field to your Feature and Requirement screens.

[setup-extension-fied.mp4](https://github.com/user-attachments/assets/f2745b85-d038-4371-86a3-3beabdf4103d)


## Development

```sh
npx aha-cli extension:install
npx aha-cli extension:watch
npx aha-cli extension:build
```

For more help see the [Aha! Develop Extension API docs](https://www.aha.io/support/develop/extensions).
