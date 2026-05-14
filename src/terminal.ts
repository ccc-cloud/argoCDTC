import * as vscode from "vscode";

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_/:=.,@%+\-]+$/.test(value)) {
    return value;
  }

  if (process.platform === "win32") {
    return `'${value.replace(/'/g, "''")}'`;
  }

  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

export function commandLine(executable: string, args: string[]): string {
  return [executable, ...args].map(shellQuote).join(" ");
}

export function runInTerminal(name: string, executable: string, args: string[]): void {
  const terminal = vscode.window.createTerminal({ name });
  terminal.show();
  terminal.sendText(commandLine(executable, args));
}
