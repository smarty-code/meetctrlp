import { useState, type FormEvent } from "react"
import { Button } from "@ctrlp/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlp/ui/card"
import { Input } from "@ctrlp/ui/input"
import { Label } from "@ctrlp/ui/label"
import { cn } from "@ctrlp/ui/utils"

type Mode = "login" | "register"

export function LoginScreen({
  busy,
  error,
  onLogin,
  onRegister,
}: {
  busy: boolean
  error: string | null
  onLogin: (identifier: string, password: string) => Promise<void>
  onRegister: (input: {
    name: string
    shopName: string
    identifier: string
    password: string
  }) => Promise<void>
}) {
  const [mode, setMode] = useState<Mode>("login")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [shopName, setShopName] = useState("")

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (mode === "login") {
      await onLogin(identifier, password)
      return
    }

    await onRegister({ name, shopName, identifier, password })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <Card className="w-full max-w-md rounded-[12px] border-graphite">
        <CardHeader>
          <p className="text-caption tracking-[0.69px] text-ash">MeetCtrlP</p>
          <CardTitle>Print Shop</CardTitle>
          <CardDescription>
            Sign in with email or mobile number and password. Phone login does
            not use OTP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              onClick={() => setMode("login")}
            >
              Sign in
            </Button>
            <Button
              type="button"
              variant={mode === "register" ? "default" : "outline"}
              onClick={() => setMode("register")}
            >
              Create shop
            </Button>
          </div>

          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            {mode === "register" ? (
              <>
                <Field
                  id="owner-name"
                  label="Your name"
                  value={name}
                  onChange={setName}
                  autoComplete="name"
                />
                <Field
                  id="shop-name"
                  label="Shop name"
                  value={shopName}
                  onChange={setShopName}
                  autoComplete="organization"
                />
              </>
            ) : null}
            <Field
              id="identifier"
              label="Phone or email"
              value={identifier}
              onChange={setIdentifier}
              autoComplete="username"
            />
            <Field
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {error ? <p className="text-body text-destructive">{error}</p> : null}
            <Button className="w-full rounded-[12px]" disabled={busy} type="submit">
              {busy
                ? "Please wait"
                : mode === "login"
                  ? "Sign In to Print Shop"
                  : "Create shop account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-caption text-ash">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className={cn("h-12 rounded-[12px] border-graphite text-body")}
      />
    </div>
  )
}
