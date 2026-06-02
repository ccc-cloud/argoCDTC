import * as vscode from "vscode";
import { ArgoCdCli } from "./argocdCli";
import { catalogCommands } from "./catalog";
import { showJsonDocument, showTextDocument } from "./documents";
import {
  ArgoApplication,
  ArgoApplicationParameter,
  ArgoCluster,
  ArgoContext,
  ArgoProject,
  ArgoRepository,
  applicationName,
  clusterName,
  projectName,
  repositoryName
} from "./models";
import { ArgoTreeItem, RefreshableTreeProvider } from "./treeProviders";

type ProviderMap = Record<string, Pick<RefreshableTreeProvider<unknown>, "refresh">>;

export function registerCommands(
  context: vscode.ExtensionContext,
  cli: ArgoCdCli,
  providers: ProviderMap
): void {
  const allProviders = Object.values(providers);
  const refreshAll = () => allProviders.forEach(provider => provider.refresh());
  const refreshApplications = () => providers.applications.refresh();

  const register = (id: string, callback: (...args: unknown[]) => unknown) => {
    context.subscriptions.push(vscode.commands.registerCommand(id, callback));
  };

  register("argocd.refreshAll", () => refreshAll());
  register("argocd.login", () => login(cli, refreshAll));
  register("argocd.logout", () => logout(cli, refreshAll));
  register("argocd.relogin", () => {
    cli.terminal(["relogin"], "Argo CD Relogin");
    refreshAll();
  });
  register("argocd.version", () => runText(cli, "Argo CD Version", ["version"]));
  register("argocd.openUi", () => openUi(cli));
  register("argocd.runCatalogCommand", () => runCatalogCommand(cli));
  register("argocd.runArbitraryCli", () => runArbitraryCli(cli));

  register("argocd.app.create", () => createApplication(cli, refreshAll));
  register("argocd.app.get", target => applicationDetails(cli, target));
  register("argocd.app.sync", target => syncApplication(cli, target, refreshApplications));
  register("argocd.app.syncOutOfSync", () => syncOutOfSyncApplications(cli, refreshApplications));
  register("argocd.app.setParameters", target => updateApplicationParameters(cli, target, refreshApplications));
  register("argocd.app.refresh", target => refreshApplication(cli, target, refreshAll, false));
  register("argocd.app.hardRefresh", target => refreshApplication(cli, target, refreshAll, true));
  register("argocd.app.diff", target => appText(cli, "Application Diff", target, ["app", "diff"], true));
  register("argocd.app.logs", target => appTerminal(cli, "Application Logs", target, ["app", "logs"]));
  register("argocd.app.manifests", target => appText(cli, "Application Manifests", target, ["app", "manifests"]));
  register("argocd.app.resources", target => appText(cli, "Application Resources", target, ["app", "resources"]));
  register("argocd.app.history", target => appText(cli, "Application History", target, ["app", "history"]));
  register("argocd.app.wait", target => waitApplication(cli, target));
  register("argocd.app.rollback", target => rollbackApplication(cli, target, refreshAll));
  register("argocd.app.terminateOperation", target => terminateOperation(cli, target, refreshAll));
  register("argocd.app.delete", target => deleteApplication(cli, target, refreshAll));

  register("argocd.project.create", () => createProject(cli, refreshAll));
  register("argocd.project.get", target => projectDetails(cli, target));
  register("argocd.project.delete", target => deleteProject(cli, target, refreshAll));

  register("argocd.repo.add", () => addRepository(cli, refreshAll));
  register("argocd.repo.get", target => repositoryDetails(cli, target));
  register("argocd.repo.remove", target => removeRepository(cli, target, refreshAll));

  register("argocd.cluster.add", () => addCluster(cli, refreshAll));
  register("argocd.cluster.get", target => clusterDetails(cli, target));
  register("argocd.cluster.remove", target => removeCluster(cli, target, refreshAll));

  register("argocd.context.add", () => addContext(cli, refreshAll));
  register("argocd.context.use", target => useContext(cli, target, refreshAll));
  register("argocd.context.edit", target => editContext(cli, target, refreshAll));
  register("argocd.context.remove", target => removeContext(cli, target, refreshAll));
}

interface LoginOptions {
  title?: string;
  promptContextName?: boolean;
  defaultServer?: string;
  defaultContextName?: string;
}

