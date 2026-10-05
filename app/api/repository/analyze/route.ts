import { NextResponse } from "next/server";

type GithubEntry = { name: string; path: string; type: "file" | "dir"; size?: number };

type Analysis = {
  runtime: string;
  runtimeVersion: string;
  framework: string | null;
  buildTool: string;
  buildCommand: string;
  testCommand: string;
  dockerfile: string | null;
  kubernetes: boolean;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  warnings: string[];
  recommendedStages: Array<{ type: string; label: string; description: string }>;
};

/** Accept GitHub web URLs, .git URLs, SSH URLs, and owner/repo shorthand. */
function parseGithubRepo(value: string) {
  let input = value.trim().replace(/^['"]|['"]$/g, "");
  if (!input) throw new Error("Repository URL is required.");

  // git@github.com:owner/repo.git
  const ssh = input.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2].replace(/\.git$/i, "") };

  // github.com/owner/repo, owner/repo, or full https URL.
  if (!/^https?:\/\//i.test(input)) input = `https://github.com/${input.replace(/^\/+/, "")}`;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid repository. Use owner/repository or https://github.com/owner/repository.git");
  }

  if (url.hostname.toLowerCase() !== "github.com") {
    throw new Error("Only github.com repositories are supported in this version.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("Use owner/repository or https://github.com/owner/repository.git");

  const owner = decodeURIComponent(parts[0]);
  const repo = decodeURIComponent(parts[1]).replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("Invalid GitHub owner or repository name.");
  }
  return { owner, repo };
}

async function github(path: string, token?: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("GitHub repository was not found or is private. Check the owner/repository and connect GitHub access for private repositories.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("GitHub authentication or access is required for this repository.");
    }
    throw new Error(`GitHub returned ${response.status} for ${path}`);
  }
  return response.json();
}

function inferVersion(text: string, patterns: RegExp[], fallback: string) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return fallback;
}

