import { routes } from "@/config/routes"
import { systemCopy } from "@/content/meta"
import { StatusPage } from "@/components/layout/StatusPage"
import { ButtonLink } from "@/components/ui/Button"

export default function NotFound() {
  return (
    <StatusPage title={systemCopy.notFoundTitle} text={systemCopy.notFoundText}>
      <ButtonLink href={routes.home}>{systemCopy.home}</ButtonLink>
    </StatusPage>
  )
}
