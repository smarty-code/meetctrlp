# Repository UI Rules

When building or changing any UI, use the shared design system in `docs/design-system/` as the source of truth.

- Read `docs/design-system/DESIGN.md` for visual direction, component patterns, and do/don't rules.
- Use the tokens from `docs/design-system/tokens.json` and `docs/design-system/variables.css`; do not invent replacement colors, radii, typography, or spacing values without a design-system update.
- Reuse styles and components from `@ctrlp/ui` before creating app-local UI primitives.
- Import the shared runtime theme from `@ctrlp/ui/design-system.css` through the consuming app's global stylesheet.
- Keep the visual language flat: no gradients, no drop shadows, and use the 12px radius consistently for buttons, links, pills, and cards.
- Use the green primary action, lime or blue outlined secondary actions, paper-white surfaces, and the shared typography tokens for hierarchy.
- When adding a reusable shadcn component, add it to `packages/ui` and update its package-level `components.json`; do not recreate it under an app's local UI folder.
