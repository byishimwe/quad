/**
 * Environment Variable Validation
 * Validates required environment variables at build/runtime
 */

interface EnvConfig {
  // API Configuration
  apiBaseUrl: string;
  socketUrl: string;

  // Clerk Configuration
  clerkPublishableKey: string;
  clerkSignInUrl: string;
  clerkSignUpUrl: string;
  clerkAfterSignInUrl: string;
  clerkAfterSignUpUrl: string;

  // Feature Flags
  enableNotifications: boolean;

  // Environment
  nodeEnv: string;

  // Media Configuration
  uploadTimeoutMs: number;
  apiTimeoutMs: number;

}

/**
 * Validates and returns typed environment configuration
 * Throws error if required variables are missing
 */
export function validateEnv(): EnvConfig {
  const requiredVars = [
    "VITE_API_BASE_URL",
    "VITE_SOCKET_URL",
    "VITE_CLERK_PUBLISHABLE_KEY",
  ];

  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!import.meta.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.join("\n")}\n\n` +
        `Please check your .env file and ensure all required variables are set.`,
    );
  }

  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    socketUrl: import.meta.env.VITE_SOCKET_URL,
    clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    clerkSignInUrl: import.meta.env.VITE_CLERK_SIGN_IN_URL || "/login",
    clerkSignUpUrl: import.meta.env.VITE_CLERK_SIGN_UP_URL || "/signup",
    clerkAfterSignInUrl: import.meta.env.VITE_CLERK_AFTER_SIGN_IN_URL || "/",
    clerkAfterSignUpUrl: import.meta.env.VITE_CLERK_AFTER_SIGN_UP_URL || "/",
    enableNotifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS === "true",
    nodeEnv:
      import.meta.env.VITE_NODE_ENV || import.meta.env.MODE || "development",
    uploadTimeoutMs:
      parseInt(import.meta.env.VITE_UPLOAD_TIMEOUT_MS as string, 10) || 300000,
    apiTimeoutMs:
      parseInt(import.meta.env.VITE_API_TIMEOUT_MS as string, 10) || 10000,
  };
}

/**
 * Get validated environment configuration
 * Call this once at app initialization
 */
export const env = validateEnv();

/**
 * Check if running in production
 */
export const isProduction = env.nodeEnv === "production";

/**
 * Check if running in development
 */
export const isDevelopment = env.nodeEnv === "development";
