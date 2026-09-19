'use client';

import * as React from 'react';
import {
  Upload,
  File,
  FileText,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Trash2,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Paperclip,
} from 'lucide-react';
import { TaskAttachment } from '@/types/database';
import { dbService } from '@/lib/supabase/db-service';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

interface TaskAttachmentsManagerProps {
  tenantId: string;
  projectId: string;
  taskId: string;
  currentUserId?: string | null;
  canEdit?: boolean;
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function TaskAttachmentsManager({
  tenantId,
  projectId,
  taskId,
  currentUserId,
  canEdit = true,
}: TaskAttachmentsManagerProps) {
  const [attachments, setAttachments] = React.useState<TaskAttachment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [signedUrls, setSignedUrls] = React.useState<Record<string, string>>({});

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const supabase = React.useMemo(() => createClient(), []);

  const loadAttachments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getTaskAttachments(taskId, supabase);
      setAttachments(data);

      // Pre-fetch signed URLs for the attachments (15-minute TTL)
      const urlMap: Record<string, string> = {};
      for (const item of data) {
        const url = await dbService.getAttachmentSignedUrl(item.storage_path, 900, supabase);
        if (url) urlMap[item.id] = url;
      }
      setSignedUrls(urlMap);
    } catch (err) {
      console.error('Failed to load attachments', err);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, supabase]);

  React.useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // 1. Boundary & Size Check
        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`File "${file.name}" exceeds the maximum 25MB limit.`);
        }

        // 2. Strict hierarchical storage path partitioning
        const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileUuid = crypto.randomUUID();
        const storagePath = `${tenantId}/${projectId}/${taskId}/${fileUuid}_${sanitizedFilename}`;

        // 3. Direct client-side upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from('task-attachments')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (storageError) throw storageError;

        // 4. Create database record
        await dbService.createTaskAttachmentRecord(
          {
            tenant_id: tenantId,
            project_id: projectId,
            task_id: taskId,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type || 'application/octet-stream',
            storage_path: storagePath,
            uploaded_by: currentUserId || null,
          },
          supabase
        );
      }

      await loadAttachments();
    } catch (err: any) {
      console.error('Upload failed', err);
      setUploadError(err.message || 'Failed to upload attachment.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachment: TaskAttachment) => {
    if (!confirm(`Delete attachment "${attachment.file_name}"?`)) return;
    try {
      await dbService.deleteTaskAttachmentRecord(attachment.id, attachment.storage_path, supabase);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      console.error('Failed to delete attachment', err);
      alert('Could not delete attachment.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string, filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (fileType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <ImageIcon className="h-5 w-5 text-sky-400" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="h-5 w-5 text-rose-400" />;
    }
    if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
    }
    if (['js', 'ts', 'tsx', 'jsx', 'json', 'py', 'sql', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="h-5 w-5 text-amber-400" />;
    }
    return <File className="h-5 w-5 text-[var(--muted-foreground)]" />;
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Upload Zone */}
      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            handleFileUpload(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
            isDraggingOver
              ? 'border-[var(--primary)] bg-[var(--primary)]/10 scale-[0.99]'
              : 'border-[var(--border)] hover:border-[var(--primary)]/60 bg-[var(--secondary)]/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="h-10 w-10 rounded-full bg-[var(--secondary)] flex items-center justify-center text-[var(--primary)] shadow-xs">
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="font-semibold text-[var(--foreground)]">
                {isUploading ? 'Uploading to secure vault...' : 'Click or drag files here to attach'}
              </p>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                Supports images, PDF, DOCX, XLSX, CSV, and code files up to 25MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {uploadError && (
        <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Attachments List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span>Task Attachments ({attachments.length})</span>
          </h4>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-[var(--muted-foreground)]">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-[var(--primary)]" />
            <span>Loading attached assets...</span>
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-6 text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-lg">
            No files attached yet.
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((att) => {
              const downloadUrl = signedUrls[att.id];
              const isImage =
                att.file_type.startsWith('image/') ||
                /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(att.file_name);

              return (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-md bg-[var(--secondary)] flex items-center justify-center shrink-0">
                      {getFileIcon(att.file_type, att.file_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--foreground)] truncate max-w-[200px] sm:max-w-xs" title={att.file_name}>
                        {att.file_name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
                        <span>{formatFileSize(att.file_size)}</span>
                        <span>•</span>
                        <span>{att.uploader?.full_name || 'Anonymous'}</span>
                        <span>•</span>
                        <span>{new Date(att.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        title={isImage ? 'Preview Image' : 'Download File'}
                      >
                        {isImage ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                      </a>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => handleDeleteAttachment(att)}
                        className="p-1.5 rounded-md hover:bg-rose-500/10 text-[var(--muted-foreground)] hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Attachment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
