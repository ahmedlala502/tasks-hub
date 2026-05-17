/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mail, CheckCircle2, XCircle, Clock, Search, Filter, Edit2, Trash2, Save, Send, X } from 'lucide-react';
import { cn } from '../utils';
import { notify } from '../services/notificationService';

const INITIAL_INVITES = [
  { id: 1, creator: '@tech_omar', campaign: 'Red Bull Summer', sentAt: '2h ago', status: 'Pending', response: '-' },
  { id: 2, creator: '@fashion.mona', campaign: 'STC Pay Launch', sentAt: '1d ago', status: 'Accepted', response: 'Confirmed' },
  { id: 3, creator: '@riyadh_explorer', campaign: 'Almarai Fresh', sentAt: '3d ago', status: 'Declined', response: 'Conflict' },
  { id: 4, creator: '@lifestyle_sa', campaign: 'Hungerstation', sentAt: '4h ago', status: 'Pending', response: '-' },
];

type Invite = typeof INITIAL_INVITES[0];

export default function Invitations() {
  const [invites, setInvites] = React.useState(INITIAL_INVITES);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editingInvite, setEditingInvite] = React.useState<Invite | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [newInvite, setNewInvite] = React.useState({ creator: '@', campaign: 'Red Bull Summer' });

  const addInvite = () => {
    if (!newInvite.creator.trim() || newInvite.creator.trim() === '@') return;
    const creator = newInvite.creator.startsWith('@') ? newInvite.creator : `@${newInvite.creator}`;
    setInvites(prev => [{
      id: Date.now(),
      creator,
      campaign: newInvite.campaign,
      sentAt: 'Just now',
      status: 'Pending',
      response: '-',
    }, ...prev]);
    notify('Invitation Dispatched', `Invite sent to ${creator} for ${newInvite.campaign}`, 'purple', '/invitations');
    setIsAddOpen(false);
    setNewInvite({ creator: '@', campaign: 'Red Bull Summer' });
  };

  const saveEdit = () => {
    if (!editingInvite) return;
    setInvites(prev => prev.map(inv => inv.id === editingInvite.id ? { ...editingInvite } : inv));
    if (editingInvite.status === 'Accepted') {
      notify('Invitation Accepted', `${editingInvite.creator} accepted the invite for ${editingInvite.campaign}`, 'green', '/invitations');
    } else if (editingInvite.status === 'Declined') {
      notify('Invitation Declined', `${editingInvite.creator} declined the invite for ${editingInvite.campaign}`, 'red', '/invitations');
    } else {
      notify('Invitation Updated', `${editingInvite.creator} invitation updated`, 'orange', '/invitations');
    }
    setEditingInvite(null);
  };

  const handleDelete = (id: number) => {
    const inv = invites.find(i => i.id === id);
    setInvites(prev => prev.filter(inv => inv.id !== id));
    if (inv) notify('Invitation Removed', `Invite to ${inv.creator} deleted`, 'red', '/invitations');
    setConfirmDeleteId(null);
  };

  const filtered = invites.filter(inv =>
    inv.creator.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.campaign.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-display font-black tracking-tighter text-foreground">Invitations Hub</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">Manage creator outreach & response logs</p>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="px-8 py-4 bg-gc-orange text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-gc-orange/20 hover:bg-gc-orange/90 transition-colors flex items-center gap-3">
           Dispatch New Batch <Send size={16} />
        </button>
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/30 p-4" onClick={() => setIsAddOpen(false)}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Invitations</p>
                <h3 className="font-condensed text-[20px] font-extrabold text-foreground">Dispatch New Batch</h3>
              </div>
              <button className="icon-btn" onClick={() => setIsAddOpen(false)}><X size={15} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 py-5">
              <label className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Creator Handle</span>
                <input className="settings-input" value={newInvite.creator} onChange={(e) => setNewInvite({ ...newInvite, creator: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Campaign</span>
                <input className="settings-input" value={newInvite.campaign} onChange={(e) => setNewInvite({ ...newInvite, campaign: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setIsAddOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent">Cancel</button>
              <button onClick={addInvite} className="rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90">Dispatch</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingInvite && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/30 p-4" onClick={() => setEditingInvite(null)}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gc-orange">Invitations</p>
                <h3 className="font-condensed text-[20px] font-extrabold text-foreground">Edit Invitation</h3>
              </div>
              <button className="icon-btn" onClick={() => setEditingInvite(null)}><X size={15} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 py-5">
              <label className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Creator Handle</span>
                <input className="settings-input" value={editingInvite.creator} onChange={(e) => setEditingInvite({ ...editingInvite, creator: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Campaign</span>
                <input className="settings-input" value={editingInvite.campaign} onChange={(e) => setEditingInvite({ ...editingInvite, campaign: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Status</span>
                  <select className="settings-input" value={editingInvite.status} onChange={(e) => setEditingInvite({ ...editingInvite, status: e.target.value })}>
                    {['Pending', 'Accepted', 'Declined'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Response</span>
                  <input className="settings-input" value={editingInvite.response} onChange={(e) => setEditingInvite({ ...editingInvite, response: e.target.value })} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setEditingInvite(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-accent">Cancel</button>
              <button onClick={saveEdit} className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-sm font-bold text-white hover:bg-gc-orange/90">
                <Save size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border-2 border-border rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-border bg-secondary/30 flex justify-between items-center">
          <div className="flex items-center gap-6">
             <div className="relative group">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-gc-orange transition-colors" />
                <input
                  type="text"
                  placeholder="Filter by creator or campaign..."
                  className="pl-12 pr-6 py-2.5 bg-card border border-border rounded-xl text-xs font-bold uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-ring/20 transition-all w-64 text-foreground"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
             <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-accent">
                <Filter size={14} /> Filters
             </button>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-1 bg-secondary rounded-lg">Active Transmissions: {invites.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/20">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Creator Instance</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mission Link</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dispatch Time</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Synch Status</th>
                <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((invite) => (
                <tr key={invite.id} className="group hover:bg-accent/40 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground font-black text-xs">
                        {invite.creator[1]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-black text-foreground">{invite.creator}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-3 py-1 bg-secondary/50 rounded-lg">{invite.campaign}</span>
                  </td>
                  <td className="px-8 py-6 text-xs font-bold text-muted-foreground tabular-nums uppercase">{invite.sentAt}</td>
                  <td className="px-8 py-6">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                      invite.status === 'Accepted' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" :
                      invite.status === 'Pending' ? "bg-amber-50 text-amber-500 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 animate-pulse" :
                      "bg-red-50 text-red-500 border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                    )}>
                      {invite.status === 'Accepted' ? <CheckCircle2 size={12} /> :
                       invite.status === 'Pending' ? <Clock size={12} /> :
                       <XCircle size={12} />}
                      {invite.status}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    {confirmDeleteId === invite.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[10px] font-bold text-destructive whitespace-nowrap">Delete?</span>
                        <button onClick={() => handleDelete(invite.id)} className="px-2 py-1 bg-destructive text-white rounded text-[10px] font-bold hover:bg-destructive/90">Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 border border-border rounded text-[10px] font-bold hover:bg-accent">No</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingInvite({ ...invite })} className="icon-btn" title="Edit"><Edit2 size={15} /></button>
                        <button onClick={() => setConfirmDeleteId(invite.id)} className="icon-btn text-destructive hover:bg-destructive/10" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
