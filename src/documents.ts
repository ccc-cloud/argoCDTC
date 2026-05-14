import * as vscode from "vscode";

export async function showJsonDocument(title: string, value: unknown): Promise<void> {
  const content = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const document = await vscode.workspace.openTextDocument({
    content,
    language: "json"
  });
  await vscode.window.showTextDocument(document, { preview: false });
}

export async function showTextDocument(title: string, content: string, language = "text"): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content: `// ${title}\n${content}`,
    language
  });
  await vscode.window.showTextDocument(document, { preview: false });
}

export function outputLine(output: vscode.OutputChannel, message: string): void {
  output.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
}
