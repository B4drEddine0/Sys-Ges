import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useChatsQuery, useChatMessagesQuery, useChatMutations, useChatRealtime } from '@/features/chat/chatHooks';
import { Button, Input, Avatar, Card } from '@/components/ui';
import { chatApi } from '@/features/chat/chatApi';
import { MessageSquare, Plus, Users, Hash, Send, Copy, LogOut, Paperclip, Trash2, X, File as FileIcon } from 'lucide-react';
import { format } from 'date-fns';

export function ChatPage() {
  const { profile } = useAuth();
  const { pushToast } = useToast();
  const { data: chats = [], isLoading: isLoadingChats } = useChatsQuery();
  const { createChat, joinChat, sendMessage, deleteMessage } = useChatMutations();
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newChatName, setNewChatName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
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
    if ((!message.trim() && !file) || !activeChatId) return;
    try {
      await sendMessage.mutateAsync({ chatId: activeChatId, content: message.trim(), file: file || undefined });
      setMessage('');
      setFile(null);
    } catch (err: any) {
      pushToast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="absolute inset-0 flex bg-background">
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
                  
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%] group`}>
                    {!isConsecutive && (
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-semibold">{isMe ? 'You' : msg.profile?.display_name}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), 'p')}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {isMe && (
                        <button 
                          onClick={() => deleteMessage.mutate({ messageId: msg.id, filePath: msg.file_path })}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all"
                          title="Delete Message"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      
                      <div className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                        isMe 
                          ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                          : 'bg-card border border-border text-card-foreground rounded-tl-sm'
                      }`}>
                        {msg.file_path && (
                          <div className="mb-2">
                            {msg.file_type?.startsWith('image/') ? (
                              <a href={chatApi.getAttachmentUrl(msg.file_path)} target="_blank" rel="noreferrer">
                                <img src={chatApi.getAttachmentUrl(msg.file_path)} alt={msg.file_name || 'attachment'} className="max-w-[240px] max-h-[240px] rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity bg-black/10" />
                              </a>
                            ) : (
                              <a 
                                href={chatApi.getAttachmentUrl(msg.file_path)} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-2 p-3 bg-background/20 rounded-lg hover:bg-background/30 transition-colors"
                              >
                                <FileIcon className="h-6 w-6" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate max-w-[200px]">{msg.file_name}</p>
                                  <p className="text-xs opacity-70">{msg.file_size ? Math.round(msg.file_size / 1024) + ' KB' : 'Unknown size'}</p>
                                </div>
                              </a>
                            )}
                          </div>
                        )}
                        {msg.content.split(/(@\w+)/g).map((part, i) => 
                          part.startsWith('@') ? (
                            <span key={i} className="font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 rounded">
                              {part}
                            </span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                      </div>
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
              {file && (
                <div className="max-w-4xl mx-auto mb-2 px-2 flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md text-sm border border-border">
                    <FileIcon className="h-4 w-4 text-primary" />
                    <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                    <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive ml-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-end gap-2">
                <div className="relative flex-1">
                  <Input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={`Message #${activeChat.name}...`}
                    className="pl-12 pr-12 py-6 rounded-2xl shadow-sm text-[15px] bg-muted/20 focus-visible:bg-background transition-colors"
                  />
                  <label className="absolute left-2 bottom-1.5 h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted rounded-xl cursor-pointer transition-colors">
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                    />
                    <Paperclip className="h-4 w-4" />
                  </label>
                </div>
                <Button 
                  type="submit" 
                  size="sm" 
                  className="h-12 w-12 flex-shrink-0 rounded-2xl p-0 flex items-center justify-center shadow-sm"
                  disabled={(!message.trim() && !file) || sendMessage.isPending}
                >
                  <Send className="h-5 w-5 ml-0.5" />
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
