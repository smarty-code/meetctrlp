import type { Metadata } from "next"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Separator,
  Switch,
} from "@ctrlp/ui"

export const metadata: Metadata = {
  title: "Component test",
  description: "Visual test route for the shared CtrlP design system",
}

export default function TestPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground sm:px-10">
      <div className="mx-auto flex max-w-[var(--page-max-width)] flex-col gap-10">
        <header className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit border-accent text-accent">
            Shared UI preview
          </Badge>
          <h1 className="font-heading text-4xl text-primary sm:text-5xl">
            CtrlP component gallery
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            These controls come from <code>@ctrlp/ui</code> and inherit the
            shared design-system tokens for color, type, spacing, radius, and
            focus states.
          </p>
        </header>

        <Separator />

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Actions and status</CardTitle>
              <CardDescription>
                Primary, secondary, outlined, and quiet interaction styles.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button>Upload documents</Button>
              <Button variant="secondary">View orders</Button>
              <Button variant="outline">Learn more</Button>
              <Button variant="ghost">Cancel</Button>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Badge>Ready</Badge>
              <Badge variant="secondary">In progress</Badge>
              <Badge variant="outline">Draft</Badge>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form controls</CardTitle>
              <CardDescription>
                Inputs, selection controls, and semantic labels.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="shop-name">Shop name</Label>
                <Input id="shop-name" placeholder="Print Studio" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="notifications">Order notifications</Label>
                <Switch id="notifications" defaultChecked />
              </div>
              <Label className="flex items-center gap-3" htmlFor="terms">
                <Checkbox id="terms" defaultChecked />I agree to the print
                guidelines
              </Label>
            </CardContent>
          </Card>
        </section>

        <Card size="sm">
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Token inheritance check</p>
              <p className="text-sm text-muted-foreground">
                Paper surfaces, green actions, lime accents, 12px corners, and
                border-based depth are coming from the shared theme.
              </p>
            </div>
            <Button size="sm" variant="outline">
              Inspect state
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
