import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, mock, afterEach } from 'bun:test';
import { ArticleItem } from './ArticleItem';
import { Article } from '@/hooks/useDatabase';

describe('ArticleItem', () => {
    afterEach(cleanup);
    const mockArticle: Article = {
        id: 'article-1',
        title: 'Test Article',
        description: 'Test Description',
        url: 'https://example.com',
        feedId: 'feed-1',
        isRead: false,
        isBookmarked: false,
        isSavedForLater: false,
        publishedAt: new Date().toISOString(),
        author: 'Test Author',
        fetchedAt: new Date().toISOString(),
        guid: 'guid-1',
        content: '',
        image: null,
    };

    const mockFormatTime = mock((date: string) => '10 mins ago');
    const mockOnSelect = mock(() => { });

    it('should render article details correctly', () => {
        render(
            <ArticleItem
                article={mockArticle}
                isSelected={false}
                isRead={false}
                onSelect={mockOnSelect}
                formatTime={mockFormatTime}
            />
        );

        expect(screen.getByText('Test Article')).toBeDefined();
        expect(screen.getByText('Test Description')).toBeDefined();
        expect(screen.getByText('Test Author')).toBeDefined();
        expect(screen.getByText('10 mins ago')).toBeDefined();
    });

    it('should call onSelect when clicked', () => {
        render(
            <ArticleItem
                article={mockArticle}
                isSelected={false}
                isRead={false}
                onSelect={mockOnSelect}
                formatTime={mockFormatTime}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        expect(mockOnSelect).toHaveBeenCalledWith(mockArticle);
    });

    it('should show read status styling', () => {
        // Unread
        const { unmount } = render(
            <ArticleItem
                article={mockArticle}
                isSelected={false}
                isRead={false}
                onSelect={mockOnSelect}
                formatTime={mockFormatTime}
            />
        );

        // Check for "font-semibold" which indicates unread
        const unreadTitle = screen.getByText('Test Article');
        expect(unreadTitle.className).toContain('font-semibold');

        unmount();

        // Read
        render(
            <ArticleItem
                article={{ ...mockArticle, isRead: true }}
                isSelected={false}
                isRead={true}
                onSelect={mockOnSelect}
                formatTime={mockFormatTime}
            />
        );

        // Check for "font-medium" which indicates read
        const readTitle = screen.getByText('Test Article');
        expect(readTitle.className).toContain('font-medium');
    });

    it('should show selected styling', () => {
        render(
            <ArticleItem
                article={mockArticle}
                isSelected={true}
                isRead={false}
                onSelect={mockOnSelect}
                formatTime={mockFormatTime}
            />
        );

        const button = screen.getByRole('button');
        expect(button.className).toContain('bg-accent');
    });

    it('should use translated content if available', () => {
        const translatedArticle = {
            ...mockArticle,
            translatedTitle: 'Translated Title',
            translatedDescription: 'Translated Description',
        };

        render(
            <ArticleItem
                article={translatedArticle}
                isSelected={false}
                isRead={false}
                onSelect={mockOnSelect}
                formatTime={mockFormatTime}
            />
        );

        expect(screen.getByText('Translated Title')).toBeDefined();
        expect(screen.getByText('Translated Description')).toBeDefined();
        // Original text should not be visible if replaced? 
        // Based on component logic: {article.translatedTitle || article.title}
        expect(screen.queryByText('Test Article')).toBeNull();
    });
});
