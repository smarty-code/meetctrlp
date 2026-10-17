"use client"

import { routes } from "@/config/routes"
import { systemCopy } from "@/content/meta"
import { StatusPage } from "@/components/layout/StatusPage"
import { Button, ButtonLink } from "@/components/ui/Button"

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <StatusPage title={systemCopy.errorTitle} text={systemCopy.errorText}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>{systemCopy.retry}</Button>
        <ButtonLink href={routes.home} variant="secondary">
          {systemCopy.home}
        </ButtonLink>
      </div>
    </StatusPage>
  )
}
