"use client";

import { useTransition } from "react";
import { deleteFaqAction } from "@/server/actions/admin";

export function DeleteFaqButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => deleteFaqAction(id))}
      className="text-danger-600 text-sm underline"
    >
      Delete FAQ
    </button>
  );
}