async function login(cli: ArgoCdCli, refreshAll: () => void, options: LoginOptions = {}): Promise<void> {
  const title = options.title ?? "Argo CD Login";
  const server = await showInputBox({
    title,
    prompt: "Argo CD server",
    value: options.defaultServer ?? cli.server,
    placeHolder: "argocd.example.com"
  });
  if (!server) {
    return;
  }

  let contextName = "";
  if (options.promptContextName) {
    const input = await showInputBox({
      title,
      prompt: "Context name",
      value: options.defaultContextName ?? "",
      placeHolder: "Defaults to the server name"
    });
    if (input === undefined) {
      return;
    }
    contextName = input.trim();
  }
  const contextArgs = contextName ? ["--name", contextName] : [];

  const method = await showQuickPick(
    [
      { label: "Username and password", value: "password" },
      { label: "Token", value: "token" },
      { label: "Generate token", value: "generateToken" },
      { label: "SSO", value: "sso" },
      { label: "Core mode", value: "core" }
    ],
    { title: "Login method" }
  );
  if (!method) {
    return;
  }

  if (method.value === "sso") {
    cli.terminal(["login", server, ...contextArgs, "--sso"], title);
    return;
  }

  if (method.value === "core") {
    cli.terminal(["login", ...contextArgs, "--core"], title, false);
    return;
  }

  if (method.value === "token") {
    await loginWithToken(cli, server, contextArgs, contextName, refreshAll, title);
    return;
  }

  if (method.value === "generateToken") {
    await generateTokenAndLogin(cli, server, contextArgs, contextName, refreshAll, title);
    return;
  }

  const username = await showInputBox({
    title,
    prompt: "Username",
    value: "admin"
  });
  if (!username) {
    return;
  }

  const password = await showInputBox({
    title,
    prompt: "Password",
    password: true
  });
  if (!password) {
    return;
  }

  await withProgress(cli, "Logging in to Argo CD", async () => {
    await cli.run(["login", server, ...contextArgs, "--username", username, "--password", password], { redact: [password] });
    vscode.window.showInformationMessage(contextName ? `Added Argo CD context ${contextName}` : `Logged in to ${server}`);
    refreshAll();
  });
}

async function loginWithToken(
  cli: ArgoCdCli,
  server: string,
  contextArgs: string[],
  contextName: string,
  refreshAll: () => void,
  title: string
): Promise<void> {
  const token = await showInputBox({
    title,
    prompt: "Argo CD auth token",
    password: true
  });
  if (!token) {
    return;
  }

  await withProgress(cli, "Logging in to Argo CD with token", async () => {
    await cli.run(["login", server, ...contextArgs, "--auth-token", token], { redact: [token] });
    vscode.window.showInformationMessage(contextName ? `Added Argo CD context ${contextName}` : `Logged in to ${server}`);
    refreshAll();
  });
}

async function generateTokenAndLogin(
  cli: ArgoCdCli,
  server: string,
  contextArgs: string[],
  contextName: string,
  refreshAll: () => void,
  title: string
): Promise<void> {
  const account = await showInputBox({
    title,
    prompt: "Account to generate the token for",
    placeHolder: "Blank uses the current account"
  });
  if (account === undefined) {
    return;
  }

  const daysInput = await showInputBox({
    title,
    prompt: "Token expiration in days",
    value: "7",
    validateInput: input => {
      const days = Number(input);
      return Number.isInteger(days) && days > 0 ? undefined : "Enter a whole number greater than 0";
    }
  });
  if (!daysInput) {
    return;
  }

  const days = Number(daysInput);
  const expiresIn = `${days * 24}h`;
  const accountArgs = account.trim() ? ["--account", account.trim()] : [];

  await withProgress(cli, `Generating ${days}-day Argo CD token`, async () => {
    const result = await cli.run(
      ["account", "generate-token", ...accountArgs, "--expires-in", expiresIn, "--server", server],
      { suppressOutput: true }
    );
    const token = result.stdout.trim();
    if (!token) {
      throw new Error("Argo CD did not return a token.");
    }

    await cli.run(["login", server, ...contextArgs, "--auth-token", token], { redact: [token] });
    vscode.window.showInformationMessage(contextName ? `Added Argo CD context ${contextName}` : `Logged in to ${server}`);
    refreshAll();
  });
}

async function addContext(cli: ArgoCdCli, refreshAll: () => void): Promise<void> {
  await login(cli, refreshAll, {
    title: "Add Argo CD Context",
    promptContextName: true
  });
}

async function logout(cli: ArgoCdCli, refreshAll: () => void): Promise<void> {
  const server = await showInputBox({
    title: "Argo CD Logout",
    prompt: "Server to log out from",
    value: cli.server
  });
  if (!server) {
    return;
  }

  await withProgress(cli, "Logging out of Argo CD", async () => {
    await cli.run(["logout", server]);
    vscode.window.showInformationMessage(`Logged out from ${server}`);
    refreshAll();
  });
}

async function openUi(cli: ArgoCdCli): Promise<void> {
  const server = await showInputBox({
    title: "Open Argo CD UI",
    prompt: "Argo CD server URL",
    value: cli.server,
    placeHolder: "https://argocd.example.com"
  });
  if (!server) {
    return;
  }
  await vscode.env.openExternal(vscode.Uri.parse(normalizeUrl(server)));
}

async function runCatalogCommand(cli: ArgoCdCli): Promise<void> {
  const picked = await showQuickPick(
    catalogCommands.map(command => ({
      label: command.label,
      description: command.description,
      detail: command.detail,
      command
    })),
    {
      title: "Argo CD Command Catalog",
      matchOnDescription: true,
      matchOnDetail: true
    }
  );
  if (!picked) {
    return;
  }

  const extra = await showInputBox({
    title: picked.label,
    prompt: "Arguments to append",
    placeHolder: "guestbook --prune --timeout 120"
  });
  const args = [...splitCommandLine(picked.command.command), ...splitCommandLine(extra ?? "")];
  cli.terminal(args, picked.label);
}

