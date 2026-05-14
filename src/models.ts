export interface ArgoMetadata {
  name?: string;
  namespace?: string;
  labels?: Record<string, string>;
}

export interface ArgoApplication {
  metadata?: ArgoMetadata;
  name?: string;
  spec?: {
    project?: string;
    source?: {
      repoURL?: string;
      path?: string;
      targetRevision?: string;
      chart?: string;
    };
    sources?: Array<{
      repoURL?: string;
      path?: string;
      targetRevision?: string;
      chart?: string;
      ref?: string;
      name?: string;
    }>;
    destination?: {
      server?: string;
      name?: string;
      namespace?: string;
    };
    syncPolicy?: unknown;
  };
  status?: {
    sync?: {
      status?: string;
      revision?: string;
    };
    health?: {
      status?: string;
      message?: string;
    };
    operationState?: {
      phase?: string;
      message?: string;
    };
    conditions?: Array<{
      type?: string;
      message?: string;
    }>;
    summary?: {
      externalURLs?: string[];
    };
  };
}

export interface ArgoProject {
  metadata?: ArgoMetadata;
  name?: string;
  description?: string;
  destinations?: unknown[];
  sourceRepos?: string[];
  roles?: unknown[];
}

export interface ArgoCluster {
  name?: string;
  server?: string;
  namespace?: string;
  connectionState?: {
    status?: string;
    message?: string;
  };
  serverVersion?: string;
}

export interface ArgoRepository {
  repo?: string;
  name?: string;
  type?: string;
  project?: string;
  connectionState?: {
    status?: string;
    message?: string;
  };
}

export interface ArgoContext {
  name: string;
  server?: string;
  user?: string;
  current?: boolean;
  raw?: string;
}

export function applicationName(app: ArgoApplication): string {
  return app.metadata?.name ?? app.name ?? "unknown";
}

export function projectName(project: ArgoProject): string {
  return project.metadata?.name ?? project.name ?? "unknown";
}

export function clusterName(cluster: ArgoCluster): string {
  return cluster.name ?? cluster.server ?? "unknown";
}

export function repositoryName(repository: ArgoRepository): string {
  return repository.name ?? repository.repo ?? "unknown";
}

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["items", "result", "repositories", "clusters", "applications", "projects"]) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        return nested as T[];
      }
    }
  }

  return [];
}
