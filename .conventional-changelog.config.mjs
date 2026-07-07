import createPreset from "conventional-changelog-conventionalcommits";

const REPO_HOST = "https://github.com";
const REPO_OWNER = "mistweaverco";
const REPO_NAME = "kulala.vscode";
const REPO_URL = `${REPO_HOST}/${REPO_OWNER}/${REPO_NAME}`;

const config = createPreset({
  commitUrlFormat: `${REPO_URL}/commit/{{hash}}`,
  compareUrlFormat: `${REPO_URL}/compare/{{previousTag}}...{{currentTag}}`,
  ignoreCommits: /^skip-changelog\b/i,
});

export default config;
