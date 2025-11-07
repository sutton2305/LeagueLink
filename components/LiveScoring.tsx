import React, { useState, useEffect, useMemo } from 'react';
import { Player, Team, Match, League, MatchTeam, ScheduledMatch, LiveGameState, PlayerStats, PitSetup, PitEnd, PersistedMatchState } from '../types';
import SwordsIcon from './icons/SwordsIcon';
import { sendNotification } from '../utils/notifications';
import HorseshoeIcon from './icons/HorseshoeIcon';
import { simulateMatch } from '../services/geminiService';
import MagicWandIcon from './icons/MagicWandIcon';

type MatchToStart = ({ teamAId: string, teamBId: string } | { playerAId: string, playerBId: string }) & { description?: string };

interface LiveScoringProps {
  players: Player[];
  teams: Team[];
  addMatch: (match: Omit<Match, 'id' | 'timestamp' | 'leagueId'>) => void;
  league: League;
  matchToStart: MatchToStart | null;
  onMatchStarted: () => void;
}

type PitTeamKey = 'teamA' | 'teamB';
type AssigningSlot = { end: PitEnd; teamKey: PitTeamKey };

type EndResult = { ringers: number; points: number };


interface EndScoringControlsProps {
  score: EndResult;
  setScore: React.Dispatch<React.SetStateAction<EndResult>>;
  isDisabled: boolean;
}

