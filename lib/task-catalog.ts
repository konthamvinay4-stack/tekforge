export type TaskCatalogCategory =
  | "Testing"
  | "Code Quality"
  | "Security"
  | "Build"
  | "Deployment"
  | "Verification";

export type IntegrationField = {
  key: string;
  label: string;
  type: "text" | "secret" | "select" | "number" | "boolean";
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
  defaultValue?: string | number | boolean;
};

export type TaskCatalogItem = {
  id: string;
  name: string;
  category: TaskCatalogCategory;
  description: string;
  image: string;
  fields: IntegrationField[];
  outputs: string[];
};

export const taskCatalog: TaskCatalogItem[] = [
  {
    id: "test-command",
    name: "Custom Test Command",
    category: "Testing",
    description: "Run the test command already defined by your application.",
    image: "node:22-bookworm-slim",
    fields: [
      { key: "testCommand", label: "Test command", type: "text", required: true, defaultValue: "npm test", placeholder: "npm test" },
      { key: "workingDirectory", label: "Working directory", type: "text", defaultValue: ".", placeholder: "." },
      { key: "timeout", label: "Timeout", type: "select", options: ["5m", "10m", "20m", "30m", "60m"], defaultValue: "10m" },
    ],
    outputs: ["test.status", "test.exitCode"],
  },
  {
    id: "jest",
    name: "Jest",
    category: "Testing",
    description: "Run Jest unit tests with optional coverage.",
    image: "node:22-bookworm-slim",
    fields: [
      { key: "testCommand", label: "Command", type: "text", required: true, defaultValue: "npm test -- --runInBand", placeholder: "npm test -- --runInBand" },
      { key: "coverage", label: "Collect coverage", type: "boolean", defaultValue: true },
      { key: "coveragePath", label: "Coverage output", type: "text", defaultValue: "coverage/lcov.info" },
      { key: "timeout", label: "Timeout", type: "select", options: ["5m", "10m", "20m", "30m"], defaultValue: "10m" },
    ],
    outputs: ["tests.passed", "coverage.path"],
  },
  {
    id: "vitest",
    name: "Vitest",
    category: "Testing",
    description: "Run Vitest unit tests and optionally generate coverage.",
    image: "node:22-bookworm-slim",
    fields: [
      { key: "testCommand", label: "Command", type: "text", required: true, defaultValue: "npx vitest run", placeholder: "npx vitest run" },
      { key: "coverage", label: "Collect coverage", type: "boolean", defaultValue: true },
      { key: "coveragePath", label: "Coverage output", type: "text", defaultValue: "coverage/lcov.info" },
      { key: "timeout", label: "Timeout", type: "select", options: ["5m", "10m", "20m", "30m"], defaultValue: "10m" },
    ],
    outputs: ["tests.passed", "coverage.path"],
  },
  {
    id: "pytest",
    name: "Pytest",
    category: "Testing",
    description: "Run Python tests with JUnit and optional coverage reporting.",
    image: "python:3.12-slim",
    fields: [
      { key: "testCommand", label: "Command", type: "text", required: true, defaultValue: "pytest -q", placeholder: "pytest -q" },
      { key: "coverage", label: "Collect coverage", type: "boolean", defaultValue: true },
      { key: "coveragePath", label: "Coverage output", type: "text", defaultValue: "coverage.xml" },
      { key: "timeout", label: "Timeout", type: "select", options: ["5m", "10m", "20m", "30m"], defaultValue: "10m" },
    ],
    outputs: ["tests.passed", "coverage.path"],
  },
  {
    id: "junit-maven",
    name: "JUnit / Maven",
    category: "Testing",
    description: "Run Java tests through Maven Surefire.",
    image: "maven:3.9-eclipse-temurin-21",
    fields: [
      { key: "testCommand", label: "Command", type: "text", required: true, defaultValue: "./mvnw -B test", placeholder: "./mvnw -B test" },
      { key: "coveragePath", label: "Coverage output", type: "text", defaultValue: "target/site/jacoco/jacoco.xml" },
      { key: "timeout", label: "Timeout", type: "select", options: ["10m", "20m", "30m", "60m"], defaultValue: "20m" },
    ],
    outputs: ["tests.passed", "coverage.path"],
  },
  {
    id: "gradle-test",
    name: "JUnit / Gradle",
    category: "Testing",
    description: "Run Java/Kotlin tests through Gradle.",
    image: "gradle:8.14-jdk21",
    fields: [
      { key: "testCommand", label: "Command", type: "text", required: true, defaultValue: "./gradlew test", placeholder: "./gradlew test" },
      { key: "coveragePath", label: "Coverage output", type: "text", defaultValue: "build/reports/jacoco/test/jacocoTestReport.xml" },
      { key: "timeout", label: "Timeout", type: "select", options: ["10m", "20m", "30m", "60m"], defaultValue: "20m" },
    ],
    outputs: ["tests.passed", "coverage.path"],
  },
  {
    id: "go-test",
    name: "Go Test",
    category: "Testing",
    description: "Run Go unit tests with coverage.",
    image: "golang:1.24",
    fields: [
      { key: "testCommand", label: "Command", type: "text", required: true, defaultValue: "go test ./...", placeholder: "go test ./..." },
      { key: "coveragePath", label: "Coverage output", type: "text", defaultValue: "coverage.out" },
      { key: "timeout", label: "Timeout", type: "select", options: ["5m", "10m", "20m", "30m"], defaultValue: "10m" },
    ],
    outputs: ["tests.passed", "coverage.path"],
  },
  {
    id: "playwright",
    name: "Playwright",
    category: "Testing",
    description: "Run browser end-to-end tests inside the Playwright container.",
    image: "mcr.microsoft.com/playwright:v1.55.0-noble",
    fields: [
      { key: "testCommand", label: "Command", type: "text", required: true, defaultValue: "npx playwright test", placeholder: "npx playwright test" },
      { key: "baseUrl", label: "Base URL", type: "text", placeholder: "https://staging.example.com" },
      { key: "timeout", label: "Timeout", type: "select", options: ["10m", "20m", "30m", "60m"], defaultValue: "20m" },
    ],
    outputs: ["e2e.status", "e2e.report"],
  },
  {
    id: "cypress",
    name: "Cypress",
    category: "Testing",
    description: "Run Cypress end-to-end tests against a deployed environment.",
    image: "cypress/included:14.5.4",
    fields: [
      { key: "testCommand", label: "Command", type: "text", required: true, defaultValue: "npx cypress run", placeholder: "npx cypress run" },
      { key: "baseUrl", label: "Base URL", type: "text", placeholder: "https://staging.example.com" },
      { key: "timeout", label: "Timeout", type: "select", options: ["10m", "20m", "30m", "60m"], defaultValue: "20m" },
    ],
    outputs: ["e2e.status", "e2e.report"],
  },
  {
    id: "sonarqube",
    name: "SonarQube",
    category: "Code Quality",
    description: "Run SonarQube analysis and optionally enforce a quality gate.",
    image: "sonarsource/sonar-scanner-cli:7.0",
    fields: [
      { key: "serverUrl", label: "SonarQube URL", type: "text", required: true, placeholder: "https://sonarqube.example.com" },
      { key: "projectKey", label: "Project key", type: "text", required: true, placeholder: "my-service" },
      { key: "organization", label: "Organization", type: "text", placeholder: "Only for SonarCloud" },
      { key: "credentialSecret", label: "Kubernetes Secret", type: "secret", required: true, placeholder: "sonarqube-credentials", description: "Secret must contain SONAR_TOKEN. It is referenced, never stored in the pipeline." },
      { key: "sources", label: "Sources", type: "text", defaultValue: "." },
      { key: "qualityGate", label: "Quality gate", type: "select", options: ["Wait and fail", "Wait and warn", "Do not wait"], defaultValue: "Wait and fail" },
      { key: "timeout", label: "Timeout", type: "select", options: ["5m", "10m", "20m", "30m"], defaultValue: "10m" },
    ],
    outputs: ["sonar.taskId", "sonar.qualityGate"],
  },
  {
    id: "sonarcloud",
    name: "SonarCloud",
    category: "Code Quality",
    description: "Analyze code with SonarCloud and enforce the configured quality gate.",
    image: "sonarsource/sonar-scanner-cli:7.0",
    fields: [
      { key: "serverUrl", label: "SonarCloud URL", type: "text", defaultValue: "https://sonarcloud.io" },
      { key: "projectKey", label: "Project key", type: "text", required: true, placeholder: "org_project" },
      { key: "organization", label: "Organization", type: "text", required: true, placeholder: "my-org" },
      { key: "credentialSecret", label: "Kubernetes Secret", type: "secret", required: true, placeholder: "sonarcloud-credentials", description: "Secret must contain SONAR_TOKEN." },
      { key: "qualityGate", label: "Quality gate", type: "select", options: ["Wait and fail", "Wait and warn", "Do not wait"], defaultValue: "Wait and fail" },
      { key: "timeout", label: "Timeout", type: "select", options: ["5m", "10m", "20m", "30m"], defaultValue: "10m" },
    ],
    outputs: ["sonar.taskId", "sonar.qualityGate"],
  },
  {
    id: "trivy",
    name: "Trivy Filesystem",
    category: "Security",
    description: "Scan source, dependencies and configuration for vulnerabilities.",
    image: "aquasec/trivy:0.66.0",
    fields: [
      { key: "severity", label: "Severity", type: "select", options: ["CRITICAL", "HIGH,CRITICAL", "MEDIUM,HIGH,CRITICAL"], defaultValue: "HIGH,CRITICAL" },
      { key: "failOn", label: "Fail on findings", type: "boolean", defaultValue: true },
      { key: "credentialSecret", label: "Registry Secret (optional)", type: "secret", placeholder: "registry-credentials" },
    ],
    outputs: ["security.findings", "security.status"],
  },
  {
    id: "gitleaks",
    name: "Gitleaks",
    category: "Security",
    description: "Detect leaked credentials and secrets in source control.",
    image: "zricethezav/gitleaks:v8.28.0",
    fields: [
      { key: "failOn", label: "Fail on secret", type: "boolean", defaultValue: true },
      { key: "configPath", label: "Config path", type: "text", defaultValue: ".gitleaks.toml" },
    ],
    outputs: ["security.secrets", "security.status"],
  },
  {
    id: "dependency-scan",
    name: "Dependency Scan",
    category: "Security",
    description: "Scan application dependencies for known vulnerabilities.",
    image: "aquasec/trivy:0.66.0",
    fields: [
      { key: "severity", label: "Severity", type: "select", options: ["CRITICAL", "HIGH,CRITICAL", "MEDIUM,HIGH,CRITICAL"], defaultValue: "HIGH,CRITICAL" },
      { key: "failOn", label: "Fail on findings", type: "boolean", defaultValue: true },
    ],
    outputs: ["security.dependencies", "security.status"],
  },
];

export function getTaskCatalogItem(id?: string | null) {
  return id ? taskCatalog.find((item) => item.id === id) ?? null : null;
}

export function catalogDefaults(id: string) {
  const item = getTaskCatalogItem(id);
  return Object.fromEntries((item?.fields || []).filter((field) => field.defaultValue !== undefined).map((field) => [field.key, field.defaultValue]));
}
