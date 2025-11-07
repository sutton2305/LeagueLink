import React, { useMemo } from 'react';
import { League, Player, Team, Match, TeamStanding, PlayerStatsData } from '../types';
import TrophyIcon from './icons/TrophyIcon';
import UsersIcon from './icons/UsersIcon';
import { MatchHistoryIcon } from './icons/MatchHistoryIcon';
import HorseshoeIcon from './icons/HorseshoeIcon';

interface HomeProps {
    league: League;
    players: Player[];
    teams: Team[];
    matches: Match[];
    onStartMatch: (teamAId: string, teamBId: string) => void;
}

const Home: React.FC<HomeProps> = ({ league, players, teams, matches, onStartMatch }) => {
    
    const ringerLeaders = useMemo(() => {
        if (players.length === 0 || matches.length === 0) return [];
        
        const stats: Record<string, { ringers: number, totalShoesPitched: number }> = {};
        
        players.forEach(p => { 
            stats[p.id] = { ringers: 0, totalShoesPitched: 0 }; 
        });

        matches.forEach(match => {
            Object.entries(match.playerStats).forEach(([playerId, pStats]) => {
                if(stats[playerId]) {
                    // FIX: Cast pStats to PlayerStatsData to access its properties safely as its type is inferred as 'unknown'.
                    const pStatsData = pStats as PlayerStatsData;
                    stats[playerId].ringers += pStatsData.ringers;
                    stats[playerId].totalShoesPitched += pStatsData.totalShoesPitched;
                }
            });
        });

        const MIN_SHOES_PITCHED = 20;

        return Object.entries(stats)
            .map(([playerId, pStats]) => {
                const playerInfo = players.find(p => p.id === playerId);
                return {
                    ...pStats,
                    playerId,
                    name: playerInfo?.name || 'Unknown',
                    avatarUrl: playerInfo?.avatarUrl || '',
                    ringerPercentage: pStats.totalShoesPitched > 0 ? (pStats.ringers / pStats.totalShoesPitched) * 100 : 0,
                }
            })
            .filter(p => p.totalShoesPitched >= MIN_SHOES_PITCHED)
            .sort((a, b) => b.ringerPercentage - a.ringerPercentage)
            .slice(0, 3);

    }, [players, matches]);

    const standings = useMemo<TeamStanding[]>(() => {
        const stats: Record<string, Omit<TeamStanding, 'teamName' | 'players'>> = {};
        teams.forEach(team => {
            stats[team.id] = { teamId: team.id, wins: 0, losses: 0, gamesPlayed: 0, pointsFor: 0, pointsAgainst: 0, pointDifferential: 0 };
        });

        matches.forEach(match => {
            const teamAId = match.teamA.id;
            const teamBId = match.teamB.id;
            if (!stats[teamAId] || !stats[teamBId]) return;
            stats[teamAId].gamesPlayed++;
            stats[teamBId].gamesPlayed++;
            if (match.winner === 'A') {
                stats[teamAId].wins++;
                stats[teamBId].losses++;
            } else {
                stats[teamBId].wins++;
                stats[teamAId].losses++;
            }
        });

        return Object.values(stats)
            .map(teamStat => ({
                ...teamStat,
                teamName: teams.find(t => t.id === teamStat.teamId)?.name || 'Unknown',
                players: players.filter(p => p.teamId === teamStat.teamId),
            }))
            .sort((a, b) => b.wins - a.wins)
            .slice(0, 4);

    }, [matches, teams, players]);


    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold text-brand-text mb-2">Welcome to <span className="text-brand-primary">{league.name}</span></h1>
            <p className="text-lg text-brand-text-secondary mb-8">Here's a quick overview of your league.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-brand-surface p-6 rounded-xl shadow-lg flex items-center">
                    <UsersIcon className="w-12 h-12 text-brand-primary mr-4"/>
                    <div>
                        <p className="text-3xl font-bold">{players.length}</p>
                        <p className="text-brand-text-secondary">Players</p>
                    </div>
                </div>
                <div className="bg-brand-surface p-6 rounded-xl shadow-lg flex items-center">
                    <TrophyIcon className="w-12 h-12 text-brand-primary mr-4"/>
                    <div>
                        <p className="text-3xl font-bold">{teams.length}</p>
                        <p className="text-brand-text-secondary">Teams</p>
                    </div>
                </div>
                 <div className="bg-brand-surface p-6 rounded-xl shadow-lg flex items-center">
                    <MatchHistoryIcon className="w-12 h-12 text-brand-primary mr-4"/>
                    <div>
                        <p className="text-3xl font-bold">{matches.length}</p>
                        <p className="text-brand-text-secondary">Matches Played</p>
                    </div>
                </div>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-brand-surface p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-brand-primary mb-4 flex items-center">
                        <HorseshoeIcon className="w-6 h-6 mr-2" />
                        Ringer % Leaders
                    </h2>
                    {ringerLeaders.length > 0 ? (
                         <div className="space-y-3">
                            {ringerLeaders.map((player, index) => (
                                <div key={player.playerId} className="flex items-center bg-brand-bg p-2 rounded-lg">
                                    <span className="font-bold text-lg w-8 text-center">{index + 1}</span>
                                    <img src={player.avatarUrl} alt={player.name} className="w-12 h-12 rounded-full mx-3"/>
                                    <div className="flex-grow">
                                        <p className="font-semibold">{player.name}</p>
                                        <p className="text-xs text-brand-text-secondary">{player.ringers} Ringers / {player.totalShoesPitched} Thrown</p>
                                    </div>
                                    <span className="text-xl font-bold text-brand-primary">{player.ringerPercentage.toFixed(1)}%</span>
                                </div>
                            ))}
                         </div>
                    ) : <p className="text-brand-text-secondary">Play some matches to see the leaders! (min. 20 shoes pitched)</p>}
                </div>
                <div className="bg-brand-surface p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-brand-primary mb-4 flex items-center">
                        <TrophyIcon className="w-6 h-6 mr-2" />
                        League Standings
                    </h2>
                    {standings.length > 0 && standings.some(s => s.gamesPlayed > 0) ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-brand-text-secondary px-2">
                                <span className="col-span-1">#</span>
                                <span className="col-span-7">Team</span>
                                <span className="col-span-2 text-center">W</span>
                                <span className="col-span-2 text-center">L</span>
                            </div>
                             {standings.map((team, index) => (
                                <div key={team.teamId} className="grid grid-cols-12 gap-2 items-center bg-brand-bg p-2 rounded-lg">
                                    <span className="col-span-1 font-bold">{index + 1}</span>
                                    <span className="col-span-7 font-semibold truncate">{team.teamName}</span>
                                    <span className="col-span-2 text-center font-medium text-green-400">{team.wins}</span>
                                    <span className="col-span-2 text-center font-medium text-red-400">{team.losses}</span>
                                </div>
                             ))}
                        </div>
                    ) : <p className="text-brand-text-secondary">No matches played yet. The standings will appear here.</p>}
                </div>
            </div>
        </div>
    );
};

export default Home;