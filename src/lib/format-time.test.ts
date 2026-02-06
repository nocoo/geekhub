import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useFormatTime } from './format-time';

describe('useFormatTime', () => {
  // Mock current time to 2026-02-06 12:00:00
  const NOW = new Date('2026-02-06T12:00:00Z').getTime();
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    originalDateNow = Date.now;
    Date.now = () => NOW;
    // Also mock new Date() without args
    const OriginalDate = Date;
    global.Date = class extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(NOW);
        } else {
          // @ts-ignore
          super(...args);
        }
      }
    } as any;
    global.Date.now = () => NOW;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  test('returns empty string for null/undefined input', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
  });

  test('returns "刚刚" for times less than 1 minute ago', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // 30 seconds ago
    const date = new Date(NOW - 30 * 1000);
    expect(formatTime(date)).toBe('刚刚');
  });

  test('returns "X分钟前" for times less than 1 hour ago', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // 5 minutes ago
    expect(formatTime(new Date(NOW - 5 * 60 * 1000))).toBe('5分钟前');
    
    // 30 minutes ago
    expect(formatTime(new Date(NOW - 30 * 60 * 1000))).toBe('30分钟前');
    
    // 59 minutes ago
    expect(formatTime(new Date(NOW - 59 * 60 * 1000))).toBe('59分钟前');
  });

  test('returns "X小时前" for times less than 24 hours ago', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // 1 hour ago
    expect(formatTime(new Date(NOW - 1 * 60 * 60 * 1000))).toBe('1小时前');
    
    // 12 hours ago
    expect(formatTime(new Date(NOW - 12 * 60 * 60 * 1000))).toBe('12小时前');
    
    // 23 hours ago
    expect(formatTime(new Date(NOW - 23 * 60 * 60 * 1000))).toBe('23小时前');
  });

  test('returns "X天前" for times less than 7 days ago', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // 1 day ago
    expect(formatTime(new Date(NOW - 1 * 24 * 60 * 60 * 1000))).toBe('1天前');
    
    // 3 days ago
    expect(formatTime(new Date(NOW - 3 * 24 * 60 * 60 * 1000))).toBe('3天前');
    
    // 6 days ago
    expect(formatTime(new Date(NOW - 6 * 24 * 60 * 60 * 1000))).toBe('6天前');
  });

  test('returns "X周前" for times less than 4 weeks ago', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // 1 week ago
    expect(formatTime(new Date(NOW - 7 * 24 * 60 * 60 * 1000))).toBe('1周前');
    
    // 2 weeks ago
    expect(formatTime(new Date(NOW - 14 * 24 * 60 * 60 * 1000))).toBe('2周前');
    
    // 3 weeks ago
    expect(formatTime(new Date(NOW - 21 * 24 * 60 * 60 * 1000))).toBe('3周前');
  });

  test('returns "X月前" for times less than 12 months ago', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // ~1 month ago (30 days)
    expect(formatTime(new Date(NOW - 30 * 24 * 60 * 60 * 1000))).toBe('1月前');
    
    // ~6 months ago
    expect(formatTime(new Date(NOW - 180 * 24 * 60 * 60 * 1000))).toBe('6月前');
    
    // ~11 months ago
    expect(formatTime(new Date(NOW - 330 * 24 * 60 * 60 * 1000))).toBe('11月前');
  });

  test('returns "X年前" for times 1+ years ago', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // 1 year ago
    expect(formatTime(new Date(NOW - 365 * 24 * 60 * 60 * 1000))).toBe('1年前');
    
    // 2 years ago
    expect(formatTime(new Date(NOW - 730 * 24 * 60 * 60 * 1000))).toBe('2年前');
  });

  test('handles string date input', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // 5 minutes ago as ISO string
    const fiveMinAgo = new Date(NOW - 5 * 60 * 1000).toISOString();
    expect(formatTime(fiveMinAgo)).toBe('5分钟前');
  });

  test('handles number (timestamp) input', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // 1 hour ago as timestamp
    const oneHourAgo = NOW - 1 * 60 * 60 * 1000;
    expect(formatTime(oneHourAgo)).toBe('1小时前');
  });

  test('handles Date object input', () => {
    const { result } = renderHook(() => useFormatTime());
    const formatTime = result.current;

    // 2 days ago as Date
    const twoDaysAgo = new Date(NOW - 2 * 24 * 60 * 60 * 1000);
    expect(formatTime(twoDaysAgo)).toBe('2天前');
  });
});
