/** Release asset platform id (matches kulala-core / kulala.nvim). */
export function releasePlatform(): string {
  let osName: string;
  if (process.platform === "darwin") {
    osName = "darwin";
  } else if (process.platform === "win32") {
    osName = "windows";
  } else {
    osName = "linux";
  }

  let archName: string = process.arch;
  if (archName === "x64") {
    archName = "x86_64";
  } else if (archName === "arm64") {
    archName = osName === "darwin" ? "arm64" : "aarch64";
  }

  return `${osName}-${archName}`;
}

export function releaseAssetName(): string {
  const base = `kulala-core-${releasePlatform()}`;
  return process.platform === "win32" ? `${base}.exe` : base;
}

export function installedBinaryName(): string {
  return process.platform === "win32" ? "kulala-core.exe" : "kulala-core";
}
