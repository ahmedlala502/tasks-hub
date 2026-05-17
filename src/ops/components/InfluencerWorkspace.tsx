import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Mail, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Instagram,
  UserPlus
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { toast } from 'sonner';

interface InfluencerWorkspaceProps {
  campaignId: string;
}

export default function InfluencerWorkspace({ campaignId }: InfluencerWorkspaceProps) {
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [communityContacts, setCommunityContacts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, `campaigns/${campaignId}/influencers`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInfluencers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [campaignId]);

  useEffect(() => {
    const fetchCommunity = async () => {
      const snapshot = await getDocs(collection(db, 'contacts'));
      setCommunityContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCommunity();
  }, []);

  const addInfluencerToCampaign = async (contact: any) => {
    try {
      // Check if already added
      if (influencers.some(inf => inf.influencerId === contact.id)) {
        toast.error('Influencer already in campaign');
        return;
      }

      await addDoc(collection(db, `campaigns/${campaignId}/influencers`), {
        influencerId: contact.id,
        name: contact.name,
        username: contact.platformHandle,
        status: 'List Preparation',
        invitationWave: 0,
        visitCompleted: false,
        coverageReceived: false,
        qaStatus: 'Pending',
        addedAt: new Date().toISOString()
      });
      toast.success(`${contact.name} added to campaign`);
    } catch (error) {
      toast.error('Failed to add influencer');
    }
  };

  const updateStatus = async (infId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, `campaigns/${campaignId}/influencers`, infId), {
        status: newStatus
      });
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Influencer List Workspace</CardTitle>
          <CardDescription>Manage the influencer lifecycle for this campaign.</CardDescription>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger>
            <Button size="sm" className="bg-zinc-800 hover:bg-zinc-700">
              <Plus className="h-4 w-4 mr-2" />
              Add from Community
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-xl">
            <DialogHeader>
              <DialogTitle>Add Influencer to Campaign</DialogTitle>
              <DialogDescription>Select influencers from the community database to add to this campaign.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                <Input placeholder="Search community..." className="pl-10 bg-zinc-950 border-zinc-800" />
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {communityContacts.map(contact => (
                  <div key={contact.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{contact.name}</span>
                      <span className="text-[10px] text-zinc-500">{contact.platformHandle}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => addInfluencerToCampaign(contact)}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-900/50">
              <TableRow className="border-zinc-800">
                <TableHead className="text-[10px] uppercase font-mono">Influencer</TableHead>
                <TableHead className="text-[10px] uppercase font-mono">Status</TableHead>
                <TableHead className="text-[10px] uppercase font-mono">Execution</TableHead>
                <TableHead className="text-[10px] uppercase font-mono">Coverage</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {influencers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-zinc-600 font-mono text-xs">
                    NO INFLUENCERS ASSIGNED
                  </TableCell>
                </TableRow>
              ) : (
                influencers.map((inf) => (
                  <TableRow key={inf.id} className="border-zinc-800">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{inf.name}</span>
                        <span className="text-[10px] text-zinc-500">{inf.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] uppercase ${getStatusColor(inf.status)}`}>
                        {inf.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {inf.visitCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-zinc-600" />
                        )}
                        <span className="text-[10px] text-zinc-400 uppercase">
                          {inf.visitCompleted ? 'Completed' : 'Pending'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {inf.coverageReceived ? (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">RECEIVED</Badge>
                      ) : (
                        <Badge variant="outline" className="text-zinc-600 text-[10px]">WAITING</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Confirmed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'Invited': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'List Preparation': return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
  }
}