async function runArbitraryCli(cli: ArgoCdCli): Promise<void> {
  const input = await showInputBox({
    title: "Run Any Argo CD CLI Command",
    prompt: "Arguments after argocd",
    placeHolder: "app sync guestbook --prune"
  });
  if (!input) {
    return;
  }
  cli.terminal(splitCommandLine(input), "Argo CD CLI");
}

async function createApplication(cli: ArgoCdCli, refreshAll: () => void): Promise<void> {
  const name = await inputRequired("Create Application", "Application name", "guestbook");
  if (!name) {
    return;
  }
  const repo = await inputRequired("Create Application", "Git or Helm repository URL", "https://github.com/argoproj/argocd-example-apps.git");
  if (!repo) {
    return;
  }
  const path = await showInputBox({
    title: "Create Application",
    prompt: "Repository path or Helm chart name",
    value: "guestbook"
  });
  if (!path) {
    return;
  }
  const destination = await showInputBox({
    title: "Create Application",
    prompt: "Destination server or cluster name",
    value: "https://kubernetes.default.svc"
  });
  if (!destination) {
    return;
  }
  const namespace = await showInputBox({
    title: "Create Application",
    prompt: "Destination namespace",
    value: "default"
  });
  if (!namespace) {
    return;
  }
  const project = await showInputBox({
    title: "Create Application",
    prompt: "Project",
    value: "default"
  });
  if (!project) {
    return;
  }

  const destinationFlag = destination.startsWith("http") ? "--dest-server" : "--dest-name";
  await withProgress(cli, `Creating application ${name}`, async () => {
    await cli.run([
      "app",
      "create",
      name,
      "--repo",
      repo,
      "--path",
      path,
      destinationFlag,
      destination,
      "--dest-namespace",
      namespace,
      "--project",
      project
    ]);
    vscode.window.showInformationMessage(`Created Argo CD application ${name}`);
    refreshAll();
  });
}

async function applicationDetails(cli: ArgoCdCli, target: unknown): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }
  await withProgress(cli, `Loading ${name}`, async () => {
    await showJsonDocument(`Argo CD Application: ${name}`, await cli.getApplication(name));
  });
}

async function syncApplication(cli: ArgoCdCli, target: unknown, refreshApplications: () => void): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }
  const mode = await showQuickPick(syncModeOptions(), { title: `Sync ${name}` });
  if (!mode) {
    return;
  }
  const confirmed = await confirm(`Sync application ${name}?`, "Sync");
  if (!confirmed) {
    return;
  }
  cli.output.show(true);
  await withProgress(cli, `Syncing ${name}`, async () => {
    await withLiveRefresh(refreshApplications, async () => {
      await cli.run(["app", "sync", name, ...mode.args], { streamOutput: true });
      vscode.window.showInformationMessage(`Sync completed for ${name}`);
    });
  });
}

async function syncOutOfSyncApplications(cli: ArgoCdCli, refreshApplications: () => void): Promise<void> {
  const apps = await withProgress(cli, "Loading OutOfSync applications", async () => await cli.listApplications());
  if (!apps) {
    return;
  }

  const outOfSyncApps = apps.filter(app => app.status?.sync?.status === "OutOfSync");
  if (outOfSyncApps.length === 0) {
    vscode.window.showInformationMessage("No OutOfSync Argo CD applications found.");
    return;
  }

  const picked = await showQuickPickMany(
    outOfSyncApps.map(app => ({
      label: applicationName(app),
      description: [app.status?.sync?.status, app.status?.health?.status].filter(Boolean).join(" / "),
      detail: app.spec?.source?.repoURL ?? app.spec?.sources?.map(source => source.repoURL).filter(Boolean).join(", "),
      app
    })),
    {
      title: "Select OutOfSync applications to sync",
      matchOnDescription: true,
      matchOnDetail: true
    }
  );
  if (!picked || picked.length === 0) {
    return;
  }

  const selectedApps = picked.map(item => item.app);
  const mode = await showQuickPick(syncModeOptions(), { title: `Sync ${selectedApps.length} application${selectedApps.length === 1 ? "" : "s"}` });
  if (!mode) {
    return;
  }

  const names = selectedApps.map(applicationName);
  const confirmed = await confirm(`Sync ${names.length} OutOfSync application${names.length === 1 ? "" : "s"}?`, "Sync");
  if (!confirmed) {
    return;
  }

  cli.output.show(true);
  await withProgress(cli, `Syncing ${names.length} application${names.length === 1 ? "" : "s"}`, async () => {
    await withLiveRefresh(refreshApplications, async () => {
      await cli.run(["app", "sync", ...names, ...mode.args], { streamOutput: true });
      vscode.window.showInformationMessage(`Sync completed for ${names.length} application${names.length === 1 ? "" : "s"}.`);
    });
  });
}

