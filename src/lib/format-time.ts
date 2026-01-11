import { formatDistanceToNow } from 'date-fns';

export function useFormatTime() {
  return (date: Date | number | string | null | undefined): string => {
    if (!date) return '';

    const d = typeof date === 'string' || typeof date === 'number'
      ? new Date(date)
      : date;

    // 计算时间差
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    // 根据时间差返回中文格式
    if (diffMinutes < 1) {
      return '刚刚';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks}周前`;
    } else if (diffMonths < 12) {
      return `${diffMonths}月前`;
    } else {
      return `${diffYears}年前`;
    }
  };
}
