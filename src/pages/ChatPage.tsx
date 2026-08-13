import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useChatsQuery, useChatMessagesQuery, useChatMutations, useChatRealtime, useChatMembersQuery } from '@/features/chat/chatHooks';
import { Button, Input, Avatar, Card } from '@/components/ui';
import { chatApi } from '@/features/chat/chatApi';
import { MessageSquare, Plus, Users, Hash, Send, Copy, LogOut, Paperclip, Trash2, X, File as FileIcon, Reply, SmilePlus, ChevronLeft, Edit3, MessageCircle, Clock, Home } from 'lucide-react';
import type { ChatMessage } from '@/features/chat/chatApi';
import { format, isToday, isYesterday } from 'date-fns';

// --- Screen Share imports ---
import { useScreenSharer } from '@/features/screenShare/useScreenSharer';
import { useActiveScreenShareSession } from '@/features/screenShare/useActiveScreenShareSession';
import { ScreenShareButton } from '@/components/screenShare/ScreenShareButton';
import { ScreenShareBanner } from '@/components/screenShare/ScreenShareBanner';
import { ScreenShareViewer } from '@/components/screenShare/ScreenShareViewer';
import { Scratchpad } from '@/features/chat/Scratchpad';

function formatActivityDate(dateString: string | null | undefined) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

