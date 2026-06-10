"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-primary print-hidden"
      type="button"
    >
      Print / Save as PDF
    </button>
  );
}
