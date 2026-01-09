export interface Feed {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: string;
  unreadCount: number;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  description: string;
  content: string;
  author: string;
  authorAvatar: string;
  publishedAt: Date;
  thumbnail?: string;
  feedName: string;
  feedIcon: string;
  isRead: boolean;
}

export const feeds: Feed[] = [
  { id: '1', name: 'Hacker News', url: 'https://news.ycombinator.com', icon: '🔶', category: 'Tech', unreadCount: 12 },
  { id: '2', name: 'The Verge', url: 'https://theverge.com', icon: '▽', category: 'Tech', unreadCount: 8 },
  { id: '3', name: 'TechCrunch', url: 'https://techcrunch.com', icon: '⚡', category: 'Tech', unreadCount: 5 },
  { id: '4', name: 'Dev.to', url: 'https://dev.to', icon: '👩‍💻', category: 'Dev', unreadCount: 23 },
  { id: '5', name: 'CSS Tricks', url: 'https://css-tricks.com', icon: '✨', category: 'Dev', unreadCount: 4 },
  { id: '6', name: 'Smashing Magazine', url: 'https://smashingmagazine.com', icon: '📕', category: 'Design', unreadCount: 7 },
  { id: '7', name: 'A List Apart', url: 'https://alistapart.com', icon: '📐', category: 'Design', unreadCount: 2 },
];

