'use client';

import React from 'react';
import { ShopStatus } from '../types/upload';
import { Clock } from 'lucide-react';

interface ShopStatusCardProps {
  status: ShopStatus;
  shopName?: string;
  estimatedMinutes?: number;
  statusMessage?: string;
}

export const ShopStatusCard: React.FC<ShopStatusCardProps> = ({
  status = 'OPEN',
  estimatedMinutes = 10,
  statusMessage,
}) => {
  const isAvailable = status === 'OPEN' || status === 'BUSY';

  return (
    <div className="w-full px-4 -mt-2">
      {/* 12px radius, flat border, paper white surface, no drop shadows */}
      <div className="w-full bg-paper rounded-xl p-5 text-center border-2 border-graphite/15">
        {isAvailable ? (
          <div>
            <h2 className="font-heading text-heading-sm text-midnight tracking-heading-sm">
              {statusMessage || "We're ready to print!"}
            </h2>

            <p className="mt-1 text-body text-charcoal font-medium max-w-[280px] mx-auto leading-body">
              Your documents will be printed at this shop.
            </p>

            <div className="mt-3.5 pt-3 border-t border-graphite/15 flex items-center justify-center gap-2 text-caption font-bold text-macaw-blue">
              <Clock className="size-4 stroke-[2.5]" />
              <span>Estimated time: ~{estimatedMinutes} minutes</span>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="font-heading text-heading-sm text-midnight tracking-heading-sm">
              We&apos;ll be right back!
            </h2>

            <p className="mt-1 text-body text-charcoal font-medium max-w-[290px] mx-auto leading-body">
              This store is temporarily unavailable. We&apos;re working on it and will be back online shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