export function ChatPage() {
  const { profile } = useAuth();
  const { pushToast } = useToast();
  const { chatId: activeChatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { data: chats = [], isLoading: isLoadingChats } = useChatsQuery();
  
  const { createChat, joinChat, sendMessage, deleteMessage, addReaction, removeReaction } = useChatMutations(activeChatId || undefined, profile);
  const [newChatName, setNewChatName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  const activeChat = chats.find(c => c.id === activeChatId);
  
  // Realtime subscription
  useChatRealtime(activeChatId || null);
  const { data: messages = [], isLoading: isLoadingMessages } = useChatMessagesQuery(activeChatId || null);
  const { data: members = [] } = useChatMembersQuery(activeChatId || null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Screen Share State ──────────────────────────────────────────────────────
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Track the active session in the current room (Postgres CDC)
  const activeSession = useActiveScreenShareSession(activeChatId || null);

  // Sharer controls for the current user
  const sharerControls = useScreenSharer({
    chatId: activeChatId ?? '',
    userId: profile?.id ?? '',
    onError: (msg) => pushToast({ title: 'Screen share error', description: msg, variant: 'destructive' }),
  });

  // When the active session ends (someone else was sharing), close the viewer if open
  useEffect(() => {
    if (!activeSession && isViewerOpen) {
      setIsViewerOpen(false);
    }
  }, [activeSession, isViewerOpen]);

  // When the user switches chats, stop sharing and close viewer
  useEffect(() => {
    if (sharerControls.state === 'sharing') {
      sharerControls.stopSharing();
    }
    setIsViewerOpen(false);
  }, [activeChatId]); // eslint-disable-line react-hooks/exhaustive-deps
  // ────────────────────────────────────────────────────────────────────────────

  // Play sound on new messages
  useEffect(() => {
    if (messages.length > prevMessagesLength.current && prevMessagesLength.current !== 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.user_id !== profile?.id) {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, profile?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark chat as read
  useEffect(() => {
    if (activeChatId) {
      chatApi.updateChatLastRead(activeChatId).catch(() => {});
    }
  }, [activeChatId, messages.length]);

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatName.trim()) return;
    try {
      const chat = await createChat.mutateAsync(newChatName.trim());
      setNewChatName('');
      navigate(`/chat/${chat.id}`);
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
      navigate(`/chat/${chat.id}`);
      pushToast({ title: 'Joined successfully', description: `Welcome to "${chat.name}"` });
    } catch (err: any) {
      pushToast({ title: 'Join failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!message.trim() && !file) || !activeChatId) return;
    try {
      await sendMessage.mutateAsync({ chatId: activeChatId, content: message.trim(), file: file || undefined, replyToId: replyingTo?.id });
      setMessage('');
      setFile(null);
      setReplyingTo(null);
      setMentionPopup(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err: any) {
      pushToast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Mention Autocomplete logic
  const [mentionPopup, setMentionPopup] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
    
    // Check if cursor is right after an @ word
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@(\w*)$/);
    
    if (match) {
      setMentionPopup(true);
      setMentionFilter(match[1].toLowerCase());
    } else {
      setMentionPopup(false);
    }
  };

  const handleMentionSelect = (displayName: string) => {
    const cleanName = displayName.replace(/\s+/g, '');
    const textBeforeCursor = message.slice(0, message.search(/@\w*$/));
    const textAfterCursor = message.slice(message.search(/@\w*$/) + (message.match(/@\w*$/)?.[0].length || 0));
    
    setMessage(`${textBeforeCursor}@${cleanName} ${textAfterCursor}`);
    setMentionPopup(false);
    textareaRef.current?.focus();
  };

  const filteredMembers = members.filter(m => m.display_name?.replace(/\s+/g, '').toLowerCase().includes(mentionFilter));

  // Is someone else (not the current user) sharing in this room?
  const someoneElseSharing = !!(activeSession && activeSession.sharer_id !== profile?.id);
  // Is the current user the sharer?
  const iAmSharing = sharerControls.state === 'sharing';

  return (
    <div className="absolute inset-0 flex bg-background overflow-hidden">
      {/* Sidebar - hidden on mobile if a chat is active */}
      <div className={`w-full md:w-80 flex-shrink-0 border-r border-border flex-col bg-card/30 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
              <MessageSquare className="h-5 w-5 text-primary" /> Team Chat
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/chat')} title="Chat Home" className="h-8 w-8 p-0">
                <Home className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsScratchpadOpen(true)} title="Open Scratchpad" className="h-8 w-8 p-0">
                <Edit3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <form onSubmit={handleJoinChat} className="flex gap-2">
            <Input 
              placeholder="Enter Invite Code" 
              value={joinCode} 
              onChange={e => setJoinCode(e.target.value)} 
              className="h-9 bg-background"
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
              className="h-9 bg-background"
            />
            <Button type="submit" size="sm" className="px-3" disabled={!newChatName.trim() || createChat.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2 mb-1">Conversations</p>
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all group relative border ${
                activeChatId === chat.id ? 'bg-primary/10 border-primary/20 shadow-sm' : 'hover:bg-muted border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 relative">
                {activeChatId === chat.id && <div className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-1 bg-primary rounded-r-full shadow-[0_0_8px_rgba(var(--primary),0.6)]" />}
                <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold shadow-sm transition-colors ${activeChatId === chat.id ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-primary group-hover:bg-primary/10'}`}>
                  {chat.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-semibold truncate ${chat.unread_count && chat.unread_count > 0 && activeChatId !== chat.id ? 'font-bold' : ''}`}>{chat.name}</span>
                  </div>
                  <div className="flex items-center text-xs opacity-80 gap-2 truncate">
                    <Hash className="h-3 w-3 shrink-0" /> Group
                  </div>
                </div>
              </div>
              {chat.unread_count && chat.unread_count > 0 && activeChatId !== chat.id ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${activeChatId === chat.id ? 'bg-primary-foreground text-primary' : 'bg-rose-500 text-white'}`}>
                  {chat.unread_count}
                </span>
              ) : null}
            </button>
          ))}
          {chats.length === 0 && !isLoadingChats && (
            <div className="text-center py-8 px-4 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs mt-1 opacity-70">Create or join a group to start collaborating.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeChat ? (
        <div className={`flex-1 flex-col min-w-0 bg-background ${activeChat ? 'flex' : 'hidden md:flex'}`}>
          {/* Chat Header */}
          <header className="h-16 flex-shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-border bg-card/50 backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <button 
                onClick={() => navigate('/chat')} 
                className="p-2 -ml-2 mr-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted md:hidden"
                title="Back to conversations"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 font-bold">
                {activeChat.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-lg leading-tight truncate">{activeChat.name}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 truncate">
                  <span className="flex items-center gap-1 shrink-0">
                    <Users className="h-3.5 w-3.5" /> {members.length} members
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    Code: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">{activeChat.join_code}</code>
                  </span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(activeChat.join_code);
                      pushToast({ title: 'Code copied!', description: 'Share this code with your team.' });
                    }}
                    className="hover:text-foreground transition-colors shrink-0"
                    title="Copy invite code"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Button variant="ghost" size="sm" onClick={() => setIsScratchpadOpen(true)} title="Open Scratchpad" className="hidden sm:flex h-9 w-9 p-0">
                <Edit3 className="h-4 w-4" />
              </Button>
              {/* Screen Share Button */}
              {profile && (
                <ScreenShareButton
                  controls={sharerControls}
                  someoneElseSharing={someoneElseSharing}
                />
              )}
            </div>
          </header>

          {/* Screen Share Banner — shown to viewers when someone is sharing */}
          {activeSession && !iAmSharing && profile && (
            <ScreenShareBanner
              session={activeSession}
              currentUserId={profile.id}
              onWatch={() => setIsViewerOpen(true)}
              isWatching={isViewerOpen}
            />
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-muted/5 relative">
            {messages.map((msg, index) => {
              const isMe = msg.user_id === profile?.id;
              const isConsecutive = index > 0 && messages[index-1].user_id === msg.user_id;
              
              return (
                <div key={msg.id} className={`flex gap-3 sm:gap-4 ${isMe ? 'flex-row-reverse' : ''} ${isConsecutive ? 'mt-1' : ''}`}>
                  {!isConsecutive ? (
                    <Avatar 
                      name={msg.profile?.display_name?.slice(0,2).toUpperCase() || '??'} 
                      color="bg-primary text-primary-foreground"
                      src={msg.profile?.avatar_url}
                      className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 shadow-sm" 
                    />
                  ) : (
                    <div className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0" /> // Spacer for consecutive messages
                  )}
                  
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[70%] group`}>
                    {!isConsecutive && (
                      <div className="flex items-baseline gap-2 mb-1 mx-1">
                        <span className="text-sm font-semibold">{isMe ? 'You' : msg.profile?.display_name}</span>
                        <span className="text-[11px] text-muted-foreground">{format(new Date(msg.created_at), 'p')}</span>
                      </div>
                    )}
                    
                    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="flex flex-col relative max-w-full min-w-0">
                        {msg.reply_to_id && (() => {
                          const parentMsg = messages.find(m => m.id === msg.reply_to_id);
                          if (!parentMsg) return null;
                          return (
                            <div className={`text-[11px] opacity-70 mb-1 flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <Reply className="h-3 w-3 shrink-0" />
                              <span className="font-semibold shrink-0">{parentMsg.profile?.display_name || 'Someone'}</span>
                              <span className="truncate max-w-[150px] italic">"{parentMsg.content}"</span>
                            </div>
                          );
                        })()}
                        <div className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-[14px] sm:text-[15px] leading-relaxed shadow-sm break-words whitespace-pre-wrap ${
                          isMe 
                            ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                            : 'bg-card border border-border text-card-foreground rounded-tl-sm'
                        }`}>
                          {msg.file_path && (
                            <div className="mb-2">
                              {msg.file_type?.startsWith('image/') ? (
                                <button type="button" onClick={() => setZoomedImage(chatApi.getAttachmentUrl(msg.file_path!))} className="block text-left w-full">
                                  <img src={chatApi.getAttachmentUrl(msg.file_path)} alt={msg.file_name || 'attachment'} className="max-w-[240px] max-h-[240px] rounded-lg object-contain cursor-zoom-in hover:opacity-90 transition-opacity bg-black/10 border border-border/20" />
                                </button>
                              ) : (
                                <a 
                                  href={chatApi.getAttachmentUrl(msg.file_path)} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-lg hover:opacity-80 transition-opacity ${isMe ? 'bg-primary-foreground/10' : 'bg-background/50'}`}
                                >
                                  <FileIcon className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate max-w-[150px] sm:max-w-[200px]">{msg.file_name}</p>
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
                      
                      <div className={`flex flex-row gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'items-end' : 'items-start'} pb-1 shrink-0`}>
                        <div className="relative group/react">
                          <button className="p-1 sm:p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors" title="React">
                            <SmilePlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                          <div className="absolute top-full pt-1.5 hidden group-hover/react:block z-10 w-max -translate-x-1/2 left-1/2">
                            <div className="bg-card border border-border shadow-md rounded-full px-2 py-1 flex items-center gap-1">
                              {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction.mutate({ messageId: msg.id, emoji })}
                                  className="text-lg hover:scale-125 transition-transform origin-bottom"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => setReplyingTo(msg)}
                          className="p-1 sm:p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                          title="Reply"
                        >
                          <Reply className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                        {isMe && (
                          <button 
                            onClick={() => deleteMessage.mutate({ messageId: msg.id, filePath: msg.file_path })}
                            className="p-1 sm:p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                            title="Delete Message"
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 mx-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => {
                          const count = msg.reactions!.filter(r => r.emoji === emoji).length;
                          const hasReacted = msg.reactions!.some(r => r.emoji === emoji && r.user_id === profile?.id);
                          return (
                            <button
                              key={emoji}
                              onClick={() => {
                                if (hasReacted) removeReaction.mutate({ messageId: msg.id, emoji });
                                else addReaction.mutate({ messageId: msg.id, emoji });
                              }}
                              className={`text-[11px] px-1.5 py-0.5 rounded-full border ${hasReacted ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'} transition-colors flex items-center gap-1 shadow-sm`}
                            >
                              {emoji} <span className="font-semibold">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
            
            {messages.length === 0 && !isLoadingMessages && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MessageSquare className="h-10 w-10 opacity-50" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No messages yet</h3>
                <p className="text-sm mt-1 max-w-sm text-center">Start the conversation with your team. Messages will appear here.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-3 sm:p-4 bg-background border-t border-border flex flex-col gap-2">
            {replyingTo && (
              <div className="max-w-5xl mx-auto w-full px-2">
                <div className="flex items-center justify-between bg-muted border border-border px-3 py-2 rounded-lg text-sm shadow-sm">
                  <div className="flex items-center gap-2 truncate text-muted-foreground">
                    <Reply className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-foreground shrink-0">{replyingTo.profile?.display_name}:</span>
                    <span className="truncate">{replyingTo.content}</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground shrink-0 ml-2">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            {file && (
              <div className="max-w-5xl mx-auto mb-1 px-2 flex items-center gap-2">
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md text-sm border border-border shadow-sm">
                  <FileIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive ml-1 shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto w-full relative flex items-end gap-2">
              <div className="relative flex-1 bg-muted/30 border border-border rounded-2xl shadow-sm focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/50 transition-all flex items-end">
                {mentionPopup && filteredMembers.length > 0 && (
                  <div className="absolute bottom-full mb-2 left-0 bg-card border border-border shadow-xl rounded-xl overflow-hidden w-64 z-50">
                    {filteredMembers.map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleMentionSelect(member.display_name || '')}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-left"
                      >
                        <Avatar name={member.display_name?.slice(0, 2).toUpperCase() || 'U'} color="#2563eb" src={member.avatar_url} className="h-6 w-6" />
                        <span className="text-sm font-medium">{member.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                <label className="h-12 w-12 flex items-center justify-center text-muted-foreground hover:text-primary shrink-0 cursor-pointer transition-colors">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                  />
                  <Paperclip className="h-5 w-5" />
                </label>
                
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${activeChat.name}...`}
                  className="w-full max-h-[200px] py-3.5 px-2 bg-transparent focus:outline-none resize-none font-sans text-[15px] leading-relaxed"
                  rows={1}
                />
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
            <div className="max-w-5xl mx-auto w-full px-2 text-center mt-1 hidden sm:block">
              <span className="text-[10px] text-muted-foreground"><strong>Return</strong> to send, <strong>Shift + Return</strong> for new line</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={`flex-1 flex-col items-center justify-center bg-background text-muted-foreground relative overflow-hidden ${!activeChatId ? 'flex' : 'hidden md:flex'}`}>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 mix-blend-multiply" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10 mix-blend-multiply" />
          
          <div className="max-w-xl w-full p-8 text-center relative z-10">
            <div className="h-28 w-28 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-8 text-primary shadow-inner border border-primary/10 rotate-3 hover:rotate-0 transition-transform duration-500">
              <MessageSquare className="h-14 w-14" />
            </div>
            <h2 className="text-3xl font-extrabold text-foreground mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Welcome to Team Chat</h2>
            <p className="text-lg mb-10 text-muted-foreground/80">Select a conversation from the sidebar to start collaborating, or create a new space for your team.</p>
            
            {chats.length > 0 && (
              <div className="text-left bg-card/50 backdrop-blur-sm border border-border p-6 rounded-2xl shadow-sm">
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Recent Conversations
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {chats.slice(0, 4).map(chat => (
                    <button
                      key={chat.id}
                      onClick={() => navigate(`/chat/${chat.id}`)}
                      className="flex items-center gap-4 p-3 rounded-xl bg-background border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all text-left group"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {chat.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">{chat.name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                          <Hash className="h-3 w-3" /> Group
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screen Share Viewer Overlay */}
      {isViewerOpen && activeSession && profile && activeSession.sharer_id !== profile.id && (
        <ScreenShareViewer
          session={activeSession}
          userId={profile.id}
          onClose={() => setIsViewerOpen(false)}
        />
      )}

      {/* Lightbox for Images */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2 bg-black/50 rounded-full transition-colors" onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}>
            <X className="h-6 w-6" />
          </button>
          <img src={zoomedImage} alt="Zoomed media" className="max-w-full max-h-full object-contain shadow-2xl rounded-sm border border-white/10" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Scratchpad Overlay */}
      <Scratchpad open={isScratchpadOpen} onClose={() => setIsScratchpadOpen(false)} />
    </div>
  );
}
