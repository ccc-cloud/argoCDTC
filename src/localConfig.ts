import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import YAML from "yaml";
import { ArgoContext } from "./models";

interface LocalArgoConfig {
  "current-context"?: unknown;
  contexts?: unknown;
  servers?: unknown;
  users?: unknown;
  [key: string]: unknown;
}

interface LocalContextRef {
  name?: unknown;
  server?: unknown;
  user?: unknown;
  [key: string]: unknown;
}

interface LocalServer {
  server?: unknown;
  [key: string]: unknown;
}

interface LocalUser {
  name?: unknown;
  [key: string]: unknown;
}

export interface LocalContextUpdate {
  name: string;
  server: string;
  user: string;
}

export async function listLocalContexts(): Promise<ArgoContext[]> {
  const configPath = await localConfigPath();
  const config = await readLocalConfig(configPath);
  if (!config) {
    return [];
  }

  const currentContext = text(config["current-context"]);
  const servers = localServers(config);
  const users = localUsers(config);

  return localContexts(config)
    .map(context => {
      const name = text(context.name);
      const serverRef = text(context.server);
      const userRef = text(context.user);
      const server = servers.find(item => text(item.server) === serverRef);
      const user = users.find(item => text(item.name) === userRef);
      const missingServer = serverRef && !server;
      const missingUser = userRef && !user;

      return {
        name,
        server: serverRef,
        user: userRef,
        current: name === currentContext,
        raw: [
          `context=${name}`,
          serverRef ? `server=${serverRef}${missingServer ? " (missing)" : ""}` : undefined,
          userRef ? `user=${userRef}${missingUser ? " (missing)" : ""}` : undefined
        ].filter(Boolean).join(" ")
      };
    })
    .filter(context => context.name);
}

export async function removeLocalContext(name: string): Promise<void> {
  const configPath = await localConfigPath();
  const config = await readLocalConfig(configPath);
  if (!config) {
    throw new Error("No local Argo CD config found.");
  }

  const contexts = localContexts(config);
  const target = contexts.find(context => text(context.name) === name);
  if (!target) {
    throw new Error(`Context ${name} does not exist.`);
  }

  const targetServer = text(target.server);
  const targetUser = text(target.user);
  const remainingContexts = contexts.filter(context => text(context.name) !== name);
  config.contexts = remainingContexts;

  if (targetUser && !remainingContexts.some(context => text(context.user) === targetUser)) {
    config.users = localUsers(config).filter(user => text(user.name) !== targetUser);
  }

  if (targetServer && !remainingContexts.some(context => text(context.server) === targetServer)) {
    config.servers = localServers(config).filter(server => text(server.server) !== targetServer);
  }

  if (text(config["current-context"]) === name) {
    config["current-context"] = "";
  }

  if (isEmptyConfig(config)) {
    await fs.rm(configPath, { force: true });
    return;
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, YAML.stringify(config), "utf8");
}

export async function editLocalContext(name: string, update: LocalContextUpdate): Promise<void> {
  const configPath = await localConfigPath();
  const config = await readLocalConfig(configPath);
  if (!config) {
    throw new Error("No local Argo CD config found.");
  }

  const contexts = localContexts(config);
  const target = contexts.find(context => text(context.name) === name);
  if (!target) {
    throw new Error(`Context ${name} does not exist.`);
  }

  const nextName = update.name.trim();
  if (!nextName) {
    throw new Error("Context name is required.");
  }

  if (nextName !== name && contexts.some(context => text(context.name) === nextName)) {
    throw new Error(`Context ${nextName} already exists.`);
  }

  target.name = nextName;
  target.server = update.server.trim();
  target.user = update.user.trim();

  if (text(config["current-context"]) === name) {
    config["current-context"] = nextName;
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, YAML.stringify(config), "utf8");
}

async function localConfigPath(): Promise<string> {
  const configured = configuredConfigPath();
  if (configured) {
    return configured;
  }

  const configDir = process.env.ARGOCD_CONFIG_DIR;
  if (configDir) {
    return path.join(configDir, "config");
  }

  const home = os.homedir();
  const legacy = path.join(home, ".argocd");
  if (await exists(legacy)) {
    return path.join(legacy, "config");
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, "argocd", "config");
  }

  return path.join(home, ".config", "argocd", "config");
}

function configuredConfigPath(): string {
  const extraArgs = vscode.workspace.getConfiguration("argocd").get<string[]>("extraArgs", []);
  if (!Array.isArray(extraArgs)) {
    return "";
  }

  for (let index = 0; index < extraArgs.length; index += 1) {
    const arg = extraArgs[index];
    if (arg === "--config") {
      return extraArgs[index + 1] ?? "";
    }
    if (arg.startsWith("--config=")) {
      return arg.slice("--config=".length);
    }
  }
  return "";
}

async function readLocalConfig(configPath: string): Promise<LocalArgoConfig | undefined> {
  try {
    const content = await fs.readFile(configPath, "utf8");
    return (YAML.parse(content) ?? {}) as LocalArgoConfig;
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

function localContexts(config: LocalArgoConfig): LocalContextRef[] {
  return Array.isArray(config.contexts) ? config.contexts.filter(isRecord) : [];
}

function localServers(config: LocalArgoConfig): LocalServer[] {
  return Array.isArray(config.servers) ? config.servers.filter(isRecord) : [];
}

function localUsers(config: LocalArgoConfig): LocalUser[] {
  return Array.isArray(config.users) ? config.users.filter(isRecord) : [];
}

function isEmptyConfig(config: LocalArgoConfig): boolean {
  return localContexts(config).length === 0 && localServers(config).length === 0 && localUsers(config).length === 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
