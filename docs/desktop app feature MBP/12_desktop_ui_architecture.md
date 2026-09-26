# Section 12: Desktop Architecture, Screen Map & Design System Alignment

## 1. Product Requirements & Architectural Scope

Based on `meetctrlp_print_shop_partner_desktop_mvp_requirements.md` and repository guidelines:
- **Platform:** Windows Desktop Application (Windows 10 / 11 64-bit)
- **Primary Framework:** .NET 8 LTS + C# + WPF (Windows Presentation Foundation)
- **Data Flow Separation:**
  - **Firebase Auth:** Handles passwords and token issuance via `apps/server` REST proxy. Desktop stores refresh token in Windows Credential Manager. Zero Firebase SDK on client.
  - **Cloud Firestore:** All business data (orders, items, pricing, hardware, payments, print jobs) stored in the Firestore document hierarchy. Realtime updates delivered via `onSnapshot` listeners through `apps/server`. Dashboard stats maintained as an embedded `stats{}` map in `/shops/{shopId}` using `FieldValue.increment()`.
  - **Railway S3 Storage:** Presigned download of raw PDF documents into a local encrypted sandbox.
  - **Local Desktop Client:** Win32 Spooler API, WMI telemetry, Serilog diagnostic logs. Offline resilience is provided natively by the Firestore SDK's built-in local persistence cache — no custom SQLite journal required.
- **Design System Compliance:** Strictly aligns with MeetCtrlP Shared Design System (`docs/design-system/DESIGN copy.md` and `tokens copy.json`):
  - **Flat Visual Language:** **Zero gradients, zero drop shadows**.
  - **12px Radius Rule:** Strictly applied to all buttons, cards, modal dialogs, search inputs, and status pills.
  - **Color Palette:**
    - Primary Action: MeetCtrlP Green (`#16A34A` / `#22C55E`)
    - Secondary Action: Outline Lime (`#65A30D`) or Outline Blue (`#2563EB`)
    - Neutral Surfaces: Paper-White (`#FFFFFF`) with Flat Slate Border (`#E2E8F0`)
    - App Canvas Background: Cool Slate (`#F8FAFC`)
    - Text Primary: Deep Charcoal (`#0F172A`)
    - Text Muted: Subdued Slate (`#64748B`)

---

## 2. Six Primary Screens & Interaction Flows

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              SHELL WINDOW                              │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Top Bar: Brand Logo | Shop Name | Device ID | Realtime Dot | User  │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Side Navigation / Tab Bar:                                         │ │
│ │  [1. Dashboard]  [2. Orders]  [3. Print Queue]  [4. Printers]      │ │
│ │  [5. Settings & Pricing]                                           │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ Active Viewport (ContentPresenter)                                 │ │
│ │                                                                    │ │
│ │  • Screen 1: Dashboard (Counters, Revenue, Printer Health)         │ │
│ │  • Screen 2: Orders (Tabs: New, Active, Ready, Completed)          │ │
│ │  • Screen 3: Order Details (Deep-dive drawer / modal)              │ │
│ │  • Screen 4: Print Queue (Live Spooler jobs, progress, retries)    │ │
│ │  • Screen 5: Printers (Discovered hardware, test print, defaults)  │ │
│ │  • Screen 6: Shop & Settings (Pricing rules, capabilities, agent)  │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Screen Data Consumption Mapping
1. **Screen 1: Dashboard:** Binds to a Firestore `onSnapshot` listener on `shops/{shopId}` — reactively driven by the embedded `stats{}` map updated via `FieldValue.increment()` on order lifecycle transitions.
2. **Screen 2: Orders:** Binds to `ObservableCollection<OrderCardViewModel>` partitioned across 4 tabs (`New`, `Active`, `Ready`, `Completed`).
3. **Screen 3: Order Details:** Consumes `orders/{orderId}` document, PDFium preview bitmaps, and `orders/{orderId}/printJobs` subcollection.
4. **Screen 4: Print Queue:** Consumes live Windows Print Spooler notifications and `shops/{shopId}/orders/{orderId}/printJobs/{jobId}` status records.
5. **Screen 5: Printers:** Consumes `shops/{shopId}/printers` subcollection + Win32 `LocalPrintServer` discovery list.
6. **Screen 6: Shop & Settings:** Consumes `shops/{shopId}` pricing/capabilities fields and `shops/{shopId}/agents` subcollection metadata.

---

## 3. C# / WPF Project Architecture

The application is structured following clean MVVM (Model-View-ViewModel) using `CommunityToolkit.Mvvm`:

