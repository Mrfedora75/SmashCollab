/**
 * Security headers for every response (applied by Nitro routeRules on Vercel, see vite.config.ts).
 * The CSP allows what the app really loads: Google sign-in / Firebase Auth (popup + auth iframe on
 * *.firebaseapp.com), Firestore, YouTube/Google profile photos, Google Fonts, Stripe, and Vercel
 * Web Analytics.
 * 'unsafe-inline' scripts are needed for the SSR hydration scripts TanStack Start inlines.
 *
 * Production Web Analytics loads the first-party script `/_vercel/insights/script.js` and posts
 * page views to `/_vercel/insights/view` (same origin). `script-src 'self'` and `connect-src 'self'`
 * already allow those. `@vercel/analytics` only requests `https://va.vercel-scripts.com` for its
 * development debug script, when NODE_ENV is development or test. Production builds do not request
 * it, and these headers apply to built deployments, so that host stays off the policy.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://www.gstatic.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://accounts.google.com https://api.stripe.com",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
