/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  MessageSquare,
  Plus,
  Copy,
  Trash2,
  Upload,
  BookOpen,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '../utils';

/* ── Built-in invitation templates ──────────────────────────────────────────── */

const BUILT_IN_TEMPLATES = [
  {
    id: '__builtin_inv_1',
    name: 'Initial Invitation — Lifestyle / Fashion',
    category: 'Invitation',
    contentEN: `Hi [Influencer Name] 👋

We'd love to invite you to collaborate with [Brand Name] for an exciting upcoming campaign!

📌 Campaign: [Campaign Name]
📅 Date: [Event / Posting Date]
📍 Location: [City / Venue] (if applicable)
🎁 Deliverables: [e.g. 1 Reel + 2 Stories]

All you need to do is enjoy the experience and share your authentic take with your audience.

Please let us know if you're interested, and we'll send over all the details right away!

Best,
[Your Name] — [Agency / Brand]`,
    contentAR: `مرحباً [اسم المؤثر] 👋

يسعدنا دعوتك للتعاون مع [اسم العلامة التجارية] في حملة مميزة قادمة!

📌 الحملة: [اسم الحملة]
📅 التاريخ: [تاريخ الفعالية / النشر]
📍 الموقع: [المدينة / المكان] (إن وجد)
🎁 المتطلبات: [مثال: ريل واحد + قصتان]

كل ما عليك فعله هو الاستمتاع بالتجربة ومشاركة أسلوبك الحقيقي مع جمهورك.

أخبرنا إن كنت مهتماً وسنرسل لك التفاصيل الكاملة فوراً!

مع التحية،
[اسمك] — [الوكالة / العلامة التجارية]`,
  },
  {
    id: '__builtin_inv_2',
    name: 'Initial Invitation — Food & Hospitality',
    category: 'Invitation',
    contentEN: `Hey [Influencer Name]!

We're reaching out because we think you'd be a perfect fit for [Brand / Restaurant Name]'s upcoming campaign.

🍽️ What's involved:
• A complimentary visit/meal at [Venue]
• Posting [deliverable e.g. 1 TikTok or 1 Reel + Stories] within [X days]
• Tagging @[handle] and using #[hashtag]

No scripts — just your honest experience.

Interested? Reply here or DM us and we'll get everything set up for you.

Talk soon,
[Your Name] — [Agency]`,
    contentAR: `مرحباً [اسم المؤثر]!

نتواصل معك لأننا نعتقد أنك الخيار المثالي لحملة [اسم العلامة / المطعم] القادمة.

🍽️ تفاصيل التعاون:
• زيارة / وجبة مجانية في [المكان]
• نشر [المحتوى: مثلاً تيك توك أو ريل + قصص] خلال [X أيام]
• الإشارة إلى @[الحساب] واستخدام #[الهاشتاق]

لا نصوص جاهزة — فقط تجربتك الحقيقية.

هل أنت مهتم؟ رد هنا أو راسلنا وسنرتب كل شيء لك.

نتحدث قريباً،
[اسمك] — [الوكالة]`,
  },
  {
    id: '__builtin_inv_3',
    name: 'Wave 2 Re-Invitation (No Response)',
    category: 'Invitation',
    contentEN: `Hi [Influencer Name],

Just following up on our previous message — we're still keen to have you on board for [Campaign Name]!

We know things get busy, so here's a quick recap:
📅 Deadline to confirm: [Date]
🎁 What you get: [Compensation / Free product / Experience]

If you're not available this round, no worries at all — we'd love to keep you in mind for future campaigns.

Looking forward to hearing from you!

[Your Name] — [Agency / Brand]`,
    contentAR: `مرحباً [اسم المؤثر]،

فقط متابعة لرسالتنا السابقة — ما زلنا نرغب في انضمامك لحملة [اسم الحملة]!

نعلم أن الجدول قد يكون مزدحماً، لذا إليك ملخصاً سريعاً:
📅 آخر موعد للتأكيد: [التاريخ]
🎁 ما ستحصل عليه: [التعويض / المنتج / التجربة]

إن لم تكن متاحاً هذه الجولة، لا قلق على الإطلاق — سنضعك في الاعتبار للحملات القادمة.

نتطلع لردك!

[اسمك] — [الوكالة / العلامة التجارية]`,
  },
  {
    id: '__builtin_inv_4',
    name: 'Confirmation & Brief',
    category: 'Invitation',
    contentEN: `Great news, [Influencer Name]! 🎉

You're officially confirmed for [Campaign Name]. Here are your full details:

📌 Brand: [Brand Name]
📅 Visit / Event Date: [Date & Time]
📍 Location: [Full Address / Google Maps link]
📸 Deliverables: [List exactly]
⏰ Posting Deadline: [Date]
#️⃣ Hashtags & Tags: #[hashtag] @[handle]

Please save this and reach out if you have any questions before the day.

Can't wait to see your content!

[Your Name] — [Agency / Brand]`,
    contentAR: `أخبار رائعة، [اسم المؤثر]! 🎉

تم تأكيد مشاركتك رسمياً في [اسم الحملة]. إليك التفاصيل الكاملة:

📌 العلامة التجارية: [الاسم]
📅 تاريخ الزيارة / الفعالية: [التاريخ والوقت]
📍 الموقع: [العنوان الكامل / رابط خرائط جوجل]
📸 المتطلبات: [القائمة بالتفصيل]
⏰ آخر موعد للنشر: [التاريخ]
#️⃣ الهاشتاقات والإشارات: #[الهاشتاق] @[الحساب]

يرجى حفظ هذه المعلومات والتواصل معنا إن كان لديك أي استفسار قبل اليوم.

لا يسعنا الانتظار لنرى محتواك!

[اسمك] — [الوكالة / العلامة التجارية]`,
  },
  {
    id: '__builtin_rem_1',
    name: 'Reminder — Post Due Tomorrow',
    category: 'Reminder',
    contentEN: `Hey [Influencer Name]! 👋

Just a friendly reminder that your post for [Campaign Name] is due tomorrow, [Date].

✅ Make sure to:
• Tag @[handle]
• Use #[hashtag]
• Post before [Time]

Let us know once it's live so we can track it. Thank you! 🙌

[Your Name]`,
    contentAR: `مرحباً [اسم المؤثر]! 👋

مجرد تذكير ودي بأن موعد نشر محتواك لـ [اسم الحملة] غداً، [التاريخ].

✅ تأكد من:
• الإشارة إلى @[الحساب]
• استخدام #[الهاشتاق]
• النشر قبل [الوقت]

أخبرنا حين ينشر المحتوى حتى نتابعه. شكراً جزيلاً! 🙌

[اسمك]`,
  },
  {
    id: '__builtin_chase_1',
    name: 'Coverage Chase — Post Overdue',
    category: 'Chase',
    contentEN: `Hi [Influencer Name],

We noticed the post for [Campaign Name] hasn't gone live yet — the deadline was [Date].

Could you please share an update on when we can expect it? We want to make sure everything is tracked properly on our end.

If there's a delay or issue, please let us know and we'll do our best to work it out.

Thanks,
[Your Name] — [Agency]`,
    contentAR: `مرحباً [اسم المؤثر]،

لاحظنا أن المنشور الخاص بـ [اسم الحملة] لم ينشر بعد — وكان الموعد النهائي [التاريخ].

هل يمكنك مشاركتنا آخر المستجدات حول موعد النشر المتوقع؟ نريد التأكد من تتبع كل شيء بشكل صحيح من جانبنا.

إن كان هناك تأخير أو مشكلة، أخبرنا وسنبذل قصارى جهدنا لحلها.

شكراً،
[اسمك] — [الوكالة]`,
  },
];

