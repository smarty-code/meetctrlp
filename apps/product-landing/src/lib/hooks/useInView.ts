"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

type Options = {
  /** Share of the element that must be visible. */
  threshold?: number
  /** Stop observing after the first time it is visible. */
  once?: boolean
}

/** Visibility of an element via IntersectionObserver. */
export function useInView<T extends Element>({
  threshold = 0.2,
  once = false,
}: Options = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        setInView(entry.isIntersecting)
        if (entry.isIntersecting && once) observer.disconnect()
      },
      { threshold }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, once])

  return [ref, inView]
}

/** True while the browser tab is visible; looping scenes pause when it is hidden (PRD 4.7). */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible")
    update()
    document.addEventListener("visibilitychange", update)
    return () => document.removeEventListener("visibilitychange", update)
  }, [])
  return visible
}
