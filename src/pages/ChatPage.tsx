import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useChatsQuery, useChatMessagesQuery, useChatMutations, useChatRealtime } from '@/features/chat/chatHooks';
import { Button, Input, Avatar, Card } from '@/components/ui';
import { MessageSquare, Plus, Users, Hash, Send, Copy, LogOut } from 'lucide-react';
import { format } from 'date-fns';

export function ChatPage() {
  const { profile } = useAuth();
  const { pushToast } = useToast();
  const { data: chats = [], isLoading: isLoadingChats } = useChatsQuery();
  const { createChat, joinChat, sendMessage } = useChatMutations();
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newChatName, setNewChatName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');
  
  const activeChat = chats.find(c => c.id === activeChatId);
  
  // Realtime subscription
  useChatRealtime(activeChatId);
  const { data: messages = [], isLoading: isLoadingMessages } = useChatMessagesQuery(activeChatId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set active chat automatically if none selected
  useEffect(() => {
    if (chats.length > 0 && !activeChatId) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId]);

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatName.trim()) return;
    try {
      const chat = await createChat.mutateAsync(newChatName.trim());
      setNewChatName('');
      setActiveChatId(chat.id);
      pushToast({ title: 'Chat created', description: `Group "${chat.name}" is ready!` });
    } catch (err: any) {
      pushToast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleJoinChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const chat = await joinChat.mutateAsync(joinCode.trim());
      setJoinCode('');
      setActiveChatId(chat.id);
      pushToast({ title: 'Joined successfully', description: `Welcome to "${chat.name}"` });
    } catch (err: any) {
      pushToast({ title: 'Join failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeChatId) return;
    try {
      await sendMessage.mutateAsync({ chatId: activeChatId, content: message.trim() });
      setMessage('');
    } catch (err: any) {
      pushToast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex h-full w-full bg-background">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col bg-muted/10">
        <div className="p-4 border-b border-border space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
            <MessageSquare className="h-5 w-5 text-primary" /> Team Chat
          </h2>
          
          <form onSubmit={handleJoinChat} className="flex gap-2">
            <Input 
              placeholder="Enter Invite Code" 
              value={joinCode} 
              onChange={e => setJoinCode(e.target.value)} 
              className="h-9"
            />
            <Button type="submit" size="sm" variant="secondary" className="px-3" disabled={!joinCode.trim() || joinChat.isPending}>
              Join
            </Button>
          </form>
          
          <form onSubmit={handleCreateChat} className="flex gap-2">
            <Input 
              placeholder="New group name..." 
              value={newChatName} 
              onChange={e => setNewChatName(e.target.value)}
              className="h-9"
            />
            <Button type="submit" size="sm" className="px-3" disabled={!newChatName.trim() || createChat.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2 mb-1">Your Groups</p>
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                activeChatId === chat.id ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted'
              }`}
            >
              <Hash className="h-4 w-4 opacity-70" />
              <span className="font-medium truncate">{chat.name}</span>
            </button>
          ))}
          {chats.length === 0 && !isLoadingChats && (
            <p className="text-sm text-muted-foreground text-center py-4 italic">No groups yet.</p>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeChat ? (
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Chat Header */}
          <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Hash className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">{activeChat.name}</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    Invite code: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">{activeChat.join_code}</code>
                  </span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(activeChat.join_code);
                      pushToast({ title: 'Code copied!', description: 'Share this code with your team.' });
                    }}
                    className="hover:text-foreground transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/5">
            {messages.map((msg, index) => {
              const isMe = msg.user_id === profile?.id;
              const isConsecutive = index > 0 && messages[index-1].user_id === msg.user_id;
              
              return (
                <div key={msg.id} className={`flex gap-4 ${isMe ? 'flex-row-reverse' : ''} ${isConsecutive ? 'mt-2' : ''}`}>
                  {!isConsecutive ? (
                    <Avatar 
                      name={msg.profile?.display_name?.slice(0,2).toUpperCase() || '??'} 
                      color="bg-primary text-primary-foreground"
                      src={msg.profile?.avatar_url}
                      className="h-10 w-10 flex-shrink-0 shadow-sm" 
                    />
                  ) : (
                    <div className="h-10 w-10 flex-shrink-0" /> // Spacer for consecutive messages
                  )}
                  
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    {!isConsecutive && (
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-semibold">{isMe ? 'You' : msg.profile?.display_name}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), 'p')}</span>
                      </div>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                      isMe 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-card border border-border text-card-foreground rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && !isLoadingMessages && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                <MessageSquare className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg">No messages here yet.</p>
                <p className="text-sm">Be the first to say hello!</p>
              </div>
            )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-background border-t border-border">
              {/* Typing indicator could go here */}
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-end gap-2">
                <Input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={`Message #${activeChat.name}...`}
                  className="pr-12 py-6 rounded-2xl shadow-sm text-[15px] bg-muted/20 focus-visible:bg-background transition-colors"
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  className="absolute right-2 bottom-1.5 h-9 w-9 rounded-xl p-0 flex items-center justify-center"
                  disabled={!message.trim() || sendMessage.isPending}
                >
                  <Send className="h-4 w-4 ml-0.5" />
                </Button>
              </form>
            </div>
          </div>
        ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/5 text-muted-foreground">
          <Users className="h-16 w-16 mb-4 opacity-20" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Team Chat</h2>
          <p className="max-w-sm text-center">Create a new group or join an existing one using an invite code from the sidebar.</p>
        </div>
      )}
    </div>
  );
}