```text
MeetCtrlP.Desktop/
├── App.xaml / App.xaml.cs            # Bootstrapper, DI container, global exception handler
├── DesignSystem/                     # Shared Design Tokens mapped to XAML
│   ├── Colors.xaml                   # Flat color brushes (Green, Blue, Paper-White)
│   ├── Controls.xaml                 # 12px radius Button, TextBox, Pill, and Card styles
│   └── Typography.xaml               # Inter / Segoe UI text styles
├── Models/                           # Business domain models
│   ├── Order.cs
│   ├── OrderDocument.cs
│   ├── PrintJob.cs
│   └── PrinterDevice.cs
├── ViewModels/                       # Observable ViewModels with reactive commands
│   ├── ShellViewModel.cs
│   ├── DashboardViewModel.cs
│   ├── OrdersViewModel.cs
│   ├── OrderDetailsViewModel.cs
│   ├── PrintQueueViewModel.cs
│   ├── PrintersViewModel.cs
│   └── SettingsViewModel.cs
├── Views/                            # UserControls and Windows
│   ├── ShellWindow.xaml
│   ├── DashboardView.xaml
│   ├── OrdersView.xaml
│   ├── OrderDetailsModal.xaml
│   ├── PrintQueueView.xaml
│   ├── PrintersView.xaml
│   └── SettingsView.xaml
├── Services/                         # Core execution services
│   ├── Auth/                         # Token storage & DPAPI encryption (No Firebase SDK)
│   ├── Realtime/                     # WebSocket & SSE client (Firestore onSnapshot relay)
│   ├── Printing/                     # Win32 Spooler API & PrintQueue interop
│   ├── Pdf/                          # PDFium rendering & preview engine
│   ├── Storage/                      # Secure temporary sandbox & zero-fill shredder
│   └── Firestore/                    # Firestore service: shop stats listener, order streams, idempotency key manager
└── Program.cs                        # Entrypoint with single-instance mutex check
```

> [!NOTE]
> The former `Services/Sync/` directory (which contained the custom SQLite offline journal and idempotency drain loop) has been **replaced** by `Services/Firestore/`. Offline resilience is now provided natively by the Firestore SDK's built-in local persistence cache. The idempotency key manager communicates with the `/idempotencyKeys/{key}` Firestore collection via `apps/server`.

---

## 4. XAML Design System Resource Dictionary (Flat & 12px Radius)

```xml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">

    <!-- Design System Colors: Flat, No Gradients -->
    <SolidColorBrush x:Key="BrandPrimaryGreen" Color="#16A34A" />
    <SolidColorBrush x:Key="BrandPrimaryGreenHover" Color="#15803D" />
    <SolidColorBrush x:Key="BrandSecondaryBlue" Color="#2563EB" />
    <SolidColorBrush x:Key="SurfacePaperWhite" Color="#FFFFFF" />
    <SolidColorBrush x:Key="CanvasBackground" Color="#F8FAFC" />
    <SolidColorBrush x:Key="BorderNeutral" Color="#E2E8F0" />
    <SolidColorBrush x:Key="TextPrimary" Color="#0F172A" />
    <SolidColorBrush x:Key="TextMuted" Color="#64748B" />
    <SolidColorBrush x:Key="BadgeAmber" Color="#D97706" />
    <SolidColorBrush x:Key="BadgeRed" Color="#DC2626" />

    <!-- Corner Radius Constant: 12px Rule -->
    <CornerRadius x:Key="DefaultRadius">12</CornerRadius>

    <!-- Flat Primary Green Button (No drop shadows) -->
    <Style x:Key="PrimaryGreenButton" TargetType="Button">
        <Setter Property="Background" Value="{StaticResource BrandPrimaryGreen}" />
        <Setter Property="Foreground" Value="#FFFFFF" />
        <Setter Property="FontWeight" Value="SemiBold" />
        <Setter Property="Padding" Value="16,10" />
        <Setter Property="BorderThickness" Value="0" />
        <Setter Property="Template">
            <Setter.Value>
                <ControlTemplate TargetType="Button">
                    <Border Background="{TemplateBinding Background}"
                            CornerRadius="{StaticResource DefaultRadius}"
                            Padding="{TemplateBinding Padding}">
                        <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center" />
                    </Border>
                    <ControlTemplate.Triggers>
                        <Trigger Property="IsMouseOver" Value="True">
                            <Setter Property="Background" Value="{StaticResource BrandPrimaryGreenHover}" />
                        </Trigger>
                        <Trigger Property="IsEnabled" Value="False">
                            <Setter Property="Opacity" Value="0.5" />
                        </Trigger>
                    </ControlTemplate.Triggers>
                </ControlTemplate>
            </Setter.Value>
        </Setter>
    </Style>

    <!-- Flat Paper-White Card Style (12px Radius, 1px Slate Border, No Shadows) -->
    <Style x:Key="FlatPaperCard" TargetType="Border">
        <Setter Property="Background" Value="{StaticResource SurfacePaperWhite}" />
        <Setter Property="BorderBrush" Value="{StaticResource BorderNeutral}" />
        <Setter Property="BorderThickness" Value="1" />
        <Setter Property="CornerRadius" Value="{StaticResource DefaultRadius}" />
        <Setter Property="Padding" Value="16" />
        <Setter Property="Margin" Value="0,0,0,12" />
    </Style>

</ResourceDictionary>
```
