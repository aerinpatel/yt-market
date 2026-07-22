import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface WebSocketContextType {
    priceUpdates: Record<string, number>; // Mapping of channelId -> new price
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
    const [priceUpdates, setPriceUpdates] = useState<Record<string, number>>({});

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:3000');

        ws.onopen = () => console.log('Connected to Market WebSocket');
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'price-update') {
                    setPriceUpdates((prev) => ({
                        ...prev,
                        [data.channelId]: data.price
                    }));
                }
            } catch (error) {
                console.error("WS parse error", error);
            }
        };

        ws.onclose = () => console.log('WebSocket disconnected');

        return () => {
            ws.close();
        };
    }, []);

    return (
        <WebSocketContext.Provider value={{ priceUpdates }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};
