"use client";

import React, { useState } from "react";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";
import { OrderLifecycleStatus } from "../../types/tracking";

interface TrackingSimulatorBarProps {
  currentStatus: OrderLifecycleStatus;
  onSelectStatus: (status: OrderLifecycleStatus) => void;
}

const SIMULATOR_STATUSES: { status: OrderLifecycleStatus; label: string }[] = [
  { status: "SUBMITTED", label: "1. Submitted" },
  { status: "ACCEPTED", label: "2. Accepted" },
  { status: "PRINTING", label: "3. Printing" },
  { status: "READY", label: "4. Ready" },
  { status: "COMPLETED", label: "5. Completed" },
  { status: "REJECTED", label: "Rejected" },
  { status: "FAILED", label: "Failed" },
  { status: "CANCELLED", label: "Cancelled" },
];

export function TrackingSimulatorBar({
  currentStatus,
  onSelectStatus,
}: TrackingSimulatorBarProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <aside
      aria-label="Order Status Simulator"
      className="fixed right-3 bottom-3 z-50 max-w-md rounded-xl border-2 border-graphite/30 bg-paper/95 p-2 shadow-lg backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3 px-2 py-1">
        <div className="flex items-center gap-1.5 text-caption font-bold text-midnight">
          <Bug className="size-3.5 text-ecto-green" />
          <span>Status Simulator</span>
          <span className="rounded bg-graphite/10 px-1.5 py-0.5 font-mono text-[10px] text-ash uppercase">
            {currentStatus}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse simulator" : "Expand simulator"}
          className="flex size-6 cursor-pointer items-center justify-center rounded-lg border border-graphite/20 bg-paper text-charcoal hover:bg-graphite/5"
        >
          {isOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronUp className="size-3.5" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-graphite/10 pt-2 sm:grid-cols-4">
          {SIMULATOR_STATUSES.map((item) => {
            const isActive = currentStatus === item.status;
            return (
              <button
                key={item.status}
                type="button"
                onClick={() => onSelectStatus(item.status)}
                className={`cursor-pointer rounded-lg px-2 py-1.5 text-center text-[11px] font-bold transition-all ${
                  isActive
                    ? "bg-ecto-green text-paper"
                    : "border border-graphite/10 bg-graphite/5 text-charcoal hover:bg-graphite/15"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
