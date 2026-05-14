import * as vscode from "vscode";
import { ArgoCdCli } from "./argocdCli";
import {
  ArgoApplication,
  ArgoCluster,
  ArgoContext,
  ArgoProject,
  ArgoRepository,
  applicationName,
  clusterName,
  projectName,
  repositoryName
} from "./models";

export type ArgoTreeKind = "application" | "project" | "cluster" | "repository" | "context" | "message";

export class ArgoTreeItem<T = unknown> extends vscode.TreeItem {
  constructor(
    public readonly kind: ArgoTreeKind,
    public readonly value: T,
    label: string,
    collapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
  }
}

export abstract class RefreshableTreeProvider<T> implements vscode.TreeDataProvider<ArgoTreeItem<T | string>> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ArgoTreeItem<T | string> | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(protected readonly cli: ArgoCdCli) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: ArgoTreeItem<T | string>): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<Array<ArgoTreeItem<T | string>>> {
    try {
      const items = await this.load();
      if (items.length === 0) {
        return [this.message("No items found")];
      }
      return items.map(item => this.toTreeItem(item));
    } catch (error) {
      return [this.message(error instanceof Error ? error.message : String(error), "error")];
    }
  }

  protected abstract load(): Promise<T[]>;

  protected abstract toTreeItem(value: T): ArgoTreeItem<T>;

  protected message(text: string, icon = "info"): ArgoTreeItem<string> {
    const item = new ArgoTreeItem<string>("message", text, text);
    item.iconPath = new vscode.ThemeIcon(icon);
    item.tooltip = text;
    return item;
  }
}

export class ApplicationsProvider extends RefreshableTreeProvider<ArgoApplication> {
  protected load(): Promise<ArgoApplication[]> {
    return this.cli.listApplications();
  }

  protected toTreeItem(app: ArgoApplication): ArgoTreeItem<ArgoApplication> {
    const name = applicationName(app);
    const sync = app.status?.sync?.status ?? "Unknown";
    const health = app.status?.health?.status ?? "Unknown";
    const project = app.spec?.project ?? "default";
    const item = new ArgoTreeItem("application", app, name);
    item.contextValue = "argocdApp";
    item.description = `${sync} / ${health}`;
    item.tooltip = [
      `Application: ${name}`,
      `Project: ${project}`,
      `Sync: ${sync}`,
      `Health: ${health}`,
      `Destination: ${app.spec?.destination?.name ?? app.spec?.destination?.server ?? "unknown"}`,
      `Namespace: ${app.spec?.destination?.namespace ?? "default"}`
    ].join("\n");
    item.iconPath = statusIcon(sync, health);
    item.command = {
      command: "argocd.app.get",
      title: "Open Application",
      arguments: [item]
    };
    return item;
  }
}

export class ProjectsProvider extends RefreshableTreeProvider<ArgoProject> {
  protected load(): Promise<ArgoProject[]> {
    return this.cli.listProjects();
  }

  protected toTreeItem(project: ArgoProject): ArgoTreeItem<ArgoProject> {
    const name = projectName(project);
    const item = new ArgoTreeItem("project", project, name);
    item.contextValue = "argocdProject";
    item.description = project.description ?? "";
    item.tooltip = [
      `Project: ${name}`,
      project.description ? `Description: ${project.description}` : undefined,
      `Source repos: ${project.sourceRepos?.length ?? 0}`,
      `Destinations: ${project.destinations?.length ?? 0}`,
      `Roles: ${project.roles?.length ?? 0}`
    ].filter(Boolean).join("\n");
    item.iconPath = new vscode.ThemeIcon("folder-library");
    item.command = {
      command: "argocd.project.get",
      title: "Open Project",
      arguments: [item]
    };
    return item;
  }
}

export class ClustersProvider extends RefreshableTreeProvider<ArgoCluster> {
  protected load(): Promise<ArgoCluster[]> {
    return this.cli.listClusters();
  }

