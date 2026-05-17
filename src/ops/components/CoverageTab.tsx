import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Plus, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Search,
  Download
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Label } from './ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { toast } from 'sonner';

interface CoverageTabProps {
  campaignId: string;
}

export default function CoverageTab({ campaignId }: CoverageTabProps) {
  const [coverage, setCoverage] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newLink, setNewLink] = useState('');

  useEffect(() => {
    // We can query influencers who have coverageReceived == true
    const q = query(collection(db, `campaigns/${campaignId}/influencers`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCoverage(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(inf => inf.coverageReceived || inf.coverageLink)
      );
    });
    return unsubscribe;
  }, [campaignId]);

  const updateQA = async (infId: string, status: 'Passed' | 'Failed') => {
    try {
      await updateDoc(doc(db, `campaigns/${campaignId}/influencers`, infId), {
        qaStatus: status
      });
      toast.success(`QA status updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update QA status');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Posting Coverage</h3>
          <p className="text-xs text-zinc-500">Review and validate received content links.</p>
        </div>
        <Button size="sm" variant="outline" className="border-zinc-800">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-900/50">
            <TableRow className="border-zinc-800">
              <TableHead className="text-[10px] uppercase font-mono">Influencer</TableHead>
              <TableHead className="text-[10px] uppercase font-mono">Link</TableHead>
              <TableHead className="text-[10px] uppercase font-mono">QA Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coverage.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-zinc-600 font-mono text-xs">
                  NO COVERAGE LINKS RECORDED YET
                </TableCell>
              </TableRow>
            ) : (
              coverage.map((item) => (
                <TableRow key={item.id} className="border-zinc-800">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-[10px] text-zinc-500">{item.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <a 
                      href={item.coverageLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-xs flex items-center gap-1"
                    >
                      View Content <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] uppercase ${getQAColor(item.qaStatus)}`}>
                      {item.qaStatus || 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
                        onClick={() => updateQA(item.id, 'Passed')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-rose-500 hover:bg-rose-500/10"
                        onClick={() => updateQA(item.id, 'Failed')}
                      >
                        <XCircle className="h-4 w-4" />
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

function getQAColor(status: string) {
  switch (status) {
    case 'Passed': return 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10';
    case 'Failed': return 'border-rose-500/50 text-rose-400 bg-rose-500/10';
    default: return 'border-zinc-500/50 text-zinc-400 bg-zinc-500/10';
  }
}
