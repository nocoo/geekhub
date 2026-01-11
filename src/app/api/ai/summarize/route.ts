import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  let baseUrl = '';
  try {
    const { title, content, aiSettings, articleId, feedId, urlHash } = await request.json();
    baseUrl = aiSettings.baseUrl || '';

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

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: '标题和内容不能为空' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client with custom settings
    const openai = new OpenAI({
      apiKey: aiSettings.apiKey,
      baseURL: aiSettings.baseUrl,
    });

    // Create the prompt for summarization
    const prompt = `请对以下文章进行总结，要求：
1. 总结必须使用中文
2. 总结应该包含文章的主要观点和关键信息
3. 总结长度控制在200-300字之间
4. 保持客观中性的语调
5. 突出文章的核心价值和要点

文章标题：${title}

文章内容：
${content}

请提供一个结构化的总结：`;

    // Call AI API
    const completion = await openai.chat.completions.create({
      model: aiSettings.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的文章总结助手。无论输入什么语言的文章，你都必须用中文进行总结。总结要准确、简洁、有条理。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 4000,  // Increase for reasoning models
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content;

    if (!summary) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI返回了空的总结',
          debug: {
            hasChoices: !!completion.choices,
            choicesLength: completion.choices?.length,
            firstChoice: completion.choices?.[0],
          }
        },
        { status: 500 }
      );
    }

    const summaryText = summary.trim();

    // Save summary to article JSON if articleId and urlHash are provided
    if (articleId && urlHash) {
      try {
        const dataDir = path.join(process.cwd(), 'data');
        const articlePath = path.join(dataDir, 'feeds', urlHash, 'articles', `${articleId}.json`);

        // Read existing article data
        const articleContent = await fs.readFile(articlePath, 'utf-8');
        const articleData = JSON.parse(articleContent);

        // Add AI summary with timestamp
        articleData.ai_summary = {
          content: summaryText,
          model: aiSettings.model || 'gpt-4o-mini',
          generated_at: new Date().toISOString(),
          usage: completion.usage,
        };

        // Write back to file
        await fs.writeFile(articlePath, JSON.stringify(articleData, null, 2), 'utf-8');
      } catch (saveError) {
        console.error('[AI Summarize] Failed to save summary:', saveError);
        // Don't fail the request if saving fails
      }
    }

    return NextResponse.json({
      success: true,
      summary: summaryText,
      usage: completion.usage
    });

  } catch (error) {
    console.error('AI summarization error:', error);

    let errorMessage = '总结失败';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Add more debug info for connection errors
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
          stack: error instanceof Error ? error.stack : undefined,
        }
      },
      { status: 500 }
    );
  }
}
