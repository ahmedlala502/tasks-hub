import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';

const campaignSchema = z.object({
  name: z.string().min(3, 'Campaign name is required'),
  clientId: z.string().min(1, 'Client is required'),
  brandId: z.string().min(1, 'Brand is required'),
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City/Area is required'),
  objective: z.string().min(1, 'Objective is required'),
  type: z.string().min(1, 'Campaign type is required'),
  targetInfluencerCount: z.number().min(1),
  targetPostingCoverageCount: z.number().min(1),
  startDate: z.string(),
  endDate: z.string(),
  visitRequired: z.boolean(),
  budget: z.number().optional(),
  budgetType: z.string().optional(),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

export default function IntakeForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      visitRequired: false,
      targetInfluencerCount: 1,
      targetPostingCoverageCount: 1,
    }
  });

  useEffect(() => {
    const fetchCompanies = async () => {
      const snapshot = await getDocs(collection(db, 'companies'));
      setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCompanies();
  }, []);

  const onSubmit = async (data: CampaignFormValues) => {
    setLoading(true);
    try {
      // Validation Logic: If any critical field is missing (already handled by Zod), 
      // but we can add custom logic here for "Blocked" stage if needed.
      const campaignData = {
        ...data,
        stage: 1, // Start at Intake
        createdAt: new Date().toISOString(),
        createdBy: user?.uid,
        currentOwner: user?.uid,
        blockerStatus: false,
        slaStatus: 'On Time',
        platforms: ['Instagram', 'TikTok'], // Default
        internalOwners: [user?.uid],
      };

      const docRef = await addDoc(collection(db, 'campaigns'), campaignData);
      toast.success('Campaign created successfully');
      navigate(`/campaigns/${docRef.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="font-condensed text-[24px] font-extrabold tracking-tight uppercase">Campaign Intake</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">Initialize a new campaign lifecycle. All fields are required for validation.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-condensed text-[18px] font-bold uppercase tracking-tight">Core Information</CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground uppercase font-bold font-condensed tracking-wider">Basic campaign identification and ownership.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Campaign Name</Label>
              <Input id="name" {...register('name')} placeholder="e.g. Summer Glow 2024" className="bg-secondary/50 border-border h-10 text-[12.5px]" />
              {errors.name && <p className="text-[10px] text-rose-500 font-bold uppercase font-condensed">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Client</Label>
              <Select onValueChange={(v) => setValue('clientId', v as string)}>
                <SelectTrigger className="bg-secondary/50 border-border h-10 text-[12.5px] font-medium">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  {companies.filter(c => c.type === 'Client').map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-[12.5px] font-medium">{c.name}</SelectItem>
                  ))}
                  <SelectItem value="new" className="text-[12.5px] font-bold text-gc-orange">+ Add New Company</SelectItem>
                </SelectContent>
              </Select>
              {errors.clientId && <p className="text-[10px] text-rose-500 font-bold uppercase font-condensed">{errors.clientId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Brand</Label>
              <Select onValueChange={(v) => setValue('brandId', v as string)}>
                <SelectTrigger className="bg-secondary/50 border-border h-10 text-[12.5px] font-medium">
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  {companies.filter(c => c.type === 'Brand').map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-[12.5px] font-medium">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.brandId && <p className="text-[10px] text-rose-500 font-bold uppercase font-condensed">{errors.brandId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Campaign Type</Label>
              <Input id="type" {...register('type')} placeholder="e.g. Gifting, Paid, Event" className="bg-secondary/50 border-border h-10 text-[12.5px]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-condensed text-[18px] font-bold uppercase tracking-tight">Geography & Targets</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="country" className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Country</Label>
              <Input id="country" {...register('country')} placeholder="e.g. Saudi Arabia" className="bg-secondary/50 border-border h-10 text-[12.5px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city" className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">City / Area</Label>
              <Input id="city" {...register('city')} placeholder="e.g. Riyadh" className="bg-secondary/50 border-border h-10 text-[12.5px]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetInfluencerCount" className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Target Influencer Count</Label>
              <Input 
                id="targetInfluencerCount" 
                type="number" 
                {...register('targetInfluencerCount', { valueAsNumber: true })} 
                className="bg-secondary/50 border-border h-10 text-[12.5px] font-mono" 
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetPostingCoverageCount" className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Target Posting Coverage</Label>
              <Input 
                id="targetPostingCoverageCount" 
                type="number" 
                {...register('targetPostingCoverageCount', { valueAsNumber: true })} 
                className="bg-secondary/50 border-border h-10 text-[12.5px] font-mono" 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-condensed text-[18px] font-bold uppercase tracking-tight">Timeline & Logistics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Start Date</Label>
              <Input id="startDate" type="date" {...register('startDate')} className="bg-secondary/50 border-border h-10 text-[12.5px] font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">End Date</Label>
              <Input id="endDate" type="date" {...register('endDate')} className="bg-secondary/50 border-border h-10 text-[12.5px] font-mono" />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox 
                id="visitRequired" 
                onCheckedChange={(checked) => setValue('visitRequired', !!checked)} 
                className="border-border data-[state=checked]:bg-gc-orange data-[state=checked]:border-gc-orange"
              />
              <Label htmlFor="visitRequired" className="text-[11px] font-bold uppercase font-condensed text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Physical Visit Required
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)} className="font-condensed font-bold uppercase tracking-wider h-10">Cancel</Button>
          <Button type="submit" disabled={loading} className="bg-gc-orange text-white hover:bg-gc-orange/90 h-10 font-condensed font-bold uppercase tracking-wider px-6">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Campaign & Start Validation'}
          </Button>
        </div>
      </form>
    </div>
  );
}
