
// This service simulates a backend database using localStorage.
// For a true multi-user, multi-device experience, this would be replaced
// with a real backend service (e.g., Firebase, Supabase, or a custom API).

import { User, League, Player, Team, Match, ScheduledMatch, ChatMessage, UserPresence, TournamentBracket, PersistedMatchState } from '../types';

// Helper function to get an item from localStorage
const getItem = <T,>(key: string, defaultValue: T): T => {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error reading from localStorage for key "${key}":`, error);
        return defaultValue;
    }
};

// Helper function to set an item in localStorage
const setItem = <T,>(key: string, value: T): void => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Error writing to localStorage for key "${key}":`, error);
    }
};

const defaultLeagues: League[] = [
  {
    id: 'league-public-1',
    name: 'Downtown Horseshoe Club',
    winScore: 21,
    playersPerTeam: 2,
    pointsPerRinger: 3,
    ownerId: 'user_system_001',
  },
  {
    id: 'league-public-2',
    name: 'Backyard Champions Tour',
    winScore: 15,
    playersPerTeam: 1,
    pointsPerRinger: 3,
    ownerId: 'user_system_002',
  },
];

// Initialize default data if it doesn't exist
const initializeDefaultData = () => {
    // Seed with default leagues if localStorage is empty for them.
    if (!localStorage.getItem('leagues')) {
        setItem('leagues', defaultLeagues);
    }
    
    // Create default admin user
    const users = getItem<User[]>('users', []);
    const adminEmail = 'admin@leaguelink.com';
    if (!users.some(user => user.email === adminEmail)) {
        const adminUser: User = {
            id: 'user-admin-default',
            email: adminEmail,
            password: 'leaguelink',
        };
        setItem('users', [...users, adminUser]);
    }
};

initializeDefaultData();

export const db = {
    // Users
    getUsers: () => getItem<User[]>('users', []),
    saveUsers: (users: User[]) => setItem('users', users),
    getCurrentUser: () => getItem<User | null>('currentUser', null),
    saveCurrentUser: (user: User | null) => setItem('currentUser', user),

    // Leagues
    getLeagues: () => getItem<League[]>('leagues', []),
    saveLeagues: (leagues: League[]) => setItem('leagues', leagues),
    getActiveLeagueId: () => getItem<string | null>('activeLeagueId', null),
    saveActiveLeagueId: (id: string | null) => setItem('activeLeagueId', id),
    getJoinedLeagueIds: (userId: string) => getItem<string[]>(`joined_leagues_${userId}`, []),
    saveJoinedLeagueIds: (userId: string, ids: string[]) => setItem(`joined_leagues_${userId}`, ids),

    // League-specific data
    getPlayers: (leagueId: string) => getItem<Player[]>(`players_${leagueId}`, []),
    savePlayers: (leagueId: string, players: Player[]) => setItem(`players_${leagueId}`, players),

    getTeams: (leagueId: string) => getItem<Team[]>(`teams_${leagueId}`, []),
    saveTeams: (leagueId: string, teams: Team[]) => setItem(`teams_${leagueId}`, teams),
    
    getMatches: (leagueId: string) => getItem<Match[]>(`matches_${leagueId}`, []),
    saveMatches: (leagueId: string, matches: Match[]) => setItem(`matches_${leagueId}`, matches),

    getScheduledMatches: (leagueId: string) => getItem<ScheduledMatch[]>(`scheduled_matches_${leagueId}`, []),
    saveScheduledMatches: (leagueId: string, matches: ScheduledMatch[]) => setItem(`scheduled_matches_${leagueId}`, matches),

    getChatMessages: (leagueId: string) => getItem<ChatMessage[]>(`chat_messages_${leagueId}`, []),
    saveChatMessages: (leagueId: string, messages: ChatMessage[]) => setItem(`chat_messages_${leagueId}`, messages),

    getBrackets: (leagueId: string) => getItem<TournamentBracket[]>(`tournaments_${leagueId}`, []),
    saveBrackets: (leagueId: string, brackets: TournamentBracket[]) => setItem(`tournaments_${leagueId}`, brackets),

    // Live State
    getLiveMatchState: (leagueId: string) => getItem<PersistedMatchState | null>(`live_match_state_${leagueId}`, null),
    saveLiveMatchState: (leagueId: string, state: PersistedMatchState | null) => {
        if (state === null) {
            localStorage.removeItem(`live_match_state_${leagueId}`);
        } else {
            setItem(`live_match_state_${leagueId}`, state);
        }
    },

    // Chat Presence
    getPresence: (leagueId: string) => getItem<UserPresence>(`user_presence_${leagueId}`, {}),
    savePresence: (leagueId: string, presence: UserPresence) => setItem(`user_presence_${leagueId}`, presence),
    
    // Clear all data for a given league ID
    clearLeagueData: (leagueId: string) => {
        const keysToRemove = [
            `players_${leagueId}`,
            `teams_${leagueId}`,
            `matches_${leagueId}`,
            `scheduled_matches_${leagueId}`,
            `chat_messages_${leagueId}`,
            `tournaments_${leagueId}`,
            `live_match_state_${leagueId}`,
            `user_presence_${leagueId}`,
        ];
        keysToRemove.forEach(key => localStorage.removeItem(key));
    },
};
