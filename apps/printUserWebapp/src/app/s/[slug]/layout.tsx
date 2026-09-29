import { ShopSessionProvider } from "../../../components/shop-session-provider"

export default async function ShopSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ShopSessionProvider slug={slug}>{children}</ShopSessionProvider>
}
