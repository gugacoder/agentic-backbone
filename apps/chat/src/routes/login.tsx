import { useState, useEffect, type FormEvent } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, Eye, EyeSlash, ChatCircle, Lock } from "@phosphor-icons/react"
import { OtpInput } from "@/components/otp-input"
import {
  identify,
  loginWithPassword,
  loginWithOtp,
  resendOtp,
  logout,
  getSession,
  ApiError,
  type IdentifyResult,
} from "@/lib/auth-client"

const TEAM_ROLES = ["admin", "manager", "attendant"] as const

const searchSchema = z.object({
  returnUrl: z.string().optional(),
})

function validateReturnUrl(url: string | undefined): string {
  if (!url) return "/"
  if (url.startsWith("/") && !url.startsWith("//")) return url
  return "/"
}

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const user = await getSession()
    if (user) {
      const isTeam = TEAM_ROLES.includes(user.role as (typeof TEAM_ROLES)[number])
      if (isTeam) {
        throw redirect({ to: validateReturnUrl((search as { returnUrl?: string }).returnUrl) as "/" })
      }
    }
  },
  component: LoginPage,
})

type Step = "identify" | "password" | "otp" | "choice"

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
}

const transition = { duration: 0.25, ease: "easeInOut" as const }

function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (remaining <= 0) return
    const timer = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(timer)
  }, [remaining])

  const start = (seconds?: number) => setRemaining(seconds ?? initialSeconds)
  const reset = () => setRemaining(0)
  return { remaining, start, reset, done: remaining === 0 }
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function LoginPage() {
  const navigate = useNavigate()
  const { returnUrl } = Route.useSearch()

  const [step, setStep] = useState<Step>("identify")
  const [direction, setDirection] = useState(1)
  const [username, setUsername] = useState("")
  const [identifyResult, setIdentifyResult] = useState<IdentifyResult | null>(null)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [accessDenied, setAccessDenied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otpKey, setOtpKey] = useState(0)

  const rateLimitCountdown = useCountdown(0)
  const otpResendCountdown = useCountdown(60)
  const rateLimitActive = rateLimitCountdown.remaining > 0
  const otpResendActive = otpResendCountdown.remaining > 0
  const isDisabled = loading || rateLimitActive

  function goTo(nextStep: Step, dir: number) {
    setDirection(dir)
    setError("")
    setAccessDenied(false)
    setStep(nextStep)
  }

  function handleBack() {
    goTo("identify", -1)
    setPassword("")
    setShowPassword(false)
    otpResendCountdown.reset()
    setOtpKey((k) => k + 1)
  }

  function handleRateLimit(err: ApiError) {
    rateLimitCountdown.start(err.retryAfter ?? 900)
    setError("")
  }

  async function handleIdentify(e: FormEvent) {
    e.preventDefault()
    if (!username.trim()) {
      setError("Informe seu email ou usuário.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const result = await identify(username.trim())
      setIdentifyResult(result)
      if (result.method === "choice") {
        goTo("choice", 1)
      } else {
        goTo(result.method as Step, 1)
      }
      if (result.method === "otp") {
        otpResendCountdown.start()
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        handleRateLimit(err)
      } else {
        setError(err instanceof Error ? err.message : "Erro ao identificar usuário.")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault()
    if (!password.trim()) {
      setError("Informe sua senha.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const user = await loginWithPassword(username.trim(), password)
      const isTeam = TEAM_ROLES.includes(user.role as (typeof TEAM_ROLES)[number])
      if (!isTeam) {
        await logout()
        setAccessDenied(true)
        handleBack()
        return
      }
      await navigate({ to: validateReturnUrl(returnUrl) as "/" })
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        handleRateLimit(err)
      } else {
        setError(err instanceof Error ? err.message : "Credenciais inválidas.")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpComplete(code: string) {
    if (isDisabled) return
    setLoading(true)
    setError("")
    try {
      const user = await loginWithOtp(username.trim(), code)
      const isTeam = TEAM_ROLES.includes(user.role as (typeof TEAM_ROLES)[number])
      if (!isTeam) {
        await logout()
        setAccessDenied(true)
        handleBack()
        return
      }
      await navigate({ to: validateReturnUrl(returnUrl) as "/" })
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        handleRateLimit(err)
      } else {
        setError(err instanceof Error ? err.message : "Código inválido.")
        setOtpKey((k) => k + 1)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (isDisabled || otpResendActive) return
    setLoading(true)
    setError("")
    try {
      await resendOtp(username.trim())
      otpResendCountdown.start()
      setOtpKey((k) => k + 1)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        handleRateLimit(err)
      } else {
        setError(err instanceof Error ? err.message : "Erro ao reenviar código.")
      }
    } finally {
      setLoading(false)
    }
  }

  function handleChoiceOtp() {
    setIdentifyResult((prev) => (prev ? { ...prev, method: "otp" } : prev))
    otpResendCountdown.start()
    goTo("otp", 1)
  }

  function handleChoicePassword() {
    goTo("password", 1)
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-6">
      {/* Radial gradient accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, var(--color-primary) 0%, transparent 70%)",
        }}
      />

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Card container */}
        <div className="rounded-2xl border border-border/50 bg-card/80 px-8 py-10 shadow-lg shadow-black/[0.03] backdrop-blur-sm dark:shadow-black/[0.15]">
          <div className="space-y-6">
            {/* Logo */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <img src="/chat/logo-h-light.svg" alt="Coletivos" className="h-8 mx-auto dark:hidden" />
              <img src="/chat/logo-h-dark.svg" alt="Coletivos" className="h-8 mx-auto hidden dark:block" />
            </motion.div>

            {/* Access denied alert */}
            <AnimatePresence>
              {accessDenied && (
                <motion.div
                  role="alert"
                  className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-3 text-sm text-destructive"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  Acesso restrito. Este painel é exclusivo para a equipe de atendimento.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Rate limit warning */}
            {rateLimitActive && (
              <p className="text-sm text-destructive text-center">
                Muitas tentativas. Tente novamente em {formatCountdown(rateLimitCountdown.remaining)}.
              </p>
            )}

            {/* Wizard steps */}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transition}
              >
                {/* STEP 1: identify */}
                {step === "identify" && (
                  <form onSubmit={handleIdentify} className="grid gap-4">
                    <div className="grid gap-1.5">
                      <label htmlFor="username" className="text-sm font-medium text-foreground">
                        Email ou usuário
                      </label>
                      <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="seu@email.com ou usuário"
                        disabled={isDisabled}
                        className="w-full rounded-lg border border-border/60 bg-background/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ minHeight: 44 }}
                      />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <button
                      type="submit"
                      disabled={isDisabled}
                      className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ minHeight: 44 }}
                    >
                      {loading ? (
                        "Verificando..."
                      ) : (
                        <>
                          <span>Continuar</span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* STEP 2a: password */}
                {step === "password" && (
                  <form onSubmit={handlePasswordLogin} className="grid gap-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit transition-colors"
                      style={{ minHeight: 44 }}
                    >
                      <ArrowLeft className="size-4" />
                      Voltar
                    </button>

                    <p className="text-sm font-medium text-center truncate text-foreground">{username}</p>

                    <div className="grid gap-1.5">
                      <label htmlFor="password" className="text-sm font-medium text-foreground">
                        Senha
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          autoFocus
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="sua senha"
                          disabled={isDisabled}
                          className="w-full rounded-lg border border-border/60 bg-background/50 px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ minHeight: 44 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          tabIndex={-1}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          style={{ minWidth: 44 }}
                        >
                          {showPassword ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <button
                      type="submit"
                      disabled={isDisabled}
                      className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ minHeight: 44 }}
                    >
                      {loading ? (
                        "Entrando..."
                      ) : (
                        <>
                          <span>Entrar</span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* STEP 2b: OTP */}
                {step === "otp" && (
                  <div className="grid gap-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit transition-colors"
                      style={{ minHeight: 44 }}
                    >
                      <ArrowLeft className="size-4" />
                      Voltar
                    </button>

                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Código enviado para WhatsApp</p>
                      {identifyResult?.phoneSuffix && (
                        <p className="text-xs text-muted-foreground">(•••{identifyResult.phoneSuffix})</p>
                      )}
                    </div>

                    <OtpInput key={otpKey} onComplete={handleOtpComplete} disabled={isDisabled} />

                    {error && <p className="text-sm text-destructive text-center">{error}</p>}

                    <button
                      type="button"
                      disabled={isDisabled}
                      className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ minHeight: 44 }}
                      onClick={() => {
                        const inputs = document.querySelectorAll<HTMLInputElement>('[aria-label^="Dígito"]')
                        const code = Array.from(inputs)
                          .map((i) => i.value)
                          .join("")
                        if (code.length === 6) void handleOtpComplete(code)
                      }}
                    >
                      {loading ? "Verificando..." : "Verificar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleResendOtp()}
                      disabled={isDisabled || otpResendActive}
                      className="text-sm text-center text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ minHeight: 44 }}
                    >
                      {otpResendActive
                        ? `Reenviar código (${formatCountdown(otpResendCountdown.remaining)})`
                        : "Reenviar código"}
                    </button>
                  </div>
                )}

                {/* STEP 2c: choice */}
                {step === "choice" && (
                  <div className="grid gap-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit transition-colors"
                      style={{ minHeight: 44 }}
                    >
                      <ArrowLeft className="size-4" />
                      Voltar
                    </button>

                    <p className="text-sm font-medium text-center truncate text-foreground">{username}</p>
                    <p className="text-sm text-muted-foreground text-center">Como deseja entrar?</p>

                    {error && <p className="text-sm text-destructive text-center">{error}</p>}

                    <button
                      type="button"
                      disabled={isDisabled}
                      className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ minHeight: 44 }}
                      onClick={handleChoiceOtp}
                    >
                      <ChatCircle className="size-4" />
                      Código WhatsApp
                    </button>

                    <button
                      type="button"
                      disabled={isDisabled}
                      className="flex items-center justify-center gap-2 w-full rounded-lg border border-border/60 bg-background/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ minHeight: 44 }}
                      onClick={handleChoicePassword}
                    >
                      <Lock className="size-4" />
                      Senha
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
