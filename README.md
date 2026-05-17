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
- Context switching, new-context login, and context removal from the Contexts view.
- Command catalog for the rest of Argo CD, including accounts, certificates, GPG keys, repository credentials, sync windows, admin export/import, and shell completion.
- Escape hatch command: `Argo CD: Run Any CLI Command`.
- YAML snippets for `Application`, multi-source `Application`, `AppProject`, and `ApplicationSet`.

## Requirements

Download and install the official Argo CD CLI before using this extension. The extension calls `argocd` under the hood, so the CLI must be available first.

- Official CLI installation guide: https://argo-cd.readthedocs.io/en/latest/cli_installation/
- Latest Argo CD release downloads: https://github.com/argoproj/argo-cd/releases/latest

On Windows, you can download the latest CLI with PowerShell:

```powershell
$version = (Invoke-RestMethod https://api.github.com/repos/argoproj/argo-cd/releases/latest).tag_name
$url = "https://github.com/argoproj/argo-cd/releases/download/$version/argocd-windows-amd64.exe"
Invoke-WebRequest -Uri $url -OutFile argocd.exe
```

Move `argocd.exe` to a folder on your `PATH`, or point the extension directly to the executable.

If the CLI is elsewhere, set:

```json
{
  "argocd.cliPath": "C:\\tools\\argocd.exe"
}
```

## Troubleshooting

### Can the Session Be Permanent?

Normal `argocd login` sessions are not permanent. Argo CD controls their lifetime on the server side with `users.session.duration`, and expired local-user sessions need a relogin.

An Argo CD admin can make sessions last longer by changing `users.session.duration` in `argocd-cm`, for example:

```yaml
data:
  users.session.duration: "168h"
```

For automation or service-account style access, Argo CD account tokens can be generated with no expiration by default:

```bash
argocd account generate-token
```

Then start VS Code with the token in the environment so the `argocd` CLI can use it:

```powershell
$env:ARGOCD_AUTH_TOKEN = "<TOKEN>"
code .
```

Long-lived tokens should be treated like passwords. Prefer normal login for day-to-day interactive use unless your organization explicitly wants token-based access.

### Expired Argo CD Session

If a view shows an error like `rpc error: code = Unauthenticated ... invalid session: token is expired`, the saved Argo CD login token has expired after not using it for a while.

Run `Argo CD: Relogin` from the VS Code command palette, or run one of these commands:

```bash
argocd relogin
argocd login <ARGOCD_SERVER> --sso
argocd login <ARGOCD_SERVER> --username <USER> --password <PASSWORD>
```

Then refresh the Argo CD views.

If the same output also says `Use flag --grpc-web in grpc calls`, enable:

```json
{
  "argocd.grpcWeb": true
}
```

Or add `--grpc-web` to the CLI command:

```bash
argocd relogin --grpc-web
argocd login <ARGOCD_SERVER> --sso --grpc-web
```

Then log in again and refresh.

## Common Settings

```json
{
  "argocd.defaultServer": "argocd.example.com",
  "argocd.defaultContext": "production",
  "argocd.applicationsAutoRefresh": true,
  "argocd.applicationsAutoRefreshIntervalSeconds": 30,
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

Some Argo CD operations are intentionally opened in an integrated terminal because the CLI may need to stream logs, show diff output, open SSO, ask Kubernetes registration questions, or display long-running progress. Application sync output is streamed to the Argo CD output channel so the Applications view can refresh while the sync is active.
