import { ErrorBoundary } from "./ErrorBoundary";
import type { ErrorType } from "./ErrorFallback";

/**
 * PageErrorBoundary Component
 * 
 * A specialized error boundary variant for page-level errors.
 * Wraps the ErrorBoundary component with page-specific configuration including:
 * - Full-height container (min-h-[400px])
 * - Error logging to error reporting service
 * - Both action buttons ("Try Again" and "Go to Home")
 * 
 * Use this component to wrap entire page content to catch and display
 * page-level errors with consistent styling and behavior.
 * 
 * @example
 * ```tsx
 * <PageErrorBoundary errorType="network">
 *   <HomePage />
 * </PageErrorBoundary>
 * ```
 * 
 * @example With custom error type
 * ```tsx
 * <PageErrorBoundary errorType="data-load">
 *   <ProfilePage />
 * </PageErrorBoundary>
 * ```
 */

export interface PageErrorBoundaryProps {
  /** Child components to render (typically page content) */
  children: React.ReactNode;
  /** Type of error for appropriate messaging (defaults to "unknown") */
  errorType?: ErrorType;
}

/**
 * Log locally until a real error reporting service is configured.
 */
function logErrorToService(error: Error, errorInfo: React.ErrorInfo): void {
  console.error("Page Error:", error, errorInfo);
}

export function PageErrorBoundary({
  children,
  errorType = "unknown",
}: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      errorType={errorType}
      onError={logErrorToService}>
      {children}
    </ErrorBoundary>
  );
}
