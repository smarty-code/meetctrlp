"use client"

import { useState, type FormEvent } from "react"
import { events } from "@/config/analytics"
import { routes } from "@/config/routes"
import { formCopy } from "@/content/meta"
import { Button } from "@/components/ui/Button"
import { Modal } from "@/components/ui/Modal"
import { Field } from "@/components/ui/Field"
import { track } from "@/lib/track"
import {
  callRequestSchema,
  callResponseSchema,
  fieldErrors,
  type CallRequestFieldErrors,
} from "@/lib/validation"

type Status = "idle" | "submitting" | "success" | "error"

/** Request-a-call form in a modal (PRD 5.12). Validated here and again on the server. */
export function CallModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [status, setStatus] = useState<Status>("idle")
  const [errors, setErrors] = useState<CallRequestFieldErrors>({})

  const close = () => {
    onClose()
    if (status === "success") setStatus("idle")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const parsed = callRequestSchema.safeParse(data)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    setStatus("submitting")
    try {
      const response = await fetch(routes.api.requestCall, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const result = callResponseSchema.safeParse(await response.json())
      if (response.ok && result.success && result.data.ok) {
        track(events.requestCallSubmit)
        setStatus("success")
      } else {
        setStatus("error")
      }
    } catch {
      setStatus("error")
    }
  }

  const { fields } = formCopy

  return (
    <Modal
      open={open}
      onClose={close}
      title={formCopy.title}
      closeLabel={formCopy.close}
    >
      {status === "success" ? (
        <div className="flex flex-col items-start gap-6">
          <p role="status" className="text-body-l">
            {formCopy.success}
          </p>
          <Button onClick={close}>{formCopy.done}</Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={submit}
          action={routes.api.requestCall}
          method="post"
          className="flex flex-col gap-4"
        >
          <p className="text-body text-ink-soft">{formCopy.intro}</p>
          <Field
            name="name"
            label={fields.name.label}
            autoComplete={fields.name.autoComplete}
            required
            error={errors.name}
          />
          <Field
            name="phone"
            type="tel"
            inputMode="tel"
            label={fields.phone.label}
            hint={fields.phone.hint}
            autoComplete={fields.phone.autoComplete}
            required
            error={errors.phone}
          />
          <Field
            name="shopName"
            label={fields.shopName.label}
            autoComplete={fields.shopName.autoComplete}
            error={errors.shopName}
          />
          <Field
            name="city"
            label={fields.city.label}
            autoComplete={fields.city.autoComplete}
            error={errors.city}
          />
          <div
            aria-hidden="true"
            className="absolute -start-full size-px overflow-hidden"
          >
            <label>
              {formCopy.honeypotLabel}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>
          <p
            aria-live="polite"
            className="text-small text-chip-error-fg empty:hidden"
          >
            {status === "error" ? formCopy.error : ""}
          </p>
          <Button
            type="submit"
            disabled={status === "submitting"}
            block
            className="sm:w-full"
          >
            {status === "submitting" ? formCopy.submitting : formCopy.submit}
          </Button>
          <p className="text-small text-ink-faint">
            {formCopy.notice}{" "}
            <a
              href={routes.privacy}
              className="text-lime-deep underline underline-offset-2"
            >
              {formCopy.privacyLink}
            </a>
          </p>
        </form>
      )}
    </Modal>
  )
}
