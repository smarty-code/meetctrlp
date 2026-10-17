import { defineConfig } from "eslint/config"
import baseConfig from "@ctrlp/config/eslint/next"

/**
 * PRD 9.3 enforcement on top of the shared Next.js config:
 * no visible text literals in JSX, no hex colours, no pixel numbers in style props.
 * The audit script (pnpm audit:hardcoded) covers what lint rules cannot.
 */
export default defineConfig([
  ...baseConfig,
  {
    files: ["src/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: [
            "·",
            "→",
            "( ",
            " )",
            "×",
            "✓",
            "✗",
            "●",
            "○",
            "+",
            "−",
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Use a colour token from src/styles/tokens.css.",
        },
        {
          selector:
            "JSXAttribute[name.name='style'] Property > Literal[value=/^-?\\d+(\\.\\d+)?px$/]",
          message: "Use a token instead of a pixel value in style props.",
        },
      ],
    },
  },
  {
    files: ["src/app/opengraph-image.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
])
