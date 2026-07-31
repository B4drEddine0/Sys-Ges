import React, { useState } from 'react';
import { Bell, Check, Circle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, Button } from '@/components/ui';
import { useNotificationsQuery, useTaskMutations } from '@/features/tasks/taskHooks';
import { cn } from '@/lib/cn';

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: notifications = [] } = useNotificationsQuery();
  const { markNotificationRead } = useTaskMutations();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-rose-500 border-2 border-background" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            
            <div className="overflow-y-auto flex-1 p-2">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                  <Bell className="h-10 w-10 mb-3 opacity-20" />
                  <p>You're all caught up!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => {
                        if (!notif.isRead) markNotificationRead.mutate(notif.id);
                      }}
                      className={cn(
                        "p-3 rounded-lg flex gap-3 cursor-pointer transition-colors text-sm",
                        notif.isRead ? "opacity-70 hover:bg-muted/50" : "bg-primary/5 hover:bg-primary/10"
                      )}
                    >
                      <Avatar 
                        name={notif.actor?.display_name?.slice(0, 2).toUpperCase() || 'S'} 
                        src={notif.actor?.avatar_url}
                        className="h-9 w-9 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-foreground leading-tight">
                          <span className="font-semibold mr-1">{notif.actor?.display_name || 'System'}</span>
                          {notif.type === 'mention' && 'mentioned you in a message'}
                          {notif.type === 'task_assigned' && 'assigned you a task'}
                          {notif.type === 'system' && notif.content}
                        </div>
                        {notif.type === 'mention' && (
                          <div className="text-muted-foreground mt-1 truncate">"{notif.content}"</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="shrink-0 pt-1">
                        {!notif.isRead ? <Circle className="h-2.5 w-2.5 fill-primary text-primary" /> : <Check className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Badge({ children, className, variant }: any) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", className)}>
      {children}
    </span>
  );
}
