"use client"

import type { ElementType, ReactNode } from "react"
import { useInView } from "@/lib/hooks/useInView"
import { cn } from "@/lib/cn"

type RevealProps = {
  children: ReactNode
  as?: ElementType
  className?: string
  /** Set data-played instead of data-reveal, for one-shot scenes styled in globals.css. */
  scene?: boolean
}

/**
 * Entrance on scroll (PRD 4.7): direct children fade up once 20% is in view,
 * staggered by their `--i` index (see lib/motion `stagger`). Hidden only when scripting is on.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  scene = false,
}: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>({ once: true })
  const flag = inView ? "" : undefined
  return (
    <Tag
      ref={ref}
      className={cn(className)}
      {...(scene
        ? { "data-scene": "", "data-played": flag }
        : { "data-reveal": "", "data-inview": flag })}
    >
      {children}
    </Tag>
  )
}
