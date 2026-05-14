# Argo CD Toolkit for VS Code

Argo CD Toolkit brings the Argo CD CLI into VS Code with browsable side-bar views, command palette actions, and snippets for common Argo CD manifests.

The extension intentionally uses the official `argocd` CLI as its execution layer. That keeps support broad across applications, projects, clusters, repositories, repository credentials, accounts, certificates, GPG keys, contexts, admin commands, sync options, and new flags added by Argo CD.

## Features

- Activity bar container with Applications, Projects, Clusters, Repositories, and Contexts views.
- Login, logout, relogin, version, and open UI commands.
- Application operations: create, details, sync, refresh, hard refresh, diff, logs, manifests, resources, history, wait, rollback, terminate operation, and delete.
- Project operations: create, details, and delete.
- Repository operations: add, details, and remove.
- Cluster operations: add, details, and remove.
- Context switching from the Contexts view.
- Command catalog for the rest of Argo CD, including accounts, certificates, GPG keys, repository credentials, sync windows, admin export/import, and shell completion.
- Escape hatch command: `Argo CD: Run Any CLI Command`.
- YAML snippets for `Application`, multi-source `Application`, `AppProject`, and `ApplicationSet`.

## Requirements

Install the Argo CD CLI and make sure `argocd` is on your `PATH`.

If the CLI is elsewhere, set:

```json
{
  "argocd.cliPath": "C:\\tools\\argocd.exe"
}
```

## Common Settings

```json
{
  "argocd.defaultServer": "argocd.example.com",
  "argocd.defaultContext": "production",
  "argocd.insecure": false,
  "argocd.grpcWeb": false,
  "argocd.portForward": false,
  "argocd.portForwardNamespace": "argocd",
  "argocd.extraArgs": []
}
```

## Development

```bash
npm install
npm run compile
```

Open this folder in VS Code and press `F5` to launch an Extension Development Host.

## Notes

Some Argo CD operations are intentionally opened in an integrated terminal because the CLI may need to stream logs, show diff output, open SSO, ask Kubernetes registration questions, or display long-running sync progress.
