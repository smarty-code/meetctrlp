# Desktop prototype — agent handbook

**This is the source of truth for `apps/desktop-proto`.**  
Read this before writing code in that folder.

Related files that are **not** the current prototype:

| Doc | Status |
| --- | --- |
| `docs/arc/DESKTOP_AGENT_ARC.md` | Future product sketch. Do not implement it yet. |
| `docs/arc/SHOP_DESKTOP_AGENT_V1.md` | Older Rust/Tauri product notes. Retired for this folder. |
| `docs/arc/PRINT_AGENT_PROTOTYPE.md` | Windows printing background. Useful context, not the app spec. |
| `apps/desktop-proto/README.md` | Short human run instructions. |

---

## 1. What this project is

A **Windows-only WPF test app**. It answers two questions:

1. Can a shop owner sign in (or register) through `apps/server` without a Firebase client SDK?
2. For a printer Windows already knows about, what configuration does the driver expose?

Flow:

```text
Open app
  → restore session (refresh token) or show login/register
  → list installed printers
  → user picks one (default printer is pre-selected)
  → read capabilities from Windows
  → show them grouped in a scrollable list
```

It is **not** a full shop product, not a print agent, and not deployable.

Auth details: [`apps/desktop-proto/docs/auth.md`](../../apps/desktop-proto/docs/auth.md).

---

## 2. How to start (Windows only)

This will not build or run on Linux, macOS, or WSL.

Need:

- Windows 10 2004+ or Windows 11
- .NET 8 SDK (`dotnet --list-sdks` should show `8.x`)
- At least one printer in Windows (physical, or Microsoft Print to PDF)

From `apps/desktop-proto`:

```powershell
dotnet restore .\Ctrlp.Desktop.sln
dotnet build .\Ctrlp.Desktop.sln -c Debug
dotnet run --project .\src\Ctrlp.Desktop\Ctrlp.Desktop.csproj -c Debug
```

One-shot (installs SDK with winget if missing):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Setup-And-Run.ps1
```

Visual Studio 2022: open `Ctrlp.Desktop.sln`, startup project **Ctrlp.Desktop**, F5.

If `dotnet` is missing, install **.NET 8 SDK**, then open a **new** terminal.

---

## 3. Scope

### In scope (current)

- Shop-owner email/phone + password auth against `apps/server` (no Firebase SDK in this app).
- Discover printers from Windows (`LocalPrintServer` + installed printer names).
- Read every setting the selected printer reports (Print Schema XML, with GDI fallback).
- Show those settings in a single capabilities window: printer dropdown, Refresh, grouped list.
- Keep printing logic out of XAML.

### Out of scope (do not add unless a human asks)

- Submitting print jobs / PDFs / page ranges
- Windows print dialog bypass for actual printing
- Agent registration / printer inventory upload via the shop session
- Shop navigation (Print / Printers / Cloud pages)
- Windows Service / background agent
- Tauri, Rust, React desktop shells
- Direct USB / IPP / vendor printer protocols
- Deployable installers, auto-update
- Password reset / email verification UI

---

## 4. Decisions already made

1. **C# / WPF / .NET 8**, not Rust + Tauri. The native Windows print APIs are used from C#.
2. **Talk to Windows, not the printer.** Discovery and capabilities go through the spooler and the installed driver.
3. **One process.** Login/register is a window; the capabilities viewer is a second window. Only one is shown at a time.
4. **Capabilities come from the driver**, not a hardcoded A4 / color / duplex form. Print Schema XML is primary; GDI `PrinterSettings` fills gaps (paper, trays, dpi, copies).
5. **Capabilities UI stays a viewer.** Selecting a printer only reloads the catalog. There is no print ticket editor and no submit.
6. **Layered projects** so printing/cloud stay out of XAML:
   - Abstractions = models + interfaces
   - Printing = Windows adapter
   - Cloud = HTTP client + DTOs (no WPF)
   - Desktop = WPF + Windows Credential Manager
7. **No Firebase client SDK.** Credentials go to `apps/server`. The refresh token is stored in Windows Credential Manager; the ID token stays in memory.
8. **Design tokens in the WPF app** use the shared palette (paper, graphite, ecto green `#58CC02`, 12px radius, no drop shadows). Do not invent a new visual language. Full web design-system rules still live in `docs/design-system/`; this app is WPF, not `@ctrlp/ui`.

---

## 5. Layout

