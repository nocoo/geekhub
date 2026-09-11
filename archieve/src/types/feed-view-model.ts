/**
 * Feed View Model
 *
 * Unified model for displaying feed information in the UI.
 * All feed data should flow through this model to ensure consistency.
 */

export interface FeedViewModel {
  /** Unique identifier */
  id: string;

  /** Feed title */
  title: string;

  /** Feed URL */
  url: string;

  /** URL hash for file storage */
  urlHash?: string;

  /** Category ID if categorized */
  categoryId: string | null;

  /** Category name for display */
  categoryName?: string;

  /** Category icon */
  categoryIcon?: string;

  /** Category color */
  categoryColor?: string;

  /** Favicon URL */
  faviconUrl: string | null;

  /** Feed description */
  description: string | null;

  /** Whether feed is active */
  isActive: boolean;

  /** Auto-translate setting */
  autoTranslate: boolean;

  /** Total articles count */
  totalArticles: number;

  /** Unread articles count */
  unreadCount: number;

  /** Whether currently being fetched */
  isFetching: boolean;

  /** Last fetch timestamp */
  lastFetchAt: string | null;

  /** Last fetch status ('success' | 'error' | 'timeout' | null) */
  lastFetchStatus: string | null;

  /** Next scheduled fetch time */
  nextFetchAt: string | null;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Category View Model
 */
export interface CategoryViewModel {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  feedCount?: number;
  unreadCount?: number;
}

/**
 * Feed with unread count for sidebar grouping
 */
export interface FeedGroupViewModel {
  category: CategoryViewModel | null;
  feeds: FeedViewModel[];
  totalUnreadCount: number;
}
