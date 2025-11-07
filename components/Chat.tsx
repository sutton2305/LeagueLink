
import React, { useState, useEffect, useRef } from 'react';
import { League, User, ChatMessage, UserPresence } from '../types';
import { sendNotification } from '../utils/notifications';
import DoubleCheckIcon from './icons/DoubleCheckIcon';

interface ChatProps {
    league: League;
    currentUser: User;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const formatTimestamp = (timestamp: number) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffSeconds = Math.round((now.getTime() - messageDate.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (now.toDateString() === messageDate.toDateString()) {
        return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return messageDate.toLocaleDateString();
};

const Chat: React.FC<ChatProps> = ({ league, currentUser, messages, setMessages }) => {
    const [newMessage, setNewMessage] = useState('');
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const presenceKey = `user_presence_${league.id}`;

    const updatePresence = () => {
        const presenceData: UserPresence = JSON.parse(localStorage.getItem(presenceKey) || '{}');
        const now = Date.now();
        const activeUsers = Object.entries(presenceData)
            .filter(([, data]) => now - data.lastSeen < 60000) // Online if seen in last 60 seconds
            .map(([, data]) => data.userName);
        setOnlineUsers(activeUsers);
    };

    useEffect(() => {
        // Set up intervals to manage user presence
        const updateSelfInterval = setInterval(() => {
            const presenceData: UserPresence = JSON.parse(localStorage.getItem(presenceKey) || '{}');
            presenceData[currentUser.id] = {
                lastSeen: Date.now(),
                userName: currentUser.email.split('@')[0],
            };
            localStorage.setItem(presenceKey, JSON.stringify(presenceData));
        }, 15000); // Update self every 15s

        const checkOthersInterval = setInterval(updatePresence, 20000); // Check others every 20s
        updatePresence(); // Initial check

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === presenceKey) {
                updatePresence();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            clearInterval(updateSelfInterval);
            clearInterval(checkOthersInterval);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [presenceKey, currentUser.id, currentUser.email]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (messages.length === 0) return;
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage.userId !== currentUser.id && document.hidden) {
            sendNotification(`New message in ${league.name}`, {
                body: `${lastMessage.userName}: ${lastMessage.message}`,
                icon: lastMessage.userAvatar,
            });
        }
    }, [messages, currentUser.id, league.name]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;

        const message: ChatMessage = {
            id: `msg-${Date.now()}`,
            leagueId: league.id,
            userId: currentUser.id,
            userName: currentUser.email.split('@')[0],
            userAvatar: `https://api.dicebear.com/8.x/bottts/svg?seed=${encodeURIComponent(currentUser.email)}`,
            message: newMessage.trim(),
            timestamp: Date.now(),
        };

        setMessages(prevMessages => [...prevMessages, message]);
        setNewMessage('');
    };

    return (
        <div className="max-w-4xl mx-auto h-[75vh] flex flex-col bg-brand-surface rounded-xl shadow-lg">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-2xl font-bold text-brand-primary">League Chat</h2>
                <p className="text-sm text-brand-text-secondary h-5">
                    {onlineUsers.length > 0 ? `🟢 Online: ${onlineUsers.join(', ')}` : 'No other users currently online'}
                </p>
            </div>
            <div className="flex-grow p-4 overflow-y-auto">
                <div className="space-y-4">
                    {messages.map(msg => {
                        const isCurrentUser = msg.userId === currentUser.id;
                        return (
                            <div key={msg.id} className={`flex items-start gap-3 ${isCurrentUser ? 'justify-end' : ''}`}>
                                {!isCurrentUser && <img src={msg.userAvatar} alt={msg.userName} className="w-10 h-10 rounded-full flex-shrink-0" />}
                                <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                                    <div className={`p-3 rounded-lg max-w-xs md:max-w-md ${isCurrentUser ? 'bg-brand-primary text-brand-bg' : 'bg-brand-bg'}`}>
                                        {!isCurrentUser && <p className="font-bold text-sm text-brand-primary mb-1">{msg.userName}</p>}
                                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                                    </div>
                                    <div className={`flex items-center mt-1 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                                        <p className="text-xs text-brand-text-secondary mx-2">
                                            {formatTimestamp(msg.timestamp)}
                                        </p>
                                        {isCurrentUser && <DoubleCheckIcon className="w-4 h-4 text-blue-400"/>}
                                    </div>
                                </div>
                                {isCurrentUser && <img src={msg.userAvatar} alt={msg.userName} className="w-10 h-10 rounded-full flex-shrink-0" />}
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <div className="p-4 border-t border-gray-700">
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-grow bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button type="submit" className="bg-brand-primary text-brand-bg font-bold py-2 px-6 rounded-lg hover:bg-brand-secondary transition-colors">
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Chat;