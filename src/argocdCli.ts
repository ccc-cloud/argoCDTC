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
import { editLocalContext, listLocalContexts, LocalContextUpdate, removeLocalContext } from "./localConfig";
import { commandLine, runInTerminal, shellQuote } from "./terminal";

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
  streamOutput?: boolean;
  suppressOutput?: boolean;
  cancellationToken?: vscode.CancellationToken;
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
    let global = options.includeGlobalArgs === false ? [] : this.globalArgs();
    // --core and --kube-context bypass the ArgoCD server API; strip them when
    // an explicit server connection is requested via `login` or --server.
    if (args[0] === "login" || args.includes("--server")) {
      global = stripKubeModeArgs(global);
    }
    // --argocd-context is irrelevant for `login` (which uses --name to set the
    // context name) and can cause "context not found" failures before the context exists.
    if (args[0] === "login") {
      global = stripArgWithValue(global, "--argocd-context");
    }
    const allArgs = [...global, ...args];
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

      options.cancellationToken?.onCancellationRequested(() => {
        child.kill();
        reject(new vscode.CancellationError());
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", chunk => {
        const text = chunk.toString();
        stdout += text;
        if (options.streamOutput) {
          this.output.append(text);
        }
      });

      child.stderr.on("data", chunk => {
        const text = chunk.toString();
        stderr += text;
        if (options.streamOutput) {
          this.output.append(text);
        }
      });

      child.on("error", error => {
        const hint = `Failed to run ${this.executable}. Check argocd.cliPath and make sure the Argo CD CLI is installed.`;
        this.output.appendLine(hint);
        reject(new Error(`${hint}\n${error.message}`));
      });

      child.on("close", code => {
        const result: CliResult = { stdout, stderr, code };
        if (stdout.trim() && !options.streamOutput && !options.suppressOutput) {
          this.output.appendLine(stdout.trimEnd());
        }
        if (stderr.trim() && !options.streamOutput && !options.suppressOutput) {
          this.output.appendLine(stderr.trimEnd());
        }

        if (code !== 0 && !options.allowFailure) {
          reject(new Error(toUserFacingCliError(stderr.trim() || stdout.trim() || `argocd exited with code ${code}`, this.executable, this.server)));
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
    return await listLocalContexts();
  }

  async removeContext(name: string): Promise<void> {
    await removeLocalContext(name);
  }

  async editContext(name: string, update: LocalContextUpdate): Promise<void> {
    await editLocalContext(name, update);
  }

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("argocd");
  }
}

export function toUserFacingCliError(message: string, executable = "argocd", server = ""): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Argo CD command failed.";
  }

  const tokenExpired = /invalid session|token is expired/i.test(trimmed) || (/unauthenticated/i.test(trimmed) && /session|token/i.test(trimmed));
  const grpcWebRequired = /--grpc-web|grpc-web|failed to invoke grpc call/i.test(trimmed);

  if (tokenExpired) {
    const serverArg = server || "<ARGOCD_SERVER>";
    const reloginArgs = grpcWebRequired ? ["relogin", "--grpc-web"] : ["relogin"];
    const ssoLoginArgs = grpcWebRequired ? ["login", serverArg, "--sso", "--grpc-web"] : ["login", serverArg, "--sso"];
    const passwordLoginArgs = grpcWebRequired
      ? ["login", serverArg, "--username", "<USER>", "--password", "<PASSWORD>", "--grpc-web"]
      : ["login", serverArg, "--username", "<USER>", "--password", "<PASSWORD>"];

    return [
      "Argo CD session expired. Run Argo CD: Relogin, or run one of these commands:",
      `  ${exampleCommand(executable, reloginArgs)}`,
      `  ${exampleCommand(executable, ssoLoginArgs)}`,
      `  ${exampleCommand(executable, passwordLoginArgs)}`,
      ...(grpcWebRequired ? ["This server also requires gRPC-Web. Set \"argocd.grpcWeb\": true in VS Code settings."] : [])
    ].join("\n");
  }

  if (grpcWebRequired) {
    return [
      "Argo CD server requires gRPC-Web.",
      "Set \"argocd.grpcWeb\": true in VS Code settings, then run Argo CD: Login again.",
      `CLI example: ${exampleCommand(executable, ["login", server || "<ARGOCD_SERVER>", "--sso", "--grpc-web"])}`
    ].join("\n");
  }

  return trimmed;
}

function parseJson<T>(stdout: string): T {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("Argo CD returned no JSON output.");
  }
  return JSON.parse(trimmed) as T;
}

function redactArgs(args: string[], values: string[]): string[] {
  if (values.length === 0) {
    return args;
  }
  return args.map(arg => (values.includes(arg) ? "********" : arg));
}

function exampleCommand(executable: string, args: string[]): string {
  return [executable, ...args].map(exampleArg).join(" ");
}

function exampleArg(value: string): string {
  if (/^<[^>\s]+>$/.test(value)) {
    return value;
  }
  return shellQuote(value);
}

function stripKubeModeArgs(args: string[]): string[] {
  return stripArgWithValue(stripArgNoValue(args, "--core"), "--kube-context");
}

function stripArgNoValue(args: string[], flag: string): string[] {
  return args.filter(arg => arg !== flag);
}

function stripArgWithValue(args: string[], flag: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      i++; // skip flag and its value
      continue;
    }
    result.push(args[i]);
  }
  return result;
}
