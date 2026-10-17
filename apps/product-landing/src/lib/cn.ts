import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/** Teach tailwind-merge the custom theme tokens so `text-display-l` is not mistaken for a colour. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display-xl",
        "display-l",
        "display-m",
        "stat",
        "step-number",
        "h3",
        "body-l",
        "body",
        "small",
        "caption",
        "eyebrow",
      ],
      radius: ["pill"],
      shadow: ["card"],
    },
    classGroups: {
      "font-size": [{ "text-ui": ["3xs", "2xs", "xs", "sm", "base", "lg"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
