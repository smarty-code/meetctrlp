import { cn } from "@/lib/cn"
import { DisplayHeading, Eyebrow } from "@/components/ui/Typography"
import type { SectionIntro } from "@/types/content"

type SectionHeaderProps = {
  id: string
  intro: SectionIntro
  align?: "start" | "center"
  tone?: "light" | "forest"
  className?: string
}

/** Eyebrow, display H2 and optional Body L intro: the opening of most sections. */
export function SectionHeader({
  id,
  intro,
  align = "start",
  tone = "light",
  className,
}: SectionHeaderProps) {
  const centred = align === "center"
  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        centred && "items-center text-center",
        className
      )}
    >
      <Eyebrow>{intro.eyebrow}</Eyebrow>
      <DisplayHeading
        id={id}
        headline={intro.headline}
        tone={tone}
        className={cn(centred && "mx-auto")}
      />
      {intro.intro && (
        <p
          className={cn(
            "max-w-prose text-body-l text-ink-soft",
            centred && "mx-auto"
          )}
        >
          {intro.intro}
        </p>
      )}
    </div>
  )
}
