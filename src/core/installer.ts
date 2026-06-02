import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { corePath, coreVersion, downloadUrlTemplate } from "../config";
import { installedBinaryName, releaseAssetName } from "./platform";

export function binDir(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, "bin");
}

export function installedBinaryPath(context: vscode.ExtensionContext): string {
  return path.join(binDir(context), installedBinaryName());
}

function versionFile(context: vscode.ExtensionContext): string {
  return path.join(binDir(context), "version.txt");
}

export function getInstalledVersion(context: vscode.ExtensionContext): string | undefined {
  try {
    return fs.readFileSync(versionFile(context), "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buf);
}

export async function ensureCoreInstalled(context: vscode.ExtensionContext): Promise<string> {
  const configured = corePath();
  if (configured) {
    if (!fs.existsSync(configured)) {
      throw new Error(`kulala.corePath does not exist: ${configured}`);
    }
    return configured;
  }

  const version = coreVersion();
  const binPath = installedBinaryPath(context);
  const installed = getInstalledVersion(context);

  if (fs.existsSync(binPath) && installed === version) {
    return binPath;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Kulala",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: `Downloading kulala-core v${version}…` });
      await fs.promises.mkdir(binDir(context), { recursive: true });

      const asset = releaseAssetName();
      const tag = `v${version}`;
      const url = downloadUrlTemplate().replace("%s", tag).replace("%s", asset);
      const tmp = `${binPath}.download`;

      await downloadFile(url, tmp);
      await fs.promises.rename(tmp, binPath);
      if (process.platform !== "win32") {
        await fs.promises.chmod(binPath, 0o755);
      }
      await fs.promises.writeFile(versionFile(context), version, "utf8");
    },
  );

  return binPath;
}
