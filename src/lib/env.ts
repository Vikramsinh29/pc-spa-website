const allowedEnvironments = ["development", "preview", "production"] as const;

type CloudflareEnvironment = (typeof allowedEnvironments)[number];

export type ServerEnvironment = {
  siteUrl: URL;
  allowedOrigins: ReadonlySet<string>;
  cloudflareEnv: CloudflareEnvironment;
  d1DatabaseName: string;
  adminUserIds: ReadonlySet<string>;
};

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentValidationError";
  }
}

function parseAllowedOrigins(siteUrl: URL): ReadonlySet<string> {
  const configuredAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const values = (configuredAllowedOrigins ?? siteUrl.origin)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new EnvironmentValidationError("ALLOWED_ORIGINS must contain at least one origin.");
  }

  const allowedOrigins = new Set(values);
  allowedOrigins.add(siteUrl.origin);
  return allowedOrigins;
}

export function getServerEnvironment(): ServerEnvironment {
  const configuredSiteUrl = process.env.SITE_URL;
  const siteUrlValue =
    configuredSiteUrl ??
    (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000");

  if (!siteUrlValue) {
    throw new EnvironmentValidationError("SITE_URL is required in production.");
  }

  let siteUrl: URL;
  try {
    siteUrl = new URL(siteUrlValue);
  } catch {
    throw new EnvironmentValidationError("SITE_URL must be a valid absolute URL.");
  }

  const cloudflareEnv = process.env.CLOUDFLARE_ENV ?? "development";
  if (!allowedEnvironments.includes(cloudflareEnv as CloudflareEnvironment)) {
    throw new EnvironmentValidationError(
      "CLOUDFLARE_ENV must be development, preview, or production.",
    );
  }

  const d1DatabaseName = process.env.D1_DATABASE_NAME ?? "pcspa";
  if (!d1DatabaseName.trim()) {
    throw new EnvironmentValidationError("D1_DATABASE_NAME cannot be empty.");
  }

  return {
    siteUrl,
    allowedOrigins: parseAllowedOrigins(siteUrl),
    cloudflareEnv: cloudflareEnv as CloudflareEnvironment,
    d1DatabaseName,
    adminUserIds: new Set(
      (process.env.ADMIN_USER_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  };
}
