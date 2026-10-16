"use client";

import React, { useState } from "react";
import { Button } from "@ctrlp/ui/button";
import type { PendingOrderAction } from "../../hooks/use-order-tracking";

interface OrderPendingActionsProps {
  canPayNow: boolean;
  canCancel: boolean;
  pendingAction: PendingOrderAction | null;
  actionError: string | null;
  onPayNow: () => void;
  onCancel: () => void;
}

/**
 * What the guest can still do before the shop takes the order on: pay an online order whose
 * payment didn't finish, or cancel an unpaid order. Hidden once neither applies.
 */
export function OrderPendingActions({
  canPayNow,
  canCancel,
  pendingAction,
  actionError,
  onPayNow,
  onCancel,
}: OrderPendingActionsProps) {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  if (!canPayNow && !canCancel) return null;
  const busy = pendingAction !== null;

  return (
    <section
      aria-labelledby="order-pending-actions-heading"
      className="mx-4 mt-4 rounded-[12px] border border-macaw-blue bg-paper px-4 py-3"
    >
      <h2 id="order-pending-actions-heading" className="text-body font-bold text-midnight">
        {canPayNow ? "Payment pending" : "Changed your mind?"}
      </h2>
      <p className="mt-1 text-caption text-ash">
        {canPayNow
          ? "Your order is saved. Pay to send it to the shop, or cancel it."
          : "You can cancel this order until the shop accepts it."}
      </p>

      {actionError ? (
        <p role="alert" className="mt-2 text-caption font-bold text-destructive">
          {actionError}
        </p>
      ) : null}

      {isConfirmingCancel ? (
        <div role="alertdialog" aria-labelledby="cancel-order-question" className="mt-3">
          <p id="cancel-order-question" className="text-caption font-bold text-midnight">
            Cancel this order? Its files will be deleted.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-[12px] border-2 px-4 text-midnight"
              onClick={() => setIsConfirmingCancel(false)}
              disabled={busy}
            >
              Keep order
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-[12px] border-2 border-destructive px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setIsConfirmingCancel(false);
                onCancel();
              }}
              disabled={busy}
            >
              Cancel order
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {canPayNow ? (
            <Button
              type="button"
              className="h-10 flex-1 rounded-[12px] px-4"
              onClick={onPayNow}
              disabled={busy}
            >
              {pendingAction === "pay" ? "Checking payment…" : "Pay now"}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-[12px] border-2 px-4 text-midnight"
              onClick={() => setIsConfirmingCancel(true)}
              disabled={busy}
            >
              {pendingAction === "cancel" ? "Cancelling…" : "Cancel order"}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
