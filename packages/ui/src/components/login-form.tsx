import { useState } from "react"
import { Button } from "./button"
import { Input } from "./input"

interface LoginFormProps {
  onSubmit: (credentials: { email: string; password: string }) => void | Promise<void>
  error?: string | null
  isLoading?: boolean
  title?: string
  description?: string
}

export function LoginForm({
  onSubmit,
  error,
  isLoading = false,
  title,
  description,
}: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit({ email, password })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(title || description) && (
        <div className="text-center space-y-1">
          {title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="text-sm font-medium">
            E-mail
          </label>
          <Input
            id="login-email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="login-password" className="text-sm font-medium">
            Senha
          </label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  )
}
