import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { articleId, content, aiSettings } = await request.json();

    // Validate AI settings
    if (!aiSettings?.enabled) {
      return NextResponse.json(
        { success: false, error: 'AI功能未启用' },
        { status: 400 }
      );
    }

    if (!articleId || !content) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: aiSettings.apiKey,
      baseURL: aiSettings.baseUrl,
    });

    // Truncate content if too long (limit to ~100k chars for context)
    const maxContentLength = 100000;
    const truncatedContent = content.length > maxContentLength
      ? content.substring(0, maxContentLength) + '\n\n[内容过长，已截断]'
      : content;

    // Create translation prompt
    const prompt = `请将以下文章内容翻译成中文，要求：
1. 保持原文的HTML结构和格式
2. 只翻译文本内容，不要翻译HTML标签、属性或代码块
3. 保持图片、链接等元素不变
4. 确保翻译流畅自然
5. 直接返回翻译后的HTML，不要添加任何额外的说明文字

待翻译内容：
${truncatedContent}`;

    // Call AI API
    const completion = await openai.chat.completions.create({
      model: aiSettings.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的文章翻译助手。将文章内容翻译成中文，保持HTML结构和格式不变。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 16000,
      temperature: 0.3,
    });

    const translatedContent = completion.choices[0]?.message?.content;

    if (!translatedContent) {
      return NextResponse.json(
        { success: false, error: 'AI返回了空的结果' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      translatedContent,
    });

  } catch (error) {
    console.error('Content translation error:', error);

    let errorMessage = '翻译失败';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
