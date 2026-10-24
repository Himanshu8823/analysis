// Pure formatting utilities
export const formatters = {
  percentage: (value: number, decimals = 2): string => {
    return `${value.toFixed(decimals)}%`;
  },
  marks: (obtained: number, max: number): string => `${obtained}/${max}`,
  grade: (percentage: number): string => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  },
  credits: (credits: number): string => `${credits} cr`,
  rollNo: (rollNo: string): string => rollNo.toUpperCase().trim(),
  date: (date: Date | string, format: 'short' | 'long' | 'time' = 'short'): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (format === 'time') return d.toLocaleTimeString();
    if (format === 'long') return d.toLocaleString();
    return d.toLocaleDateString();
  },
  fileSize: (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
} as const;