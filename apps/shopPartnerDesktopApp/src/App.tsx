import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

type PrinterStatus = "online" | "offline" | "printing" | "paused" | "error" | "unknown";
type ColorMode = "color" | "black_and_white";
type PaperSize = "A4" | "A3" | "LETTER";

type Printer = {
  id: string;
  name: string;
  backend: string;
  status: PrinterStatus;
  capabilities: {
    color: boolean;
    paper_sizes: string[];
    raw_supported: boolean;
  };
};

type JobReceipt = {
  id: string;
  state: string;
  message: string;
};

function App() {
  const [appVersion, setAppVersion] = useState("");
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [filePath, setFilePath] = useState("");
  const [copies, setCopies] = useState(1);
  const [colorMode, setColorMode] = useState<ColorMode>("color");
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [lastJob, setLastJob] = useState<JobReceipt | null>(null);
  const [message, setMessage] = useState("Ready to discover local printers.");
  const [loading, setLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://localhost:3000");
  const [deviceId, setDeviceId] = useState("shop-desktop-local");
  const [inventoryKey, setInventoryKey] = useState("");

  async function refreshPrinters() {
    setLoading(true);
    try {
      const discovered = await invoke<Printer[]>("list_printers");
      setPrinters(discovered);
      setSelectedPrinter((current) => current || discovered[0]?.id || "");
      setMessage(`${discovered.length} printer${discovered.length === 1 ? "" : "s"} discovered.`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function choosePrinter(printerId: string) {
    setSelectedPrinter(printerId);
    try {
      await invoke("select_printer", { printerId });
      setMessage("Printer selected.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function syncPrinterInventory() {
    setLoading(true);
    try {
      const result = await invoke<{ saved: number }>("sync_printer_inventory", {
        request: { server_url: serverUrl, device_id: deviceId, api_key: inventoryKey },
      });
      setMessage(`${result.saved} printer snapshot${result.saved === 1 ? "" : "s"} synced.`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function chooseDocument() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Documents", extensions: ["pdf", "png", "jpg", "jpeg"] }],
      });
      if (typeof selected === "string" && selected.length > 0) {
        setFilePath(selected);
        setMessage("Document selected.");
      }
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function submitPrintJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const receipt = await invoke<JobReceipt>("create_print_job", {
        job: {
          id: "pending",
          printer_id: selectedPrinter,
          document: { local_file: { path: filePath } },
          options: {
            color_mode: colorMode,
            paper_size: paperSize,
            copies,
            page_selection: "all",
          },
        },
      });
      setLastJob(receipt);
      setMessage(receipt.message);
      void watchJob(receipt.id);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function watchJob(jobId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      const receipt = await invoke<JobReceipt | null>("get_job", { jobId });
      if (receipt) {
        setLastJob(receipt);
        setMessage(receipt.message);
        if (receipt.state === "completed" || receipt.state === "failed") return;
      }
    }
  }

  useEffect(() => {
    void getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(""));
    void refreshPrinters();
    let unlisten: (() => void) | undefined;
    void listen<JobReceipt>("job:changed", (event) => {
      setLastJob(event.payload);
      setMessage(event.payload.message);
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => unlisten?.();
  }, []);

  const selected = printers.find((printer) => printer.id === selectedPrinter);
  const fileName = filePath.split(/[/\\]/).pop() || "No file selected";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PrintKro / Shop Desktop</p>
          <h1>Agent console</h1>
        </div>
        <div className="topbar-meta">
          <p className="app-version">{appVersion ? `Version ${appVersion}` : "Version unavailable"}</p>
          <div className="agent-status">
            <span className="status-dot status-online" /> Agent running
          </div>
        </div>
      </header>

      <section className="intro-band">
        <div>
          <p className="eyebrow">Local print channel</p>
          <h2>Print a PDF or image through the Windows driver.</h2>
          <p className="intro-copy">Pick a local file and a discovered printer. The agent queues the job and the Windows spooler talks to the driver.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void refreshPrinters()} disabled={loading}>
          {loading ? "Working..." : "Refresh printers"}
        </button>
      </section>

      <div className="dashboard-grid">
        <section className="panel printer-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Discovery</p>
              <h3>Printers</h3>
            </div>
            <span className="count-badge">{printers.length}</span>
          </div>
          <div className="printer-list">
            {printers.map((printer) => (
              <button
                className={`printer-row ${selectedPrinter === printer.id ? "is-selected" : ""}`}
                key={printer.id}
                type="button"
                onClick={() => void choosePrinter(printer.id)}
              >
                <span className={`status-dot status-${printer.status}`} />
                <span className="printer-copy">
                  <strong>{printer.name}</strong>
                  <small>{printer.backend}</small>
                </span>
                <span className="printer-status">{printer.status}</span>
              </button>
            ))}
            {printers.length === 0 && <p className="empty-state">No printers discovered yet.</p>}
          </div>
        </section>

        <section className="panel details-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Selected device</p>
              <h3>{selected?.name ?? "No printer selected"}</h3>
            </div>
          </div>
          {selected ? (
            <dl className="details-list">
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`status-dot status-${selected.status}`} /> {selected.status}
                </dd>
              </div>
              <div>
                <dt>Backend</dt>
                <dd>{selected.backend}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>{selected.capabilities.color ? "Supported" : "Unavailable"}</dd>
              </div>
              <div>
                <dt>Paper</dt>
                <dd>{selected.capabilities.paper_sizes.join(", ") || "Unknown"}</dd>
              </div>
            </dl>
          ) : (
            <p className="empty-state">Select a discovered printer to inspect its capabilities.</p>
          )}
        </section>

        <section className="panel inventory-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Firebase inventory</p>
              <h3>Sync printer details</h3>
            </div>
          </div>
          <label htmlFor="server-url">Server URL</label>
          <input id="server-url" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} />
          <label htmlFor="device-id">Device ID</label>
          <input id="device-id" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} />
          <label htmlFor="inventory-key">Inventory API key</label>
          <input id="inventory-key" type="password" value={inventoryKey} onChange={(event) => setInventoryKey(event.target.value)} />
          <button className="button button-secondary" type="button" onClick={() => void syncPrinterInventory()} disabled={loading || printers.length === 0}>
            Sync discovered details
          </button>
          <p className="feedback">Uploads normalized fields and the complete discovery snapshot.</p>
        </section>

        <section className="panel test-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Document job</p>
              <h3>Print PDF or image</h3>
            </div>
          </div>
          <form onSubmit={submitPrintJob}>
            <label>Document</label>
            <div className="file-picker">
              <button className="button button-secondary" type="button" onClick={() => void chooseDocument()} disabled={loading}>
                Choose file
              </button>
              <span title={filePath}>{fileName}</span>
            </div>
            <div className="options-grid">
              <div>
                <label htmlFor="copies">Copies</label>
                <input
                  id="copies"
                  type="number"
                  min={1}
                  value={copies}
                  onChange={(event) => setCopies(Math.max(1, Number(event.target.value) || 1))}
                />
              </div>
              <div>
                <label htmlFor="color-mode">Color</label>
                <select id="color-mode" value={colorMode} onChange={(event) => setColorMode(event.target.value as ColorMode)}>
                  <option value="color">Color</option>
                  <option value="black_and_white">Black and white</option>
                </select>
              </div>
              <div>
                <label htmlFor="paper-size">Paper</label>
                <select id="paper-size" value={paperSize} onChange={(event) => setPaperSize(event.target.value as PaperSize)}>
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                  <option value="LETTER">Letter</option>
                </select>
              </div>
            </div>
            <button className="button button-primary" type="submit" disabled={loading || !selectedPrinter || !filePath}>
              Send to printer
            </button>
          </form>
          <p className="feedback" role="status">
            {message}
          </p>
        </section>

        <section className="panel job-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Latest result</p>
              <h3>Job receipt</h3>
            </div>
          </div>
          {lastJob ? (
            <div className="job-receipt">
              <strong>{lastJob.state}</strong>
              <span>{lastJob.id}</span>
              <p>{lastJob.message}</p>
            </div>
          ) : (
            <p className="empty-state">No local jobs submitted.</p>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
