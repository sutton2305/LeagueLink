import React, { useState, useMemo, useEffect } from 'react';
import { League, Match, Player, Team, ScheduledMatch, User, ChatMessage, TournamentBracket, BracketNode, PlayerStatsData } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import Home from './Home';
import LiveScoring from './LiveScoring';
import Standings from './Standings';
import MatchHistory from './MatchHistory';
import PlayerManagement from './PlayerManagement';
import TeamManagement from './TeamManagement';
import Schedule from './Schedule';
import LeagueSettings from './LeagueSettings';
import PlayerStats from './PlayerStats';
import Chat from './Chat';
import Brackets from './Brackets';

// Icons
import HomeIcon from './icons/HomeIcon';
import SwordsIcon from './icons/SwordsIcon';
import TrophyIcon from './icons/TrophyIcon';
import { MatchHistoryIcon } from './icons/MatchHistoryIcon';
import UsersIcon from './icons/UsersIcon';
import CalendarIcon from './icons/CalendarIcon';
import SettingsIcon from './icons/SettingsIcon';
import ChatIcon from './icons/ChatIcon';
import TournamentIcon from './icons/TournamentIcon';

interface DashboardProps {
  league: League;
  currentUser: User;
  onRolloverLeague: (sourceLeagueId: string, newLeagueName: string, keepTeams: boolean) => void;
}

type Tab = 'Home' | 'Live Match' | 'Chat' | 'Standings' | 'Match History' | 'Players' | 'Teams' | 'Schedule' | 'Player Stats' | 'Settings' | 'Brackets';

type LiveScoringSource = {
    bracketId: string;
    matchId: string;
    type: 'winners' | 'losers' | 'round-robin';
    roundIndex?: number;
    matchIndex?: number;
};

type MatchToStart = ({ teamAId: string, teamBId: string } | { playerAId: string, playerBId: string }) & { description?: string };