async function updateApplicationParameters(cli: ArgoCdCli, target: unknown, refreshApplications: () => void): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }

  const app = await withProgress(cli, `Loading parameters for ${name}`, async () => await cli.getApplication(name));
  if (!app) {
    return;
  }

  const existingParameters = existingApplicationParameters(app);
  const originalValues = new Map(existingParameters.map(parameter => [parameter.name, parameter.value]));
  const values = new Map(originalValues);
  const parameters = await collectParameterUpdates(name, originalValues, values);
  if (parameters.length === 0) {
    return;
  }

  const confirmed = await confirm(`Update ${parameters.length} parameter${parameters.length === 1 ? "" : "s"} on ${name}?\n${parameterSummary(parameters)}`, "Update");
  if (!confirmed) {
    return;
  }

  await withProgress(cli, `Updating parameters for ${name}`, async () => {
    const parameterArgs = parameters.flatMap(parameter => ["--parameter", `${parameter.name}=${parameter.value}`]);
    await cli.run(["app", "set", name, ...parameterArgs]);
    vscode.window.showInformationMessage(`Updated ${parameters.length} parameter${parameters.length === 1 ? "" : "s"} for ${name}.`);
    refreshApplications();
  });
}

async function refreshApplication(cli: ArgoCdCli, target: unknown, refreshAll: () => void, hard: boolean): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }
  await withProgress(cli, `${hard ? "Hard refreshing" : "Refreshing"} ${name}`, async () => {
    await cli.run(["app", "get", name, hard ? "--hard-refresh" : "--refresh"]);
    vscode.window.showInformationMessage(`${hard ? "Hard refresh" : "Refresh"} requested for ${name}`);
    refreshAll();
  });
}

async function appText(
  cli: ArgoCdCli,
  title: string,
  target: unknown,
  prefix: string[],
  allowFailure = false
): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }
  await withProgress(cli, `${title}: ${name}`, async () => {
    const result = await cli.run([...prefix, name], { allowFailure });
    await showTextDocument(`${title}: ${name}`, [result.stdout, result.stderr].filter(Boolean).join("\n"));
  });
}

async function appTerminal(cli: ArgoCdCli, title: string, target: unknown, prefix: string[]): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }
  cli.terminal([...prefix, name], `${title}: ${name}`);
}

async function waitApplication(cli: ArgoCdCli, target: unknown): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }
  const mode = await showQuickPick(
    [
      { label: "Healthy and synced", args: ["--health", "--sync"] },
      { label: "Healthy", args: ["--health"] },
      { label: "Synced", args: ["--sync"] },
      { label: "Operation complete", args: ["--operation"] },
      { label: "Hydrated", args: ["--hydrated"] },
      { label: "Deleted", args: ["--delete"] }
    ],
    { title: `Wait for ${name}` }
  );
  if (!mode) {
    return;
  }
  cli.terminal(["app", "wait", name, ...mode.args], `Wait ${name}`);
}

async function rollbackApplication(cli: ArgoCdCli, target: unknown, refreshAll: () => void): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }
  const historyId = await inputRequired("Rollback Application", "History ID", "0");
  if (!historyId) {
    return;
  }
  const confirmed = await confirm(`Rollback ${name} to history ID ${historyId}?`, "Rollback");
  if (!confirmed) {
    return;
  }
  cli.terminal(["app", "rollback", name, historyId], `Rollback ${name}`);
  refreshAll();
}

async function terminateOperation(cli: ArgoCdCli, target: unknown, refreshAll: () => void): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }
  if (!(await confirm(`Terminate the current operation for ${name}?`, "Terminate"))) {
    return;
  }
  await withProgress(cli, `Terminating ${name}`, async () => {
    await cli.run(["app", "terminate-op", name]);
    vscode.window.showInformationMessage(`Operation terminated for ${name}`);
    refreshAll();
  });
}

async function deleteApplication(cli: ArgoCdCli, target: unknown, refreshAll: () => void): Promise<void> {
  const name = await selectApplication(cli, target);
  if (!name) {
    return;
  }
  const cascade = await showQuickPick(
    [
      { label: "Cascade delete managed resources", args: ["--cascade"] },
      { label: "Delete application only", args: ["--cascade=false"] }
    ],
    { title: `Delete ${name}` }
  );
  if (!cascade) {
    return;
  }
  if (!(await confirm(`Delete application ${name}?`, "Delete"))) {
    return;
  }
  await withProgress(cli, `Deleting ${name}`, async () => {
    await cli.run(["app", "delete", name, ...cascade.args, "--yes"]);
    vscode.window.showInformationMessage(`Deleted Argo CD application ${name}`);
    refreshAll();
  });
}

async function createProject(cli: ArgoCdCli, refreshAll: () => void): Promise<void> {
  const name = await inputRequired("Create Project", "Project name", "platform");
  if (!name) {
    return;
  }
  const description = await showInputBox({
    title: "Create Project",
    prompt: "Description",
    value: ""
  });
  const args = ["proj", "create", name];
  if (description) {
    args.push("--description", description);
  }
  await withProgress(cli, `Creating project ${name}`, async () => {
    await cli.run(args);
    vscode.window.showInformationMessage(`Created Argo CD project ${name}`);
    refreshAll();
  });
}