function stages(runtime: string, hasDockerfile: boolean, hasTests: boolean, kubernetes: boolean) {
  const result: Analysis["recommendedStages"] = [
    { type: "git", label: "Checkout", description: "Clone the selected repository and branch." },
    { type: "build", label: "Build", description: "Install dependencies and compile the application." },
  ];
  if (hasTests) result.push({ type: "test", label: "Test", description: "Run the detected automated test command." });
  result.push({ type: "security", label: "Security", description: "Run dependency and source security checks." });
  if (hasDockerfile) result.push({ type: "image", label: "Build Image", description: "Build and scan the application container." });
  if (kubernetes) result.push({ type: "deploy", label: "Deploy", description: "Deploy the detected Kubernetes configuration." });
  else result.push({ type: "deploy", label: "Deploy", description: `Deploy ${runtime} application to a connected Kubernetes cluster.` });
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const repositoryUrl = String(body.repositoryUrl ?? "").trim();
    const { owner, repo } = parseGithubRepo(repositoryUrl);
    const token = process.env.GITHUB_TOKEN;

    const repoInfo = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);
    const branch = String(body.branch || repoInfo.default_branch || "main");
    const entries = (await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents?ref=${encodeURIComponent(branch)}`, token)) as GithubEntry[];
    if (!Array.isArray(entries)) throw new Error("Repository root could not be read.");

    const names = new Set(entries.map((entry) => entry.name.toLowerCase()));
    const relevantFiles = [
      "pom.xml", "mvnw", "build.gradle", "build.gradle.kts", "gradlew", "pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "pytest.ini", "tox.ini",
      "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "go.mod", "Cargo.toml", "Dockerfile",
    ];
    const fileTexts = new Map<string, string>();
    await Promise.all(relevantFiles.filter((file) => names.has(file.toLowerCase())).map(async (file) => {
      try {
        const data = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(file)}?ref=${encodeURIComponent(branch)}`, token);
        if (data.content && data.encoding === "base64") fileTexts.set(file, Buffer.from(data.content, "base64").toString("utf8"));
      } catch { /* filename detection is still useful */ }
    }));

    const evidence: string[] = [];
    const warnings: string[] = [];
    let runtime = "unknown";
    let runtimeVersion = "latest";
    let framework: string | null = null;
    let buildTool = "custom";
    let buildCommand = "";
    let testCommand = "";
    let confidence: Analysis["confidence"] = "low";

    if (names.has("pom.xml") || names.has("mvnw")) {
      runtime = "java"; buildTool = "maven"; buildCommand = names.has("mvnw") ? "./mvnw -B package -DskipTests" : "mvn -B package -DskipTests"; testCommand = names.has("mvnw") ? "./mvnw -B test" : "mvn -B test"; confidence = "high"; evidence.push("Maven project detected from pom.xml/mvnw");
      const pom = fileTexts.get("pom.xml") || "";
      runtimeVersion = inferVersion(pom, [/<maven.compiler.release>\s*([^<]+)</, /<java.version>\s*([^<]+)</, /<maven.compiler.source>\s*([^<]+)</], "21");
      if (/spring-boot/i.test(pom)) framework = "Spring Boot";
    } else if (names.has("build.gradle") || names.has("build.gradle.kts") || names.has("gradlew")) {
      runtime = "java"; buildTool = "gradle"; buildCommand = names.has("gradlew") ? "./gradlew build -x test" : "gradle build -x test"; testCommand = names.has("gradlew") ? "./gradlew test" : "gradle test"; confidence = "high"; evidence.push("Gradle project detected");
      const gradle = fileTexts.get("build.gradle") || fileTexts.get("build.gradle.kts") || "";
      runtimeVersion = inferVersion(gradle, [/(?:sourceCompatibility|JavaVersion\.VERSION_)(?:\s*=\s*|\. )[\"']?(\d+)/i, /languageVersion.*?JavaLanguageVersion\.of\((\d+)\)/i], "21");
      if (/org.springframework.boot/i.test(gradle)) framework = "Spring Boot";
    } else if (names.has("pyproject.toml") || names.has("requirements.txt") || names.has("setup.py") || names.has("pipfile")) {
      runtime = "python"; buildTool = names.has("pyproject.toml") ? "pip/pyproject" : "pip"; buildCommand = names.has("requirements.txt") ? "python -m pip install -r requirements.txt" : "python -m pip install -e ."; testCommand = names.has("pytest.ini") || names.has("tox.ini") || names.has("tests") ? "python -m pytest" : "python -m unittest discover"; confidence = "high"; evidence.push("Python packaging/test markers detected");
      const pyproject = fileTexts.get("pyproject.toml") || "";
      runtimeVersion = inferVersion(pyproject, [/requires-python\s*=\s*[\"']>=?([0-9.]+)/i], "3.13");
      if (/django/i.test(pyproject)) framework = "Django"; else if (/fastapi/i.test(pyproject)) framework = "FastAPI"; else if (/flask/i.test(pyproject)) framework = "Flask";
    } else if (names.has("package.json")) {
      runtime = "nodejs"; buildTool = names.has("pnpm-lock.yaml") ? "pnpm" : names.has("yarn.lock") ? "yarn" : "npm"; buildCommand = buildTool === "pnpm" ? "pnpm install --frozen-lockfile" : buildTool === "yarn" ? "yarn install --immutable" : "npm ci"; testCommand = buildTool === "pnpm" ? "pnpm test" : buildTool === "yarn" ? "yarn test" : "npm test"; confidence = "high"; evidence.push("package.json detected");
      const pkg = fileTexts.get("package.json") || "";
      runtimeVersion = inferVersion(pkg, [/\"node\"\s*:\s*[\"']>=?([0-9]+)/i], "22");
      if (/next/i.test(pkg)) framework = "Next.js"; else if (/express/i.test(pkg)) framework = "Express";
    } else if (names.has("go.mod")) {
      runtime = "go"; buildTool = "go"; buildCommand = "go build ./..."; testCommand = "go test ./..."; runtimeVersion = "1.24"; confidence = "high"; evidence.push("go.mod detected");
    } else if (names.has("cargo.toml")) {
      runtime = "rust"; buildTool = "cargo"; buildCommand = "cargo build --release"; testCommand = "cargo test"; runtimeVersion = "stable"; confidence = "high"; evidence.push("Cargo.toml detected");
    } else if (names.has("dockerfile")) {
      runtime = "container"; buildTool = "dockerfile"; buildCommand = "docker build ."; confidence = "medium"; evidence.push("Dockerfile detected"); warnings.push("No supported application manifest was detected; TekForge will not invent a test command.");
    } else {
      warnings.push("No supported runtime marker was detected. Add a Dockerfile or a standard project manifest.");
    }

    const kubernetes = entries.some((entry) => ["k8s", "kubernetes"].includes(entry.name.toLowerCase())) || entries.some((entry) => /^(deployment|service)\.ya?ml$/i.test(entry.name));
    const dockerfile = entries.find((entry) => entry.name.toLowerCase() === "dockerfile")?.path ?? null;
    if (!dockerfile) warnings.push("A Dockerfile is required for the current image-build stage.");
    if (!testCommand) warnings.push("No automated test command was selected.");

    const analysis: Analysis = {
      runtime, runtimeVersion, framework, buildTool, buildCommand, testCommand, dockerfile, kubernetes, confidence,
      evidence, warnings, recommendedStages: stages(runtime, Boolean(dockerfile), Boolean(testCommand), kubernetes),
    };

    return NextResponse.json({
      repository: { owner, repo, branch, defaultBranch: repoInfo.default_branch, private: Boolean(repoInfo.private), url: repoInfo.html_url },
      analysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repository analysis failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