export const articles: Article[] = [
  {
    id: '1',
    feedId: '1',
    title: 'The Future of WebAssembly: Beyond the Browser',
    description: 'WebAssembly is evolving beyond its browser origins to become a universal runtime for cloud, edge, and embedded systems.',
    content: `
# The Future of WebAssembly: Beyond the Browser

WebAssembly (Wasm) has come a long way since its initial release in 2017. What started as a way to run high-performance code in web browsers has evolved into something far more ambitious: a universal binary format that could fundamentally change how we think about software deployment.

## The Browser Era

When WebAssembly first launched, it was primarily seen as a way to bring languages like C, C++, and Rust to the web. Game engines, video editors, and CAD software could finally run in browsers with near-native performance.

\`\`\`rust
// A simple WebAssembly function in Rust
#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}
\`\`\`

## Beyond the Browser

Today, WebAssembly is making waves in unexpected places:

- **Edge Computing**: Cloudflare Workers and Fastly Compute@Edge use Wasm for serverless functions
- **Plugin Systems**: Figma, VS Code, and many other applications use Wasm for extensibility
- **Blockchain**: Smart contracts on various platforms run on Wasm runtimes

> "WebAssembly is becoming the universal binary format we always wanted but never had." — Solomon Hykes

## The WASI Standard

The WebAssembly System Interface (WASI) is the key to Wasm's expansion beyond browsers. It provides a standardized way for Wasm modules to interact with system resources like:

1. File systems
2. Network sockets
3. Environment variables
4. Random number generation

## What's Next?

The component model, currently in development, will enable truly modular software composition. Imagine building applications from pre-compiled, language-agnostic components that can be mixed and matched like Lego blocks.

The future of WebAssembly is not just bright—it's universal.
    `,
    author: 'Lin Clark',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lin',
    publishedAt: new Date(Date.now() - 1000 * 60 * 30),
    thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300&fit=crop',
    feedName: 'Hacker News',
    feedIcon: '🔶',
    isRead: false,
  },
  {
    id: '2',
    feedId: '2',
    title: 'Apple Vision Pro: Six Months Later',
    description: 'We revisit Apple\'s spatial computing headset after half a year of daily use. Has the promise held up?',
    content: `
# Apple Vision Pro: Six Months Later

Six months ago, Apple released its most ambitious product in years. The Vision Pro promised to usher in a new era of spatial computing. Now, after extensive daily use, we can finally assess whether it delivers on that promise.

## The Hardware

The build quality remains exceptional. The aluminum frame, the custom-molded light seal, the remarkable displays—everything feels premium.

## Daily Workflow Integration

Using Vision Pro for productivity has been transformative in some ways, limiting in others:

- **Writing and Research**: Excellent. Multiple floating windows are genuinely useful.
- **Video Calls**: Surprisingly good, though Persona still feels uncanny.
- **Coding**: Mixed results. Great for reading code, less ideal for typing.

## The Ecosystem Challenge

The app gap remains real. While many iPad apps work, native spatial apps are still rare.

## Verdict

Vision Pro is a remarkable first-generation device that hints at a compelling future, even if that future isn't quite here yet.
    `,
    author: 'Nilay Patel',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nilay',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    thumbnail: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=400&h=300&fit=crop',
    feedName: 'The Verge',
    feedIcon: '▽',
    isRead: false,
  },
  {
    id: '3',
    feedId: '4',
    title: 'Understanding React Server Components',
    description: 'A deep dive into RSC architecture, streaming, and how to think about the new mental model.',
    content: `
# Understanding React Server Components

React Server Components represent the biggest shift in React's architecture since Hooks. Let's break down what they are and why they matter.

## The Mental Model Shift

Traditional React apps send JavaScript to the client, which then renders components. With RSC, some components render on the server and send HTML directly.

\`\`\`tsx
// This is a Server Component (default in Next.js 13+)
async function BlogPost({ id }: { id: string }) {
  const post = await db.posts.find(id);
  return <article>{post.content}</article>;
}
\`\`\`

## Benefits

1. **Smaller Bundle Sizes**: Server-only code never ships to clients
2. **Direct Backend Access**: Query databases without API layers
3. **Streaming**: Send UI progressively as data becomes available

## The 'use client' Boundary

When you need interactivity, mark components with the 'use client' directive:

\`\`\`tsx
'use client';

import { useState } from 'react';

export function LikeButton() {
  const [likes, setLikes] = useState(0);
  return <button onClick={() => setLikes(l => l + 1)}>{likes}</button>;
}
\`\`\`

## Conclusion

RSC isn't replacing client-side React—it's augmenting it. The key is understanding when to use each.
    `,
    author: 'Dan Abramov',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dan',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=300&fit=crop',
    feedName: 'Dev.to',
    feedIcon: '👩‍💻',
    isRead: true,
  },
  {
    id: '4',
    feedId: '5',
    title: 'The State of CSS in 2024',
    description: 'Container queries, cascade layers, and :has() are finally here. A comprehensive guide to modern CSS.',
    content: `
# The State of CSS in 2024

CSS has evolved dramatically. Features we've dreamed about for years are now shipping in all major browsers.

## Container Queries

Finally, we can style elements based on their container size, not just the viewport:

\`\`\`css
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
}
\`\`\`

## The :has() Selector

CSS can now select parents based on their children:

\`\`\`css
/* Style a form that contains invalid inputs */
form:has(input:invalid) {
  border-color: red;
}
\`\`\`

## Cascade Layers

Finally, specificity management that makes sense:

\`\`\`css
@layer base, components, utilities;

@layer base {
  a { color: blue; }
}

@layer utilities {
  .text-red { color: red; }
}
\`\`\`

## What's Coming Next

- CSS Nesting (already shipping!)
- Scroll-driven animations
- View transitions

The future of CSS is incredibly exciting.
    `,
    author: 'Miriam Suzanne',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=miriam',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
    feedName: 'CSS Tricks',
    feedIcon: '✨',
    isRead: false,
  },
  {
    id: '5',
    feedId: '3',
    title: 'Anthropic Raises $2B in Latest Funding Round',
    description: 'The AI safety company behind Claude reaches new heights with major investment from tech giants.',
    content: `
# Anthropic Raises $2B in Latest Funding Round

Anthropic, the AI safety company known for its Claude assistant, has secured $2 billion in new funding, valuing the company at $15 billion.

## The Investment

The round was led by major tech investors, with participation from existing backers. This brings Anthropic's total funding to over $7 billion.

## What This Means

The funding will be used to:

- Expand Claude's capabilities
- Increase compute infrastructure
- Accelerate AI safety research

> "Our mission remains unchanged: to develop AI systems that are safe, beneficial, and understandable." — Dario Amodei, CEO

## The Competitive Landscape

This puts Anthropic in a strong position against OpenAI and Google in the race to develop advanced AI systems.

## Looking Forward

With this funding, expect significant advances in Claude's reasoning abilities and new product launches in the coming months.
    `,
    author: 'Kate Clark',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kate',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop',
    feedName: 'TechCrunch',
    feedIcon: '⚡',
    isRead: false,
  },
  {
    id: '6',
    feedId: '6',
    title: 'Designing for Variable Fonts',
    description: 'How to leverage the full power of variable fonts in your web typography workflow.',
    content: `
# Designing for Variable Fonts

Variable fonts are single font files that behave like multiple fonts. Let's explore how to use them effectively.

## What Are Variable Fonts?

Instead of loading separate files for each weight and style, variable fonts contain all variations in one file.

## The Axes

Common variable axes include:

- **wght**: Weight (100-900)
- **wdth**: Width (75%-125%)
- **slnt**: Slant (-15 to 0)
- **ital**: Italic (0 or 1)

## Using in CSS

\`\`\`css
@font-face {
  font-family: 'Inter';
  src: url('Inter-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
}

.heading {
  font-variation-settings: 'wght' 720;
}
\`\`\`

## Animation Possibilities

Variable fonts enable smooth transitions between states:

\`\`\`css
.button:hover {
  font-variation-settings: 'wght' 600;
  transition: font-variation-settings 0.3s;
}
\`\`\`

Embrace the flexibility of variable fonts in your next project.
    `,
    author: 'Jason Pamental',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jason',
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    feedName: 'Smashing Magazine',
    feedIcon: '📕',
    isRead: true,
  },
];

export const crawlerLogs = [
  { status: 200, action: 'GET', url: 'news.ycombinator.com/rss', time: '45ms' },
  { status: 200, action: 'GET', url: 'theverge.com/feed', time: '128ms' },
  { status: 200, action: 'PARSE', url: 'XML content validated', time: '12ms' },
  { status: 200, action: 'GET', url: 'dev.to/feed', time: '89ms' },
  { status: 304, action: 'SKIP', url: 'css-tricks.com (no changes)', time: '23ms' },
  { status: 200, action: 'SYNC', url: '12 new articles indexed', time: '156ms' },
];
