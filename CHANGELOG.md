# Changelog

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
