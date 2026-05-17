/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { cn } from '../utils';
import { notify } from '../services/notificationService';

type ScheduleEvent = { id: string; day: number; title: string; type: string; creator: string; time: string };

export default function Scheduling() {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<ScheduleEvent | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<ScheduleEvent[]>([
    { id: 'evt-5', day: 5, title: 'Visit: Red Bull', type: 'Visit', creator: '@tech_omar', time: '14:00' },
    { id: 'evt-9', day: 9, title: 'Post: STC Pay', type: 'Post', creator: '@fashion.mona', time: '19:00' },
    { id: 'evt-14', day: 14, title: 'Visit: Red Bull', type: 'Visit', creator: '@lifestyle_sa', time: '15:30' },
  ]);
  const [newEvent, setNewEvent] = React.useState({ title: '', day: new Date().getDate(), type: 'Visit', creator: '@creator', time: '14:00' });

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDayOfMonth + 6) % 7;
  const eventDays = Array.from(new Set(events.map(e => e.day)));

  const addEvent = () => {
    if (!newEvent.title.trim()) return;
    const event = { ...newEvent, id: `evt-${Date.now()}`, day: Number(newEvent.day) };
    setEvents(prev => [event, ...prev]);
    notify('Event Scheduled', `"${event.title}" scheduled for Day ${event.day} at ${event.time}`, 'purple', '/scheduling');
    setIsAddOpen(false);
    setNewEvent({ title: '', day: today.getDate(), type: 'Visit', creator: '@creator', time: '14:00' });
  };

  const saveEdit = () => {
    if (!editingEvent) return;
    setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...editingEvent } : e));
    notify('Event Updated', `"${editingEvent.title}" updated`, 'orange', '/scheduling');
    setEditingEvent(null);
  };

  const handleDelete = (id: string) => {
    const event = events.find(e => e.id === id);
    setEvents(prev => prev.filter(e => e.id !== id));
    if (event) notify('Event Removed', `"${event.title}" deleted from schedule`, 'red', '/scheduling');
    setConfirmDeleteId(null);
  };

  const EventModal = ({ title, data, onChange, onSave, onClose, saveLabel }: {
    title: string; data: Omit<ScheduleEvent, 'id'>; onChange: (p: Partial<typeof data>) => void;
    onSave: () => void; onClose: () => void; saveLabel: string;
  }) => (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Scheduler</p>
            <h3 className="font-condensed text-[20px] font-extrabold text-foreground">{title}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
          <label className="md:col-span-2 space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Title</span>
            <input className="settings-input" value={data.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Creator visit, posting deadline..." />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Day</span>
            <input className="settings-input" type="number" min={1} max={daysInMonth} value={data.day} onChange={(e) => onChange({ day: Number(e.target.value) })} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Time</span>
            <input className="settings-input" value={data.time} onChange={(e) => onChange({ time: e.target.value })} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Type</span>
            <select className="settings-input" value={data.type} onChange={(e) => onChange({ type: e.target.value })}>
              {['Visit', 'Post', 'Sync'].map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Creator / Owner</span>
            <input className="settings-input" value={data.creator} onChange={(e) => onChange({ creator: e.target.value })} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent">Cancel</button>
          <button onClick={onSave} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90">
            <Save size={14} />{saveLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <div className="text-[9.5px] font-bold uppercase tracking-[1.5px] text-gc-orange">Operations</div>
          <h2 className="font-condensed font-extrabold text-[22px] tracking-tight text-foreground">Operational Scheduler</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Harmonize creator visits & content distribution timelines</p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-card border border-border text-foreground rounded-lg font-condensed font-bold uppercase text-[10px] tracking-widest hover:border-gc-orange transition-all">
            Timeline View
          </button>
          <button onClick={() => setIsAddOpen(true)} className="px-5 py-2.5 bg-gc-orange text-white rounded-lg font-condensed font-bold uppercase text-[10px] tracking-widest hover:bg-gc-orange/90 transition-colors flex items-center gap-2">
            Add Event <Plus size={14} />
          </button>
        </div>
      </div>

      {isAddOpen && (
        <EventModal
          title="Add Event"
          data={newEvent}
          onChange={(p) => setNewEvent(prev => ({ ...prev, ...p }))}
          onSave={addEvent}
          onClose={() => setIsAddOpen(false)}
          saveLabel="Save Event"
        />
      )}

      {editingEvent && (
        <EventModal
          title="Edit Event"
          data={editingEvent}
          onChange={(p) => setEditingEvent(prev => prev ? { ...prev, ...p } : prev)}
          onSave={saveEdit}
          onClose={() => setEditingEvent(null)}
          saveLabel="Save Changes"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-8">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-secondary/20">
              <div className="flex items-center gap-4">
                <h3 className="font-condensed font-extrabold text-[18px] tracking-tight text-foreground">{monthName}</h3>
                <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card">
                  <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="py-3 text-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground border-r border-border last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, i) => {
                const dayNum = i - startOffset + 1;
                const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                const isToday = isValid && year === today.getFullYear() && month === today.getMonth() && dayNum === today.getDate();
                const hasEvent = isValid && eventDays.includes(dayNum);
                return (
                  <div key={i} className={cn('h-28 p-2.5 border-r border-b border-border relative transition-all hover:bg-accent/30', (i + 1) % 7 === 0 && 'border-r-0', !isValid && 'bg-secondary/20 opacity-40')}>
                    <span className={cn('text-xs font-bold tabular-nums', isToday ? 'text-gc-orange' : 'text-muted-foreground')}>
                      {isValid ? dayNum : ''}
                    </span>
                    {hasEvent && isValid && (
                      <div className="mt-1.5 space-y-1">
                        {events.filter(e => e.day === dayNum).slice(0, 2).map(e => (
                          <div key={e.id} className={cn('px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest rounded truncate border', e.type === 'Visit' ? 'bg-[var(--gc-orange-soft)] text-gc-orange border-[var(--gc-orange-soft)]' : 'bg-[var(--gc-purple-soft)] text-gc-purple border-[var(--gc-purple-soft)]')}>
                            {e.title}
                          </div>
                        ))}
                      </div>
                    )}
                    {isToday && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-gc-orange animate-pulse" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Events List */}
          <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-secondary/20">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">All Scheduled Events</h3>
            </div>
            {events.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No events scheduled.</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Title</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Day</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Time</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Type</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Creator</th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {events.map(evt => (
                    <tr key={evt.id} className="group hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3 text-sm font-bold text-foreground">{evt.title}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{evt.day}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{evt.time}</td>
                      <td className="px-5 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest', evt.type === 'Visit' ? 'bg-[var(--gc-orange-soft)] text-gc-orange' : 'bg-[var(--gc-purple-soft)] text-gc-purple')}>
                          {evt.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{evt.creator}</td>
                      <td className="px-5 py-3 text-right">
                        {confirmDeleteId === evt.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[10px] font-bold text-destructive whitespace-nowrap">Delete?</span>
                            <button onClick={() => handleDelete(evt.id)} className="px-2 py-1 bg-destructive text-white rounded text-[10px] font-bold hover:bg-destructive/90">Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 border border-border rounded text-[10px] font-bold hover:bg-accent">No</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditingEvent({ ...evt })} className="icon-btn"><Edit2 size={15} /></button>
                            <button onClick={() => setConfirmDeleteId(evt.id)} className="icon-btn text-destructive hover:bg-destructive/10"><Trash2 size={15} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-foreground border border-border rounded-xl p-6 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-gc-orange opacity-10 blur-[60px] pointer-events-none" />
            <div className="space-y-4 relative z-10">
              <h3 className="font-condensed font-bold text-[11px] uppercase tracking-widest text-background/60">Agenda: Today</h3>
              <div className="space-y-3">
                {[
                  { title: 'Jeddah Experience Visit', creator: '@tech_omar', time: '14:00 – 18:00', type: 'Visit' },
                  { title: 'Content Mirror Validation', creator: 'Internal System', time: '19:00', type: 'Sync' },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-3 p-3 bg-background/5 border border-white/10 rounded-lg">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', item.type === 'Visit' ? 'bg-gc-orange' : 'bg-gc-purple')}>
                      {item.type === 'Visit' ? <MapPin size={18} className="text-white" /> : <CalendarIcon size={18} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-background">{item.title}</p>
                      <p className="text-[9px] font-medium text-background/50 uppercase tracking-widest mt-0.5">{item.creator} · {item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-5 border-t border-white/10 mt-5 relative z-10">
              <p className="text-[9px] font-bold uppercase tracking-widest text-background/50 mb-2">Team Capacity</p>
              <div className="h-1.5 bg-background/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 w-[72%]" />
              </div>
              <p className="text-[9px] font-bold text-emerald-400 mt-1.5 uppercase tracking-wide">Sync level: Optimal</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              <h4 className="font-condensed font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Pending Approvals</h4>
            </div>
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer">
                  <div className="flex gap-2.5 items-center">
                    <div className="w-8 h-8 rounded-lg bg-gc-orange/10 border border-gc-orange/20 flex items-center justify-center text-[9px] font-bold text-gc-orange">RB</div>
                    <span className="text-[11px] font-semibold text-foreground">RB Visit Reschedule</span>
                  </div>
                  <ChevronRight size={13} className="text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h4 className="font-condensed font-bold text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Event Types</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[var(--gc-orange-soft)] border border-gc-orange" />
                <span className="text-[11px] text-foreground font-medium">Creator Visit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[var(--gc-purple-soft)] border border-gc-purple" />
                <span className="text-[11px] text-foreground font-medium">Content Posting</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/10 border border-emerald-500/40" />
                <span className="text-[11px] text-foreground font-medium">Internal Sync</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
