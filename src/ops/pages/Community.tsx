import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  Instagram, 
  Twitter,
  UserPlus
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Label } from '../components/ui/label';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

export default function Community() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    const q = query(collection(db, 'contacts'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

  const onSubmit = async (data: any) => {
    try {
      await addDoc(collection(db, 'contacts'), data);
      toast.success('Contact added to community database');
      setIsAddOpen(false);
      reset();
    } catch (error) {
      toast.error('Failed to add contact');
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.platformHandle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-condensed text-[24px] font-extrabold tracking-tight uppercase">Community Database</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Centralized influencer and contact directory for all campaigns.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger>
            <Button className="bg-gc-orange text-white hover:bg-gc-orange/90 h-9 font-condensed font-bold tracking-wider">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Influencer
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-condensed text-[20px] font-bold uppercase">Add New Influencer</DialogTitle>
              <DialogDescription className="text-[12px]">Enter the details to add a new contact to the community database.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Full Name</Label>
                <Input {...register('name')} placeholder="John Doe" className="bg-secondary/50 border-border h-9 text-[12.5px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Email</Label>
                <Input {...register('email')} type="email" placeholder="john@example.com" className="bg-secondary/50 border-border h-9 text-[12.5px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Platform Handle</Label>
                <Input {...register('platformHandle')} placeholder="@username" className="bg-secondary/50 border-border h-9 text-[12.5px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Niche</Label>
                <Input {...register('niche')} placeholder="Lifestyle, Tech, Fashion" className="bg-secondary/50 border-border h-9 text-[12.5px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Follower Range</Label>
                <Input {...register('followerRange')} placeholder="10k - 50k" className="bg-secondary/50 border-border h-9 text-[12.5px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">City</Label>
                <Input {...register('city')} placeholder="Riyadh" className="bg-secondary/50 border-border h-9 text-[12.5px]" />
              </div>
              <div className="col-span-2 flex justify-end gap-3 mt-4">
                <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="font-condensed font-bold uppercase tracking-wider h-9">Cancel</Button>
                <Button type="submit" className="bg-gc-orange text-white hover:bg-gc-orange/90 font-condensed font-bold uppercase tracking-wider h-9">Save Contact</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input 
            placeholder="Search by name, handle, or email..." 
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
              <TableHead className="text-muted-foreground/60 font-condensed text-[10px] uppercase tracking-[1px] py-3">Niche / Category</TableHead>
              <TableHead className="text-muted-foreground/60 font-condensed text-[10px] uppercase tracking-[1px] py-3">Reach</TableHead>
              <TableHead className="text-muted-foreground/60 font-condensed text-[10px] uppercase tracking-[1px] py-3">Location</TableHead>
              <TableHead className="text-muted-foreground/60 font-condensed text-[10px] uppercase tracking-[1px] py-3">Contact</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground/40 font-mono text-[11px]">
                  NO CONTACTS FOUND IN DATABASE
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id} className="border-border hover:bg-secondary/30 transition-colors group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-[12.5px] font-condensed">{contact.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5 tracking-tight">
                        <Instagram className="h-3 w-3" />
                        {contact.platformHandle || 'no_handle'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-secondary text-muted-foreground text-[9px] font-bold uppercase font-condensed">
                      {contact.niche || 'General'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11.5px] text-foreground font-medium">{contact.followerRange || 'N/A'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11.5px] text-muted-foreground font-medium">{contact.city}, {contact.country}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-gc-orange hover:bg-accent">
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-emerald-500 hover:bg-accent">
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
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