  protected toTreeItem(cluster: ArgoCluster): ArgoTreeItem<ArgoCluster> {
    const name = clusterName(cluster);
    const status = cluster.connectionState?.status ?? "Unknown";
    const item = new ArgoTreeItem("cluster", cluster, name);
    item.contextValue = "argocdCluster";
    item.description = status;
    item.tooltip = [
      `Cluster: ${name}`,
      `Server: ${cluster.server ?? "unknown"}`,
      `Namespace: ${cluster.namespace ?? "all"}`,
      `Connection: ${status}`,
      cluster.serverVersion ? `Kubernetes: ${cluster.serverVersion}` : undefined,
      cluster.connectionState?.message
    ].filter(Boolean).join("\n");
    item.iconPath = status === "Successful"
      ? new vscode.ThemeIcon("server-process", new vscode.ThemeColor("testing.iconPassed"))
      : new vscode.ThemeIcon("server-environment", new vscode.ThemeColor("testing.iconErrored"));
    item.command = {
      command: "argocd.cluster.get",
      title: "Open Cluster",
      arguments: [item]
    };
    return item;
  }
}

export class RepositoriesProvider extends RefreshableTreeProvider<ArgoRepository> {
  protected load(): Promise<ArgoRepository[]> {
    return this.cli.listRepositories();
  }

  protected toTreeItem(repository: ArgoRepository): ArgoTreeItem<ArgoRepository> {
    const name = repositoryName(repository);
    const status = repository.connectionState?.status ?? "";
    const item = new ArgoTreeItem("repository", repository, name);
    item.contextValue = "argocdRepo";
    item.description = [repository.type, repository.project].filter(Boolean).join(" / ");
    item.tooltip = [
      `Repository: ${name}`,
      repository.repo ? `URL: ${repository.repo}` : undefined,
      repository.type ? `Type: ${repository.type}` : undefined,
      repository.project ? `Project: ${repository.project}` : undefined,
      status ? `Connection: ${status}` : undefined,
      repository.connectionState?.message
    ].filter(Boolean).join("\n");
    item.iconPath = status === "Successful" || !status
      ? new vscode.ThemeIcon("repo")
      : new vscode.ThemeIcon("warning", new vscode.ThemeColor("testing.iconErrored"));
    item.command = {
      command: "argocd.repo.get",
      title: "Open Repository",
      arguments: [item]
    };
    return item;
  }
}

export class ContextsProvider extends RefreshableTreeProvider<ArgoContext> {
  protected load(): Promise<ArgoContext[]> {
    return this.cli.listContexts();
  }

  protected toTreeItem(context: ArgoContext): ArgoTreeItem<ArgoContext> {
    const item = new ArgoTreeItem("context", context, context.name);
    item.contextValue = "argocdContext";
    item.description = context.current ? "current" : context.server;
    item.tooltip = [
      `Context: ${context.name}`,
      context.server ? `Server: ${context.server}` : undefined,
      context.user ? `User: ${context.user}` : undefined,
      context.current ? "Current context" : undefined,
      context.raw
    ].filter(Boolean).join("\n");
    item.iconPath = context.current
      ? new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"))
      : new vscode.ThemeIcon("server");
    return item;
  }
}

function statusIcon(sync: string, health: string): vscode.ThemeIcon {
  if (health === "Degraded" || health === "Missing" || sync === "Unknown") {
    return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconErrored"));
  }
  if (sync === "OutOfSync") {
    return new vscode.ThemeIcon("warning", new vscode.ThemeColor("testing.iconFailed"));
  }
  if (health === "Progressing" || sync === "Progressing") {
    return new vscode.ThemeIcon("sync~spin", new vscode.ThemeColor("charts.blue"));
  }
  if (sync === "Synced" && health === "Healthy") {
    return new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("testing.iconPassed"));
  }
  return new vscode.ThemeIcon("circle-large-outline");
}
