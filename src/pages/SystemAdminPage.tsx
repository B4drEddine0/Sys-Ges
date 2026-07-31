import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Card, Button } from '@/components/ui';
import { Users, HardDrive, ShieldAlert, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Navigate } from 'react-router-dom';

interface SystemUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  is_super_admin: boolean;
  created_at: string;
}

interface StorageStats {
  total_size: number;
  file_count: number;
  oldest_file: string;
}

export function SystemAdminPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'storage'>('users');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.is_super_admin) return;

    async function loadData() {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.rpc('get_system_users');
        if (userError) throw userError;
        setUsers(userData || []);

        const { data: statsData, error: statsError } = await supabase.rpc('get_system_storage_stats');
        if (statsError) {
          console.error(statsError);
          setStats({ total_size: 0, file_count: 0, oldest_file: '' });
        } else if (statsData && statsData.length > 0) {
          setStats(statsData[0]);
        } else {
          setStats({ total_size: 0, file_count: 0, oldest_file: '' });
        }
      } catch (err) {
        console.error('Failed to load system data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile]);

  const handleUpdateName = async (userId: string, currentName: string) => {
    const newName = window.prompt("Enter new display name:", currentName);
    if (!newName || newName === currentName) return;
    
    try {
      const { error } = await supabase.rpc('admin_update_user_name', { p_user_id: userId, p_new_name: newName });
      if (error) throw error;
      setUsers(users.map(u => u.id === userId ? { ...u, display_name: newName } : u));
    } catch (err: any) {
      alert("Failed to update name: " + err.message);
    }
  };

  if (!profile?.is_super_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="flex-shrink-0 border-b border-border/40 bg-card/30 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3 px-6 h-16">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <h1 className="font-semibold text-lg">System Control Panel</h1>
          <div className="ml-2 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium uppercase tracking-wider">
            Super Admin
          </div>
        </div>
        <div className="px-6 flex gap-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'users' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'storage' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Storage & Files
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">Loading system data...</div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            
            {activeTab === 'users' && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
                  <Users className="h-5 w-5 text-primary" /> Registered Users
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/30 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 font-medium text-muted-foreground">User</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground text-right">Joined</th>
                        <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-medium flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold overflow-hidden">
                              {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.display_name?.slice(0, 2).toUpperCase()}
                            </div>
                            {u.display_name}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">
                            {u.is_super_admin ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                                Super Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                Member
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {u.created_at ? format(new Date(u.created_at), 'MMM d, yyyy') : 'Unknown'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="secondary" size="sm" onClick={() => handleUpdateName(u.id, u.display_name)}>
                              Edit Name
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'storage' && stats && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
                  <HardDrive className="h-5 w-5 text-primary" /> Storage Usage
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-6 flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Total Data Stored</span>
                    <span className="text-3xl font-bold">{formatBytes(stats.total_size)}</span>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, (stats.total_size / 1073741824) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground text-right">{((stats.total_size / 1073741824) * 100).toFixed(1)}% of 1GB Limit</span>
                  </Card>
                  
                  <Card className="p-6 flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Total Files</span>
                    <span className="text-3xl font-bold">{stats.file_count}</span>
                    <span className="text-xs text-muted-foreground mt-2">Across all active chats</span>
                  </Card>

                  <Card className="p-6 flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Oldest Retained File</span>
                    <span className="text-lg font-bold">{stats.oldest_file ? format(new Date(stats.oldest_file), 'PPp') : 'N/A'}</span>
                    <span className="text-xs text-muted-foreground mt-2">Files older than 12h are auto-deleted</span>
                  </Card>
                </div>
                
                <Card className="p-6 mt-8 border-dashed bg-muted/10">
                  <div className="flex items-start gap-4">
                    <FileText className="h-6 w-6 text-muted-foreground mt-1" />
                    <div>
                      <h3 className="font-medium text-lg">Automated Cleanup Active</h3>
                      <p className="text-muted-foreground text-sm mt-1 mb-4 leading-relaxed">
                        A scheduled pg_cron job runs automatically on the database to protect your storage limits. 
                        Files over 10MB are deleted after 1 hour, and all other files are deleted after 12 hours. 
                        No manual cleanup is necessary.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
