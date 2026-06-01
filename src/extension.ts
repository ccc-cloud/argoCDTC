import * as vscode from "vscode";
import { ArgoCdCli } from "./argocdCli";
import { registerCommands } from "./commands";
import {
  ApplicationsProvider,
  ClustersProvider,
  ContextsProvider,
  ProjectsProvider,
  RepositoriesProvider
} from "./treeProviders";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Argo CD");
  const cli = new ArgoCdCli(output);

  const applications = new ApplicationsProvider(cli);
  const projects = new ProjectsProvider(cli);
  const clusters = new ClustersProvider(cli);
  const repositories = new RepositoriesProvider(cli);
  const contexts = new ContextsProvider(cli);

  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider("argocdApplications", applications),
    vscode.window.registerTreeDataProvider("argocdProjects", projects),
    vscode.window.registerTreeDataProvider("argocdClusters", clusters),
    vscode.window.registerTreeDataProvider("argocdRepositories", repositories),
    vscode.window.registerTreeDataProvider("argocdContexts", contexts)
  );

  const applicationsAutoRefresh = createApplicationsAutoRefresh(applications);
  context.subscriptions.push(
    applicationsAutoRefresh,
    vscode.workspace.onDidChangeConfiguration(event => {
      if (
        event.affectsConfiguration("argocd.applicationsAutoRefresh") ||
        event.affectsConfiguration("argocd.applicationsAutoRefreshIntervalSeconds")
      ) {
        applicationsAutoRefresh.reconfigure();
      }
    })
  );

  registerCommands(context, cli, {
    applications,
    projects,
    clusters,
    repositories,
    contexts
  });
}

export function deactivate(): void {}

interface ReconfigurableDisposable extends vscode.Disposable {
  reconfigure(): void;
}

function createApplicationsAutoRefresh(applications: ApplicationsProvider): ReconfigurableDisposable {
  let timer: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  const reconfigure = () => {
    stop();

    const config = vscode.workspace.getConfiguration("argocd");
    if (!config.get<boolean>("applicationsAutoRefresh", true)) {
      return;
    }

    const seconds = Math.max(3, config.get<number>("applicationsAutoRefreshIntervalSeconds", 15));
    timer = setInterval(() => applications.refresh(), seconds * 1000);
  };

  reconfigure();

  return {
    reconfigure,
    dispose: stop
  };
}
