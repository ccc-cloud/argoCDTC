# Changelog

## 0.1.14

- When an operation fails because the server requires gRPC-Web, a notification now offers an **Enable gRPC-Web** button that sets `argocd.grpcWeb: true` automatically. No more digging through VS Code settings.

## 0.1.13

- Fixed `current-context unset` errors after login. The `--argocd-context` global flag is now stripped from `login` commands (it was causing "context not found" before the context is created). After every successful login, the extension now explicitly switches to the named context.

## 0.1.12

- Fixed "Generate token" hanging on a `Username:` prompt. The flow now asks for username/password upfront, logs in to create a session, generates the token from that session, then replaces the session with the token-based credential.

## 0.1.11

- All progress notifications now show a Cancel button. Cancelling kills the running CLI process immediately.

## 0.1.10

- Changed token expiration format from hours (`720h`) to days (`30d`) to match the ArgoCD CLI native format.
- Changed default token expiration from 7 days to 30 days.

## 0.1.9

- Fixed `account generate-token` and `login` commands failing with "no configuration has been provided" when the `argocd.core` setting is enabled. The `--core` and `--kube-context` flags are now stripped from global args whenever an explicit server connection is requested.

## 0.1.8

- Fixed token login and generate-token options not appearing in the Add/Edit Context flow due to a stale compiled bundle.
- Fixed context edit command (`argocd.context.edit`) not found error caused by the same stale build.

## 0.1.7

- Added context editing from the Contexts view, including re-login/update-credentials and direct local name/server/user reference edits.

## 0.1.6

- Added token login to the Add Context flow.
- Added an Add Context option to generate an account token with an expiration in days and save it as the new context.
- Kept generated token output out of the Argo CD output channel.

## 0.1.5

- Renamed the VS Code setting to `argocd.usersSessionDuration` so it appears reliably in Settings while still documenting the server-side `users.session.duration` key.

## 0.1.4

- Added an application parameter update command with a searchable picker, per-parameter editing, bulk paste, and an inline application-row icon.
- Added a bulk sync command with a selectable list of OutOfSync applications.
- Refreshed the Applications view more aggressively during and after sync operations, and lowered the default auto-refresh interval.
- Added a session-duration setting as a reference for the server-side `users.session.duration` value.

## 0.1.3

- Fixed extension activation failure caused by missing yaml dependency in VSIX by switching from plain tsc to esbuild bundling.

## 0.1.2

- Added a plus action to log in and create a new named context from the Contexts view.
- Added safe local context removal from the Contexts view without deleting shared server entries still used by other contexts.
- Fixed TypeScript types for setInterval and clearInterval by explicitly declaring Node.js types in tsconfig.json.

## 0.1.1

- Added Argo CD CLI download instructions and session troubleshooting notes to the README.
- Added clearer expired-session and gRPC-Web error messages with relogin commands.
- Kept command prompts open when VS Code loses focus.
- Added an inline context switch action in the Contexts view.
- Added live Applications view refresh during sync operations.
- Added configurable automatic Applications view refresh.

## 0.1.0

- Initial Argo CD Toolkit extension scaffold.
- Added side-bar views for applications, projects, clusters, repositories, and contexts.
- Added common Argo CD operations and a CLI command catalog.
- Added YAML snippets for Argo CD custom resources.
