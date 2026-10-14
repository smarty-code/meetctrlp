import { useEffect, useMemo, useState, type ReactNode } from "react"
import { businessHourProblem, closesNextDay, describeBusinessHour, formatTime12h } from "@ctrlp/schemas"
import { Badge } from "@ctrlp/ui/badge"
import { Button } from "@ctrlp/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ctrlp/ui/card"
import { Input } from "@ctrlp/ui/input"
import { Label } from "@ctrlp/ui/label"
import { NativeSelect, NativeSelectOption } from "@ctrlp/ui/native-select"
import { Switch } from "@ctrlp/ui/switch"

import {
  editableHours,
  paiseToRupeesInput,
  rupeesInputToPaise,
  setOpen24x7,
  timeOptions,
  weekdayLabels,
  type EditableBusinessHour,
} from "../lib/dashboard"
import { appVersion, type AgentStatus, type OrderAutomation, type Printer, type ShopConfig, type ShopProfile, type ShopUser } from "../lib/protocol"

export function SettingsScreen({
  status,
  user,
  shop,
  config,
  printers,
  hostName,
  deviceId,
  lastHeartbeatAt,
  cloudState,
  streamState,
  queuedJobs,
  busy,
  onSaveProfile,
  onSavePricing,
  onSaveHours,
  onSaveCapabilities,
  onUpdateAutomation,
  onExportLog,
  onSignOut,
}: {
  status: AgentStatus
  user: ShopUser
  shop: ShopProfile | null
  config: ShopConfig | null
  printers: Printer[]
  hostName: string | null
  deviceId: string | null
  lastHeartbeatAt: string | null
  cloudState: string
  streamState: string
  queuedJobs: number
  busy: boolean
  onSaveProfile: (input: {
    name: string
    phone: string | null
    email: string | null
    address: {
      line1?: string | null
      line2?: string | null
      city?: string | null
      state?: string | null
      postalCode?: string | null
      country?: string | null
    }
  }) => Promise<void>
  onSavePricing: (input: { bwA4PricePaise: number; colorA4PricePaise: number; colorA3PricePaise: number }) => Promise<void>
  onSaveHours: (hours: EditableBusinessHour[]) => Promise<void>
  onSaveCapabilities: (input: { colorPrinting: boolean; a3Printing: boolean }) => Promise<void>
  onUpdateAutomation: (automation: OrderAutomation) => void
  onExportLog: () => Promise<string | null>
  onSignOut: () => void
}) {
  const [name, setName] = useState(shop?.name ?? "")
  const [phone, setPhone] = useState(shop?.phone ?? "")
  const [email, setEmail] = useState(shop?.email ?? "")
  const [line1, setLine1] = useState(shop?.addressParts?.line1 ?? "")
  const [line2, setLine2] = useState(shop?.addressParts?.line2 ?? "")
  const [city, setCity] = useState(shop?.addressParts?.city ?? "")
  const [state, setState] = useState(shop?.addressParts?.state ?? "")
  const [postalCode, setPostalCode] = useState(shop?.addressParts?.postalCode ?? "")
  const [country, setCountry] = useState(shop?.addressParts?.country ?? "India")
  const [bw, setBw] = useState(paiseToRupeesInput(config?.pricing.bwA4PricePaise ?? 0))
  const [colorA4, setColorA4] = useState(paiseToRupeesInput(config?.pricing.colorA4PricePaise ?? 0))
  const [colorA3, setColorA3] = useState(paiseToRupeesInput(config?.pricing.colorA3PricePaise ?? 0))
  const [hours, setHours] = useState(() => editableHours(config?.businessHours))
  const isOpen24x7 = hours.every((hour) => !hour.isClosed && hour.isOpen24Hours)
  const hasHoursProblem = hours.some((hour) => businessHourProblem(hour) !== null)
  const [colorPrinting, setColorPrinting] = useState(config?.capabilities.colorPrinting ?? false)
  const [a3Printing, setA3Printing] = useState(config?.capabilities.a3Printing ?? false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  useEffect(() => {
    setName(shop?.name ?? "")
    setPhone(shop?.phone ?? "")
    setEmail(shop?.email ?? "")
    setLine1(shop?.addressParts?.line1 ?? "")
    setLine2(shop?.addressParts?.line2 ?? "")
    setCity(shop?.addressParts?.city ?? "")
    setState(shop?.addressParts?.state ?? "")
    setPostalCode(shop?.addressParts?.postalCode ?? "")
    setCountry(shop?.addressParts?.country ?? "India")
  }, [shop])

  useEffect(() => {
    if (!config) return
    setBw(paiseToRupeesInput(config.pricing.bwA4PricePaise))
    setColorA4(paiseToRupeesInput(config.pricing.colorA4PricePaise))
    setColorA3(paiseToRupeesInput(config.pricing.colorA3PricePaise))
    setHours(editableHours(config.businessHours))
    setColorPrinting(config.capabilities.colorPrinting)
    setA3Printing(config.capabilities.a3Printing)
  }, [config])

  const offeredColor = printers.some((printer) => printer.enabled !== false && printer.offered?.color)
  const offeredA3 = printers.some((printer) => printer.enabled !== false && printer.offered?.a3)

  const uptime = status.uptimeMs ? `${Math.round(status.uptimeMs / 1000)}s` : "—"

  const rateHint = useMemo(() => "Rates are stored in paise. Customer quotes use these values, never hardcoded UI prices.", [])

  return (
    <div className="space-y-4">
      <Card className="rounded-[12px]">
        <CardHeader>
          <CardTitle>Shop</CardTitle>
          <CardDescription>Name, contact, and pickup address customers see.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Shop name">
            <Input className="rounded-[12px]" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input className="rounded-[12px]" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label="Email">
            <Input className="rounded-[12px]" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Address line 1">
            <Input className="rounded-[12px]" value={line1} onChange={(event) => setLine1(event.target.value)} />
          </Field>
          <Field label="Address line 2">
            <Input className="rounded-[12px]" value={line2} onChange={(event) => setLine2(event.target.value)} />
          </Field>
          <Field label="City">
            <Input className="rounded-[12px]" value={city} onChange={(event) => setCity(event.target.value)} />
          </Field>
          <Field label="State">
            <Input className="rounded-[12px]" value={state} onChange={(event) => setState(event.target.value)} />
          </Field>
          <Field label="Postal code">
            <Input className="rounded-[12px]" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
          </Field>
          <Field label="Country">
            <Input className="rounded-[12px]" value={country} onChange={(event) => setCountry(event.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Button
              className="rounded-[12px]"
              disabled={busy}
              onClick={() =>
                void onSaveProfile({
                  name,
                  phone: phone.trim() || null,
                  email: email.trim() || null,
                  address: { line1, line2, city, state, postalCode, country },
                })
              }
            >
              Save shop profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {shop?.customerUrl ? (
        <Card className="rounded-[12px]">
          <CardHeader>
            <CardTitle>Customer QR</CardTitle>
            <CardDescription>
              Guests scan this code to open your shop print page. Share the link or print the QR at the counter.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
            <img
              alt="Customer print page QR code"
              className="size-[220px] rounded-[12px] border border-graphite bg-paper"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shop.customerUrl)}`}
            />
            <div className="space-y-3">
              <p className="break-all text-body font-bold text-midnight">{shop.customerUrl}</p>
              <p className="text-caption text-ash">Shop slug: {shop.slug}</p>
              <Button
                className="rounded-[12px]"
                variant="outline"
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(shop.customerUrl ?? "")
                }}
              >
                Copy customer link
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[12px]">
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>{rateHint} Minimum ₹0.50 per page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Field label="B&W A4 (₹ / page)">
            <Input className="rounded-[12px]" value={bw} onChange={(event) => setBw(event.target.value)} />
          </Field>
          <Field label="Color A4 (₹ / page)">
            <Input className="rounded-[12px]" value={colorA4} onChange={(event) => setColorA4(event.target.value)} />
          </Field>
          <Field label="Color A3 (₹ / page)">
            <Input className="rounded-[12px]" value={colorA3} onChange={(event) => setColorA3(event.target.value)} />
          </Field>
          <div className="md:col-span-3">
            <Button
              className="rounded-[12px]"
              disabled={busy}
              onClick={() =>
                void onSavePricing({
                  bwA4PricePaise: rupeesInputToPaise(bw),
                  colorA4PricePaise: rupeesInputToPaise(colorA4),
                  colorA3PricePaise: rupeesInputToPaise(colorA3),
                })
              }
            >
              Save rates
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[12px]">
        <CardHeader>
          <CardTitle>Hours</CardTitle>
          <CardDescription>
            {config?.openStatusLabel ?? (config?.openNow ? "Open now" : "Closed now")} · India time (Asia/Kolkata).
            Customers see these hours, and uploads pause while you are closed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-graphite px-3 py-3">
            <div>
              <Label htmlFor="hours-open-24x7">Open 24 hours, every day</Label>
              <p className="text-caption text-ash">Turn off to set opening and closing times for each day.</p>
            </div>
            <Switch
              id="hours-open-24x7"
              checked={isOpen24x7}
              disabled={busy}
              onCheckedChange={(enabled) => setHours((current) => setOpen24x7(current, enabled))}
            />
          </div>
          {hours.map((hour) => {
            const problem = businessHourProblem(hour)
            const showTimes = !hour.isClosed && !hour.isOpen24Hours
            const updateDay = (patch: Partial<EditableBusinessHour>) =>
              setHours((current) =>
                current.map((entry) => (entry.dayOfWeek === hour.dayOfWeek ? { ...entry, ...patch } : entry)),
              )
            return (
              <div
                key={hour.dayOfWeek}
                className="grid items-center gap-3 rounded-[12px] border border-graphite px-3 py-3 md:grid-cols-[120px_auto_auto_1fr]"
              >
                <p className="text-body font-bold">{weekdayLabels[hour.dayOfWeek]}</p>
                <div className="flex items-center gap-2">
                  <Switch
                    aria-label={`${weekdayLabels[hour.dayOfWeek]} open`}
                    checked={!hour.isClosed}
                    onCheckedChange={(open) => updateDay({ isClosed: !open, isOpen24Hours: open && hour.isOpen24Hours })}
                  />
                  <span className="w-12 text-caption text-ash">{hour.isClosed ? "Closed" : "Open"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    aria-label={`${weekdayLabels[hour.dayOfWeek]} open 24 hours`}
                    checked={hour.isOpen24Hours}
                    disabled={hour.isClosed}
                    onCheckedChange={(enabled) => updateDay({ isOpen24Hours: enabled })}
                  />
                  <span className="text-caption text-ash">24 hours</span>
                </div>
                {showTimes ? (
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TimeSelect
                        label={`${weekdayLabels[hour.dayOfWeek]} opens at`}
                        value={hour.opensAt}
                        onChange={(opensAt) => updateDay({ opensAt })}
                      />
                      <span className="text-caption text-ash">to</span>
                      <TimeSelect
                        label={`${weekdayLabels[hour.dayOfWeek]} closes at`}
                        value={hour.closesAt}
                        invalid={problem !== null}
                        onChange={(closesAt) => updateDay({ closesAt })}
                      />
                    </div>
                    {problem ? (
                      <p className="text-caption text-destructive">{problem}</p>
                    ) : closesNextDay(hour) && hour.closesAt !== "00:00" ? (
                      <p className="text-caption text-ash">Closes the next day at {formatTime12h(hour.closesAt)}.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-caption text-ash">{describeBusinessHour(hour)}</p>
                )}
              </div>
            )
          })}
          <Button className="rounded-[12px]" disabled={busy || hasHoursProblem} onClick={() => void onSaveHours(hours)}>
            Save hours
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[12px]">
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
          <CardDescription>B&W is always offered. Color and A3 follow enabled printer offers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-[12px] border border-graphite px-3 py-3">
            <Label>B&W</Label>
            <Badge>Always on</Badge>
          </div>
          <div className="flex items-center justify-between rounded-[12px] border border-graphite px-3 py-3">
            <Label>Color</Label>
            <Switch checked={colorPrinting} disabled={!offeredColor || busy} onCheckedChange={setColorPrinting} />
          </div>
          <div className="flex items-center justify-between rounded-[12px] border border-graphite px-3 py-3">
            <Label>A3</Label>
            <Switch checked={a3Printing} disabled={!offeredA3 || busy} onCheckedChange={setA3Printing} />
          </div>
          {!offeredColor ? <p className="text-caption text-ash">Enable a color printer offer first.</p> : null}
          {!offeredA3 ? <p className="text-caption text-ash">Enable an A3 printer offer first.</p> : null}
          <Button
            className="rounded-[12px]"
            disabled={busy}
            onClick={() => void onSaveCapabilities({ colorPrinting: colorPrinting && offeredColor, a3Printing: a3Printing && offeredA3 })}
          >
            Save capabilities
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[12px]">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Operator on this PC.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-body">
          <p>{user.name} · {user.role}</p>
          <p className="text-caption text-ash">{user.email ?? user.phone ?? "No contact on this account"}</p>
          <p className="text-caption text-ash">Auth: {user.status}</p>
          <Button variant="outline" className="rounded-[12px]" onClick={onSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[12px]">
        <CardHeader>
          <CardTitle>Device diagnostics</CardTitle>
          <CardDescription>Connection, agent, and versions for this PC.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-body">
          <p>Cloud: {cloudState} · Orders stream: {streamState}</p>
          <p>Agent: {status.state} · pipe {status.pipeName ?? "—"} · uptime {uptime}</p>
          <p>Printers: {status.printerCount ?? printers.length} · Local queued jobs: {queuedJobs}</p>
          <p>Last heartbeat: {lastHeartbeatAt ?? "not sent yet"}</p>
          <p>App {appVersion} · Agent {status.agentVersion ?? "—"} · Protocol {status.protocolVersion ?? "—"}</p>
          <p>Hostname: {hostName ?? "—"} · Device {deviceId ?? "not registered"}</p>
        </CardContent>
      </Card>

      <Card className="rounded-[12px]">
        <CardHeader>
          <CardTitle>Log export</CardTitle>
          <CardDescription>Copies the agent log. Document paths, tokens, and signed URLs are not written there.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {exportMessage ? <p className="text-caption text-ash">{exportMessage}</p> : null}
          <Button
            className="rounded-[12px]"
            disabled={busy}
            onClick={() => {
              void onExportLog().then((path) => {
                setExportMessage(path ? `Saved ${path}` : "Export cancelled.")
              })
            }}
          >
            Export agent log
          </Button>
        </CardContent>
      </Card>

      {config ? (
        <Card className="rounded-[12px]">
          <CardHeader>
            <CardTitle>Order automation</CardTitle>
            <CardDescription>Paid online orders can admit and route without an operator. Cash stays operator-controlled.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <AutomationToggle
              label="Auto-accept paid online orders"
              enabled={config.orderAutomation.autoAcceptPaidOnline}
              disabled={busy}
              onToggle={() =>
                onUpdateAutomation({
                  ...config.orderAutomation,
                  autoAcceptPaidOnline: !config.orderAutomation.autoAcceptPaidOnline,
                })
              }
            />
            <AutomationToggle
              label="Auto-dispatch accepted orders"
              enabled={config.orderAutomation.autoDispatchAcceptedOrders}
              disabled={busy}
              onToggle={() =>
                onUpdateAutomation({
                  ...config.orderAutomation,
                  autoDispatchAcceptedOrders: !config.orderAutomation.autoDispatchAcceptedOrders,
                })
              }
            />
            <AutomationToggle
              label="Require cash operator acceptance"
              enabled={config.orderAutomation.cashRequiresOperatorAcceptance}
              disabled
              onToggle={() => undefined}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-caption text-ash">{label}</span>
      {children}
    </label>
  )
}

/** 12-hour time picker; the value stays canonical 24-hour "HH:mm". */
function TimeSelect({
  label,
  value,
  invalid = false,
  onChange,
}: {
  label: string
  value: string
  invalid?: boolean
  onChange: (value: string) => void
}) {
  const options = useMemo(() => timeOptions(value), [value])
  return (
    <NativeSelect
      aria-label={label}
      aria-invalid={invalid || undefined}
      className="w-36 [&_select]:h-9 [&_select]:rounded-[12px]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

function AutomationToggle({
  label,
  enabled,
  disabled,
  onToggle,
}: {
  label: string
  enabled: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <Button size="sm" variant={enabled ? "default" : "outline"} disabled={disabled} onClick={onToggle}>
        {enabled ? "On" : "Off"}
      </Button>
    </div>
  )
}
