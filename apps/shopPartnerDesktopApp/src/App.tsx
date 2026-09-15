import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

type PrinterStatus = "online" | "offline" | "printing" | "paused" | "error" | "unknown";

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

type SelectedDocument = {
  path: string;
  name: string;
};

function App() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [content, setContent] = useState("Hello from PrintKro");
  const [document, setDocument] = useState<SelectedDocument | null>(null);
  const [lastJob, setLastJob] = useState<JobReceipt | null>(null);
  const [message, setMessage] = useState("Ready to discover local printers.");
  const [loading, setLoading] = useState(false);

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

  async function submitTestJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const receipt = await invoke<JobReceipt>("create_test_job", {
        job: { printer_id: selectedPrinter, content },
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

  async function chooseDocument() {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Printable documents", extensions: ["pdf", "jpg", "jpeg", "png"] }],
      });
      if (typeof selected === "string") {
        setDocument({ path: selected, name: selected.split(/[\\/]/).pop() ?? selected });
        setMessage("Document selected. It is ready to print.");
      }
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function printDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || !selectedPrinter) return;

    setLoading(true);
    try {
      const receipt = await invoke<JobReceipt>("print_document_job", {
        job: {
          id: crypto.randomUUID(),
          printer_id: selectedPrinter,
          document: { local_file: { path: document.path } },
          options: {
            color_mode: "color",
            paper_size: "A4",
            copies: 1,
            page_selection: "all",
          },
        },
      });
      setLastJob(receipt);
      setMessage(receipt.message);
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PrintKro / Shop Desktop</p>
          <h1>Agent console</h1>
        </div>
        <div className="agent-status"><span className="status-dot" /> Agent running</div>
      </header>

      <section className="intro-band">
        <div>
          <p className="eyebrow">Local print channel</p>
          <h2>Observe the path from UI to printer.</h2>
          <p className="intro-copy">This first console validates the native boundary before cloud transport is added.</p>
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
                <span className="printer-copy"><strong>{printer.name}</strong><small>{printer.backend}</small></span>
                <span className="printer-status">{printer.status}</span>
              </button>
            ))}
            {printers.length === 0 && <p className="empty-state">No printers discovered yet.</p>}
          </div>
        </section>

        <section className="panel details-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Selected device</p><h3>{selected?.name ?? "No printer selected"}</h3></div>
          </div>
          {selected ? (
            <dl className="details-list">
              <div><dt>Status</dt><dd><span className={`status-dot status-${selected.status}`} /> {selected.status}</dd></div>
              <div><dt>Color</dt><dd>{selected.capabilities.color ? "Supported" : "Unavailable"}</dd></div>
              <div><dt>Paper</dt><dd>{selected.capabilities.paper_sizes.join(", ") || "Unknown"}</dd></div>
              <div><dt>RAW</dt><dd>{selected.capabilities.raw_supported ? "Supported" : "Unavailable"}</dd></div>
            </dl>
          ) : <p className="empty-state">Select a discovered printer to inspect its capabilities.</p>}
        </section>

        <section className="panel test-panel">
          <div className="panel-heading"><div><p className="eyebrow">Local backend</p><h3>Submit test job</h3></div></div>
          <form onSubmit={submitTestJob}>
            <label htmlFor="test-content">Text payload</label>
            <textarea id="test-content" value={content} onChange={(event) => setContent(event.target.value)} rows={5} />
            <button className="button button-primary" type="submit" disabled={loading || !selectedPrinter}>Send to printer</button>
          </form>
          <p className="feedback" role="status">{message}</p>
        </section>

        <section className="panel document-panel">
          <div className="panel-heading"><div><p className="eyebrow">Local document pipeline</p><h3>Print a file</h3></div></div>
          <form onSubmit={printDocument}>
            <button className="button button-secondary" type="button" onClick={() => void chooseDocument()} disabled={loading}>
              Choose PDF or photo
            </button>
            <p className="selected-file">{document ? document.name : "No document selected"}</p>
            <button className="button button-primary" type="submit" disabled={loading || !selectedPrinter || !document}>Print selected file</button>
          </form>
          <p className="feedback">The agent sends this file to the selected printer without opening the Windows print dialog.</p>
        </section>

        <section className="panel job-panel">
          <div className="panel-heading"><div><p className="eyebrow">Latest result</p><h3>Job receipt</h3></div></div>
          {lastJob ? <div className="job-receipt"><strong>{lastJob.state}</strong><span>{lastJob.id}</span><p>{lastJob.message}</p></div> : <p className="empty-state">No local jobs submitted.</p>}
        </section>
      </div>
    </main>
  );
}

export default App;
