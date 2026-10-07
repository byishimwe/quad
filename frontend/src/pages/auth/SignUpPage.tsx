import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSignUp } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PiEyeBold,
  PiEyeSlashBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiSpinnerBold,
} from "react-icons/pi";
import { FcGoogle } from "react-icons/fc";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { SignUpSkeleton } from "@/components/auth/AuthSkeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SegmentedOTP } from "@/components/auth/SegmentedOTP";
import {
  getIntendedDestination,
  peekIntendedDestination,
} from "@/lib/redirectAfterLogin";
import { cn } from "@/lib/utils";
import { AuthProcessingState } from "@/components/auth/AuthProcessingState";

function StatusIndicator({
  status,
  loading = false,
}: {
  status: "success" | "error" | "none";
  loading?: boolean;
}) {
  if (loading) return <div className="p-2"><PiSpinnerBold className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (status === "none") return null;
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn("flex items-center justify-center", status === "success" ? "text-emerald-500" : "text-destructive")}>
      {status === "success" ? <PiCheckCircleBold className="h-3.5 w-3.5" /> : <PiXCircleBold className="h-3.5 w-3.5" />}
    </motion.div>
  );
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signUp, setActive, isLoaded } = useSignUp();

  const [step, setStep] = useState<"form" | "verify">("form");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [email, setEmail] = useState("");
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const oauthRedirectComplete = useMemo(() => {
    const destination = peekIntendedDestination();
    return `${window.location.origin}${destination}`;
  }, []);

  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  const isPasswordValid = password.length >= 8;

  // Username availability check
  useEffect(() => {
    const checkAvailability = async () => {
      if (username.trim().length < 4 || username.trim().length > 64) {
        setUsernameAvailable(null);
        return;
      }
      setCheckingUsername(true);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
        const res = await fetch(`${baseUrl}/users/check/${username.trim()}`);
        const data = await res.json();
        if (data.success) {
          setUsernameAvailable(data.available);
        }
      } catch (err) {
        console.error("Failed to check username availability", err);
      } finally {
        setCheckingUsername(false);
      }
    };

    const timer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timer);
  }, [username]);

  // Email availability check
  useEffect(() => {
    const checkAvailability = async () => {
      if (!isEmailValid) {
        setEmailAvailable(null);
        return;
      }
      setCheckingEmail(true);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
        const res = await fetch(`${baseUrl}/users/check-email/${email.trim()}`);
        const data = await res.json();
        if (data.success) {
          setEmailAvailable(data.available);
        }
      } catch (err) {
        console.error("Failed to check email availability", err);
      } finally {
        setCheckingEmail(false);
      }
    };

    const timer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timer);
  }, [email, isEmailValid]);

  const handleGoogleSignUp = async () => {
    setError(null);
    if (!isLoaded || !signUp) return;
    setSubmitting(true);
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}/signup/sso-callback`,
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

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isLoaded || !signUp) return;

    if (username.trim().length === 0) {
      setError("Please choose a username");
      return;
    }
    if (username.trim().length < 4) {
      setError("Username must be at least 4 characters");
      return;
    }
    if (username.trim().length > 64) {
      setError("Username cannot exceed 64 characters");
      return;
    }
    if (usernameAvailable === false) {
      setError("This username is already taken");
      return;
    }
    if (email.trim().length === 0) {
      setError("Please enter your email");
      return;
    }
    if (emailAvailable === false) {
      setError("This email is already registered");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      await signUp.create({
        username: username.trim(),
        emailAddress: email.trim(),
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "errors" in err
          ? ((err as { errors?: { message?: string }[] }).errors?.[0]
              ?.message ?? "Unable to create account.")
          : "Unable to create account.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isLoaded || !signUp) return;

    if (code.trim().length === 0) return;

    setSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        const destination = getIntendedDestination();
        navigate(destination, { replace: true });
        return;
      }

      setError("Verification requires additional steps. Please try again.");
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "errors" in err
          ? ((err as { errors?: { message?: string }[] }).errors?.[0]
              ?.message ?? "Invalid verification code.")
          : "Invalid verification code.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout variant="signup">
      <div className="space-y-8 max-w-md mx-auto">
        {/* Breadcrumbs / Step Indicator */}
        <div className="flex justify-center items-center gap-3 px-10">
          <div
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-700",
              step === "form"
                ? "bg-gradient-to-r from-primary to-[#60a5fa] shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)]"
                : "bg-primary/20",
            )}
          />
          <div
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-700",
              step === "verify"
                ? "bg-gradient-to-r from-primary to-[#60a5fa] shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)]"
                : "bg-muted/10",
            )}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col items-center text-center space-y-3">
          <h2 className="text-4xl font-black tracking-tight text-foreground">
            {step === "form" ? (
              <>
                Create your{" "}
                <span className="bg-gradient-to-r from-primary via-[#60a5fa] to-primary bg-clip-text text-transparent italic drop-shadow-sm pr-2">
                  account
                </span>
              </>
            ) : (
              <span className="bg-gradient-to-r from-primary via-[#60a5fa] to-primary bg-clip-text text-transparent drop-shadow-sm">
                Verify your email
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground font-medium max-w-[280px]">
            {step === "form" ? (
              "Join Quad and start moving in real time."
            ) : (
              <>
                We sent a code to{" "}
                <span className="text-primary font-bold">{email}</span>
              </>
            )}
          </p>
        </motion.div>

        {!isLoaded && <SignUpSkeleton />}

        {isLoaded && (
          <div>
            {error && (
              <Alert
                variant="destructive"
                className="rounded-full mb-6 border-destructive/20 bg-destructive/5 px-5 py-3">
                <AlertDescription className="text-xs font-semibold leading-normal">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <AnimatePresence mode="wait">
              {submitting ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="min-h-[400px] flex items-center justify-center">
                  <AuthProcessingState />
                </motion.div>
              ) : step === "form" ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6">
                  <div className="space-y-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 rounded-full border-border/40 hover:bg-accent/40 transition-all duration-300 font-bold text-sm group"
                      onClick={handleGoogleSignUp}
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

                    <form className="space-y-4" onSubmit={handleCreateAccount}>
                      <Input
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        disabled={submitting}
                        error={undefined}
                        rightElement={
                          <StatusIndicator
                            loading={checkingUsername}
                            status={
                              username.trim().length >= 4 &&
                              username.trim().length <= 64
                                ? usernameAvailable === true
                                  ? "success"
                                  : usernameAvailable === false
                                    ? "error"
                                    : "none"
                                : "none"
                            }
                          />
                        }
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        disabled={submitting}
                        error={undefined}
                        rightElement={
                          <StatusIndicator
                            loading={checkingEmail}
                            status={
                              email.trim().length > 0
                                ? isEmailValid
                                  ? emailAvailable === true
                                    ? "success"
                                    : emailAvailable === false
                                      ? "error"
                                      : "none"
                                  : "error"
                                : "none"
                            }
                          />
                        }
                      />
                      <div className="space-y-3">
                        <Input
                          label="Password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                          disabled={submitting}
                          error={undefined}
                          rightElement={
                            <div className="flex items-center gap-2 pr-1">
                              <StatusIndicator
                                status={
                                  password.length > 0
                                    ? isPasswordValid
                                      ? "success"
                                      : "error"
                                    : "none"
                                }
                              />
                              <button
                                type="button"
                                className="min-h-11 min-w-11 inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={
                                  showPassword
                                    ? "Hide password"
                                    : "Show password"
                                }
                                disabled={submitting}>
                                {showPassword ? (
                                  <PiEyeSlashBold className="h-4 w-4" />
                                ) : (
                                  <PiEyeBold className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          }
                        />
                      </div>

                      <div className="relative group overflow-hidden rounded-full mt-2">
                        <Button
                          type="submit"
                          className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] relative"
                          loading={submitting}
                          disabled={submitting}>
                          Sign Up
                        </Button>
                      </div>
                    </form>
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-[13px] text-muted-foreground font-medium">
                      Already have an account?{" "}
                      <button
                        type="button"
                        className="font-black text-primary hover:underline underline-offset-4 decoration-2"
                        onClick={() => navigate("/login")}
                        disabled={submitting}>
                        Sign in
                      </button>
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6">
                  <form className="space-y-8" onSubmit={handleVerifyCode}>
                    <div className="flex justify-center">
                      <SegmentedOTP
                        value={code}
                        onChange={setCode}
                        disabled={submitting}
                      />
                    </div>

                    <div className="relative group overflow-hidden rounded-full">
                      <Button
                        type="submit"
                        className="w-full h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] relative"
                        loading={submitting}
                        disabled={submitting || code.length < 6}>
                        Verify & Continue
                      </Button>
                    </div>
                  </form>

                  <div className="flex items-center justify-between px-2">
                    <button
                      type="button"
                      className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setStep("form")}
                      disabled={submitting}>
                      Back
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors"
                      onClick={async () => {
                        if (!signUp) return;
                        setSubmitting(true);
                        setError(null);
                        try {
                          await signUp.prepareEmailAddressVerification({
                            strategy: "email_code",
                          });
                        } catch (err: unknown) {
                          const message =
                            typeof err === "object" && err && "errors" in err
                              ? ((err as { errors?: { message?: string }[] })
                                  .errors?.[0]?.message ??
                                "Unable to resend code.")
                              : "Unable to resend code.";
                          setError(message);
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      disabled={submitting}>
                      Resend code
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AuthSplitLayout>
  );
}
