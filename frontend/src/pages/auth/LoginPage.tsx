import { useNavigate } from "react-router-dom";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth, useSignIn } from "@clerk/clerk-react";
import { PiEyeBold, PiEyeSlashBold } from "react-icons/pi";
import { FcGoogle } from "react-icons/fc";
import {
  getIntendedDestination,
  peekIntendedDestination,
} from "@/lib/redirectAfterLogin";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { LoginSkeleton } from "@/components/auth/AuthSkeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const oauthRedirectComplete = useMemo(() => {
    const destination = peekIntendedDestination();
    return `${window.location.origin}${destination}`;
  }, []);

  // Redirect to intended destination after successful login
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const destination = getIntendedDestination();
      navigate(destination, { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  const canSubmit = !submitting;

  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSignInLoaded || !signIn) return;

    if (identifier.trim().length === 0) {
      setError("Please enter your email or username");
      return;
    }
    if (password.length === 0) {
      setError("Please enter your password");
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn.create({
        identifier: identifier.trim(),
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        const destination = getIntendedDestination();
        navigate(destination, { replace: true });
        return;
      }

      setError("Sign in requires additional steps. Please try again.");
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "errors" in err
          ? ((err as { errors?: { message?: string }[] }).errors?.[0]
              ?.message ?? "Unable to sign in.")
          : "Unable to sign in.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    if (!isSignInLoaded || !signIn) return;

    setSubmitting(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}/login/sso-callback`,
        redirectUrlComplete: oauthRedirectComplete,
      });
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "errors" in err
          ? ((err as { errors?: { message?: string }[] }).errors?.[0]
              ?.message ?? "Unable to continue with Google.")
          : "Unable to continue with Google.";
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout variant="login">
      <div className="space-y-8 max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col items-center text-center space-y-3">
          <h2 className="text-4xl font-black tracking-tight text-foreground">
            Sign in to{" "}
            <span className="bg-gradient-to-r from-primary via-[#60a5fa] to-primary bg-clip-text text-transparent italic drop-shadow-sm pr-2">
              Quad
            </span>
          </h2>
          <p className="text-sm text-muted-foreground font-medium max-w-[280px]">
            Welcome back. Continue where the pulse left off.
          </p>
        </motion.div>

        {!isSignInLoaded && <LoginSkeleton />}

        {isSignInLoaded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-6">
            {error && (
              <Alert
                variant="destructive"
                className="rounded-full border-destructive/20 bg-destructive/5 px-5 py-3">
                <AlertDescription className="text-xs font-semibold leading-normal">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-full border-border/40 hover:bg-accent/40 transition-all duration-300 font-bold text-sm group"
                onClick={handleGoogleSignIn}
                loading={submitting}
                disabled={submitting}>
                <FcGoogle className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                Continue with Google
              </Button>

              <div className="relative py-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-border/40 to-transparent" />
                </div>
                <div className="relative bg-background px-6">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    OR
                  </span>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handlePasswordSignIn}>
                <Input
                  label="Email or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  disabled={submitting}
                  error={undefined}
                />
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={submitting}
                  error={undefined}
                  rightElement={
                    <button
                      type="button"
                      className="min-h-11 min-w-11 inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      disabled={submitting}>
                      {showPassword ? (
                        <PiEyeSlashBold className="h-4 w-4" />
                      ) : (
                        <PiEyeBold className="h-4 w-4" />
                      )}
                    </button>
                  }
                />

                <div className="relative group overflow-hidden rounded-full mt-2">
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] relative"
                    loading={submitting}
                    disabled={!canSubmit}>
                    Sign In
                  </Button>
                </div>
              </form>
            </div>

            <div className="text-center pt-2">
              <p className="text-[13px] text-muted-foreground font-medium">
                Don’t have an account?{" "}
                <button
                  type="button"
                  className="font-black text-primary hover:underline underline-offset-4 decoration-2"
                  onClick={() => navigate("/signup")}
                  disabled={submitting}>
                  Create account
                </button>
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </AuthSplitLayout>
  );
}
