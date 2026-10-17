import type { ReactNode } from "react"
import { Hills } from "@/components/concepts/Hills"
import { Container } from "@/components/layout/Container"

/** Shared on-brand shell for not-found, error and loading states (PRD 9.8). */
export function StatusPage({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children?: ReactNode
}) {
  return (
    <main className="relative flex min-h-dvh items-center overflow-hidden bg-bg">
      <Hills variant="bottom" className="top-auto h-2/5" />
      <Container className="relative flex flex-col items-start gap-6">
        <h1 className="max-w-headline font-display text-display-l">{title}</h1>
        <p className="max-w-prose text-body-l text-ink-soft">{text}</p>
        {children}
      </Container>
    </main>
  )
}
