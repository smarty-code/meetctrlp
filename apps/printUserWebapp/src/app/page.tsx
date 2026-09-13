import { Button } from "@ctrlp/ui/button"

export default function Page() {
  return (
    <main className="flex min-h-svh items-center px-6 py-16">
      <div className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-6">
        <div>
          <p className="mb-3 text-sm font-bold tracking-[0.053em] text-macaw-blue">
            PRINT USER WEB APP
          </p>
          <h1 className="font-heading text-heading leading-heading text-ecto-green">
            Project ready!
          </h1>
          <p className="mt-4 max-w-xl text-body leading-body">
            Your shared UI package and design tokens are ready to build on.
          </p>
          <Button className="mt-6">Start building</Button>
        </div>
        <p className="text-caption leading-caption text-ash">
          Press{" "}
          <kbd className="rounded-xl border border-graphite px-2 py-1">d</kbd>{" "}
          to toggle dark mode.
        </p>
      </div>
    </main>
  )
}
