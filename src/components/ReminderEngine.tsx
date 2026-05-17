import React, { useEffect, useState } from 'react';
import { Task, Reminder } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ExternalLink, Clock } from 'lucide-react';
import { useLocalData } from './LocalDataContext';

interface ReminderEngineProps {
  tasks: Task[];
}

export default function ReminderEngine({ tasks }: ReminderEngineProps) {
  const { user, updateTask } = useLocalData();
  const [activeReminders, setActiveReminders] = useState<{task: Task, reminder: Reminder}[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const newTriggered: {task: Task, reminder: Reminder}[] = [];

      tasks.forEach(task => {
        const reminders = task.reminders;
        if (!reminders) return;

        const isOwner = task.owner === user.name || task.owner === user.email;
        const isCreator = task.creatorId === user.email;
        if (!isOwner && !isCreator) return;

        reminders.forEach((r, idx) => {
          const reminderTime = new Date(r.time);
          if (reminderTime <= now && !r.triggered) {
            newTriggered.push({ task, reminder: r });

            const updatedReminders = [...reminders];
            updatedReminders[idx] = { ...r, triggered: true };
            updateTask(task.id, { reminders: updatedReminders })
              .catch(err => console.error('Failed to update triggered reminder:', err));
          }
        });
      });

      if (newTriggered.length > 0) {
        setActiveReminders(prev => [...prev, ...newTriggered]);
        
        // Browser notification if possible
        if (Notification.permission === 'granted') {
          newTriggered.forEach(nt => {
            new Notification('Task Reminder', {
              body: `Task: ${nt.task.title}`,
              icon: '/favicon.ico'
            });
          });
        }
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [tasks, updateTask, user.email, user.name]);

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const removeReminder = (taskId: string, time: string) => {
    setActiveReminders(prev => prev.filter(r => !(r.task.id === taskId && r.reminder.time === time)));
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] pointer-events-none space-y-3 w-80">
      <AnimatePresence>
        {activeReminders.map((ar, idx) => (
          <motion.div
            key={`${ar.task.id}-${ar.reminder.time}`}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="pointer-events-auto bg-white rounded-2xl shadow-2xl border-l-4 border-l-amber-500 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Task Reminder</span>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(ar.reminder.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => removeReminder(ar.task.id, ar.reminder.time)}
                  className="p-1 hover:bg-stone rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-muted" />
                </button>
              </div>
              
              <h4 className="text-sm font-bold text-ink mb-1 line-clamp-2">{ar.task.title}</h4>
              <p className="text-xs font-medium text-muted line-clamp-2 mb-3">
                {ar.task.details || 'Operational alert for this task.'}
              </p>

              <div className="flex items-center gap-2">
                <button className="flex-1 px-3 py-2 bg-stone hover:bg-dawn rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">
                  Acknowledge
                </button>
                <div className="w-10 h-8 flex items-center justify-center bg-amber-50 rounded-lg">
                  <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
                </div>
              </div>
            </div>
            <div className="h-1 bg-amber-50">
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 30 }}
                onAnimationComplete={() => removeReminder(ar.task.id, ar.reminder.time)}
                className="h-full bg-amber-500"
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
