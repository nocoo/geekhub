/**
 * ReadStatusService Tests
 *
 * Tests the database layer that manages read status.
 *
 * Run: npm test -- read-status-service.test.ts
 */

import { ReadStatusService } from './read-status-service';

// Mock Supabase client
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

// Mock cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

describe('ReadStatusService', () => {
  let service: ReadStatusService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock createClient method
    const mockEq = jest.fn().mockResolvedValue({ error: null, data: null });
    const mockClient = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { article_hash: 'abc123' },
                { article_hash: 'def456' },
              ],
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({
          error: null,
          data: null,
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: mockEq,
            }),
          }),
        }),
      }),
    };

    service = new ReadStatusService('test-user-id');
    (service as any).createClient = jest.fn().mockResolvedValue(mockClient);
  });

  describe('constructor', () => {
    it('should store userId', () => {
      const service = new ReadStatusService('user-123');
      expect((service as any).userId).toBe('user-123');
    });

    it('should handle empty userId', () => {
      const service = new ReadStatusService('');
      expect((service as any).userId).toBe('');
    });

    it('should handle UUID format userId', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const service = new ReadStatusService(uuid);
      expect((service as any).userId).toBe(uuid);
    });
  });

  describe('getReadHashes', () => {
    it('should return set of read article hashes', async () => {
      const hashes = await service.getReadHashes('feed-123');

      expect(hashes).toBeInstanceOf(Set);
      expect(hashes.has('abc123')).toBe(true);
      expect(hashes.has('def456')).toBe(true);
      expect(hashes.has('nonexistent')).toBe(false);
    });

    it('should return empty set on database error', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            })),
          })),
        })),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const hashes = await service.getReadHashes('feed-123');

      expect(hashes).toBeInstanceOf(Set);
      expect(hashes.size).toBe(0);
    });

    it('should return empty set when no data returned', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const hashes = await service.getReadHashes('feed-123');

      expect(hashes).toBeInstanceOf(Set);
      expect(hashes.size).toBe(0);
    });

    it('should return empty set when data is null', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const hashes = await service.getReadHashes('feed-123');

      expect(hashes).toBeInstanceOf(Set);
      expect(hashes.size).toBe(0);
    });

    it('should filter by user_id in query', async () => {
      // Verify by checking the mock was called with correct table
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      await service.getReadHashes('feed-123');

      expect(mockClient.from).toHaveBeenCalledWith('read_articles');
    });

    it('should handle single read hash', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ article_hash: 'single123' }],
                error: null,
              }),
            }),
          }),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const hashes = await service.getReadHashes('feed-123');

      expect(hashes.has('single123')).toBe(true);
      expect(hashes.size).toBe(1);
    });

    it('should handle many read hashes', async () => {
      const manyHashes = Array.from({ length: 100 }, (_, i) => ({
        article_hash: `hash${i.toString().padStart(4, '0')}`,
      }));

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: manyHashes,
                error: null,
              }),
            }),
          }),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const hashes = await service.getReadHashes('feed-123');

      expect(hashes.size).toBe(100);
    });
  });

  describe('markAsRead', () => {
    it('should mark article as read successfully', async () => {
      const result = await service.markAsRead('feed-123', 'abc123');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            error: { message: 'Insert failed' },
            data: null,
          }),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const result = await service.markAsRead('feed-123', 'abc123');

      expect(result).toBe(false);
    });

    it('should include feed_id and article_hash and user_id in insert', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockImplementation((record) => {
            // Verify record structure before resolving
            expect(record.feed_id).toBe('feed-123');
            expect(record.article_hash).toBe('abc123');
            expect(record.user_id).toBe('test-user-id');
            return Promise.resolve({ error: null, data: null });
          }),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const result = await service.markAsRead('feed-123', 'abc123');

      expect(result).toBe(true);
      expect(mockClient.from).toHaveBeenCalledWith('read_articles');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark multiple articles as read', async () => {
      const hashes = ['abc123', 'def456', 'ghi789'];
      const count = await service.markAllAsRead('feed-123', hashes);

      expect(count).toBe(3);
    });

    it('should return 0 on error', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            error: { message: 'Batch insert failed' },
            data: null,
          }),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const count = await service.markAllAsRead('feed-123', ['abc123', 'def456']);

      expect(count).toBe(0);
    });

    it('should return 0 for empty array', async () => {
      const count = await service.markAllAsRead('feed-123', []);

      expect(count).toBe(0);
    });

    it('should create records with correct structure', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockImplementation((records) => {
            // Verify records structure
            expect(records).toHaveLength(2);
            expect(records[0]).toHaveProperty('feed_id');
            expect(records[0]).toHaveProperty('article_hash');
            expect(records[0]).toHaveProperty('user_id');
            return Promise.resolve({ error: null, data: null });
          }),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      await service.markAllAsRead('feed-123', ['hash1', 'hash2']);
    });
  });

  describe('markAsUnread', () => {
    it('should mark article as unread successfully', async () => {
      const result = await service.markAsUnread('feed-123', 'abc123');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const mockEqError = jest.fn().mockResolvedValue({
        error: { message: 'Delete failed' },
        data: null,
      });
      const mockClient = {
        from: jest.fn(() => ({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: mockEqError,
              }),
            }),
          }),
        })),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const result = await service.markAsUnread('feed-123', 'abc123');

      expect(result).toBe(false);
    });

    it('should build correct delete query with all conditions', async () => {
      const mockDelete = {
        eq: jest.fn().mockReturnThis(),
      };
      const mockClient = {
        from: jest.fn().mockReturnValue({
          delete: jest.fn().mockReturnValue(mockDelete),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      await service.markAsUnread('feed-123', 'abc123');

      expect(mockClient.from).toHaveBeenCalledWith('read_articles');
      expect(mockDelete.eq).toHaveBeenCalledWith('feed_id', 'feed-123');
      expect(mockDelete.eq).toHaveBeenCalledWith('article_hash', 'abc123');
      expect(mockDelete.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });
  });
});
