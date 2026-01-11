import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { aiSettings } = await request.json();

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

    // Initialize OpenAI client with custom settings
    const openai = new OpenAI({
      apiKey: aiSettings.apiKey,
      baseURL: aiSettings.baseUrl,
    });

    // Test connection by fetching models list
    const models = await openai.models.list();

    return NextResponse.json({
      success: true,
      message: '连接成功！',
      provider: aiSettings.provider,
      baseUrl: aiSettings.baseUrl,
      modelCount: models.data.length,
      models: models.data.slice(0, 10).map((m: any) => m.id), // Return first 10 models
      hasMore: models.data.length > 10,
    });

  } catch (error: any) {
    console.error('[AI Validate] Error:', error.message);

    let errorMessage = '连接失败';
    if (error.message) {
      errorMessage = error.message;
    }

    // Add helpful error messages
    if (error.message?.includes('ENOTFOUND')) {
      errorMessage = `DNS 解析失败：无法找到服务器。请检查 Base URL 是否正确。`;
    } else if (error.message?.includes('401')) {
      errorMessage = `认证失败：API Key 无效。`;
    } else if (error.message?.includes('403')) {
      errorMessage = `权限不足：请检查 API Key 权限。`;
    } else if (error.message?.includes('404')) {
      errorMessage = `接口不存在：Base URL 可能不正确。`;
    } else if (error.message?.includes('ECONNREFUSED')) {
      errorMessage = `连接被拒绝：服务器无法访问。`;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        debug: {
          message: error.message,
          type: error.type,
          code: error.code,
        }
      },
      { status: 200 } // Return 200 so client can display the error
    );
  }
}
