# CtrlP Print Shop (Tauri 2)

Windows shop UI. The C# agent in `apps/print-agent` is the backend.

Full architecture, protocol, and scripts: [`docs/arc/PRINT_SHOP_DESKTOP.md`](../../docs/arc/PRINT_SHOP_DESKTOP.md).  
Coding rules: [`AGENTS.md`](./AGENTS.md).

```powershell
# from repo root
pnpm desktop:setup
pnpm desktop:dev
```

Vite-only (`pnpm shop:dev`) is a UI preview. It cannot talk to the agent.