async function projectDetails(cli: ArgoCdCli, target: unknown): Promise<void> {
  const name = await selectProject(cli, target);
  if (!name) {
    return;
  }
  await withProgress(cli, `Loading project ${name}`, async () => {
    await showJsonDocument(`Argo CD Project: ${name}`, await cli.getProject(name));
  });
}

async function deleteProject(cli: ArgoCdCli, target: unknown, refreshAll: () => void): Promise<void> {
  const name = await selectProject(cli, target);
  if (!name) {
    return;
  }
  if (!(await confirm(`Delete project ${name}?`, "Delete"))) {
    return;
  }
  await withProgress(cli, `Deleting project ${name}`, async () => {
    await cli.run(["proj", "delete", name]);
    vscode.window.showInformationMessage(`Deleted Argo CD project ${name}`);
    refreshAll();
  });
}

async function addRepository(cli: ArgoCdCli, refreshAll: () => void): Promise<void> {
  const repo = await inputRequired("Add Repository", "Repository URL", "https://github.com/example/repo.git");
  if (!repo) {
    return;
  }
  const type = await showQuickPick(
    [
      { label: "Git", args: [] },
      { label: "Helm", args: ["--type", "helm"] },
      { label: "OCI Helm", args: ["--type", "helm", "--enable-oci"] }
    ],
    { title: "Repository type" }
  );
  if (!type) {
    return;
  }
  const extra = await showInputBox({
    title: "Add Repository",
    prompt: "Extra CLI arguments",
    placeHolder: "--username USER --ssh-private-key-path ~/.ssh/id_rsa"
  });
  cli.terminal(["repo", "add", repo, ...type.args, ...splitCommandLine(extra ?? "")], "Add Argo CD Repository");
  refreshAll();
}

async function repositoryDetails(cli: ArgoCdCli, target: unknown): Promise<void> {
  const repo = await selectRepository(cli, target);
  if (!repo) {
    return;
  }
  await withProgress(cli, `Loading repository ${repo}`, async () => {
    await showJsonDocument(`Argo CD Repository: ${repo}`, await cli.getRepository(repo));
  });
}

async function removeRepository(cli: ArgoCdCli, target: unknown, refreshAll: () => void): Promise<void> {
  const repo = await selectRepository(cli, target);
  if (!repo) {
    return;
  }
  if (!(await confirm(`Remove repository ${repo}?`, "Remove"))) {
    return;
  }
  await withProgress(cli, `Removing repository ${repo}`, async () => {
    await cli.run(["repo", "rm", repo]);
    vscode.window.showInformationMessage(`Removed Argo CD repository ${repo}`);
    refreshAll();
  });
}

async function addCluster(cli: ArgoCdCli, refreshAll: () => void): Promise<void> {
  const kubeContext = await inputRequired("Add Cluster", "Kubernetes context name", "docker-desktop");
  if (!kubeContext) {
    return;
  }
  const extra = await showInputBox({
    title: "Add Cluster",
    prompt: "Extra CLI arguments",
    placeHolder: "--name dev --namespace default"
  });
  cli.terminal(["cluster", "add", kubeContext, ...splitCommandLine(extra ?? "")], "Add Argo CD Cluster");
  refreshAll();
}

async function clusterDetails(cli: ArgoCdCli, target: unknown): Promise<void> {
  const name = await selectCluster(cli, target);
  if (!name) {
    return;
  }
  await withProgress(cli, `Loading cluster ${name}`, async () => {
    await showJsonDocument(`Argo CD Cluster: ${name}`, await cli.getCluster(name));
  });
}

async function removeCluster(cli: ArgoCdCli, target: unknown, refreshAll: () => void): Promise<void> {
  const name = await selectCluster(cli, target);
  if (!name) {
    return;
  }
  if (!(await confirm(`Remove cluster ${name}?`, "Remove"))) {
    return;
  }
  await withProgress(cli, `Removing cluster ${name}`, async () => {
    await cli.run(["cluster", "rm", name]);
    vscode.window.showInformationMessage(`Removed Argo CD cluster ${name}`);
    refreshAll();
  });
}

async function useContext(cli: ArgoCdCli, target: unknown, refreshAll: () => void): Promise<void> {
  const name = await selectContext(cli, target);
  if (!name) {
    return;
  }
  await withProgress(cli, `Switching to context ${name}`, async () => {
    await cli.run(["context", name], { includeGlobalArgs: false });
    vscode.window.showInformationMessage(`Using Argo CD context ${name}`);
    refreshAll();
  });
}

