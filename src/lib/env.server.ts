export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/** True on Vercel production/preview deployments (not local dev). */
export function isDeployed(): boolean {
  return Boolean(env("VERCEL_ENV") || env("VERCEL"));
}
