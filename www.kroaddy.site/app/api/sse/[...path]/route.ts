/**
 * Next.js API Route: SSE Proxy
 * - Gateway SSE 연결을 프록시
 * - 스트리밍 유지
 */

import { NextRequest } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathArray } = await params;
    const path = pathArray.join('/');
    const url = `${GATEWAY_URL}/sse/${path}`;
    
    // Gateway SSE 연결
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...(request.headers.get('cookie') && {
          Cookie: request.headers.get('cookie')!,
        }),
      },
    });
    
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'SSE connection failed' }),
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // 스트리밍 응답
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        
        if (!reader) {
          controller.close();
          return;
        }
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }
            
            controller.enqueue(value);
          }
        } catch (error) {
          console.error('[SSE Proxy Error]', error);
        } finally {
          controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('[SSE Proxy Error]', error);
    return new Response(
      JSON.stringify({ error: 'SSE proxy error', message: error.message }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

