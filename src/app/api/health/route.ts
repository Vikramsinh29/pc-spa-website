import { EnvironmentValidationError, getServerEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const environment = getServerEnvironment();

    return Response.json(
      {
        status: "ok",
        service: "pc-spa-web",
        environment: environment.cloudflareEnv,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof EnvironmentValidationError) {
      return Response.json(
        { status: "error", message: "Service configuration is invalid." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    throw error;
  }
}
