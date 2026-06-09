"use client";

import { useEffect, useState } from "react";

export function CountUp({ value }: { value: string }) {
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    // 1. Extract number and formatting from the value string
    const isCurrency = value.includes("$");
    const numericStr = value.replace(/[^0-9]/g, "");
    
    if (!numericStr) {
      setDisplayValue(value);
      return;
    }

    const targetNumber = parseInt(numericStr, 10);
    const duration = 1000; // 1.0 seconds
    let startTime: number | null = null;

    function formatVal(val: number) {
      if (isCurrency) {
        return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(val);
      }
      return new Intl.NumberFormat("en-US").format(val);
    }

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // Easing out cubic: f(t) = 1 - (1 - t)^3
      const easePercentage = 1 - Math.pow(1 - percentage, 3);
      const current = Math.floor(easePercentage * targetNumber);

      setDisplayValue(formatVal(current));

      if (percentage < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value); // Ensure exact final formatting is restored
      }
    }

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{displayValue}</span>;
}
