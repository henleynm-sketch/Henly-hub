"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

// All colors come from theme tokens — SVG accepts var() in presentation attrs.
const PALETTE = [
  "var(--hh-dot-blue)",
  "var(--hh-dot-green)",
  "var(--hh-dot-orange)",
  "var(--hh-dot-purple)",
  "var(--hh-dot-red)",
  "var(--hh-dot-yellow)",
  "var(--fog)",
  "var(--mist)",
];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--hh-panel)",
  border: "1px solid var(--glass-border-strong)",
  borderRadius: 10,
  color: "var(--white)",
  fontSize: 12,
} as const;

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduce;
}

const money = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-CA", { maximumFractionDigits: 0 });

export function PipelineValueBar({
  data,
}: {
  data: { label: string; valueCents: number; count: number }[];
}) {
  const reduce = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={data.length * 30 + 20}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis
          type="number"
          tickFormatter={money}
          tick={{ fill: "var(--fog)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={190}
          tick={{ fill: "var(--fog)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "var(--glass-border)" }}
          formatter={(v, name) =>
            String(name) === "valueCents"
              ? [money(Number(v ?? 0)), "Open estimate $"]
              : [String(v ?? ""), String(name ?? "")]
          }
        />
        <Bar dataKey="valueCents" isAnimationActive={!reduce} radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="var(--accent)" fillOpacity={0.55 + 0.45 * ((data.length - i) / data.length)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CountDonut({
  data,
  height = 220,
}: {
  data: { label: string; count: number }[];
  height?: number;
}) {
  const reduce = useReducedMotion();
  const filled = data.filter((d) => d.count > 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={filled}
          dataKey="count"
          nameKey="label"
          innerRadius="55%"
          outerRadius="85%"
          isAnimationActive={!reduce}
          stroke="var(--hh-panel)"
        >
          {filled.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend
          formatter={(v) => <span style={{ color: "var(--fog)", fontSize: 11 }}>{v}</span>}
          iconSize={9}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ActivityTrend({
  data,
}: {
  data: { week: string; logs: number; estimates: number }[];
}) {
  const reduce = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <XAxis
          dataKey="week"
          tickFormatter={(w: string) => w.slice(5)}
          tick={{ fill: "var(--fog)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={{ fill: "var(--fog)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend formatter={(v) => <span style={{ color: "var(--fog)", fontSize: 11 }}>{v}</span>} iconSize={9} />
        <Line
          type="monotone"
          dataKey="logs"
          name="Daily logs"
          stroke="var(--hh-dot-green)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={!reduce}
        />
        <Line
          type="monotone"
          dataKey="estimates"
          name="Estimates"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={!reduce}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
