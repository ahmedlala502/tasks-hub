import React from 'react';
import { motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ReportingChartsProps {
  total: number;
  statusData: { name: string; value: number }[];
  priorityData: { name: string; value: number }[];
  shiftData: { name: string; open: number; closed: number; handovers: number }[];
  teamData: { name: string; value: number; closed: number; risk: number }[];
  countryData: { name: string; value: number }[];
  officeData: { name: string; value: number; risk: number }[];
  statusColors: Record<string, string>;
  priorityColors: Record<string, string>;
  colors: string[];
  tooltipStyle: React.CSSProperties;
}

export default function ReportingCharts({
  total,
  statusData,
  priorityData,
  shiftData,
  teamData,
  countryData,
  officeData,
  statusColors,
  priorityColors,
  colors,
  tooltipStyle,
}: ReportingChartsProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Task Status" desc="Current state distribution">
          <div className="relative" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3} cornerRadius={4} strokeWidth={0}>
                  {statusData.map(e => (
                    <Cell key={e.name} fill={statusColors[e.name] || colors[0]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, n) => [`${v ?? 0} tasks (${total ? ((Number(v ?? 0) / total) * 100).toFixed(0) : 0}%)`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: 2 }}>
              <span className="text-2xl font-black relaxed-title text-ink">{total}</span>
              <span className="text-[8px] font-bold text-muted uppercase tracking-widest">Total</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {statusData.filter(s => s.value > 0).map(s => (
              <div key={s.name} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone/40 text-[9px] font-bold uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[s.name] || colors[0] }} />
                {s.name}
                <span className="font-black text-ink tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Priority Breakdown" desc="Task distribution by urgency">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priorityData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={70} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={36}>
                {priorityData.map(e => <Cell key={e.name} fill={priorityColors[e.name] || colors[0]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Shift Rhythm" desc="Open, closed & handovers by shift">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={shiftData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="open" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="closed" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="handovers" stroke="#F28C33" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Team Load" desc="Tasks & risks per team">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teamData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748B' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Total" fill="#1E293B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="risk" name="Risk" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Country Distribution" desc="Regional workload">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={countryData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={60} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                {countryData.map((e, i) => <Cell key={e.name} fill={colors[i % colors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Office Health" desc="Workload & risk per office">
          <div className="space-y-4 overflow-y-auto max-h-[280px] pr-1 custom-scrollbar">
            {officeData.map((o, i) => {
              const pct = total ? Math.round((o.value / total) * 100) : 0;
              return (
                <div key={o.name}>
                  <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
                    <span className="text-ink flex items-center gap-1.5">{o.name}</span>
                    <span className={o.risk ? 'text-red-500' : 'text-muted'}>{o.value} tasks · {o.risk} risk</span>
                  </div>
                  <div className="h-2.5 bg-dawn/60 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      className="h-full rounded-full relative"
                      style={{ backgroundColor: colors[i % colors.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </>
  );
}

function ChartCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="p-5 bg-white border border-dawn rounded-2xl hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="relaxed-title text-base font-bold">{title}</h3>
          <p className="text-[9px] font-bold text-muted uppercase tracking-widest mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="h-[220px]">{children}</div>
    </div>
  );
}
