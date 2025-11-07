// FIX: Removed a self-import of the `User` type that was previously on this line, which caused a name conflict.

export interface User {
    id: string;
    email: string;
    password?: string;
}

export type SignUpData = Omit<User, 'id'>;

export type PlayerRole = 'Captain' | 'Co-Captain';

export interface Player {
    id: string;
    name: string;
    avatarUrl: string;
    teamId: string | null;
    leagueId: string;
    role?: PlayerRole;
}

export interface Team {
    id: string;
    name: string;
    leagueId: string;
}

export interface MatchTeam {
    id: string;
    name: string;
    players: Player[];
}

export type PlayerStatsData = {
    ringers: number;
    totalShoesPitched: number;
};

export type PlayerStats = {
    [playerId: string]: PlayerStatsData;
};

// FIX: Define and export the LiveGameState interface for use in LiveScoring component.
export interface LiveGameState {
    scoreA: number;
    scoreB: number;
    playerStats: PlayerStats;
    activeEnd: 'end1' | 'end2';
}

export type PitEnd = 'end1' | 'end2';
export type PitTeamKey = 'teamA' | 'teamB';
export type PitSetup = {
    [key in PitEnd]: {
        teamA: Player | null;
        teamB: Player | null;
    }
};


export interface PersistedMatchState {
  teamA: MatchTeam;
  teamB: MatchTeam;
  isPlayerMatch: boolean;
  liveGameState: LiveGameState;
  pitSetup: PitSetup;
  gameStateHistory: LiveGameState[];
  componentState: 'playing' | 'finished' | 'pit-setup';
}

export interface Match {
    id: string;
    timestamp: number;
    leagueId: string;
    teamA: MatchTeam;
    teamB: MatchTeam;
    scoreA: number;
    scoreB: number;
    winner: 'A' | 'B';
    playerStats: PlayerStats;
    description?: string;
}

export interface League {
    id:string;
    name: string;
    winScore: number;
    playersPerTeam: number;
    pointsPerRinger: number;
    ownerId: string;
}

export interface TeamStanding {
    teamId: string;
    teamName: string;
    players: Player[];
    wins: number;
    losses: number;
    gamesPlayed: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDifferential: number;
}

export interface ScheduledMatch {
    id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    teamAId: string;
    teamBId: string;
    leagueId: string;
    description?: string;
}

export interface ChatMessage {
    id: string;
    leagueId: string;
    userId: string;
    userName: string;
    userAvatar: string;
    message: string;
    timestamp: number;
}

export interface UserPresence {
    [userId: string]: {
        lastSeen: number;
        userName: string;
    }
}

// Represents a participant in a bracket match (either a player or a team)
export interface BracketMatchParticipant {
  id: string | null;
  name: string;
  score: number | null;
  avatarUrl?: string;
}

// Represents a participant entity (player or team) for a tournament
export interface BracketParticipant {
    id: string;
    name: string;
    avatarUrl?: string;
}

// A single match-up in the bracket
export interface BracketNode {
  id: string;
  participantA: BracketMatchParticipant;
  participantB: BracketMatchParticipant;
  winnerId: string | null;
  isBye?: boolean;
  matchIdentifier: string; // e.g., "R1-M1" for Round 1, Match 1
  nextMatchId: string | null;
  gameNumber?: number;
  loserDestinationMatchId?: string;
}

// A single match in a round-robin tournament
export interface RoundRobinMatch {
  id: string;
  participantA: BracketMatchParticipant;
  participantB: BracketMatchParticipant;
  winnerId: string | null;
  pitNumber?: number;
}

// The entire tournament bracket
export interface TournamentBracket {
  id: string;
  leagueId: string;
  name: string;
  type: 'single-elimination' | 'double-elimination' | 'round-robin';
  participantType: 'team' | 'player';
  participants: BracketParticipant[];
  rounds?: BracketNode[][];
  loserRounds?: BracketNode[][]; // For double-elimination
  matches?: RoundRobinMatch[]; // For round-robin
  numberOfPits?: number;
}