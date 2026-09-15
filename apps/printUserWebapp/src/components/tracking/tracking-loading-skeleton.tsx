"use client";

import React from "react";

export function TrackingLoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 animate-pulse space-y-6 px-4 py-6 sm:px-6">
      {/* Banner Skeleton */}
      <div className="flex h-44 flex-col items-center justify-center space-y-3 rounded-xl border-2 border-graphite/10 bg-graphite/5 p-6">
        <div className="size-12 rounded-full bg-graphite/10" />
        <div className="h-6 w-48 rounded bg-graphite/15" />
        <div className="h-4 w-64 rounded bg-graphite/10" />
        <div className="h-8 w-36 rounded-full bg-graphite/15" />
      </div>

      {/* Timeline Skeleton */}
      <div className="h-64 space-y-4 rounded-xl border-2 border-graphite/10 bg-graphite/5 p-6">
        <div className="h-4 w-32 rounded bg-graphite/15" />
        <div className="space-y-6 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="size-7 rounded-full bg-graphite/15" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-40 rounded bg-graphite/15" />
                <div className="h-3 w-60 rounded bg-graphite/10" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-32 rounded-xl border-2 border-graphite/10 bg-graphite/5 p-4" />
        <div className="h-32 rounded-xl border-2 border-graphite/10 bg-graphite/5 p-4" />
      </div>
    </div>
  );
}
