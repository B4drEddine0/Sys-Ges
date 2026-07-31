import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileDown, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useTaskMutations, useSectionsQuery } from './taskHooks';
import { useToast } from '@/providers/ToastProvider';
import type { TaskStatus, Priority } from '@/types';

interface ImportTasksModalProps {
  open: boolean;
  onClose: () => void;
}

const EXPECTED_FORMAT = [
  { column: 'Title', req: true, desc: 'The name of the task' },
  { column: 'Description', req: false, desc: 'Task description details' },
  { column: 'Status', req: false, desc: 'backlog, todo, in_progress, testing, done' },
  { column: 'Priority', req: false, desc: 'low, medium, high, critical' },
  { column: 'Section', req: false, desc: 'Name of the section (e.g. Frontend)' },
  { column: 'Estimated Hours', req: false, desc: 'A number (e.g. 5)' },
];

export function ImportTasksModal({ open, onClose }: ImportTasksModalProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createTask } = useTaskMutations();
  const { data: sections = [] } = useSectionsQuery();
  const { pushToast } = useToast();

  const handleDownloadTemplate = () => {
    const csvContent = "Title,Description,Status,Priority,Section,Estimated Hours\n\"Build login page\",\"Create the UI and connect to auth\",\"todo\",\"high\",\"Frontend\",\"8\"\n\"Setup database\",\"\",\"backlog\",\"critical\",\"Backend\",\"4\"";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'tasks_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseRow = (row: any, fallbackSectionId: string) => {
    // Basic mapping
    const title = row['Title'] || row['title'] || '';
    if (!title.trim()) return null;

    const statusRaw = (row['Status'] || row['status'] || 'todo').toLowerCase().trim();
    const validStatuses = ['backlog', 'todo', 'in_progress', 'testing', 'done'];
    const status = validStatuses.includes(statusRaw) ? statusRaw as TaskStatus : 'todo';

    const priorityRaw = (row['Priority'] || row['priority'] || 'medium').toLowerCase().trim();
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    const priority = validPriorities.includes(priorityRaw) ? priorityRaw as Priority : 'medium';

    const sectionRaw = (row['Section'] || row['section'] || '').trim().toLowerCase();
    const matchedSection = sections.find(s => s.name.toLowerCase() === sectionRaw);
    const sectionId = matchedSection ? matchedSection.id : fallbackSectionId;

    const estRaw = parseFloat(row['Estimated Hours'] || row['estimated_hours'] || '0');
    const estimatedHours = isNaN(estRaw) ? null : estRaw;

    return {
      title,
      description: row['Description'] || row['description'] || '',
      status,
      priority,
      section: sectionId,
      estimatedHours,
      assigneeIds: [],
      labelIds: [],
      notes: '',
      dueDate: null,
      subtasks: [],
      attachments: [],
      order: 0,
      archived: false,
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (sections.length === 0) {
      pushToast({ title: 'Error', description: 'No sections available in this project.', variant: 'destructive' });
      return;
    }

    const fallbackSectionId = sections[0].id;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        if (rows.length === 0) {
          pushToast({ title: 'Empty File', description: 'No data found in the CSV.', variant: 'destructive' });
          return;
        }

        const validTasks = rows
          .map(row => parseRow(row, fallbackSectionId))
          .filter(t => t !== null) as any[];

        if (validTasks.length === 0) {
          pushToast({ title: 'Invalid Data', description: 'No valid tasks found. Make sure the "Title" column exists.', variant: 'destructive' });
          return;
        }

        setIsImporting(true);
        setProgress({ current: 0, total: validTasks.length });

        let successCount = 0;
        for (const taskPayload of validTasks) {
          try {
            await createTask.mutateAsync(taskPayload);
            successCount++;
            setProgress(p => ({ ...p, current: successCount }));
          } catch (err) {
            console.error('Failed to import row', taskPayload, err);
          }
        }

        setIsImporting(false);
        pushToast({ title: 'Import Complete', description: `Successfully imported ${successCount} tasks.` });
        onClose();
      },
      error: (err) => {
        pushToast({ title: 'Parse Error', description: err.message, variant: 'destructive' });
      }
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal open={open} onClose={() => !isImporting && onClose()} title="Import Tasks">
      <div className="space-y-6">
        
        <div className="bg-muted/30 p-4 rounded-lg border border-border">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm mb-1">CSV Format Requirements</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Your CSV must include a header row. "Title" is the only strictly required column. Unrecognized columns will be ignored.
              </p>
              
              <div className="overflow-x-auto bg-background rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Column Name</th>
                      <th className="px-3 py-2 font-semibold">Required</th>
                      <th className="px-3 py-2 font-semibold">Expected Values</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {EXPECTED_FORMAT.map(col => (
                      <tr key={col.column}>
                        <td className="px-3 py-2 font-medium">{col.column}</td>
                        <td className="px-3 py-2">{col.req ? <span className="text-destructive font-medium">Yes</span> : 'No'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{col.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {isImporting ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <div className="w-full max-w-xs bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300 ease-out" 
                style={{ width: `${(progress.current / progress.total) * 100}%` }} 
              />
            </div>
            <p className="text-sm font-medium">
              Importing {progress.current} of {progress.total}...
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button variant="secondary" className="w-full sm:w-1/2" onClick={handleDownloadTemplate}>
              <FileDown className="h-4 w-4 mr-2" /> Download Template
            </Button>
            
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            
            <Button className="w-full sm:w-1/2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Upload CSV
            </Button>
          </div>
        )}

      </div>
    </Modal>
  );
}
