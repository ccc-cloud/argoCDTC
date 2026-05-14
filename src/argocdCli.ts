import { spawn } from "child_process";
import * as vscode from "vscode";
import { outputLine } from "./documents";
import {
  ArgoApplication,
  ArgoCluster,
  ArgoContext,
  ArgoProject,
  ArgoRepository,
  asArray
} from "./models";
import { commandLine, runInTerminal } from "./terminal";

export interface CliResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface RunOptions {
  includeGlobalArgs?: boolean;
  json?: boolean;
  allowFailure?: boolean;
  redact?: string[];
}

export class ArgoCdCli {
  constructor(readonly output: vscode.OutputChannel) {}

  get executable(): string {
    return this.config().get<string>("cliPath", "argocd");
  }

  get server(): string {
    return this.config().get<string>("defaultServer", "").trim();
  }

  globalArgs(): string[] {
    const cfg = this.config();
    const args: string[] = [];
    const defaultContext = cfg.get<string>("defaultContext", "").trim();
    const kubeContext = cfg.get<string>("kubeContext", "").trim();
    const portForwardNamespace = cfg.get<string>("portForwardNamespace", "").trim();

    if (defaultContext) {
      args.push("--argocd-context", defaultContext);
    }
    if (cfg.get<boolean>("core", false)) {
      args.push("--core");
    }
    if (kubeContext) {
      args.push("--kube-context", kubeContext);
    }
    if (cfg.get<boolean>("insecure", false)) {
      args.push("--insecure");
    }
    if (cfg.get<boolean>("grpcWeb", false)) {
      args.push("--grpc-web");
    }
    if (cfg.get<boolean>("plaintext", false)) {
      args.push("--plaintext");
    }
    if (cfg.get<boolean>("portForward", false)) {
      args.push("--port-forward");
    }
    if (portForwardNamespace) {
      args.push("--port-forward-namespace", portForwardNamespace);
    }

    const extraArgs = cfg.get<string[]>("extraArgs", []);
    if (Array.isArray(extraArgs)) {
      args.push(...extraArgs.filter(Boolean));
    }

    return args;
  }

  buildArgs(args: string[], options: RunOptions = {}): string[] {
    const allArgs = options.includeGlobalArgs === false ? [...args] : [...this.globalArgs(), ...args];
    if (options.json && !allArgs.includes("-o") && !allArgs.includes("--output")) {
      allArgs.push("-o", "json");
    }
    return allArgs;
  }

  terminal(args: string[], title = "Argo CD", includeGlobalArgs = true): void {
    runInTerminal(title, this.executable, includeGlobalArgs ? this.buildArgs(args) : args);
  }

  terminalCommand(args: string[], includeGlobalArgs = true): string {
    return commandLine(this.executable, includeGlobalArgs ? this.buildArgs(args) : args);
  }

  async run(args: string[], options: RunOptions = {}): Promise<CliResult> {
    const allArgs = this.buildArgs(args, options);
    const redacted = redactArgs(allArgs, options.redact ?? []);
    outputLine(this.output, `$ ${commandLine(this.executable, redacted)}`);

    return await new Promise<CliResult>((resolve, reject) => {
      const child = spawn(this.executable, allArgs, {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        shell: false,
        env: process.env
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", chunk => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", chunk => {
        stderr += chunk.toString();
      });

      child.on("error", error => {
        const hint = `Failed to run ${this.executable}. Check argocd.cliPath and make sure the Argo CD CLI is installed.`;
        this.output.appendLine(hint);
        reject(new Error(`${hint}\n${error.message}`));
      });

      child.on("close", code => {
        const result: CliResult = { stdout, stderr, code };
        if (stdout.trim()) {
          this.output.appendLine(stdout.trimEnd());
        }
        if (stderr.trim()) {
          this.output.appendLine(stderr.trimEnd());
        }

        if (code !== 0 && !options.allowFailure) {
          reject(new Error(stderr.trim() || stdout.trim() || `argocd exited with code ${code}`));
          return;
        }

        resolve(result);
      });
    });
  }

  async json<T>(args: string[]): Promise<T> {
    const result = await this.run(args, { json: true });
    return parseJson<T>(result.stdout);
  }

  async listApplications(): Promise<ArgoApplication[]> {
    return asArray<ArgoApplication>(await this.json<unknown>(["app", "list"]));
  }

  async getApplication(name: string): Promise<ArgoApplication> {
    return await this.json<ArgoApplication>(["app", "get", name]);
  }

  async listProjects(): Promise<ArgoProject[]> {
    return asArray<ArgoProject>(await this.json<unknown>(["proj", "list"]));
  }

  async getProject(name: string): Promise<unknown> {
    return await this.json<unknown>(["proj", "get", name]);
  }

  async listClusters(): Promise<ArgoCluster[]> {
    return asArray<ArgoCluster>(await this.json<unknown>(["cluster", "list"]));
  }

  async getCluster(nameOrServer: string): Promise<unknown> {
    return await this.json<unknown>(["cluster", "get", nameOrServer]);
  }

  async listRepositories(): Promise<ArgoRepository[]> {
    return asArray<ArgoRepository>(await this.json<unknown>(["repo", "list"]));
  }

  async getRepository(repo: string): Promise<unknown> {
    return await this.json<unknown>(["repo", "get", repo]);
  }

  async listContexts(): Promise<ArgoContext[]> {
    const result = await this.run(["context"], { includeGlobalArgs: false });
    return parseContexts(result.stdout);
  }

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("argocd");
  }
}

function parseJson<T>(stdout: string): T {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("Argo CD returned no JSON output.");
  }
  return JSON.parse(trimmed) as T;
}

function parseContexts(stdout: string): ArgoContext[] {
  return stdout
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line.trim() && !/^CURRENT\s+/.test(line.trim()))
    .map(line => {
      const current = line.trimStart().startsWith("*");
      const clean = line.replace(/^\s*\*\s*/, "").trim();
      const parts = clean.split(/\s+/);
      return {
        name: parts[0] ?? clean,
        server: parts[1],
        user: parts[2],
        current,
        raw: line
      };
    })
    .filter(context => context.name);
}

function redactArgs(args: string[], values: string[]): string[] {
  if (values.length === 0) {
    return args;
  }
  return args.map(arg => (values.includes(arg) ? "********" : arg));
}
