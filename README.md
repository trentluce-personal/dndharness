# dndharness

Locally ran application that friends and family can use to play through a D&amp;D campaign

## OpenCode

This repository includes [OpenCode configuration](./opencode.json) and
[project instructions](./AGENTS.md). No application stack or build/test
commands have been established yet.

### Install the CLI

On Windows, install OpenCode for your user account:

```powershell
winget install --id SST.opencode --exact --source winget --scope user
```

Open a new terminal after installation so the updated PATH takes effect.
For other platforms, see the [official installation guide](https://opencode.ai/docs/).

### Connect GitHub Copilot

From the repository directory, launch:

```powershell
opencode
```

1. Run `/connect` and select **GitHub Copilot**.
2. Follow the device sign-in instructions at <https://github.com/login/device>.
   A GitHub account with a Copilot subscription is required; available models
   depend on your plan and account settings.
3. Run `/models` to choose an available model.

The repository enables only the GitHub Copilot provider and leaves model
selection to your account. Credentials are stored by OpenCode in your user
profile, not in the repository. Do not paste tokens into configuration files
or commit them.

Session sharing is disabled. File edits, shell commands, and access outside
the project require approval. These settings do not prevent code from being
sent to the selected model provider.

OpenCode loads `AGENTS.md` automatically; there is no need to run `/init`.
To inspect the resolved configuration without making a model request, run:

```powershell
opencode debug config
```
