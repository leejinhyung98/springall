/**
 * SSE (Server-Sent Events) Custom Hook
 * - 실시간 스트리밍 데이터를 받기 위한 React Hook
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseSSEOptions {
    enabled?: boolean;
    reconnect?: boolean;
    reconnectInterval?: number;
    onMessage?: (data: any) => void;
    onError?: (error: Error) => void;
    onOpen?: () => void;
    onClose?: () => void;
}

interface UseSSEReturn<T> {
    data: T[];
    isConnected: boolean;
    error: Error | null;
    reconnect: () => void;
    disconnect: () => void;
}

export function useSSE<T = any>(
    path: string,
    options: UseSSEOptions = {}
): UseSSEReturn<T> {
    const {
        enabled = true,
        reconnect: shouldReconnect = true,
        reconnectInterval = 3000,
        onMessage,
        onError,
        onOpen,
        onClose,
    } = options;

    const [data, setData] = useState<T[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const shouldReconnectRef = useRef(shouldReconnect);

    useEffect(() => {
        shouldReconnectRef.current = shouldReconnect;
    }, [shouldReconnect]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        setIsConnected(false);
        onClose?.();
    }, [onClose]);

    const connect = useCallback(() => {
        if (!enabled) {
            return;
        }

        // 기존 연결이 있으면 먼저 끊기
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        try {
            const eventSource = new EventSource(path);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                setIsConnected(true);
                setError(null);
                onOpen?.();
            };

            eventSource.onmessage = (event) => {
                try {
                    const parsedData = JSON.parse(event.data) as T;
                    setData((prev) => [...prev, parsedData]);
                    onMessage?.(parsedData);
                } catch (err) {
                    console.error('[SSE] Failed to parse message:', err);
                }
            };

            eventSource.onerror = (err) => {
                setIsConnected(false);
                const error = new Error('SSE connection error');
                setError(error);
                onError?.(error);

                // 자동 재연결
                if (shouldReconnectRef.current && eventSource.readyState === EventSource.CLOSED) {
                    if (reconnectTimeoutRef.current) {
                        clearTimeout(reconnectTimeoutRef.current);
                    }
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, reconnectInterval);
                } else {
                    disconnect();
                }
            };
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to create SSE connection');
            setError(error);
            onError?.(error);
        }
    }, [enabled, path, reconnectInterval, onMessage, onError, onOpen]);

    const reconnect = useCallback(() => {
        disconnect();
        setTimeout(() => {
            connect();
        }, 100);
    }, [disconnect, connect]);

    useEffect(() => {
        if (enabled) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [enabled, connect, disconnect]);

    return {
        data,
        isConnected,
        error,
        reconnect,
        disconnect,
    };
}

