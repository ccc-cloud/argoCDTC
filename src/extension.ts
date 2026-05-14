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

  registerCommands(context, cli, {
    applications,
    projects,
    clusters,
    repositories,
    contexts
  });
}

export function deactivate(): void {}
