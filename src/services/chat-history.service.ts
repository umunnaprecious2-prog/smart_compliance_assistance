import { prisma } from '../lib/prisma.ts';
import { Prisma } from '@prisma/client';

export const saveMessage = async (
    sessionId: number,
    role: 'user' | 'assistant',
    content: string,
    citations?: any,
    piiRedacted: boolean = false,
    confidenceScore?: number
) => {
    if (!sessionId || isNaN(sessionId)) {
        throw new Error(`Invalid sessionId: ${sessionId}`);
    }

    const sessionExists = await prisma.chatSession.findUnique({
        where: { id: sessionId }
    });

    if (!sessionExists) {
        throw new Error(`ChatSession with ID ${sessionId} does not exist`);
    }

    const message = await prisma.chatMessage.create({
        data: {
            sessionId,
            role,
            content,
            citations: citations ? JSON.stringify(citations) : Prisma.JsonNull,
            piiRedacted,
            confidenceScore: confidenceScore || null
        }
    });
    return message;
};

export const getSessionMessages = async (sessionId: number) => {
    const messages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' }
    });
    
    return messages.map(msg => {
        let parsedCitations = null;
        if (msg.citations) {
            try {
                parsedCitations = JSON.parse(msg.citations as string);
            } catch {
                parsedCitations = null;
            }
        }
        return {
            role: msg.role,
            content: msg.content,
            citations: parsedCitations,
            confidenceScore: msg.confidenceScore,
            createdAt: msg.createdAt
        };
    });
};

export const createSession = async (firstMessage?: string) => {
    const session = await prisma.chatSession.create({
        data: {
            title: firstMessage 
                ? firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '')
                : 'New Chat'
        }
    });
    return session;
};

export const getRecentSessions = async (limit: number = 10) => {
    const sessions = await prisma.chatSession.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    });
    return sessions;
};

export const getSessionWithMessages = async (sessionId: number) => {
    const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
            messages: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });
    return session;
};
