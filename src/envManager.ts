import * as vscode from "vscode";
import type { KulalaCoreBridge } from "./core/bridge";
import { getSelectedEnv, setSelectedEnv } from "./config";

export async function pickEnvironment(
  bridge: KulalaCoreBridge,
  context: vscode.ExtensionContext,
  cwd: string,
): Promise<void> {
  const { catalog, err } = await bridge.listEnvironments(cwd);
  const envNames = Object.keys(catalog?.environments ?? {}).sort((a, b) => a.localeCompare(b));
  if (err || envNames.length === 0) {
    void vscode.window.showErrorMessage(err ?? "No environments found.");
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.find((f) => cwd.startsWith(f.uri.fsPath));
  const current = getSelectedEnv(context, folder);
  const picked = await vscode.window.showQuickPick(
    envNames.map((name) => ({
      label: name,
      picked: name === current,
    })),
    { title: "Kulala environment", placeHolder: `Current: ${current}` },
  );
  if (!picked) return;
  await setSelectedEnv(context, picked.label, folder);
  void vscode.window.showInformationMessage(`Kulala environment: ${picked.label}`);
}
