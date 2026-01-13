import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@config/index';

interface BoardUser {
    odId: string;
    odname: string;
    color: string;
    socketId: string;
}

interface BoardElement {
    id: string;
    version: number;
    isDeleted?: boolean;
    [key: string]: any;
}

// Store active users per board
const boardRooms = new Map<string, Map<string, BoardUser>>();

// Store latest elements per board (in-memory cache for merging)
const boardElementsCache = new Map<string, BoardElement[]>();

// Generate random color
const getRandomColor = () => {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
};

// Merge elements (keep newer versions)
const mergeElements = (existing: BoardElement[], incoming: BoardElement[]): BoardElement[] => {
    const elementMap = new Map<string, BoardElement>();
    
    // Add existing elements
    for (const el of existing || []) {
        elementMap.set(el.id, el);
    }
    
    // Merge incoming elements (keep newer version)
    for (const el of incoming || []) {
        const current = elementMap.get(el.id);
        if (!current || el.version > current.version) {
            elementMap.set(el.id, el);
        }
    }
    
    // Filter out deleted elements
    return Array.from(elementMap.values()).filter(el => !el.isDeleted);
};

export const initBoardSocket = (io: Server) => {
    // Board namespace
    const boardNamespace = io.of('/board');

    // Authentication middleware
    boardNamespace.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
            socket.data.userId = decoded.sub;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    boardNamespace.on('connection', (socket: Socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Join board room
        socket.on('board:join', (data: { boardId: string; odId: string; odname: string; elements?: BoardElement[] }) => {
            const { boardId, odId, odname, elements } = data;
            
            // Leave any previous rooms
            socket.rooms.forEach(room => {
                if (room !== socket.id && room.startsWith('board:')) {
                    socket.leave(room);
                }
            });

            // Join the board room
            const roomName = `board:${boardId}`;
            socket.join(roomName);

            // Initialize room if not exists
            if (!boardRooms.has(boardId)) {
                boardRooms.set(boardId, new Map());
            }

            const room = boardRooms.get(boardId)!;
            
            // Add user to room
            const user: BoardUser = {
                odId,
                odname,
                color: getRandomColor(),
                socketId: socket.id,
            };
            room.set(socket.id, user);

            // Store boardId in socket data
            socket.data.boardId = boardId;

            // Merge incoming elements with cache (if provided)
            if (elements && elements.length > 0) {
                const existingElements = boardElementsCache.get(boardId) || [];
                const mergedElements = mergeElements(existingElements, elements);
                boardElementsCache.set(boardId, mergedElements);
            }

            // Notify all users in room about the new user
            socket.to(roomName).emit('board:user-joined', user);

            // Send current collaborators list to the new user
            const collaborators = Array.from(room.values());
            socket.emit('board:collaborators', collaborators);

            console.log(`User ${odname} joined board ${boardId}. Total users: ${room.size}`);
            
            // Send cached elements to the new user (if any)
            const cachedElements = boardElementsCache.get(boardId);
            if (cachedElements && cachedElements.length > 0) {
                socket.emit('board:elements-update', {
                    elements: cachedElements,
                    odId: 'server',
                });
            }
        });

        // Handle element changes (realtime broadcast with merge)
        socket.on('board:elements-change', (data: { boardId: string; elements: BoardElement[]; odId: string }) => {
            const { boardId, elements, odId } = data;
            const roomName = `board:${boardId}`;

            // Get existing cached elements
            const existingElements = boardElementsCache.get(boardId) || [];
            
            // Merge with incoming elements
            const mergedElements = mergeElements(existingElements, elements);
            
            // Update cache
            boardElementsCache.set(boardId, mergedElements);

            // Broadcast merged elements to all other users in the room
            socket.to(roomName).emit('board:elements-update', {
                elements: mergedElements,
                odId,
            });
        });

        // Leave board room
        socket.on('board:leave', (data: { boardId: string }) => {
            const { boardId } = data;
            handleUserLeave(socket, boardId);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            const boardId = socket.data.boardId;
            if (boardId) {
                handleUserLeave(socket, boardId);
            }
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    const handleUserLeave = (socket: Socket, boardId: string) => {
        const roomName = `board:${boardId}`;
        const room = boardRooms.get(boardId);

        if (room) {
            const user = room.get(socket.id);
            if (user) {
                room.delete(socket.id);
                
                // Notify remaining users
                socket.to(roomName).emit('board:user-left', { odId: user.odId });
                
                console.log(`User ${user.odname} left board ${boardId}. Remaining: ${room.size}`);

                // Clean up empty rooms
                if (room.size === 0) {
                    boardRooms.delete(boardId);
                    
                    // Clear elements cache after 5 minutes (in case someone rejoins)
                    setTimeout(() => {
                        if (!boardRooms.has(boardId)) {
                            boardElementsCache.delete(boardId);
                            console.log(`Cleared elements cache for board ${boardId}`);
                        }
                    }, 5 * 60 * 1000);
                }
            }
        }

        socket.leave(roomName);
    };
};

// Optional: Get active users for a board (for API endpoint)
export const getBoardActiveUsers = (boardId: string): BoardUser[] => {
    const room = boardRooms.get(boardId);
    return room ? Array.from(room.values()) : [];
};

// Initialize cache with elements from database (call when user joins)
export const initBoardCache = (boardId: string, elements: BoardElement[]) => {
    const existing = boardElementsCache.get(boardId) || [];
    const merged = mergeElements(existing, elements);
    boardElementsCache.set(boardId, merged);
};

// Get cached elements
export const getCachedElements = (boardId: string): BoardElement[] => {
    return boardElementsCache.get(boardId) || [];
};