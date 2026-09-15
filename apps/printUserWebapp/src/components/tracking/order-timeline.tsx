"use client";

import React from "react";
import { TimelineStepItem } from "../../types/tracking";
import { TRACKING_COPY } from "../../data/tracking-constants";
import { OrderTimelineItem } from "./order-timeline-item";

interface OrderTimelineProps {
  steps: TimelineStepItem[];
}

export function OrderTimeline({ steps }: OrderTimelineProps) {
  return (
    <section
      aria-labelledby="timeline-heading"
      className="rounded-xl border-2 border-graphite/20 bg-paper p-3.5 sm:p-4"
    >
      <div className="mb-3">
        <h3
          id="timeline-heading"
          className="text-caption font-bold tracking-wide text-midnight uppercase"
        >
          {TRACKING_COPY.orderTimelineTitle}
        </h3>
      </div>

      <ol
        className="relative space-y-3 sm:space-y-3.5"
        aria-label="Order progress"
      >
        {steps.map((step, idx) => (
          <OrderTimelineItem
            key={step.id}
            step={step}
            isLast={idx === steps.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

