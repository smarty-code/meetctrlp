"use client";

import React from "react";
import { Check, CircleDot, AlertCircle } from "lucide-react";
import { TimelineStepItem } from "../../types/tracking";

interface OrderCompactTimelineProps {
  steps: TimelineStepItem[];
}

export function OrderCompactTimeline({ steps }: OrderCompactTimelineProps) {
  return (
    <div
      aria-label="Order progress tracker"
      className="w-full px-4 py-3 sm:px-6"
    >
      <ol className="relative space-y-2.5">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const isCompleted = step.state === "completed";
          const isCurrent = step.state === "current";
          const isFailed = step.state === "failed";
          const isUpcoming = step.state === "upcoming";

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className={`relative flex items-center gap-3 ${
                isUpcoming ? "opacity-40" : "opacity-100"
              }`}
            >
              {/* Connector line between nodes */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={`absolute top-4 left-2.5 -bottom-2.5 -ml-px w-0.5 ${
                    isCompleted
                      ? "bg-ecto-green"
                      : isFailed
                        ? "bg-amber-400"
                        : "bg-graphite/20"
                  }`}
                />
              )}

              {/* Node indicator */}
              <div
                className={`relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isCompleted
                    ? "border-ecto-green bg-ecto-green text-paper"
                    : isCurrent
                      ? "border-ecto-green bg-eel-light text-midnight ring-2 ring-eel-light/60"
                      : isFailed
                        ? "border-amber-500 bg-amber-100 text-amber-900"
                        : "border-graphite/30 bg-paper text-ash"
                }`}
              >
                {isCompleted && <Check className="size-3 stroke-[3]" />}
                {isCurrent && (
                  <CircleDot className="size-2.5 stroke-[2.5] text-midnight" />
                )}
                {isFailed && (
                  <AlertCircle className="size-2.5 stroke-[2.5] text-amber-700" />
                )}
                {isUpcoming && (
                  <span className="size-1 rounded-full bg-graphite/40" />
                )}
              </div>

              {/* Step info row: Title | status note */}
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span
                  className={`text-[13px] leading-tight ${
                    isCurrent
                      ? "font-extrabold text-midnight"
                      : isCompleted
                        ? "font-bold text-midnight"
                        : "font-medium text-ash"
                  }`}
                >
                  {step.title}
                </span>

                {/* Compact state pill or timestamp */}
                <span className="shrink-0 text-[11px] font-medium text-ash">
                  {isCompleted && (
                    <span className="font-bold text-ecto-green">Done</span>
                  )}
                  {isCurrent && (
                    <span className="rounded bg-eel-light px-1.5 py-0.5 font-bold text-midnight uppercase tracking-wider text-[9px]">
                      In Progress
                    </span>
                  )}
                  {isFailed && (
                    <span className="font-bold text-amber-700">Issue</span>
                  )}
                  {isUpcoming && <span>Pending</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
