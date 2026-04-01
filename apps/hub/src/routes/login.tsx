import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, ArrowLeft, MessageSquare, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OtpInput } from "@/components/otp-input";
import { useAuthStore, ApiError, type IdentifyResult } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Step = "identify" | "password" | "otp" | "choice";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -30 : 30,
    opacity: 0,
  }),
};

const transition = { duration: 0.25, ease: "easeInOut" as const };

function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const start = (seconds?: number) => setRemaining(seconds ?? initialSeconds);
  const reset = () => setRemaining(0);
  return { remaining, start, reset, done: remaining === 0 };
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function LoginPage() {
  const navigate = useNavigate();
  const { user, identify, loginWithPassword, loginWithOtp, resendOtp } = useAuthStore();

  const [step, setStep] = useState<Step>("identify");
  const [direction, setDirection] = useState(1);

  const [username, setUsername] = useState("");
  const [identifyResult, setIdentifyResult] = useState<IdentifyResult | null>(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Rate limit countdown
  const rateLimitCountdown = useCountdown(0);
  const rateLimitActive = rateLimitCountdown.remaining > 0;

  // OTP resend countdown
  const otpResendCountdown = useCountdown(60);
  const otpResendActive = otpResendCountdown.remaining > 0;

  // OTP key for resetting the input
  const [otpKey, setOtpKey] = useState(0);

  const isDisabled = loading || rateLimitActive;

  if (user) {
    navigate({ to: "/" });
    return null;
  }

  function goTo(nextStep: Step, dir: number) {
    setDirection(dir);
    setError("");
    setStep(nextStep);
  }

  function handleBack() {
    goTo("identify", -1);
    setPassword("");
    setShowPassword(false);
    otpResendCountdown.reset();
    setOtpKey((k) => k + 1);
  }

  function handleRateLimit(err: ApiError) {
    const seconds = err.retryAfter ?? 900;
    rateLimitCountdown.start(seconds);
    setError("");
  }

  async function handleIdentify(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError("Informe seu email ou usuário.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await identify(username.trim());
      setIdentifyResult(result);
      if (result.method === "choice") {
        goTo("choice", 1);
      } else {
        goTo(result.method as Step, 1);
      }
      if (result.method === "otp") {
        otpResendCountdown.start();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        handleRateLimit(err);
      } else {
        setError(err instanceof Error ? err.message : "Erro ao identificar usuário.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError("Informe sua senha.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await loginWithPassword(username.trim(), password);
      navigate({ to: "/" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        handleRateLimit(err);
      } else {
        setError(err instanceof Error ? err.message : "Credenciais inválidas.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpComplete(code: string) {
    if (isDisabled) return;
    setLoading(true);
    setError("");
    try {
      await loginWithOtp(username.trim(), code);
      navigate({ to: "/" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        handleRateLimit(err);
      } else {
        setError(err instanceof Error ? err.message : "Código inválido.");
        setOtpKey((k) => k + 1);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (isDisabled || otpResendActive) return;
    setLoading(true);
    setError("");
    try {
      await resendOtp(username.trim());
      otpResendCountdown.start();
      setOtpKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        handleRateLimit(err);
      } else {
        setError(err instanceof Error ? err.message : "Erro ao reenviar código.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleChoiceOtp() {
    setIdentifyResult((prev) => prev ? { ...prev, method: "otp" } : prev);
    otpResendCountdown.start();
    goTo("otp", 1);
  }

  function handleChoicePassword() {
    goTo("password", 1);
  }

  const stepKey = step;

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm overflow-hidden">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <span className="text-xl font-bold text-primary">AB</span>
          </div>
          <p className="text-sm text-muted-foreground">Entrar no sistema</p>
        </CardHeader>

        <CardContent className="pt-2 pb-6">
          {rateLimitActive && (
            <p className="mb-3 text-sm text-destructive text-center">
              Muitas tentativas. Tente novamente em {formatCountdown(rateLimitCountdown.remaining)}.
            </p>
          )}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={stepKey}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              {step === "identify" && (
                <form onSubmit={handleIdentify} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Email ou usuário</Label>
                    <Input
                      id="username"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="seu@email.com ou usuário"
                      disabled={isDisabled}
                      style={{ minHeight: 44 }}
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isDisabled}
                    className="w-full"
                    style={{ minHeight: 44 }}
                  >
                    {loading ? "Verificando..." : (
                      <>
                        Continuar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {step === "password" && (
                <form onSubmit={handlePasswordLogin} className="grid gap-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
                    style={{ minHeight: 44 }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>

                  <p className="text-sm font-medium text-center truncate">{username}</p>

                  <div className="grid gap-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="sua senha"
                        disabled={isDisabled}
                        className="pr-10"
                        style={{ minHeight: 44 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        style={{ minWidth: 44, minHeight: 44 }}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isDisabled}
                    className="w-full"
                    style={{ minHeight: 44 }}
                  >
                    {loading ? "Entrando..." : (
                      <>
                        Entrar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {step === "otp" && (
                <div className="grid gap-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
                    style={{ minHeight: 44 }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Código enviado para WhatsApp</p>
                    {identifyResult?.phoneSuffix && (
                      <p className="text-xs text-muted-foreground">
                        (•••{identifyResult.phoneSuffix})
                      </p>
                    )}
                  </div>

                  <OtpInput
                    key={otpKey}
                    onComplete={handleOtpComplete}
                    disabled={isDisabled}
                  />

                  {error && <p className="text-sm text-destructive text-center">{error}</p>}

                  <Button
                    type="button"
                    size="lg"
                    disabled={isDisabled}
                    className="w-full"
                    style={{ minHeight: 44 }}
                    onClick={() => {
                      const inputs = document.querySelectorAll<HTMLInputElement>('[aria-label^="Dígito"]');
                      const code = Array.from(inputs).map((i) => i.value).join("");
                      if (code.length === 6) handleOtpComplete(code);
                    }}
                  >
                    {loading ? "Verificando..." : "Verificar"}
                  </Button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isDisabled || otpResendActive}
                    className="text-sm text-center text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ minHeight: 44 }}
                  >
                    {otpResendActive
                      ? `Reenviar código (${formatCountdown(otpResendCountdown.remaining)})`
                      : "Reenviar código"}
                  </button>
                </div>
              )}

              {step === "choice" && (
                <div className="grid gap-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
                    style={{ minHeight: 44 }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>

                  <p className="text-sm font-medium text-center truncate">{username}</p>
                  <p className="text-sm text-muted-foreground text-center">Como deseja entrar?</p>

                  {error && <p className="text-sm text-destructive text-center">{error}</p>}

                  <Button
                    type="button"
                    size="lg"
                    disabled={isDisabled}
                    className="w-full"
                    style={{ minHeight: 44 }}
                    onClick={handleChoiceOtp}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Código WhatsApp
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={isDisabled}
                    className="w-full"
                    style={{ minHeight: 44 }}
                    onClick={handleChoicePassword}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Senha
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
