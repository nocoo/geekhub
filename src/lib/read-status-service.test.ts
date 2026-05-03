import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ReadStatusService } from './read-status-service';

const {
  mockUpsert,
  mockMaybeSingle,
  mockSelect,
  mockFrom,
  mockCookies,
} = vi.hoisted(() => {
  const mockUpsert = vi.fn(() => Promise.resolve({ error: null }));
  const mockUpdate = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
  }));
  const mockMaybeSingle = vi.fn(() => Promise.resolve({ data: { id: 'article-1', hash: 'hash-1' } }));
  const mockSelectEq = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => mockMaybeSingle()),
      maybeSingle: mockMaybeSingle,
    })),
    in: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: [{ id: 'article-1' }, { id: 'article-2' }] })),
    })),
    maybeSingle: mockMaybeSingle,
  }));
  const mockSelect = vi.fn(() => ({
    eq: mockSelectEq,
  }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    upsert: mockUpsert,
    update: mockUpdate,
  }));
  const mockCookies = vi.fn(() => ({
    getAll: () => [],
    set: () => {},
  }));
  return { mockUpsert, mockMaybeSingle, mockSelect, mockFrom, mockCookies };
});

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    from: mockFrom,
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null }),
    },
  }),
}));

describe('ReadStatusService', () => {
  beforeEach(() => {
    mockUpsert.mockClear();
    mockFrom.mockClear();
    mockSelect.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('constructor', () => {
    test('stores userId', () => {
      const service = new ReadStatusService('user-123');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private field for test assertion
      expect((service as any).userId).toBe('user-123');
    });

    test('handles empty userId', () => {
      const service = new ReadStatusService('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private field for test assertion
      expect((service as any).userId).toBe('');
    });

    test('handles UUID format userId', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const service = new ReadStatusService(uuid);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private field for test assertion
      expect((service as any).userId).toBe(uuid);
    });
  });

  describe('getReadArticleIds()', () => {
    test('returns Set of read article IDs', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.getReadArticleIds('feed-1');
      
      expect(result).toBeInstanceOf(Set);
    });

    test('returns empty Set on error', async () => {
      mockSelect.mockImplementationOnce(() => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: null, error: new Error('DB error') }),
        }),
      }));
      
      const service = new ReadStatusService('user-123');
      const result = await service.getReadArticleIds('feed-1');
      
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('getReadHashes()', () => {
    test('returns Set of read article hashes', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.getReadHashes('feed-1');
      
      expect(result).toBeInstanceOf(Set);
    });
  });

  describe('markAsRead()', () => {
    test('upserts user_articles with is_read=true', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.markAsRead('article-1');
      
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('user_articles');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          article_id: 'article-1',
          is_read: true,
        }),
        expect.any(Object)
      );
    });

    test('returns false on error', async () => {
      mockUpsert.mockImplementationOnce(() => Promise.resolve({ error: new Error('DB error') }));
      
      const service = new ReadStatusService('user-123');
      const result = await service.markAsRead('article-1');
      
      expect(result).toBe(false);
    });
  });

  describe('markAsReadByHash()', () => {
    test('finds article by hash then marks as read', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.markAsReadByHash('feed-1', 'hash-abc');
      
      expect(result).toBe(true);
    });

    test('returns false when article not found', async () => {
      mockMaybeSingle.mockImplementationOnce(() => Promise.resolve({ data: null }));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const service = new ReadStatusService('user-123');
      const result = await service.markAsReadByHash('feed-1', 'nonexistent-hash');
      
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('markAllAsRead()', () => {
    test('upserts multiple articles as read', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.markAllAsRead('feed-1', ['article-1', 'article-2', 'article-3']);
      
      expect(result).toBe(3);
      expect(mockUpsert).toHaveBeenCalled();
    });

    test('returns 0 on error', async () => {
      mockUpsert.mockImplementationOnce(() => Promise.resolve({ error: new Error('DB error') }));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const service = new ReadStatusService('user-123');
      const result = await service.markAllAsRead('feed-1', ['article-1']);
      
      expect(result).toBe(0);
      errorSpy.mockRestore();
    });
  });

  describe('markAsUnread()', () => {
    test('updates article with is_read=false', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.markAsUnread('article-1');
      
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('user_articles');
    });
  });

  describe('markAsUnreadByHash()', () => {
    test('finds article by hash then marks as unread', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.markAsUnreadByHash('feed-1', 'hash-abc');
      
      expect(result).toBe(true);
    });

    test('returns false when article not found', async () => {
      mockMaybeSingle.mockImplementationOnce(() => Promise.resolve({ data: null }));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const service = new ReadStatusService('user-123');
      const result = await service.markAsUnreadByHash('feed-1', 'nonexistent-hash');
      
      expect(result).toBe(false);
      warnSpy.mockRestore();
    });
  });

  describe('toggleBookmark()', () => {
    test('toggles bookmark status', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.toggleBookmark('article-1');
      
      expect(result).toBe(true);
    });

    test('accepts optional notes parameter', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.toggleBookmark('article-1', 'Important article');
      
      expect(result).toBe(true);
    });
  });

  describe('toggleReadLater()', () => {
    test('toggles read later status', async () => {
      const service = new ReadStatusService('user-123');
      
      const result = await service.toggleReadLater('article-1');
      
      expect(result).toBe(true);
    });
  });

  describe('public API', () => {
    test('exposes all required methods', () => {
      const service = new ReadStatusService('test-user-id');
      
      expect(typeof service.getReadArticleIds).toBe('function');
      expect(typeof service.getReadHashes).toBe('function');
      expect(typeof service.markAsRead).toBe('function');
      expect(typeof service.markAsReadByHash).toBe('function');
      expect(typeof service.markAllAsRead).toBe('function');
      expect(typeof service.markAsUnread).toBe('function');
      expect(typeof service.markAsUnreadByHash).toBe('function');
      expect(typeof service.toggleBookmark).toBe('function');
      expect(typeof service.toggleReadLater).toBe('function');
    });
  });
});

describe('createReadStatusService', () => {
  test('is exported as a function', async () => {
    const { createReadStatusService } = await import('./read-status-service');
    expect(typeof createReadStatusService).toBe('function');
  });
});