async function editContext(cli: ArgoCdCli, target: unknown, refreshAll: () => void): Promise<void> {
  const context = await selectContextValue(cli, target);
  if (!context) {
    return;
  }

  const mode = await showQuickPick(
    [
      { label: "Re-login / update credentials", value: "login" },
      { label: "Edit local name/server/user references", value: "references" }
    ],
    { title: `Edit Context: ${context.name}` }
  );
  if (!mode) {
    return;
  }

  if (mode.value === "login") {
    await login(cli, refreshAll, {
      title: `Edit Argo CD Context: ${context.name}`,
      promptContextName: true,
      defaultContextName: context.name,
      defaultServer: context.server
    });
    return;
  }

  const nextName = await showInputBox({
    title: `Edit Context: ${context.name}`,
    prompt: "Context name",
    value: context.name,
    validateInput: input => input.trim() ? undefined : "Context name is required"
  });
  if (nextName === undefined) {
    return;
  }

  const nextServer = await showInputBox({
    title: `Edit Context: ${context.name}`,
    prompt: "Server reference",
    value: context.server ?? "",
    placeHolder: "argocd.example.com"
  });
  if (nextServer === undefined) {
    return;
  }

  const nextUser = await showInputBox({
    title: `Edit Context: ${context.name}`,
    prompt: "User reference",
    value: context.user ?? "",
    placeHolder: "Usually matches the server or account entry"
  });
  if (nextUser === undefined) {
    return;
  }

  await withProgress(cli, `Editing context ${context.name}`, async () => {
    await cli.editContext(context.name, {
      name: nextName,
      server: nextServer,
      user: nextUser
    });
    vscode.window.showInformationMessage(`Updated Argo CD context ${nextName.trim()}`);
    refreshAll();
  });
}

async function removeContext(cli: ArgoCdCli, target: unknown, refreshAll: () => void): Promise<void> {
  const name = await selectContext(cli, target);
  if (!name) {
    return;
  }
  if (!(await confirm(`Remove Argo CD context ${name}?`, "Remove"))) {
    return;
  }
  await withProgress(cli, `Removing context ${name}`, async () => {
    await cli.removeContext(name);
    vscode.window.showInformationMessage(`Removed Argo CD context ${name}`);
    refreshAll();
  });
}

async function selectApplication(cli: ArgoCdCli, target: unknown): Promise<string | undefined> {
  const direct = targetName(target, "application", value => applicationName(value as ArgoApplication));
  if (direct) {
    return direct;
  }
  const apps = await cli.listApplications();
  const picked = await showQuickPick(
    apps.map(app => ({
      label: applicationName(app),
      description: [app.status?.sync?.status, app.status?.health?.status].filter(Boolean).join(" / "),
      detail: app.spec?.source?.repoURL ?? app.spec?.sources?.map(source => source.repoURL).filter(Boolean).join(", "),
      app
    })),
    { title: "Select Argo CD application", matchOnDescription: true, matchOnDetail: true }
  );
  return picked?.label;
}

async function selectProject(cli: ArgoCdCli, target: unknown): Promise<string | undefined> {
  const direct = targetName(target, "project", value => projectName(value as ArgoProject));
  if (direct) {
    return direct;
  }
  const projects = await cli.listProjects();
  const picked = await showQuickPick(
    projects.map(project => ({
      label: projectName(project),
      description: project.description
    })),
    { title: "Select Argo CD project", matchOnDescription: true }
  );
  return picked?.label;
}

async function selectRepository(cli: ArgoCdCli, target: unknown): Promise<string | undefined> {
  const direct = targetName(target, "repository", value => repositoryName(value as ArgoRepository));
  if (direct) {
    return direct;
  }
  const repos = await cli.listRepositories();
  const picked = await showQuickPick(
    repos.map(repo => ({
      label: repositoryName(repo),
      description: [repo.type, repo.project].filter(Boolean).join(" / ")
    })),
    { title: "Select Argo CD repository", matchOnDescription: true }
  );
  return picked?.label;
}

async function selectCluster(cli: ArgoCdCli, target: unknown): Promise<string | undefined> {
  const direct = targetName(target, "cluster", value => clusterName(value as ArgoCluster));
  if (direct) {
    return direct;
  }
  const clusters = await cli.listClusters();
  const picked = await showQuickPick(
    clusters.map(cluster => ({
      label: clusterName(cluster),
      description: cluster.connectionState?.status,
      detail: cluster.server
    })),
    { title: "Select Argo CD cluster", matchOnDescription: true, matchOnDetail: true }
  );
  return picked?.label;
}

async function selectContext(cli: ArgoCdCli, target: unknown): Promise<string | undefined> {
  return (await selectContextValue(cli, target))?.name;
}

async function selectContextValue(cli: ArgoCdCli, target: unknown): Promise<ArgoContext | undefined> {
  const direct = targetName(target, "context", value => (value as ArgoContext).name);
  if (direct) {
    const contexts = await cli.listContexts();
    return contexts.find(context => context.name === direct) ?? { name: direct };
  }
  const contexts = await cli.listContexts();
  const picked = await showQuickPick(
    contexts.map(context => ({
      label: context.name,
      description: context.current ? "current" : context.server,
      detail: context.raw,
      context
    })),
    { title: "Select Argo CD context", matchOnDescription: true, matchOnDetail: true }
  );
  return picked?.context;
}

function targetName(target: unknown, kind: string, extract: (value: unknown) => string): string | undefined {
  if (typeof target === "string" && target.trim()) {
    return target.trim();
  }
  if (target instanceof ArgoTreeItem && target.kind === kind) {
    return extract(target.value);
  }
  return undefined;
}

