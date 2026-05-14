export interface CatalogCommand {
  label: string;
  description: string;
  detail: string;
  command: string;
}

export const catalogCommands: CatalogCommand[] = [
  {
    label: "Applications: List",
    description: "argocd app list",
    detail: "List applications, including filters such as --project, --selector, and --repo.",
    command: "app list"
  },
  {
    label: "Applications: Create",
    description: "argocd app create",
    detail: "Create an application from Git, Helm, Kustomize, Jsonnet, directory, plugin, or multi-source inputs.",
    command: "app create"
  },
  {
    label: "Applications: Details",
    description: "argocd app get",
    detail: "Show application status, resources, parameters, and operation details.",
    command: "app get"
  },
  {
    label: "Applications: Sync",
    description: "argocd app sync",
    detail: "Sync applications by name, selector, project, resource, revision, source name, or source position.",
    command: "app sync"
  },
  {
    label: "Applications: Refresh",
    description: "argocd app refresh",
    detail: "Refresh normal or hard application cache state.",
    command: "app refresh"
  },
  {
    label: "Applications: Diff",
    description: "argocd app diff",
    detail: "Compare live cluster resources with target manifests.",
    command: "app diff"
  },
  {
    label: "Applications: Resources",
    description: "argocd app resources",
    detail: "List application managed Kubernetes resources.",
    command: "app resources"
  },
  {
    label: "Applications: Manifests",
    description: "argocd app manifests",
    detail: "Render and show application manifests.",
    command: "app manifests"
  },
  {
    label: "Applications: Logs",
    description: "argocd app logs",
    detail: "Stream or print logs from application pods and containers.",
    command: "app logs"
  },
  {
    label: "Applications: History",
    description: "argocd app history",
    detail: "Show deployment history.",
    command: "app history"
  },
  {
    label: "Applications: Rollback",
    description: "argocd app rollback",
    detail: "Rollback to a deployment history ID.",
    command: "app rollback"
  },
  {
    label: "Applications: Wait",
    description: "argocd app wait",
    detail: "Wait for sync, health, deletion, operation, hydration, or suspended states.",
    command: "app wait"
  },
  {
    label: "Applications: Set Parameters",
    description: "argocd app set",
    detail: "Update source, destination, sync policy, Helm, Kustomize, Jsonnet, plugin, and directory settings.",
    command: "app set"
  },
  {
    label: "Applications: Unset Parameters",
    description: "argocd app unset",
    detail: "Remove application parameters and sync options.",
    command: "app unset"
  },
  {
    label: "Applications: Patch",
    description: "argocd app patch",
    detail: "Patch an Application object.",
    command: "app patch"
  },
  {
    label: "Applications: Actions List",
    description: "argocd app actions list",
    detail: "List resource actions available for an application.",
    command: "app actions list"
  },
  {
    label: "Applications: Actions Run",
    description: "argocd app actions run",
    detail: "Run a custom resource action.",
    command: "app actions run"
  },
  {
    label: "Applications: Terminate Operation",
    description: "argocd app terminate-op",
    detail: "Terminate a running sync, rollback, or app operation.",
    command: "app terminate-op"
  },
  {
    label: "Applications: Delete",
    description: "argocd app delete",
    detail: "Delete one or more applications with cascade and propagation controls.",
    command: "app delete"
  },
  {
    label: "Projects: List",
    description: "argocd proj list",
    detail: "List AppProjects.",
    command: "proj list"
  },
  {
    label: "Projects: Create",
    description: "argocd proj create",
    detail: "Create an AppProject.",
    command: "proj create"
  },
  {
    label: "Projects: Details",
    description: "argocd proj get",
    detail: "Show AppProject configuration.",
    command: "proj get"
  },
  {
    label: "Projects: Add Destination",
    description: "argocd proj add-destination",
    detail: "Allow a cluster and namespace destination.",
    command: "proj add-destination"
  },
  {
    label: "Projects: Add Source Repo",
    description: "argocd proj add-source",
    detail: "Allow a source repository.",
    command: "proj add-source"
  },
  {
    label: "Projects: Roles",
    description: "argocd proj role",
    detail: "Manage project roles, policies, and JWT tokens.",
    command: "proj role"
  },
  {
    label: "Projects: Sync Windows",
    description: "argocd proj windows",
    detail: "Manage allow or deny sync windows.",
    command: "proj windows"
  },
  {
    label: "Projects: Delete",
    description: "argocd proj delete",
    detail: "Delete an AppProject.",
    command: "proj delete"
  },
  {
    label: "Clusters: List",
    description: "argocd cluster list",
    detail: "List registered deployment clusters.",
    command: "cluster list"
  },
  {
    label: "Clusters: Add",
    description: "argocd cluster add",
    detail: "Register a Kubernetes context as a deployment cluster.",
    command: "cluster add"
  },
  {
    label: "Clusters: Details",
    description: "argocd cluster get",
    detail: "Show cluster credentials and connection status.",
    command: "cluster get"
  },
  {
    label: "Clusters: Remove",
    description: "argocd cluster rm",
    detail: "Remove a registered deployment cluster.",
    command: "cluster rm"
  },
  {
    label: "Repositories: List",
    description: "argocd repo list",
    detail: "List configured Git and Helm repositories.",
    command: "repo list"
  },
  {
    label: "Repositories: Add",
    description: "argocd repo add",
    detail: "Add a Git, Helm, GitHub App, OCI, SSH, HTTPS, or TLS-auth repository.",
    command: "repo add"
  },
  {
    label: "Repositories: Details",
    description: "argocd repo get",
    detail: "Show repository connection details.",
    command: "repo get"
  },
  {
    label: "Repositories: Remove",
    description: "argocd repo rm",
    detail: "Remove a configured repository.",
    command: "repo rm"
  },
  {
    label: "Repository Credentials: List",
    description: "argocd repocreds list",
    detail: "List repository credential templates.",
    command: "repocreds list"
  },
  {
    label: "Repository Credentials: Add",
    description: "argocd repocreds add",
    detail: "Add a repository credential template.",
    command: "repocreds add"
  },
  {
    label: "Repository Credentials: Remove",
    description: "argocd repocreds rm",
    detail: "Remove a repository credential template.",
    command: "repocreds rm"
  },
  {
    label: "Accounts: List",
    description: "argocd account list",
    detail: "List local accounts.",
    command: "account list"
  },
  {
    label: "Accounts: Details",
    description: "argocd account get",
    detail: "Show account capabilities and tokens.",
    command: "account get"
  },
  {
    label: "Accounts: Can I",
    description: "argocd account can-i",
    detail: "Check RBAC permissions.",
    command: "account can-i"
  },
  {
    label: "Accounts: Generate Token",
    description: "argocd account generate-token",
    detail: "Generate an API token.",
    command: "account generate-token"
  },
  {
    label: "Accounts: Delete Token",
    description: "argocd account delete-token",
    detail: "Delete an account token.",
    command: "account delete-token"
  },
  {
    label: "Accounts: Update Password",
    description: "argocd account update-password",
    detail: "Update the current or another local account password.",
    command: "account update-password"
  },
  {
    label: "Certificates: List",
    description: "argocd cert list",
    detail: "List repository TLS certificates and SSH known hosts entries.",
    command: "cert list"
  },
  {
    label: "Certificates: Add TLS",
    description: "argocd cert add-tls",
    detail: "Add repository TLS certificate data.",
    command: "cert add-tls"
  },
  {
    label: "Certificates: Add SSH",
    description: "argocd cert add-ssh",
    detail: "Add repository SSH known host data.",
    command: "cert add-ssh"
  },
  {
    label: "Certificates: Remove",
    description: "argocd cert rm",
    detail: "Remove repository certificate or known host data.",
    command: "cert rm"
  },
  {
    label: "GPG: List",
    description: "argocd gpg list",
    detail: "List GPG keys used for signature verification.",
    command: "gpg list"
  },
  {
    label: "GPG: Add",
    description: "argocd gpg add",
    detail: "Add a GPG public key.",
    command: "gpg add"
  },
  {
    label: "GPG: Remove",
    description: "argocd gpg rm",
    detail: "Remove a GPG public key.",
    command: "gpg rm"
  },
  {
    label: "Contexts: List",
    description: "argocd context",
    detail: "List saved Argo CD contexts.",
    command: "context"
  },
  {
    label: "Contexts: Use",
    description: "argocd context <name>",
    detail: "Switch the active Argo CD context.",
    command: "context"
  },
  {
    label: "Sessions: Login",
    description: "argocd login",
    detail: "Log in with username/password, SSO, grpc-web, TLS, or core-mode options.",
    command: "login"
  },
  {
    label: "Sessions: Logout",
    description: "argocd logout",
    detail: "Log out from a server.",
    command: "logout"
  },
  {
    label: "Sessions: Relogin",
    description: "argocd relogin",
    detail: "Refresh expired authentication.",
    command: "relogin"
  },
  {
    label: "Version",
    description: "argocd version",
    detail: "Show client and server versions.",
    command: "version"
  },
  {
    label: "Admin: Dashboard",
    description: "argocd admin dashboard",
    detail: "Run the local dashboard helper.",
    command: "admin dashboard"
  },
  {
    label: "Admin: Export",
    description: "argocd admin export",
    detail: "Export Argo CD data.",
    command: "admin export"
  },
  {
    label: "Admin: Import",
    description: "argocd admin import",
    detail: "Import Argo CD data.",
    command: "admin import"
  },
  {
    label: "Completion",
    description: "argocd completion",
    detail: "Generate shell completion scripts.",
    command: "completion"
  }
];