const EndScoringControls: React.FC<EndScoringControlsProps> = ({ score, setScore, isDisabled }) => {
    const totalShoes = score.ringers + score.points;

    const updateScore = (field: keyof EndResult, delta: number) => {
        setScore(prev => {
            const newValue = prev[field] + delta;
            if (newValue < 0) return prev;
            const newTotal = field === 'ringers' ? newValue + prev.points : prev.ringers + newValue;
            if (newTotal > 2) return prev;
            return { ...prev, [field]: newValue };
        });
    };

    return (
        <div className={`mt-3 w-full max-w-[200px] flex flex-col items-center space-y-3 p-3 bg-brand-bg rounded-lg ${isDisabled ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-sm text-brand-text">Ringers</span>
                <div className="flex items-center space-x-2">
                    <button onClick={() => updateScore('ringers', -1)} disabled={isDisabled || score.ringers === 0} className="w-7 h-7 bg-red-600 text-white rounded-md font-bold flex items-center justify-center hover:bg-red-700 transition-colors">-</button>
                    <span className="w-8 text-center font-bold text-xl text-brand-primary">{score.ringers}</span>
                    <button onClick={() => updateScore('ringers', 1)} disabled={isDisabled || totalShoes >= 2} className="w-7 h-7 bg-green-600 text-white rounded-md font-bold flex items-center justify-center hover:bg-green-700 transition-colors">+</button>
                </div>
            </div>
            <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-sm text-brand-text">Points</span>
                 <div className="flex items-center space-x-2">
                    <button onClick={() => updateScore('points', -1)} disabled={isDisabled || score.points === 0} className="w-7 h-7 bg-red-600 text-white rounded-md font-bold flex items-center justify-center hover:bg-red-700 transition-colors">-</button>
                    <span className="w-8 text-center font-bold text-xl text-brand-primary">{score.points}</span>
                    <button onClick={() => updateScore('points', 1)} disabled={isDisabled || totalShoes >= 2} className="w-7 h-7 bg-green-600 text-white rounded-md font-bold flex items-center justify-center hover:bg-green-700 transition-colors">+</button>
                </div>
            </div>
        </div>
    );
};


const LiveScoring: React.FC<LiveScoringProps> = ({ players, teams, addMatch, league, matchToStart, onMatchStarted }) => {
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [gameState, setGameState] = useState<'setup' | 'roster-selection' | 'pit-setup' | 'playing' | 'finished'>('setup');
  
  const [teamA, setTeamA] = useState<MatchTeam | null>(null);
  const [teamB, setTeamB] = useState<MatchTeam | null>(null);
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [isPlayerMatch, setIsPlayerMatch] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [matchDescription, setMatchDescription] = useState<string | undefined>(undefined);

  const [selectedRosterA, setSelectedRosterA] = useState<string[]>([]);
  const [selectedRosterB, setSelectedRosterB] = useState<string[]>([]);

  const [liveGameState, setLiveGameState] = useState<LiveGameState | null>(null);
  const [gameStateHistory, setGameStateHistory] = useState<LiveGameState[]>([]);

  const [pitSetup, setPitSetup] = useState<PitSetup>({
    end1: { teamA: null, teamB: null },
    end2: { teamA: null, teamB: null },
  });
  const [assigningSlot, setAssigningSlot] = useState<AssigningSlot | null>(null);
  const [startingEnd, setStartingEnd] = useState<PitEnd>('end1');

  const [endScoreA, setEndScoreA] = useState<EndResult>({ ringers: 0, points: 0 });
  const [endScoreB, setEndScoreB] = useState<EndResult>({ ringers: 0, points: 0 });

  const { winScore, playersPerTeam, pointsPerRinger } = league;
  const liveMatchStorageKey = `live_match_state_${league.id}`;

  const validTeams = useMemo(() => {
    return teams.filter(team => {
        const teamPlayers = players.filter(p => p.teamId === team.id);
        return teamPlayers.length >= playersPerTeam;
    });
  }, [teams, players, playersPerTeam]);

  // Effect to resume a match from localStorage on component mount
  useEffect(() => {
    // If we're being told to start a specific new match, ignore and clear any persisted state.
    if (matchToStart) {
        localStorage.removeItem(liveMatchStorageKey);
        return;
    }

    const storedStateJSON = localStorage.getItem(liveMatchStorageKey);
    if (storedStateJSON) {
        try {
            const storedState: PersistedMatchState & { description?: string } = JSON.parse(storedStateJSON);
            setTeamA(storedState.teamA);
            setTeamB(storedState.teamB);
            setIsPlayerMatch(storedState.isPlayerMatch);
            setLiveGameState(storedState.liveGameState);
            setPitSetup(storedState.pitSetup);
            setGameStateHistory(storedState.gameStateHistory);
            setGameState(storedState.componentState);
            setMatchDescription(storedState.description);
            
            if (storedState.componentState === 'finished') {
                if (storedState.liveGameState.scoreA >= league.winScore) setWinner('A');
                else if (storedState.liveGameState.scoreB >= league.winScore) setWinner('B');
            }
        } catch (e) {
            console.error("Failed to parse persisted match state, resetting.", e);
            localStorage.removeItem(liveMatchStorageKey);
        }
    }
  }, [liveMatchStorageKey]); // Re-run if league changes, though it only runs on mount

  // Effect to save the entire match state to localStorage whenever it changes
  useEffect(() => {
    if (gameState === 'playing' || gameState === 'finished' || gameState === 'pit-setup') {
        if (teamA && teamB && liveGameState && pitSetup) {
            const stateToPersist: PersistedMatchState & { description?: string } = {
                teamA,
                teamB,
                isPlayerMatch,
                liveGameState,
                pitSetup,
                gameStateHistory,
                componentState: gameState,
                description: matchDescription,
            };
            localStorage.setItem(liveMatchStorageKey, JSON.stringify(stateToPersist));
        }
    }
  }, [gameState, teamA, teamB, liveGameState, pitSetup, gameStateHistory, isPlayerMatch, liveMatchStorageKey, matchDescription]);


  const startMatch = (rosterA: Player[], rosterB: Player[]) => {
    const [teamDataA, teamDataB] = selectedTeams;
    const newTeamA: MatchTeam = { id: teamDataA.id, name: teamDataA.name, players: rosterA };
    const newTeamB: MatchTeam = { id: teamDataB.id, name: teamDataB.name, players: rosterB };
    
    setTeamA(newTeamA);
    setTeamB(newTeamB);
    setIsPlayerMatch(false);
    
    const initialStats: PlayerStats = {};
    [...rosterA, ...rosterB].forEach(p => { initialStats[p.id] = { ringers: 0, totalShoesPitched: 0 }; });
    
    const initialLiveState: LiveGameState = {
        scoreA: 0,
        scoreB: 0,
        playerStats: initialStats,
        activeEnd: 'end1',
    };
    setLiveGameState(initialLiveState);

    if (playersPerTeam > 1) {
        setGameState('pit-setup');
    } else {
        setGameState('playing');
    }
  };

  const startMatchWithPlayers = (playerA: Player, playerB: Player) => {
    const newTeamA: MatchTeam = { id: playerA.id, name: playerA.name, players: [playerA] };
    const newTeamB: MatchTeam = { id: playerB.id, name: playerB.name, players: [playerB] };
    setTeamA(newTeamA);
    setTeamB(newTeamB);
    setIsPlayerMatch(true);

    const initialStats: PlayerStats = {};
    [playerA, playerB].forEach(p => { initialStats[p.id] = { ringers: 0, totalShoesPitched: 0 }; });

    const initialLiveState: LiveGameState = {
        scoreA: 0,
        scoreB: 0,
        playerStats: initialStats,
        activeEnd: 'end1',
    };
    setLiveGameState(initialLiveState);
    setGameState('playing');
  };

 useEffect(() => {
    if (matchToStart) {
        setMatchDescription(matchToStart.description);
        if ('teamAId' in matchToStart && teams.length > 0) {
            const teamA = teams.find(t => t.id === matchToStart.teamAId);
            const teamB = teams.find(t => t.id === matchToStart.teamBId);
            if (teamA && teamB) {
                resetGame(false); // Clear any previous game state before starting a new one
                setSelectedTeams([teamA, teamB]);
                setGameState('roster-selection');
                onMatchStarted();
            }
        } else if ('playerAId' in matchToStart && players.length > 0) {
            const playerA = players.find(p => p.id === matchToStart.playerAId);
            const playerB = players.find(p => p.id === matchToStart.playerBId);
            if (playerA && playerB) {
                resetGame(false); // Clear any previous game state
                startMatchWithPlayers(playerA, playerB);
                onMatchStarted();
            }
        }
    }
}, [matchToStart, teams, players, onMatchStarted]);

  useEffect(() => {
    if (gameState !== 'playing' || !liveGameState) return;

    const { scoreA, scoreB } = liveGameState;
    if (scoreA >= winScore) {
      setWinner('A');
      setGameState('finished');
      sendNotification('Match Finished!', { body: `${teamA?.name} won ${scoreA} to ${scoreB}.` });
    } else if (scoreB >= winScore) {
      setWinner('B');
      setGameState('finished');
      sendNotification('Match Finished!', { body: `${teamB?.name} won ${scoreB} to ${scoreA}.` });
    }
  }, [liveGameState, winScore, gameState, teamA, teamB]);

  const handleTeamSelect = (team: Team) => {
    if (selectedTeams.find(t => t.id === team.id)) {
      setSelectedTeams(selectedTeams.filter(t => t.id !== team.id));
    } else if (selectedTeams.length < 2) {
      setSelectedTeams([...selectedTeams, team]);
    }
  };

  const handleSetupMatch = () => {
    if (selectedTeams.length !== 2) return;
    setGameState('roster-selection');
  };
  
  const handleSaveAndReset = () => {
    if (teamA && teamB && winner && liveGameState) {
        const newMatch = {
            teamA,
            teamB,
            scoreA: liveGameState.scoreA,
            scoreB: liveGameState.scoreB,
            winner,
            playerStats: liveGameState.playerStats,
            description: matchDescription,
        };
        addMatch(newMatch);
        resetGame();
    }
  }

  const resetGame = (fullReset = true) => {
    if (fullReset) {
      localStorage.removeItem(liveMatchStorageKey);
    }
    setSelectedTeams([]);
    setTeamA(null);
    setTeamB(null);
    setWinner(null);
    setGameState('setup');
    setLiveGameState(null);
    setGameStateHistory([]);
    setIsPlayerMatch(false);
    setSelectedRosterA([]);
    setSelectedRosterB([]);
    setPitSetup({
      end1: { teamA: null, teamB: null },
      end2: { teamA: null, teamB: null },
    });
    setAssigningSlot(null);
    setEndScoreA({ ringers: 0, points: 0 });
    setEndScoreB({ ringers: 0, points: 0 });
    setIsSimulating(false);
    setStartingEnd('end1');
    setMatchDescription(undefined);
  }

  const handleConfirmEnd = () => {
    if (!liveGameState) return;

    setGameStateHistory(prev => [...prev, liveGameState]);

    let playerA: Player | null;
    let playerB: Player | null;
    let currentEndScoreA: EndResult;
    let currentEndScoreB: EndResult;
    const activeEnd = liveGameState.activeEnd;
    const isMultiPlayerMode = league.playersPerTeam > 1 && !isPlayerMatch;

    if (isMultiPlayerMode) {
        playerA = pitSetup[activeEnd].teamA;
        playerB = pitSetup[activeEnd].teamB;
        currentEndScoreA = endScoreA;
        currentEndScoreB = endScoreB;
    } else { // 1v1 logic
        playerA = teamA!.players[0];
        playerB = teamB!.players[0];
        currentEndScoreA = endScoreA;
        currentEndScoreB = endScoreB;
    }
    
    if (!playerA || !playerB) return;

    const newPlayerStats: PlayerStats = JSON.parse(JSON.stringify(liveGameState.playerStats));
    newPlayerStats[playerA.id].ringers += currentEndScoreA.ringers;
    newPlayerStats[playerA.id].totalShoesPitched += 2;
    newPlayerStats[playerB.id].ringers += currentEndScoreB.ringers;
    newPlayerStats[playerB.id].totalShoesPitched += 2;

    let pointsA = 0;
    let pointsB = 0;
    const liveRingersA = currentEndScoreA.ringers - currentEndScoreB.ringers;

    if (liveRingersA > 0) {
        pointsA = liveRingersA * pointsPerRinger + currentEndScoreA.points;
    } else if (liveRingersA < 0) {
        pointsB = -liveRingersA * pointsPerRinger + currentEndScoreB.points;
    } else {
        pointsA = currentEndScoreA.points;
        pointsB = currentEndScoreB.points;
    }

    const newGameState: LiveGameState = {
        scoreA: Math.min(liveGameState.scoreA + pointsA, winScore),
        scoreB: Math.min(liveGameState.scoreB + pointsB, winScore),
        playerStats: newPlayerStats,
        activeEnd: isMultiPlayerMode ? (activeEnd === 'end1' ? 'end2' : 'end1') : activeEnd,
    };

    setLiveGameState(newGameState);
    
    setEndScoreA({ ringers: 0, points: 0 });
    setEndScoreB({ ringers: 0, points: 0 });
  };
  
  const handleUndo = () => {
    if (gameStateHistory.length === 0) return;

    const lastState = gameStateHistory[gameStateHistory.length - 1];
    setLiveGameState(lastState);
    setGameStateHistory(prev => prev.slice(0, -1));
  };

  const handleAssignPlayer = (player: Player) => {
    if (!assigningSlot || !teamA || !teamB) return;

    const { end, teamKey } = assigningSlot;
    const teamPlayers = teamKey === 'teamA' ? teamA.players : teamB.players;

    const partner = teamPlayers.find(p => p.id !== player.id);
    const partnerEnd = end === 'end1' ? 'end2' : 'end1';

    setPitSetup(prev => {
        const newPitSetup: PitSetup = {
            end1: { ...prev.end1 },
            end2: { ...prev.end2 },
        };
        
        newPitSetup.end1[teamKey] = null;
        newPitSetup.end2[teamKey] = null;
        
        newPitSetup[end][teamKey] = player;
        if (partner) {
            newPitSetup[partnerEnd][teamKey] = partner;
        }

        return newPitSetup;
    });

    setAssigningSlot(null);
  };

  const handleConfirmPitSetup = () => {
    if (!liveGameState) return;

    const updatedLiveState = { ...liveGameState, activeEnd: startingEnd };

    setLiveGameState(updatedLiveState);
    setGameState('playing');
  };

  const handleQuickStart = () => {
    if (!teamA || !teamB || (league.playersPerTeam !== 2 || isPlayerMatch)) return;

    const [teamAPlayer1, teamAPlayer2] = teamA.players;
    const [teamBPlayer1, teamBPlayer2] = teamB.players;

    const newPitSetup: PitSetup = {
      end1: {
        teamA: teamAPlayer1,
        teamB: teamBPlayer1,
      },
      end2: {
        teamA: teamAPlayer2,
        teamB: teamBPlayer2,
      },
    };

    setPitSetup(newPitSetup);
    
    if (liveGameState) {
        const updatedLiveState = { ...liveGameState, activeEnd: startingEnd };
        setLiveGameState(updatedLiveState);
    }
    
    setGameState('playing');
  };

  const isPitSetupComplete = useMemo(() => {
    if (playersPerTeam === 1) return true;
    return !!(pitSetup.end1.teamA && pitSetup.end1.teamB && pitSetup.end2.teamA && pitSetup.end2.teamB);
  }, [pitSetup, playersPerTeam]);

  const rostersValid = useMemo(() => {
      return selectedRosterA.length === playersPerTeam && selectedRosterB.length === playersPerTeam;
  }, [selectedRosterA, selectedRosterB, playersPerTeam]);

  const handleSimulateMatch = async () => {
    if (!rostersValid) return;
    setIsSimulating(true);
    try {
        const rosterAPlayers = players.filter(p => selectedRosterA.includes(p.id));
        const rosterBPlayers = players.filter(p => selectedRosterB.includes(p.id));

        const simResult = await simulateMatch(rosterAPlayers, rosterBPlayers, winScore, pointsPerRinger);

        const [teamDataA, teamDataB] = selectedTeams;
        const matchTeamA: MatchTeam = { id: teamDataA.id, name: teamDataA.name, players: rosterAPlayers };
        const matchTeamB: MatchTeam = { id: teamDataB.id, name: teamDataB.name, players: rosterBPlayers };

        addMatch({
            teamA: matchTeamA,
            teamB: matchTeamB,
            scoreA: simResult.scoreA,
            scoreB: simResult.scoreB,
            winner: simResult.winner,
            playerStats: simResult.playerStats,
            description: matchDescription,
        });

        const winnerName = simResult.winner === 'A' ? matchTeamA.name : matchTeamB.name;
        alert(`Simulation Complete!\n\n${matchTeamA.name}: ${simResult.scoreA}\n${matchTeamB.name}: ${simResult.scoreB}\n\nWinner: ${winnerName}`);

        resetGame();
    } catch (e: any) {
        alert(`Simulation failed: ${e.message}`);
        setIsSimulating(false);
    }
  };


  if (validTeams.length < 2 && league.playersPerTeam > 0 && !isPlayerMatch && gameState === 'setup') {
    return (
        <div className="text-center p-8 bg-brand-surface rounded-xl max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-brand-primary mb-4">Live Match</h2>
            <p className="text-brand-text-secondary">You need at least 2 teams with {playersPerTeam} player(s) each to start a match ({validTeams.length}/2). Please set up teams in the 'Teams' section.</p>
        </div>
    )
  }

  if (gameState === 'setup') {
    if(matchToStart){
        return (
            <div className="text-center p-8 bg-brand-surface rounded-xl max-w-lg mx-auto">
                <h2 className="text-2xl font-bold text-brand-primary mb-4 animate-pulse">Loading Match...</h2>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="max-w-3xl mx-auto bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary mb-4 text-center">Start a Team Match</h2>
                <p className="text-center text-sm text-brand-text-secondary mb-6">This is the live scoring hub. Start a new match here to keep track of scores, ringers, and player stats in real-time. Once the match is complete, it will be automatically added to the match history and league standings. Select two teams below to get started.</p>
                <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 mb-6`}>
                    {validTeams.map(team => {
                        const teamPlayers = players.filter(p => p.teamId === team.id);
                        return (
                            <div key={team.id} onClick={() => handleTeamSelect(team)}
                                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${selectedTeams.find(t => t.id === team.id) ? 'bg-brand-primary text-brand-bg ring-2 ring-brand-secondary' : 'bg-brand-bg hover:bg-gray-700'}`}>
                                <div className="flex -space-x-4 justify-center mb-2">
                                    {teamPlayers.slice(0, 4).map(p => <img key={p.id} src={p.avatarUrl} alt={p.name} title={p.name} className="w-12 h-12 rounded-full border-2 border-brand-surface"/>)}
                                </div>
                                <p className="text-center font-semibold">{team.name}</p>
                            </div>
                        )
                    })}
                </div>
                <p className="text-center text-brand-text-secondary mb-4">{selectedTeams.length} / 2 teams selected</p>
                <button
                    onClick={handleSetupMatch}
                    disabled={selectedTeams.length !== 2}
                    className="w-full bg-brand-primary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-secondary transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <SwordsIcon className="w-5 h-5 mr-2"/>
                    Select Rosters & Start
                </button>
            </div>
        </div>
    )
  }

  if (gameState === 'roster-selection') {
      const [teamDataA, teamDataB] = selectedTeams;
      const teamAPlayers = players.filter(p => p.teamId === teamDataA.id);
      const teamBPlayers = players.filter(p => p.teamId === teamDataB.id);

      const handleRosterSelect = (playerId: string, team: 'A' | 'B') => {
          const roster = team === 'A' ? selectedRosterA : selectedRosterB;
          const setRoster = team === 'A' ? setSelectedRosterA : setSelectedRosterB;
          
          if (roster.includes(playerId)) {
              setRoster(roster.filter(id => id !== playerId));
          } else if (roster.length < playersPerTeam) {
              setRoster([...roster, playerId]);
          }
      };

      return (
        <div className="max-w-4xl mx-auto bg-brand-surface p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-brand-primary mb-6 text-center">Select Match Rosters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-bold text-center mb-1">{teamDataA.name}</h3>
                    <p className="text-center text-brand-text-secondary mb-4">Select {playersPerTeam} ({selectedRosterA.length}/{playersPerTeam})</p>
                    <div className="space-y-2">
                        {teamAPlayers.map(p => (
                             <label key={p.id} className={`flex items-center p-2 rounded-md cursor-pointer ${selectedRosterA.includes(p.id) ? 'bg-brand-primary text-brand-bg' : 'bg-brand-bg hover:bg-gray-700'}`}>
                                 <input type="checkbox" checked={selectedRosterA.includes(p.id)} onChange={() => handleRosterSelect(p.id, 'A')} className="form-checkbox text-brand-primary bg-brand-bg border-gray-500 rounded focus:ring-brand-secondary" />
                                 <img src={p.avatarUrl} alt={p.name} className="w-10 h-10 rounded-full mx-3" />
                                 <span className="font-medium">{p.name}</span>
                             </label>
                        ))}
                    </div>
                </div>
                 <div>
                    <h3 className="text-xl font-bold text-center mb-1">{teamDataB.name}</h3>
                    <p className="text-center text-brand-text-secondary mb-4">Select {playersPerTeam} ({selectedRosterB.length}/{playersPerTeam})</p>
                    <div className="space-y-2">
                        {teamBPlayers.map(p => (
                             <label key={p.id} className={`flex items-center p-2 rounded-md cursor-pointer ${selectedRosterB.includes(p.id) ? 'bg-brand-primary text-brand-bg' : 'bg-brand-bg hover:bg-gray-700'}`}>
                                 <input type="checkbox" checked={selectedRosterB.includes(p.id)} onChange={() => handleRosterSelect(p.id, 'B')} className="form-checkbox text-brand-primary bg-brand-bg border-gray-500 rounded focus:ring-brand-secondary" />
                                 <img src={p.avatarUrl} alt={p.name} className="w-10 h-10 rounded-full mx-3" />
                                 <span className="font-medium">{p.name}</span>
                             </label>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-8">
                <label htmlFor="match-description" className="block text-sm font-medium text-brand-text-secondary mb-1">Match Description (Optional)</label>
                <input
                    id="match-description"
                    type="text"
                    value={matchDescription || ''}
                    onChange={e => setMatchDescription(e.target.value)}
                    placeholder="e.g., Playoffs - Round 1"
                    className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
            </div>
             <div className="mt-8 pt-6 border-t border-gray-700 flex flex-col sm:flex-row justify-center gap-4">
                <button 
                    onClick={() => startMatch(players.filter(p => selectedRosterA.includes(p.id)), players.filter(p => selectedRosterB.includes(p.id)))}
                    disabled={!rostersValid} 
                    className="bg-brand-primary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-secondary transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <SwordsIcon className="w-5 h-5 mr-2"/>
                    Start Live Match
                </button>
                 <button 
                    onClick={handleSimulateMatch}
                    disabled={!rostersValid || isSimulating} 
                    className="bg-brand-secondary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-primary transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <MagicWandIcon className="w-5 h-5 mr-2"/>
                    {isSimulating ? 'Simulating...' : 'Simulate Match'}
                </button>
            </div>
             <button onClick={() => setGameState('setup')} className="mt-4 text-center w-full text-sm text-brand-text-secondary hover:underline">Back to Team Selection</button>
        </div>
      );
  }

  if (gameState === 'pit-setup') {
    const PlayerSlot: React.FC<{end: PitEnd, teamKey: PitTeamKey}> = ({ end, teamKey }) => {
        const player = pitSetup[end][teamKey];
        const teamName = teamKey === 'teamA' ? teamA?.name : teamB?.name;
        return (
            <button onClick={() => setAssigningSlot({end, teamKey})} className="w-full h-24 bg-brand-bg rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-600 hover:border-brand-primary transition-colors">
                {player ? (
                    <>
                        <img src={player.avatarUrl} alt={player.name} className="w-12 h-12 rounded-full mb-1"/>
                        <span className="text-sm font-semibold text-brand-text">{player.name}</span>
                    </>
                ) : (
                    <>
                        <span className="text-brand-text-secondary text-sm">{teamName}</span>
                        <span className="text-brand-text-secondary text-xs">Click to Assign</span>
                    </>
                )}
            </button>
        )
    };
    const teamAPlayers = teamA?.players || [];
    const teamBPlayers = teamB?.players || [];

    const availablePlayers = assigningSlot ? (assigningSlot.teamKey === 'teamA' ? teamAPlayers : teamBPlayers) : [];

    return (
        <>
            <div className="max-w-2xl mx-auto bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary mb-1 text-center">Set Up The Pit</h2>
                <p className="text-center text-brand-text-secondary mb-6 text-sm">Assign players to their starting ends. Partners will be automatically placed on opposite ends.</p>
                
                <div className="space-y-6">
                    <div>
                        <h3 className="font-bold text-lg text-brand-text mb-3 text-center">End 1</h3>
                        <div className="flex items-center gap-4">
                            <PlayerSlot end="end1" teamKey="teamA" />
                            <span className="font-bold text-brand-text-secondary">VS</span>
                            <PlayerSlot end="end1" teamKey="teamB" />
                        </div>
                    </div>
                     <div>
                        <h3 className="font-bold text-lg text-brand-text mb-3 text-center">End 2</h3>
                        <div className="flex items-center gap-4">
                            <PlayerSlot end="end2" teamKey="teamA" />
                            <span className="font-bold text-brand-text-secondary">VS</span>
                            <PlayerSlot end="end2" teamKey="teamB" />
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-700">
                    <h3 className="text-lg font-bold text-center text-brand-text mb-3">Select Starting End</h3>
                    <div className="flex justify-center bg-brand-bg p-1 rounded-lg max-w-xs mx-auto">
                        <button
                            onClick={() => setStartingEnd('end1')}
                            className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors ${startingEnd === 'end1' ? 'bg-brand-primary text-brand-bg' : 'text-brand-text-secondary hover:bg-gray-700'}`}
                        >
                            End 1
                        </button>
                        <button
                            onClick={() => setStartingEnd('end2')}
                            className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors ${startingEnd === 'end2' ? 'bg-brand-primary text-brand-bg' : 'text-brand-text-secondary hover:bg-gray-700'}`}
                        >
                            End 2
                        </button>
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={handleQuickStart}
                        className="w-full bg-brand-secondary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-primary transition-colors flex items-center justify-center"
                    >
                        🚀 Quick Start
                    </button>
                    <button
                        onClick={handleConfirmPitSetup}
                        disabled={!isPitSetupComplete}
                        className="w-full bg-brand-primary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-secondary transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        Confirm Setup & Start
                    </button>
                </div>
            </div>

            {assigningSlot && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setAssigningSlot(null)}>
                    <div className="bg-brand-surface rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-brand-primary mb-4">Assign Player</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {availablePlayers.map(p => (
                                <div key={p.id} onClick={() => handleAssignPlayer(p)} className="p-3 rounded-lg cursor-pointer bg-brand-bg hover:bg-gray-700 transition-colors">
                                    <img src={p.avatarUrl} alt={p.name} className="w-20 h-20 rounded-full mx-auto mb-2"/>
                                    <p className="text-center font-semibold text-brand-text">{p.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
  }
  
  const renderPlayingContent = () => {
    if (!liveGameState) {
        return <div className="text-center p-8 text-brand-text-secondary">Loading live match...</div>
    }
    const { scoreA, scoreB, playerStats, activeEnd } = liveGameState;
    const isMultiPlayerMode = league.playersPerTeam > 1 && !isPlayerMatch;

    const PlayerInfoCard: React.FC<{player: Player | null, isScoring: boolean}> = ({ player, isScoring }) => {
        if (!player) return null;
        return (
            <div className={`bg-brand-bg rounded-lg p-4 flex flex-col items-center w-full transition-all duration-300 ${isScoring ? 'shadow-lg' : 'opacity-60'}`}>
                <img src={player.avatarUrl} alt={player.name} className={`w-20 h-20 rounded-full mb-2 border-2 ${isScoring ? 'border-brand-primary' : 'border-gray-600'}`}/>
                <p className="font-semibold text-brand-text text-lg mb-2 truncate max-w-full text-center">{player.name}</p>
                <div className="flex items-center text-brand-text-secondary">
                    <HorseshoeIcon className="w-5 h-5 mr-2 text-brand-primary"/>
                    <span className="font-bold text-lg">{playerStats[player.id]?.ringers || 0}</span>
                    <span className="text-sm ml-2">Ringers</span>
                </div>
            </div>
        );
    };
    
    return (
        <div className="space-y-6">
            <div className="flex justify-around items-center text-center bg-brand-surface p-4 rounded-xl">
                 <div>
                    <h3 className="text-xl font-bold text-brand-text-secondary mb-2">{teamA?.name}</h3>
                    <p className="text-7xl font-bold text-brand-primary">{scoreA}</p>
                </div>
                 <div className="text-4xl font-light text-brand-text-secondary">VS</div>
                <div>
                    <h3 className="text-xl font-bold text-brand-text-secondary mb-2">{teamB?.name}</h3>
                    <p className="text-7xl font-bold text-brand-primary">{scoreB}</p>
                </div>
            </div>

            <div className="bg-brand-surface p-6 rounded-xl">
                 <h2 className="text-2xl font-bold text-brand-primary mb-4 text-center">
                    Scoring
                </h2>
                <div className="mb-6 max-w-md mx-auto">
                    <input
                        type="text"
                        value={matchDescription || ''}
                        onChange={e => setMatchDescription(e.target.value)}
                        placeholder="Optional: Match description"
                        className="w-full text-center bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                </div>

                {!isMultiPlayerMode && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <div className="flex flex-col items-center">
                           <PlayerInfoCard player={teamA!.players[0]} isScoring={true} />
                           <EndScoringControls score={endScoreA} setScore={setEndScoreA} isDisabled={gameState==='finished'} />
                        </div>
                         <div className="flex flex-col items-center">
                           <PlayerInfoCard player={teamB!.players[0]} isScoring={true} />
                           <EndScoringControls score={endScoreB} setScore={setEndScoreB} isDisabled={gameState==='finished'} />
                        </div>
                    </div>
                )}
                
                {isMultiPlayerMode && isPitSetupComplete && (
                    <div className="space-y-8">
                        {/* END 1 */}
                        <div className={`p-4 rounded-lg border-2 transition-all duration-300 ${activeEnd === 'end1' ? 'border-brand-primary' : 'border-gray-700'}`}>
                            <h3 className="font-bold text-lg text-brand-text mb-3 text-center">End 1 {activeEnd === 'end1' && <span className="text-xs font-semibold text-brand-primary tracking-wider uppercase"> (Active)</span>}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="flex flex-col items-center space-y-3">
                                   <PlayerInfoCard player={pitSetup.end1.teamA} isScoring={activeEnd === 'end1'} />
                                   {activeEnd === 'end1' && <EndScoringControls score={endScoreA} setScore={setEndScoreA} isDisabled={gameState==='finished'} />}
                                </div>
                                 <div className="flex flex-col items-center space-y-3">
                                   <PlayerInfoCard player={pitSetup.end1.teamB} isScoring={activeEnd === 'end1'} />
                                   {activeEnd === 'end1' && <EndScoringControls score={endScoreB} setScore={setEndScoreB} isDisabled={gameState==='finished'} />}
                                </div>
                            </div>
                        </div>
                        {/* END 2 */}
                        <div className={`p-4 rounded-lg border-2 transition-all duration-300 ${activeEnd === 'end2' ? 'border-brand-primary' : 'border-gray-700'}`}>
                            <h3 className="font-bold text-lg text-brand-text mb-3 text-center">End 2 {activeEnd === 'end2' && <span className="text-xs font-semibold text-brand-primary tracking-wider uppercase"> (Active)</span>}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="flex flex-col items-center space-y-3">
                                   <PlayerInfoCard player={pitSetup.end2.teamA} isScoring={activeEnd === 'end2'} />
                                   {activeEnd === 'end2' && <EndScoringControls score={endScoreA} setScore={setEndScoreA} isDisabled={gameState==='finished'} />}
                                </div>
                                 <div className="flex flex-col items-center space-y-3">
                                   <PlayerInfoCard player={pitSetup.end2.teamB} isScoring={activeEnd === 'end2'} />
                                   {activeEnd === 'end2' && <EndScoringControls score={endScoreB} setScore={setEndScoreB} isDisabled={gameState==='finished'} />}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                 <div className="text-center mt-8 flex justify-center items-center gap-4">
                    <button onClick={handleUndo} disabled={gameStateHistory.length === 0 || gameState === 'finished'} className="bg-gray-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-800 disabled:cursor-not-allowed">
                        Undo Last End
                    </button>
                    <button onClick={handleConfirmEnd} disabled={gameState==='finished'} className="bg-brand-secondary text-brand-bg font-bold py-3 px-12 rounded-lg hover:bg-brand-primary transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                        Confirm & Next
                    </button>
                </div>
            </div>
        </div>
    );
  }

  // FIX: This block had a redundant check for 'pit-setup' which is handled by a prior block, causing a type error.
  // The check and the ternary for 'pit-setup' were removed, simplifying the logic.
  if (gameState === 'playing' || gameState === 'finished') {
    return (
        <div className="max-w-4xl mx-auto">
            {renderPlayingContent()}
            {gameState === 'finished' && winner && (
                <div className="mt-8 text-center bg-brand-primary text-brand-bg p-6 rounded-xl shadow-lg animate-pulse">
                    <h2 className="text-4xl font-extrabold">WINNER!</h2>
                    <p className="text-2xl mt-2">{winner === 'A' ? teamA?.name : teamB?.name} takes the victory!</p>

                    <button onClick={handleSaveAndReset} className="mt-6 bg-brand-bg text-brand-primary font-bold py-2 px-8 rounded-lg hover:bg-gray-800 transition-colors">
                        Save Match & Start New
                    </button>
                </div>
            )}
        </div>
      )
  }

  return null;
};

export default LiveScoring;