```text
apps/desktop-proto/
  Ctrlp.Desktop.sln
  README.md
  scripts/Setup-And-Run.ps1
  src/
    Ctrlp.Agent.Abstractions/     net8.0 — no Windows UI
      Printers/PrinterInfo.cs
      Capabilities/PrinterCapabilityCatalog.cs
      Capabilities/WellKnownPrintSettings.cs
      Printing/IPrinterDiscovery.cs
      Printing/IPrinterCapabilitiesReader.cs
      PrintMessages.cs
      PrintValidationException.cs
    Ctrlp.Agent.Printing/          net8.0-windows, UseWPF (System.Printing)
      WindowsPrinterDiscovery.cs
      WindowsPrinterCapabilitiesReader.cs
    Ctrlp.Agent.Cloud/             net8.0 — HTTP, no WPF
      AuthApiClient.cs
      CloudOptions.cs
    Ctrlp.Desktop/                 WPF WinExe
      App.xaml
      LoginWindow.xaml
      MainWindow.xaml
      Auth/
      ViewModels/
```

Dependency direction (do not reverse):

```text
Ctrlp.Desktop
    → Ctrlp.Agent.Printing
        → Ctrlp.Agent.Abstractions
    → Ctrlp.Agent.Cloud
    → Ctrlp.Agent.Abstractions
```

| Project | Allowed to do | Must not do |
| --- | --- | --- |
| Abstractions | Models, interfaces, message strings | WPF, `System.Printing`, HTTP |
| Printing | Query Windows printers and capabilities | XAML, cloud, job submission (not in this snapshot) |
| Cloud | HTTP to `apps/server`, JSON DTOs | WPF, Windows print APIs, Credential Manager |
| Desktop | Bind UI, store refresh token, host login | Call `LocalPrintServer` / Print Schema from the window |

Composition is in `App` / `MainWindow`: printers via `WindowsPrinterDiscovery` and `WindowsPrinterCapabilitiesReader`; auth via `AuthApiClient` + `AuthSession`.

---

## 6. Runtime path

```text
App.OnStartup
  → restore refresh token or LoginWindow
  → MainWindow.Loaded
  → MainViewModel.InitializeAsync
  → IPrinterDiscovery.GetPrinters / GetDefaultPrinterName
  → SelectedPrinter = default or first
  → IPrinterCapabilitiesReader.Read(printerName)
  → PrinterCapabilityCatalog
  → UI groups by Category, lists option display names
```

`WindowsPrinterCapabilitiesReader`:

1. Validates the printer with `System.Drawing.Printing.PrinterSettings`.
2. Seeds a catalog from GDI (paper sizes, orientation, color, duplex, bins, resolutions, copies).
3. Overlays Print Schema from `PrintQueue.GetPrintCapabilitiesAsXml()`.
4. Uses the current `PrintTicket` for default option names.

`PrinterSetting.Name` is the Print Schema QName when known (for example `psk:PageMediaSize`). `DisplayName` is what the UI shows.

---

## 7. How to change this code

- **New Windows print API usage** → `Ctrlp.Agent.Printing`, behind an interface in Abstractions.
- **HTTP / auth JSON** → `Ctrlp.Agent.Cloud`, then Desktop session/UI.
- **New fields on a printer or setting** → Abstractions first, then Printing, then the view model.
- **UI copy/layout only** → `MainWindow.xaml` / `LoginWindow.xaml` / `App.xaml` / view models.
- **Do not** recreate `Ctrlp.Prototype`, Core, PDF print, or a multi-page shop shell.
- **Do not** add a Firebase SDK to this app.
- **Do not** add NuGet packages unless they are required for the asked feature.

---

## 8. Known constraints

- **Windows only.** `System.Printing` and WPF require a Windows desktop TFM (`net8.0-windows10.0.19041.0`).
- **Print Spooler must be running** or discovery/capabilities fail.
- **Capability lists vary by driver.** Microsoft Print to PDF reports many paper sizes; a real printer may report trays, duplex, finishing, or almost nothing.
- **Wrapping:** option values are shown as wrapping text (`OptionsText`), not a chip WrapPanel (that overflowed the window).
- Nested `.git` may exist under `apps/desktop-proto` from an earlier standalone copy. The monorepo root git is the one that matters for this workspace.

---

## 9. Next work

Do not invent the next milestone. The agreed process is:

1. Keep this capabilities viewer working.
2. Gather requirements with a human.
3. Then implement the next slice.

When that happens, update **this file** (scope + decisions) in the same change as the code.
