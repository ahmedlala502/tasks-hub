import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Trash2,
  MessageSquare
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from 'sonner';

interface BlockerTabProps {
  campaignId: string;
}

export default function BlockerTab({ campaignId }: BlockerTabProps) {
  const [blockers, setBlockers] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newBlocker, setNewBlocker] = useState({
    issue: '',
    severity: 'Medium',
    status: 'Active'
  });

  useEffect(() => {
    const q = query(collection(db, `campaigns/${campaignId}/blockers`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBlockers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [campaignId]);

  const addBlocker = async () => {
    if (!newBlocker.issue) return;
    try {
      await addDoc(collection(db, `campaigns/${campaignId}/blockers`), {
        ...newBlocker,
        reportedAt: new Date().toISOString()
      });
      // Update campaign status
      await updateDoc(doc(db, 'campaigns', campaignId), {
        blockerStatus: true
      });
      toast.success('Blocker reported');
      setIsAdding(false);
      setNewBlocker({ issue: '', severity: 'Medium', status: 'Active' });
    } catch (error) {
      toast.error('Failed to report blocker');
    }
  };

  const resolveBlocker = async (id: string) => {
    try {
      await updateDoc(doc(db, `campaigns/${campaignId}/blockers`, id), {
        status: 'Resolved',
        resolvedAt: new Date().toISOString()
      });
      
      // Check if any active blockers left
      const activeLeft = blockers.filter(b => b.id !== id && b.status === 'Active').length > 0;
      if (!activeLeft) {
        await updateDoc(doc(db, 'campaigns', campaignId), {
          blockerStatus: false
        });
      }
      
      toast.success('Blocker resolved');
    } catch (error) {
      toast.error('Failed to resolve blocker');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Active Blockers & Issues</h3>
        <Button size="sm" onClick={() => setIsAdding(true)} className="bg-rose-600 hover:bg-rose-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Report Issue
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-zinc-900 border-rose-900/50">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Description</Label>
                <Input 
                  value={newBlocker.issue} 
                  onChange={(e) => setNewBlocker({...newBlocker, issue: e.target.value})}
                  placeholder="e.g. Client delayed product delivery"
                  className="bg-zinc-950 border-zinc-800"
                />
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select 
                  value={newBlocker.severity} 
                  onValueChange={(v) => setNewBlocker({...newBlocker, severity: v || 'Medium'})}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <SelectItem value="Critical">Critical (Stops Campaign)</SelectItem>
                    <SelectItem value="High">High (Major Delay)</SelectItem>
                    <SelectItem value="Medium">Medium (Minor Issue)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button onClick={addBlocker} className="bg-rose-600 hover:bg-rose-700 text-white">Report Blocker</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {blockers.length === 0 ? (
          <div className="py-12 text-center text-zinc-600 font-mono text-xs border-2 border-dashed border-zinc-800 rounded-xl">
            NO ACTIVE BLOCKERS REPORTED
          </div>
        ) : (
          blockers.map((blocker) => (
            <Card key={blocker.id} className={`bg-zinc-900/50 border-zinc-800 ${blocker.status === 'Resolved' ? 'opacity-50' : ''}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${blocker.status === 'Resolved' ? 'bg-zinc-800' : 'bg-rose-500/10'}`}>
                    <AlertTriangle className={`h-5 w-5 ${blocker.status === 'Resolved' ? 'text-zinc-600' : 'text-rose-500'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{blocker.issue}</h4>
                      <Badge variant="outline" className={`text-[10px] uppercase ${getSeverityColor(blocker.severity)}`}>
                        {blocker.severity}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 font-mono uppercase">
                      Reported: {new Date(blocker.reportedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {blocker.status === 'Active' && (
                  <Button size="sm" variant="outline" onClick={() => resolveBlocker(blocker.id)} className="border-zinc-700 hover:bg-emerald-500/10 hover:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'Critical': return 'border-rose-500/50 text-rose-400 bg-rose-500/10';
    case 'High': return 'border-orange-500/50 text-orange-400 bg-orange-500/10';
    default: return 'border-zinc-500/50 text-zinc-400 bg-zinc-500/10';
  }
}
