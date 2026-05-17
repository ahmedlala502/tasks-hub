import React, { useEffect, useState } from 'react';
import { collectionGroup, onSnapshot, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  Search,
  Filter,
  Eye
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from 'sonner';

export default function QACenter() {
  const [pendingCoverage, setPendingCoverage] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // collectionGroup allows querying across all 'influencers' subcollections
    const q = query(
      collectionGroup(db, 'influencers'), 
      where('coverageReceived', '==', true),
      where('qaStatus', '==', 'Pending')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCoverage(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        path: doc.ref.path,
        ...doc.data() 
      })));
    });
    return unsubscribe;
  }, []);

  const handleQA = async (path: string, status: 'Passed' | 'Failed') => {
    try {
      await updateDoc(doc(db, path), {
        qaStatus: status
      });
      toast.success(`Coverage marked as ${status}`);
    } catch (error) {
      toast.error('Failed to update QA status');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-condensed text-[24px] font-extrabold tracking-tight uppercase">QA Review Center</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">Review and approve posting coverage across all active campaigns.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input 
            placeholder="Search by influencer or campaign..." 
            className="pl-10 bg-card border-border h-9 text-[12.5px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="border-border bg-card text-muted-foreground h-9 font-condensed font-bold">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground/60 font-condensed text-[10px] uppercase tracking-[1px] py-3">Influencer</TableHead>
              <TableHead className="text-muted-foreground/60 font-condensed text-[10px] uppercase tracking-[1px] py-3">Campaign</TableHead>
              <TableHead className="text-muted-foreground/60 font-condensed text-[10px] uppercase tracking-[1px] py-3">Platform</TableHead>
              <TableHead className="text-muted-foreground/60 font-condensed text-[10px] uppercase tracking-[1px] py-3">Coverage Link</TableHead>
              <TableHead className="text-muted-foreground/60 font-condensed text-[10px] uppercase tracking-[1px] py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingCoverage.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground/40 font-mono text-[11px]">
                  NO PENDING COVERAGE FOR REVIEW
                </TableCell>
              </TableRow>
            ) : (
              pendingCoverage.map((item) => (
                <TableRow key={item.id} className="border-border hover:bg-secondary/30 transition-colors group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-[12.5px] font-condensed">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono tracking-tight">{item.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11.5px] text-muted-foreground font-medium">Campaign ID: {item.path.split('/')[1]}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-secondary text-muted-foreground text-[9px] font-bold uppercase font-condensed">
                      Instagram
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <a 
                      href={item.coverageLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-gc-orange hover:underline text-[11.5px] font-medium flex items-center gap-1"
                    >
                      View Post <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 font-condensed font-bold uppercase tracking-wider"
                        onClick={() => handleQA(item.path, 'Passed')}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 font-condensed font-bold uppercase tracking-wider"
                        onClick={() => handleQA(item.path, 'Failed')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
