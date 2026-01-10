import { formatDistanceToNow } from 'date-fns';

export function useFormatTime() {
  return (date: Date | number | string | null | undefined): string => {
    if (!date) return '';

    const d = typeof date === 'string' || typeof date === 'number'
      ? new Date(date)
      : date;

    const distance = formatDistanceToNow(d, { addSuffix: false });

    // Parse the distance and format it in Chinese
    const parts = distance.split(' ');

    if (parts.length === 2) {
      const value = parseInt(parts[0]);
      const unit = parts[1]; // "minutes", "hours", etc.

      // Map to Chinese
      const unitMap: Record<string, string> = {
        'minute': '分钟前',
        'minutes': '分钟前',
        'hour': '小时前',
        'hours': '小时前',
        'day': '天前',
        'days': '天前',
        'week': '周前',
        'weeks': '周前',
        'month': '月前',
        'months': '月前',
        'year': '年前',
        'years': '年前',
      };

      const cnUnit = unitMap[unit];
      if (cnUnit) {
        return `${value}${cnUnit}`;
      }
    }

    // Fallback for "less than a minute"
    if (distance.includes('less than') || distance.includes('seconds')) {
      return '刚刚';
    }

    return distance;
  };
}
