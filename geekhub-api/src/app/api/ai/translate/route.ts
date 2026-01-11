import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface ArticleToTranslate {
  id: string;
  title: string;
  description: string;
}

interface TranslatedArticle {
  id: string;
  translatedTitle: string;
  translatedDescription: string;
}

export async function POST(request: NextRequest) {
  let baseUrl = '';
  try {
    const { articles, aiSettings } = await request.json();
    baseUrl = aiSettings?.baseUrl || '';

    console.log('[AI Translate] Request received');
    console.log('[AI Translate] Articles count:', articles?.length);
    console.log('[AI Translate] AI Settings:', JSON.stringify({
      enabled: aiSettings?.enabled,
      provider: aiSettings?.provider,
      baseUrl: aiSettings?.baseUrl,
      model: aiSettings?.model,
    }));
    console.log('[AI Translate] Sample article:', articles?.[0] ? JSON.stringify(articles[0]) : 'none');

    // Validate AI settings
    if (!aiSettings?.enabled) {
      return NextResponse.json(
        { success: false, error: 'AI功能未启用' },
        { status: 400 }
      );
    }

    if (!aiSettings.apiKey) {
      return NextResponse.json(
        { success: false, error: 'API Key未配置' },
        { status: 400 }
      );
    }

    if (!aiSettings.baseUrl) {
      return NextResponse.json(
        { success: false, error: 'Base URL未配置' },
        { status: 400 }
      );
    }

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { success: false, error: '文章列表不能为空' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: aiSettings.apiKey,
      baseURL: aiSettings.baseUrl,
    });

    // Prepare articles data for translation
    const articlesText = articles.map((a: ArticleToTranslate, index: number) =>
      `【文章${index + 1}】ID: ${a.id}\n标题: ${a.title}\n描述: ${a.description}`
    ).join('\n\n');

    // Create the prompt for batch translation
    const prompt = `请将以下${articles.length}篇文章的标题和描述翻译成中文，要求：
1. 保持原文格式和语义
2. 标题要简洁有力
3. 描述要准确传达原文意思
4. 必须返回一个JSON对象，包含一个"translations"数组
5. 数组中每个对象包含id、translatedTitle、translatedDescription三个字段
6. 不要添加任何额外的文字说明

待翻译文章：
${articlesText}

返回格式示例：
{
  "translations": [
    {"id": "文章ID", "translatedTitle": "中文标题", "translatedDescription": "中文描述"},
    ...
  ]
}`;

    // Call AI API
    const completion = await openai.chat.completions.create({
      model: aiSettings.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的翻译助手。无论输入什么语言的内容，你都翻译成中文。必须严格按照要求返回JSON格式，不添加任何额外文字。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      console.error('[AI Translate] Empty response from AI');
      console.error('[AI Translate] completion:', JSON.stringify(completion, null, 2));
      return NextResponse.json(
        { success: false, error: 'AI返回了空的结果' },
        { status: 500 }
      );
    }

    console.log('[AI Translate] Raw AI response length:', response.length);
    console.log('[AI Translate] Raw AI response (first 500 chars):', response.substring(0, 500));
    console.log('[AI Translate] Raw AI response (last 500 chars):', response.substring(response.length - 500));

    // Parse the JSON response
    let parsed: { translations: TranslatedArticle[] };
    try {
      parsed = JSON.parse(response.trim());
      console.log('[AI Translate] Parsed JSON successfully');
      console.log('[AI Translate] Parsed keys:', Object.keys(parsed));
    } catch (e) {
      console.error('[AI Translate] Failed to parse JSON');
      console.error('[AI Translate] Parse error:', e);
      console.error('[AI Translate] Raw response:', response);
      return NextResponse.json(
        {
          success: false,
          error: 'AI返回的不是有效的JSON格式',
          debug: { response }
        },
        { status: 500 }
      );
    }

    // Extract translations array
    if (!parsed.translations || !Array.isArray(parsed.translations)) {
      console.error('[AI Translate] No "translations" array found in response');
      console.error('[AI Translate] Parsed data:', JSON.stringify(parsed, null, 2));
      return NextResponse.json(
        {
          success: false,
          error: 'AI返回的JSON格式不正确，缺少translations数组',
          debug: { response, parsed }
        },
        { status: 500 }
      );
    }

    const translations = parsed.translations;
    console.log('[AI Translate] Translations array length:', translations.length);
    if (translations.length > 0) {
      console.log('[AI Translate] First item:', JSON.stringify(translations[0], null, 2));
    }

    // Validate translations count
    if (translations.length !== articles.length) {
      console.warn('[AI Translate] Translation count mismatch:', {
        expected: articles.length,
        received: translations.length
      });
    }

    console.log('[AI Translate] Translation successful, returning', translations.length, 'translations');
    console.log('[AI Translate] Usage:', JSON.stringify(completion.usage));

    return NextResponse.json({
      success: true,
      translations,
      usage: completion.usage
    });

  } catch (error) {
    console.error('AI translation error:', error);

    let errorMessage = '翻译失败';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch')) {
      errorMessage = `Connection error: 无法连接到 ${baseUrl}。请检查 Base URL 是否正确。`;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        debug: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Unknown',
        }
      },
      { status: 500 }
    );
  }
}