async function runText(cli: ArgoCdCli, title: string, args: string[]): Promise<void> {
  await withProgress(cli, title, async () => {
    const result = await cli.run(args);
    await showTextDocument(title, [result.stdout, result.stderr].filter(Boolean).join("\n"));
  });
}

async function withProgress<T>(cli: ArgoCdCli, title: string, task: () => Promise<T>): Promise<T | undefined> {
  try {
    return await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title, cancellable: false },
      task
    );
  } catch (error) {
    cli.output.show(true);
    vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

async function withLiveRefresh<T>(refresh: () => void, task: () => Promise<T>): Promise<T> {
  refresh();
  const timer = setInterval(refresh, 1000);
  try {
    return await task();
  } finally {
    clearInterval(timer);
    refresh();
    schedulePostSyncRefreshes(refresh);
  }
}

async function confirm(message: string, action: string): Promise<boolean> {
  return (await vscode.window.showWarningMessage(message, { modal: true }, action)) === action;
}

async function showInputBox(options: vscode.InputBoxOptions): Promise<string | undefined> {
  return await vscode.window.showInputBox({ ignoreFocusOut: true, ...options });
}

async function showQuickPick<T extends vscode.QuickPickItem>(
  items: readonly T[],
  options: vscode.QuickPickOptions = {}
): Promise<T | undefined> {
  return await vscode.window.showQuickPick(items, { ignoreFocusOut: true, ...options });
}

async function showQuickPickMany<T extends vscode.QuickPickItem>(
  items: readonly T[],
  options: vscode.QuickPickOptions = {}
): Promise<T[] | undefined> {
  return await vscode.window.showQuickPick(items, { ignoreFocusOut: true, ...options, canPickMany: true });
}

async function inputRequired(title: string, prompt: string, value = ""): Promise<string | undefined> {
  return await showInputBox({
    title,
    prompt,
    value,
    validateInput: input => input.trim() ? undefined : `${prompt} is required`
  });
}

interface SyncMode extends vscode.QuickPickItem {
  args: string[];
}

function syncModeOptions(): SyncMode[] {
  return [
    { label: "Sync", args: [] },
    { label: "Sync and prune", args: ["--prune"] },
    { label: "Dry run", args: ["--dry-run"] },
    { label: "Force", args: ["--force"] },
    { label: "Server-side apply", args: ["--server-side"] }
  ];
}

interface ParameterUpdate {
  name: string;
  value: string;
}

type ParameterPick =
  | (vscode.QuickPickItem & { action: "apply" | "add" | "bulk" })
  | (vscode.QuickPickItem & { action: "edit"; name: string });

async function collectParameterUpdates(
  appName: string,
  originalValues: Map<string, string>,
  values: Map<string, string>
): Promise<ParameterUpdate[]> {
  while (true) {
    const changes = changedParameters(originalValues, values);
    const picked = await showQuickPick(parameterPickItems(originalValues, values, changes.length), {
      title: `Update Parameters: ${appName}`,
      placeHolder: changes.length > 0
        ? "Search a parameter to edit, add one, or apply changes"
        : "Search a parameter to edit or add one"
    });

    if (!picked) {
      return [];
    }

    if (picked.action === "apply") {
      if (changes.length === 0) {
        vscode.window.showInformationMessage("No parameter changes to apply.");
        continue;
      }
      return changes;
    }

    if (picked.action === "add") {
      await addParameterValue(values);
      continue;
    }

    if (picked.action === "bulk") {
      await bulkUpdateParameterValues(values);
      continue;
    }

    if (picked.action === "edit") {
      await editParameterValue(picked.name, values);
    }
  }
}

function parameterPickItems(
  originalValues: Map<string, string>,
  values: Map<string, string>,
  changeCount: number
): ParameterPick[] {
  const actionItems: ParameterPick[] = [
    {
      label: "$(check) Apply changes",
      description: changeCount > 0 ? `${changeCount} pending` : "no pending changes",
      action: "apply"
    },
    {
      label: "$(add) Add parameter",
      action: "add"
    },
    {
      label: "$(list-unordered) Bulk paste parameters",
      description: "name=value or JSON",
      action: "bulk"
    }
  ];

  const parameterItems = Array.from(values.entries()).map(([name, value]) => {
    const originalValue = originalValues.get(name);
    const changed = originalValue !== value;
    return {
      label: name,
      description: value,
      detail: changed
        ? originalValues.has(name) ? `Edited, was: ${originalValue}` : "New parameter"
        : "Current value",
      action: "edit" as const,
      name
    };
  });

  return [
    ...actionItems,
    ...parameterItems
  ];
}

async function addParameterValue(values: Map<string, string>): Promise<void> {
  const name = await showInputBox({
    title: "Add Parameter",
    prompt: "Parameter name",
    placeHolder: "backend.image.tag",
    validateInput: input => input.trim() ? undefined : "Parameter name is required"
  });
  if (!name) {
    return;
  }

  await editParameterValue(name.trim(), values);
}

async function editParameterValue(name: string, values: Map<string, string>): Promise<void> {
  const value = await showInputBox({
    title: `Update ${name}`,
    prompt: "Parameter value",
    value: values.get(name) ?? "",
    placeHolder: "1.202-26"
  });
  if (value === undefined) {
    return;
  }
  values.set(name, value);
}

async function bulkUpdateParameterValues(values: Map<string, string>): Promise<void> {
  const input = await showInputBox({
    title: "Bulk Paste Parameters",
    prompt: "Paste name=value pairs or JSON with a parameters array",
    placeHolder: "nameOverride=nexus, backend.image.tag=1.202-26, ui.image.tag=1.202-26",
    value: parameterInputValue(mapToParameters(values)),
    validateInput: value => parseParameterUpdates(value).error
  });
  if (input === undefined) {
    return;
  }

  const parsed = parseParameterUpdates(input);
  if (parsed.error) {
    vscode.window.showErrorMessage(parsed.error);
    return;
  }

  for (const parameter of parsed.parameters) {
    values.set(parameter.name, parameter.value);
  }
}

function changedParameters(originalValues: Map<string, string>, values: Map<string, string>): ParameterUpdate[] {
  return Array.from(values.entries())
    .filter(([name, value]) => originalValues.get(name) !== value)
    .map(([name, value]) => ({ name, value }));
}

function existingApplicationParameters(app: ArgoApplication): ParameterUpdate[] {
  const primaryParameters = normalizeApplicationParameters(app.spec?.source?.helm?.parameters);
  if (primaryParameters.length > 0) {
    return primaryParameters;
  }

  const sourceParameterGroups = app.spec?.sources
    ?.map(source => normalizeApplicationParameters(source.helm?.parameters))
    .filter(parameters => parameters.length > 0) ?? [];

  return sourceParameterGroups.length === 1 ? sourceParameterGroups[0] : [];
}

function normalizeApplicationParameters(parameters: ArgoApplicationParameter[] | undefined): ParameterUpdate[] {
  return parameters
    ?.map(parameter => ({
      name: parameter.name?.trim() ?? "",
      value: parameter.value ?? ""
    }))
    .filter(parameter => parameter.name) ?? [];
}

function parameterInputValue(parameters: ParameterUpdate[]): string {
  return parameters.map(parameter => `${parameter.name}=${parameter.value}`).join(", ");
}

function mapToParameters(values: Map<string, string>): ParameterUpdate[] {
  return Array.from(values.entries()).map(([name, value]) => ({ name, value }));
}

function parseParameterUpdates(input: string): { parameters: ParameterUpdate[]; error?: undefined } | { parameters: ParameterUpdate[]; error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { parameters: [], error: "Enter at least one parameter." };
  }

  const jsonLike = toParameterJson(trimmed);
  if (jsonLike) {
    try {
      const parsed = JSON.parse(jsonLike) as unknown;
      const parameters = parametersFromJson(parsed);
      return parameters.length > 0
        ? { parameters }
        : { parameters: [], error: "JSON must contain at least one parameter with name and value." };
    } catch (error) {
      return { parameters: [], error: error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON." };
    }
  }

  const parameters: ParameterUpdate[] = [];
  for (const rawPart of trimmed.split(/[,\r\n]+/)) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }
    const separator = part.indexOf("=");
    if (separator < 1) {
      return { parameters: [], error: `Use name=value syntax for "${part}".` };
    }
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) {
      return { parameters: [], error: "Parameter names cannot be empty." };
    }
    parameters.push({ name, value });
  }

  return parameters.length > 0
    ? { parameters }
    : { parameters: [], error: "Enter at least one parameter." };
}