const Dashboard: React.FC<DashboardProps> = ({ league, currentUser, onRolloverLeague }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [players, setPlayers] = useLocalStorage<Player[]>(`players_${league.id}`, []);
  const [teams, setTeams] = useLocalStorage<Team[]>(`teams_${league.id}`, []);
  const [matches, setMatches] = useLocalStorage<Match[]>(`matches_${league.id}`, []);
  const [scheduledMatches, setScheduledMatches] = useLocalStorage<ScheduledMatch[]>(`scheduled_matches_${league.id}`, []);
  const [chatMessages, setChatMessages] = useLocalStorage<ChatMessage[]>(`chat_messages_${league.id}`, []);
  const [brackets, setBrackets] = useLocalStorage<TournamentBracket[]>(`tournaments_${league.id}`, []);
  const [scheduleFilter, setScheduleFilter] = useState<{ teamId: string | null }>({ teamId: null });

  const [matchToStart, setMatchToStart] = useState<MatchToStart | null>(null);
  const [liveScoringSource, setLiveScoringSource] = useState<LiveScoringSource | null>(null);
  const [isMatchInProgress, setIsMatchInProgress] = useState(false);

  useEffect(() => {
    const liveMatchStorageKey = `live_match_state_${league.id}`;
    
    const checkStorage = () => {
        setIsMatchInProgress(!!localStorage.getItem(liveMatchStorageKey));
    };

    checkStorage(); // Initial check on component mount or league change

    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === liveMatchStorageKey) {
            checkStorage();
        }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [league.id]);

  const startMatch = (ids: MatchToStart, source: LiveScoringSource | null = null) => {
    setMatchToStart(ids);
    setLiveScoringSource(source);
    setActiveTab('Live Match');
  };

  const onMatchStarted = () => {
    setMatchToStart(null);
  };

  const handleViewTeamSchedule = (teamId: string) => {
    setScheduleFilter({ teamId });
    setActiveTab('Schedule');
  };

  const updateBracketWithResult = (source: LiveScoringSource, matchResult: Match) => {
    setBrackets(prevBrackets => {
        const newBrackets = JSON.parse(JSON.stringify(prevBrackets)) as TournamentBracket[];
        const bracketToUpdate = newBrackets.find(b => b.id === source.bracketId);
        if (!bracketToUpdate) return prevBrackets;

        // --- ROUND ROBIN ---
        if (source.type === 'round-robin') {
            const matchToUpdate = bracketToUpdate.matches?.find(m => m.id === source.matchId);
            if (matchToUpdate) {
                matchToUpdate.participantA.score = matchToUpdate.participantA.id === matchResult.teamA.id ? matchResult.scoreA : matchResult.scoreB;
                matchToUpdate.participantB.score = matchToUpdate.participantB.id === matchResult.teamB.id ? matchResult.scoreB : matchResult.scoreA;
                matchToUpdate.winnerId = matchResult.winner === 'A' ? matchResult.teamA.id : matchResult.teamB.id;
            }
            return newBrackets;
        }

        // --- ELIMINATION ---
        const { type, roundIndex, matchIndex } = source;
        const rounds = type === 'winners' ? bracketToUpdate.rounds : bracketToUpdate.loserRounds;
        if (!rounds || !rounds[roundIndex!] || !rounds[roundIndex!][matchIndex!]) {
            return prevBrackets;
        }

        const matchToUpdate = rounds[roundIndex!][matchIndex!];
        
        // 1. Update the match that was just played
        matchToUpdate.participantA.score = matchToUpdate.participantA.id === matchResult.teamA.id ? matchResult.scoreA : matchResult.scoreB;
        matchToUpdate.participantB.score = matchToUpdate.participantB.id === matchResult.teamB.id ? matchResult.scoreB : matchResult.scoreA;
        matchToUpdate.winnerId = matchResult.winner === 'A' ? matchResult.teamA.id : matchResult.teamB.id;
        
        // --- PROPAGATION LOGIC ---
        const allRounds = [...(bracketToUpdate.rounds || []), ...(bracketToUpdate.loserRounds || [])];
        const findMatchById = (id: string | null): BracketNode | null => {
            if (!id) return null;
            for (const round of allRounds) {
                const found = round.find(m => m.id === id);
                if (found) return found;
            }
            return null;
        };
        
        const winner = matchToUpdate.winnerId ? (matchToUpdate.winnerId === matchToUpdate.participantA.id ? matchToUpdate.participantA : matchToUpdate.participantB) : null;
        const loser = matchToUpdate.winnerId ? (matchToUpdate.winnerId === matchToUpdate.participantA.id ? matchToUpdate.participantB : matchToUpdate.participantA) : null;

        // 2. Propagate Winner
        if (matchToUpdate.nextMatchId && winner) {
            const nextMatch = findMatchById(matchToUpdate.nextMatchId);
            if (nextMatch) {
                const feedingMatches = allRounds.flat().filter(m => m.nextMatchId === nextMatch.id).sort((a,b) => (a.gameNumber ?? 0) - (b.gameNumber ?? 0));
                const feederIndex = feedingMatches.findIndex(m => m.id === matchToUpdate.id);
                const slot = feederIndex === 0 ? 'participantA' : 'participantB';
                nextMatch[slot] = { id: winner.id, name: winner.name, score: null, avatarUrl: winner.avatarUrl };
            }
        }

        // 3. Propagate Loser (Generic Logic)
        if (loser && loser.id && matchToUpdate.loserDestinationMatchId) {
            const destMatch = findMatchById(matchToUpdate.loserDestinationMatchId);
            if (destMatch) {
                // Find all matches that feed losers into this destination match
                const loserFeedingMatches = allRounds.flat()
                    .filter(m => m.loserDestinationMatchId === destMatch.id)
                    .sort((a, b) => (a.gameNumber ?? 0) - (b.gameNumber ?? 0));

                const feederIndex = loserFeedingMatches.findIndex(m => m.id === matchToUpdate.id);
                
                // Determine the slot ('participantA' or 'participantB')
                const slot = feederIndex === 0 ? 'participantA' : 'participantB';

                // Assign the loser to the determined slot if it's empty
                if (destMatch[slot]?.id === null) {
                     destMatch[slot] = { id: loser.id, name: loser.name, score: null, avatarUrl: loser.avatarUrl };
                } else {
                    // Fallback to the other slot if the primary one is somehow taken (should be rare)
                    const fallbackSlot = slot === 'participantA' ? 'participantB' : 'participantA';
                    if(destMatch[fallbackSlot]?.id === null) {
                        destMatch[fallbackSlot] = { id: loser.id, name: loser.name, score: null, avatarUrl: loser.avatarUrl };
                    }
                }
            }
        }
        return newBrackets;
    });
};


  const addMatch = (matchData: Omit<Match, 'id' | 'timestamp' | 'leagueId'>) => {
    const newMatch: Match = {
      ...matchData,
      id: `match-${Date.now()}`,
      timestamp: Date.now(),
      leagueId: league.id,
    };
    setMatches(prev => [...prev, newMatch]);

    if(liveScoringSource) {
        updateBracketWithResult(liveScoringSource, newMatch);
        setLiveScoringSource(null);
    }
  };

  const handleBracketUpdate = (bracketId: string, updatedBracket: TournamentBracket) => {
    setBrackets(prev => prev.map(b => b.id === bracketId ? updatedBracket : b));
  };

    const playerRingerStats = useMemo(() => {
        const stats: Record<string, number> = {};
        players.forEach(p => {
            stats[p.id] = 0;
        });

        matches.forEach(match => {
            Object.entries(match.playerStats).forEach(([playerId, pStats]) => {
                if (stats.hasOwnProperty(playerId)) {
                    stats[playerId] += (pStats as PlayerStatsData).ringers;
                }
            });
        });
        return stats;
    }, [matches, players]);

  const tabs: { name: Tab, icon: React.FC<{className?: string}> }[] = [
    { name: 'Home', icon: HomeIcon },
    { name: 'Live Match', icon: SwordsIcon },
    { name: 'Chat', icon: ChatIcon },
    { name: 'Standings', icon: TrophyIcon },
    { name: 'Match History', icon: MatchHistoryIcon },
    { name: 'Brackets', icon: TournamentIcon },
    { name: 'Player Stats', icon: UsersIcon }, // Placeholder icon
    { name: 'Players', icon: UsersIcon },
    { name: 'Teams', icon: UsersIcon }, // Placeholder icon
    { name: 'Schedule', icon: CalendarIcon },
    { name: 'Settings', icon: SettingsIcon },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Home':
        return <Home league={league} players={players} teams={teams} matches={matches} onStartMatch={(teamAId, teamBId) => startMatch({ teamAId, teamBId })} />;
      case 'Live Match':
        return <LiveScoring players={players} teams={teams} addMatch={addMatch} league={league} matchToStart={matchToStart} onMatchStarted={onMatchStarted} />;
      case 'Chat':
        return <Chat league={league} currentUser={currentUser} messages={chatMessages} setMessages={setChatMessages} />;
      case 'Standings':
        return <Standings matches={matches} teams={teams} players={players} />;
      case 'Match History':
        return <MatchHistory matches={matches} />;
      case 'Brackets':
        return <Brackets league={league} teams={teams} setTeams={setTeams} players={players} setPlayers={setPlayers} playerRingerStats={playerRingerStats} brackets={brackets} setBrackets={setBrackets} onBracketUpdate={handleBracketUpdate} onStartLiveMatch={startMatch} />;
      case 'Player Stats':
        return <PlayerStats matches={matches} players={players} />;
      case 'Players':
        return <PlayerManagement players={players} setPlayers={setPlayers} teams={teams} leagueId={league.id} />;
      case 'Teams':
        return <TeamManagement teams={teams} setTeams={setTeams} players={players} setPlayers={setPlayers} leagueId={league.id} onViewSchedule={handleViewTeamSchedule} />;
      case 'Schedule':
        return <Schedule scheduledMatches={scheduledMatches} setScheduledMatches={setScheduledMatches} teams={teams} setTeams={setTeams} leagueId={league.id} onStartMatch={startMatch} scheduleFilter={scheduleFilter} setScheduleFilter={setScheduleFilter} />;
      case 'Settings':
        return <LeagueSettings 
                    league={league} 
                    onRolloverLeague={onRolloverLeague} 
                    players={players}
                    teams={teams}
                    matches={matches}
                    brackets={brackets}
                />;
      default:
        return null;
    }
  };

  return (
    <div>
        <div className="mb-6 overflow-x-auto">
            <nav className="flex space-x-2 sm:space-x-4 border-b border-gray-700">
                {tabs.map(tab => {
                    const isLiveMatchTab = tab.name === 'Live Match';
                    const showResumeIndicator = isLiveMatchTab && isMatchInProgress;

                    return (
                        <button
                            key={tab.name}
                            onClick={() => setActiveTab(tab.name)}
                            className={`flex items-center px-3 py-3 text-sm sm:text-base font-medium whitespace-nowrap transition-colors ${
                                activeTab === tab.name
                                    ? 'border-b-2 border-brand-primary text-brand-primary'
                                    : 'text-brand-text-secondary hover:text-brand-text'
                            }`}
                        >
                            <tab.icon className="w-5 h-5 mr-2" />
                            {showResumeIndicator ? 'Resume Match' : tab.name}
                            {showResumeIndicator && <span className="ml-2 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></span>}
                        </button>
                    );
                })}
            </nav>
        </div>
        <div>{renderContent()}</div>
    </div>
  );
};

export default Dashboard;