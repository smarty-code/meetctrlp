import { randomBytes } from "node:crypto";

export function makeShopSlug(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${base || "shop"}-${randomBytes(3).toString("hex")}`;
}