function toParameterJson(input: string): string | undefined {
  if (input.startsWith("[") || input.startsWith("{")) {
    return input;
  }
  if (/^"parameters"\s*:/.test(input)) {
    return `{${input}}`;
  }
  return undefined;
}

function parametersFromJson(value: unknown): ParameterUpdate[] {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { parameters?: unknown }).parameters)
      ? (value as { parameters: unknown[] }).parameters
      : [];

  return source.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Parameter ${index + 1} must be an object.`);
    }
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) {
      throw new Error(`Parameter ${index + 1} is missing a name.`);
    }
    if (!Object.prototype.hasOwnProperty.call(record, "value")) {
      throw new Error(`Parameter ${index + 1} is missing a value.`);
    }
    return {
      name,
      value: String(record.value)
    };
  });
}

function parameterSummary(parameters: ParameterUpdate[]): string {
  const summary = parameters.map(parameter => `${parameter.name}=${parameter.value}`).join(", ");
  return summary.length <= 180 ? summary : `${summary.slice(0, 177)}...`;
}

function schedulePostSyncRefreshes(refresh: () => void): void {
  for (const delayMs of [500, 1500, 3000, 5000, 10000]) {
    setTimeout(refresh, delayMs);
  }
}

function normalizeUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function splitCommandLine(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: "'" | "\"" | undefined;
  let escaping = false;

  for (const char of input.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }
  return args;
}