/* ── Types ───────────────────────────────────────────────────────────────────── */

type Template = {
  id: string;
  name: string;
  category: string;
  contentEN: string;
  contentAR: string;
};

const EMPTY_DRAFT = (): Omit<Template, 'id'> => ({
  name: '',
  category: 'Invitation',
  contentEN: '',
  contentAR: '',
});

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function downloadTemplate(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const CATEGORY_COLORS: Record<string, string> = {
  Invitation: 'border-gc-orange/30 text-gc-orange bg-gc-orange/10',
  Reminder: 'border-amber-300/40 text-amber-600 bg-amber-50 dark:border-amber-700/40 dark:text-amber-400 dark:bg-amber-900/20',
  Chase: 'border-red-300/40 text-red-600 bg-red-50 dark:border-red-700/40 dark:text-red-400 dark:bg-red-900/20',
};

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'border-border text-muted-foreground bg-secondary';
}

/* ── Template card ───────────────────────────────────────────────────────────── */

function TemplateCard({
  template,
  onDelete,
  onAddToWorkspace,
  isBuiltIn = false,
}: {
  template: Template;
  onDelete?: () => void;
  onAddToWorkspace?: () => void;
  isBuiltIn?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-card border-border transition-all hover:border-gc-orange/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className={cn('text-[9px] font-bold uppercase font-condensed shrink-0', categoryStyle(template.category))}>
            {template.category}
          </Badge>
          <div className="flex items-center gap-1 ml-auto">
            {isBuiltIn && onAddToWorkspace && (
              <button
                onClick={onAddToWorkspace}
                title="Save to workspace"
                className="h-7 px-2.5 rounded-lg border border-gc-orange/30 bg-gc-orange/5 text-[10px] font-bold text-gc-orange hover:bg-gc-orange/15 transition-colors"
              >
                + Add
              </button>
            )}
            {!isBuiltIn && onDelete && (
              <button
                onClick={onDelete}
                title="Delete template"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <CardTitle className="text-[15px] font-bold font-condensed uppercase tracking-tight mt-2 leading-snug">
          {template.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="en" className="w-full">
          <TabsList className="bg-secondary border border-border w-full grid grid-cols-2 h-9">
            <TabsTrigger value="en" className="text-[11px] font-bold uppercase font-condensed data-[state=active]:bg-card data-[state=active]:text-gc-orange">
              English
            </TabsTrigger>
            <TabsTrigger value="ar" className="text-[11px] font-bold uppercase font-condensed data-[state=active]:bg-card data-[state=active]:text-gc-orange">
              Arabic / عربي
            </TabsTrigger>
          </TabsList>

          {(['en', 'ar'] as const).map((lang) => {
            const content = lang === 'en' ? template.contentEN : template.contentAR;
            const isAr = lang === 'ar';
            return (
              <TabsContent key={lang} value={lang} className="mt-4">
                <div className="relative group">
                  <div
                    className={cn(
                      'p-4 rounded-lg bg-secondary/30 border border-border text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-medium overflow-hidden transition-all',
                      isAr && 'text-right',
                      !expanded && 'max-h-32',
                    )}
                    dir={isAr ? 'rtl' : 'ltr'}
                  >
                    {content || <span className="italic opacity-50">No content yet</span>}
                  </div>

                  {/* copy button */}
                  {content && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(content); toast.success('Copied to clipboard'); }}
                      className={cn(
                        'absolute top-2 h-7 w-7 rounded-lg flex items-center justify-center bg-card border border-border opacity-0 group-hover:opacity-100 transition-opacity',
                        isAr ? 'left-2' : 'right-2',
                      )}
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {content && content.length > 200 && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-gc-orange transition-colors"
                  >
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {expanded ? 'Collapse' : 'Expand full message'}
                  </button>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */

export default function Templates() {
  const [workspaceTemplates, setWorkspaceTemplates] = useState<Template[]>([]);
  const [firebaseError, setFirebaseError] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<Template, 'id'>>(EMPTY_DRAFT());
  const [activeTab, setActiveTab] = useState<'workspace' | 'builtin'>('builtin');
  const [bulkStatus, setBulkStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const bulkRef = useRef<HTMLInputElement>(null);

  /* Firebase listener */
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = onSnapshot(
        collection(db, 'templates'),
        (snap) => setWorkspaceTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Template))),
        () => setFirebaseError(true),
      );
    } catch {
      setFirebaseError(true);
    }
    return () => unsub?.();
  }, []);

  /* Save new template to Firebase */
  const saveTemplate = async () => {
    if (!draft.name.trim()) { toast.error('Template name is required'); return; }
    try {
      await addDoc(collection(db, 'templates'), draft);
      toast.success('Template saved to workspace');
      setIsAdding(false);
      setDraft(EMPTY_DRAFT());
    } catch {
      toast.error('Failed to save — check Firebase connection');
    }
  };

  /* Add a built-in template to the workspace */
  const addBuiltInToWorkspace = async (t: typeof BUILT_IN_TEMPLATES[number]) => {
    const { id: _id, ...data } = t;
    try {
      await addDoc(collection(db, 'templates'), data);
      toast.success(`"${t.name}" added to workspace`);
      setActiveTab('workspace');
    } catch {
      toast.error('Failed to save — check Firebase connection');
    }
  };

  /* Delete a workspace template */
  const deleteTemplate = async (id: string) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await deleteDoc(doc(db, 'templates', id));
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    }
  };

  /* Bulk upload from JSON or CSV file */
  const handleBulkFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setBulkStatus('Parsing file...');

    try {
      const text = await file.text();
      let rows: Omit<Template, 'id'>[] = [];

      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        /* CSV: first row = headers */
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
        rows = lines.slice(1).map((line) => {
          const cells = line.split(',');
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim().replace(/^"|"$/g, ''); });
          return {
            name: obj['name'] || obj['template_name'] || 'Untitled',
            category: obj['category'] || 'Invitation',
            contentEN: obj['content_en'] || obj['contenten'] || obj['english'] || '',
            contentAR: obj['content_ar'] || obj['contentar'] || obj['arabic'] || '',
          };
        });
      }

      const valid = rows.filter((r) => r.name && (r.contentEN || r.contentAR));
      if (valid.length === 0) { setBulkStatus('No valid rows found in file'); return; }

      setBulkStatus(`Uploading ${valid.length} template(s)...`);
      const batch = writeBatch(db);
      valid.forEach((row) => {
        const ref = doc(collection(db, 'templates'));
        batch.set(ref, row);
      });
      await batch.commit();
      toast.success(`${valid.length} template(s) uploaded successfully`);
      setBulkStatus(`✓ ${valid.length} template(s) added`);
      setActiveTab('workspace');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Bulk upload failed');
      setBulkStatus(`Failed: ${msg}`);
    }
  };

  /* Derived */
  const categories = ['all', ...Array.from(new Set([...workspaceTemplates.map((t) => t.category), ...BUILT_IN_TEMPLATES.map((t) => t.category)]))];
  const filteredWorkspace = categoryFilter === 'all' ? workspaceTemplates : workspaceTemplates.filter((t) => t.category === categoryFilter);
  const filteredBuiltIn = categoryFilter === 'all' ? BUILT_IN_TEMPLATES : BUILT_IN_TEMPLATES.filter((t) => t.category === categoryFilter);

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-12 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-gc-orange">Communications</div>
          <h2 className="font-extrabold text-2xl tracking-tight text-foreground">Messaging Templates</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare size={15} className="text-gc-orange" />
            Bilingual EN / AR templates for invitations, reminders, and coverage chases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk upload */}
          <button
            onClick={() => bulkRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest text-foreground hover:border-gc-orange hover:text-gc-orange transition-colors"
          >
            <Upload size={14} />
            Bulk Upload
          </button>
          <input ref={bulkRef} type="file" accept=".json,.csv" className="hidden" onChange={handleBulkFile} />

          {/* New template */}
          <button
            onClick={() => { setIsAdding(true); setActiveTab('workspace'); }}
            className="inline-flex items-center gap-2 rounded-lg bg-gc-orange px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest text-white hover:bg-gc-orange/90 transition-colors"
          >
            <Plus size={14} />
            New Template
          </button>
        </div>
      </div>

      {/* Bulk status */}
      {bulkStatus && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          <span className="text-[12px] font-semibold text-foreground">{bulkStatus}</span>
          <button onClick={() => setBulkStatus('')}><X size={14} className="text-muted-foreground hover:text-foreground" /></button>
        </div>
      )}

      {/* Firebase offline notice */}
      {firebaseError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          Firebase is unreachable — workspace templates may not load. Built-in templates are always available.
        </div>
      )}

      {/* Bulk upload format hint */}
      <details className="rounded-xl border border-border bg-muted/20 px-4 py-3">
        <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-muted-foreground select-none">
          Bulk Upload Format Guide
        </summary>
        <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
          <p><strong className="text-foreground">JSON</strong> — Array of objects with keys: <code className="bg-secondary px-1 rounded">name</code>, <code className="bg-secondary px-1 rounded">category</code>, <code className="bg-secondary px-1 rounded">contentEN</code>, <code className="bg-secondary px-1 rounded">contentAR</code></p>
          <p><strong className="text-foreground">CSV</strong> — First row headers: <code className="bg-secondary px-1 rounded">name, category, content_en, content_ar</code></p>
          <button
            onClick={() => downloadTemplate('trygc-templates-sample.json', JSON.stringify([{ name: 'Example Template', category: 'Invitation', contentEN: 'Hi [Name], ...', contentAR: 'مرحباً [الاسم]، ...' }], null, 2))}
            className="text-gc-orange hover:underline font-bold"
          >
            Download sample JSON
          </button>
        </div>
      </details>

      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              'rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest transition-colors capitalize',
              categoryFilter === cat
                ? 'border-gc-orange bg-gc-orange/10 text-gc-orange'
                : 'border-border text-muted-foreground hover:border-gc-orange/50 hover:text-foreground',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        <button
          onClick={() => setActiveTab('builtin')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest transition-colors',
            activeTab === 'builtin' ? 'bg-card text-gc-orange shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <BookOpen size={13} />
          Built-in ({filteredBuiltIn.length})
        </button>
        <button
          onClick={() => setActiveTab('workspace')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest transition-colors',
            activeTab === 'workspace' ? 'bg-card text-gc-orange shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MessageSquare size={13} />
          Workspace ({filteredWorkspace.length})
        </button>
      </div>

      {/* New template form */}
      {isAdding && (
        <Card className="bg-card border-gc-orange/30 border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-condensed text-[18px] font-bold uppercase tracking-tight">Create Template</CardTitle>
              <button onClick={() => { setIsAdding(false); setDraft(EMPTY_DRAFT()); }} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <X size={15} />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Template Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Initial Invitation — Lifestyle"
                  className="bg-secondary/50 border-border h-10 text-[12.5px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Category</Label>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 text-[12.5px] font-semibold text-foreground outline-none focus:border-gc-orange"
                >
                  {['Invitation', 'Reminder', 'Chase', 'Confirmation', 'Other'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">English Content</Label>
                <Textarea
                  value={draft.contentEN}
                  onChange={(e) => setDraft({ ...draft, contentEN: e.target.value })}
                  rows={8}
                  placeholder="Write the English version here..."
                  className="bg-secondary/50 border-border font-sans text-[12.5px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase font-condensed text-muted-foreground">Arabic Content / المحتوى بالعربي</Label>
                <Textarea
                  value={draft.contentAR}
                  onChange={(e) => setDraft({ ...draft, contentAR: e.target.value })}
                  rows={8}
                  placeholder="اكتب النسخة العربية هنا..."
                  className="bg-secondary/50 border-border font-sans text-[12.5px] text-right"
                  dir="rtl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setIsAdding(false); setDraft(EMPTY_DRAFT()); }} className="font-condensed font-bold uppercase tracking-wider h-9">Cancel</Button>
              <Button onClick={saveTemplate} className="bg-gc-orange text-white hover:bg-gc-orange/90 font-condensed font-bold uppercase tracking-wider h-9">Save Template</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Built-in templates */}
      {activeTab === 'builtin' && (
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Ready-to-use templates. Click <strong className="text-foreground">+ Add</strong> to save any of them to your workspace for editing.
          </p>
          {filteredBuiltIn.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No built-in templates match this category.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredBuiltIn.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isBuiltIn
                  onAddToWorkspace={() => addBuiltInToWorkspace(t)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Workspace templates */}
      {activeTab === 'workspace' && (
        <div className="space-y-4">
          {filteredWorkspace.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/20 py-16 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No workspace templates yet.</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Add templates from the Built-in library or create a custom one.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredWorkspace.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onDelete={() => deleteTemplate(t.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
