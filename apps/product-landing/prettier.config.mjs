import shared from "@ctrlp/config/prettier"

/** Shared monorepo Prettier config, pointed at this app's stylesheet for class sorting. */
const config = {
  ...shared,
  tailwindStylesheet: "./src/styles/globals.css",
}

export default config
