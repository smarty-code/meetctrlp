"use client";

import React from "react";
import { AlertCircle, Check, CircleDot, Clock } from "lucide-react";
import { TimelineStepItem } from "../../types/tracking";

interface OrderTimelineItemProps {
  step: TimelineStepItem;
  isLast: boolean;
}

export function OrderTimelineItem({ step, isLast }: OrderTimelineItemProps) {
  const isCompleted = step.state === "completed";
  const isCurrent = step.state === "current";
  const isFailed = step.state === "failed";
  const isUpcoming = step.state === "upcoming";

  return (
    <li
      aria-current={isCurrent ? "step" : undefined}
      className={`relative flex items-start gap-2.5 sm:gap-3 ${
        isUpcoming ? "opacity-50" : "opacity-100"
      }`}
    >
      {/* Connector line */}
      {!isLast && (
        <div
          aria-hidden="true"
          className={`absolute top-7 -bottom-3.5 left-3.5 -ml-px w-0.5 ${
            isCompleted
              ? "bg-ecto-green"
              : isFailed
                ? "bg-amber-400"
                : "bg-graphite/20"
          }`}
        />
      )}

      {/* Step indicator node */}
      <div
        className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isCompleted
            ? "border-ecto-green bg-ecto-green text-paper"
            : isCurrent
              ? "border-ecto-green bg-eel-light text-midnight ring-3 ring-eel-light/50"
              : isFailed
                ? "border-amber-500 bg-amber-100 text-amber-900"
                : "border-graphite/30 bg-paper text-ash"
        }`}
      >
        {isCompleted && <Check className="size-3.5 stroke-[3]" />}
        {isCurrent && (
          <CircleDot className="size-3.5 stroke-[2.5] text-midnight" />
        )}
        {isFailed && (
          <AlertCircle className="size-3.5 stroke-[2.5] text-amber-700" />
        )}
        {isUpcoming && (
          <span className="size-1.5 rounded-full bg-graphite/40" />
        )}
      </div>

      {/* Content description */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p
            className={`text-caption sm:text-body leading-tight font-bold ${
              isCurrent
                ? "font-black text-midnight"
                : isFailed
                  ? "text-amber-900"
                  : "text-midnight"
            }`}
          >
            {step.title}
          </p>

          {/* Accessible state badge */}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
              isCompleted
                ? "border border-ecto-green/40 bg-eel-light text-midnight"
                : isCurrent
                  ? "bg-ecto-green text-paper"
                  : isFailed
                    ? "bg-amber-200 text-amber-900"
                    : "bg-graphite/10 text-ash"
            }`}
          >
            {isCompleted
              ? "Completed"
              : isCurrent
                ? "In Progress"
                : isFailed
                  ? "Issue"
                  : "Pending"}
          </span>
        </div>

        <p className="mt-0.5 text-[12px] leading-tight text-charcoal">
          {step.description}
        </p>

        {step.timestamp && (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-ash">
            <Clock className="size-2.5 text-ash" />
            <span>Updated just now</span>
          </p>
        )}
      </div>
    </li>
  );
}
