import React, { useMemo } from 'react';
import { Match, Player, PlayerStatsData } from '../types';
import TrophyIcon from './icons/TrophyIcon';
import HorseshoeIcon from './icons/HorseshoeIcon';

interface PlayerStatsProps {
    matches: Match[];
    players: Player[];
}

const PlayerStats: React.FC<PlayerStatsProps> = ({ matches, players }) => {
    const playerStats = useMemo(() => {
        const stats: Record<string, { ringers: number, gamesPlayed: number, wins: number, teamId: string | null, totalShoesPitched: number }> = {};

        players.forEach(p => {
            stats[p.id] = { ringers: 0, gamesPlayed: 0, wins: 0, teamId: p.teamId, totalShoesPitched: 0 };
        });

        matches.forEach(match => {
            Object.entries(match.playerStats).forEach(([playerId, pStats]) => {
                if (stats[playerId]) {
                    // FIX: Cast pStats to PlayerStatsData to access its properties safely as its type is inferred as 'unknown'.
                    const pStatsData = pStats as PlayerStatsData;
                    stats[playerId].ringers += pStatsData.ringers;
                    stats[playerId].totalShoesPitched += pStatsData.totalShoesPitched;
                    stats[playerId].gamesPlayed += 1;
                    
                    const isWinner = (match.winner === 'A' && match.teamA.players.some(p => p.id === playerId)) ||
                                     (match.winner === 'B' && match.teamB.players.some(p => p.id === playerId));
                    
                    if(isWinner) {
                        stats[playerId].wins += 1;
                    }
                }
            });
        });

        return Object.entries(stats)
            .map(([playerId, stat]) => {
                const playerInfo = players.find(p => p.id === playerId);
                return {
                    ...stat,
                    playerId,
                    name: playerInfo?.name || 'Unknown',
                    avatarUrl: playerInfo?.avatarUrl || '',
                    winRate: stat.gamesPlayed > 0 ? (stat.wins / stat.gamesPlayed) * 100 : 0,
                    ringerPercentage: stat.totalShoesPitched > 0 ? (stat.ringers / stat.totalShoesPitched) * 100 : 0,
                };
            })
            .sort((a, b) => b.ringers - a.ringers);
    }, [matches, players]);

    return (
        <div className="max-w-4xl mx-auto bg-brand-surface p-6 rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold text-brand-primary mb-6 flex items-center">
                <TrophyIcon className="w-8 h-8 mr-3" />
                Player Leaderboard
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b-2 border-brand-primary">
                        <tr>
                            <th className="p-3 text-sm font-semibold tracking-wide text-center">Rank</th>
                            <th className="p-3 text-sm font-semibold tracking-wide">Player</th>
                            <th className="p-3 text-sm font-semibold tracking-wide text-center">GP</th>
                            <th className="p-3 text-sm font-semibold tracking-wide text-center">Win %</th>
                            <th className="p-3 text-sm font-semibold tracking-wide text-center flex items-center justify-center">
                                <HorseshoeIcon className="w-4 h-4 mr-1" />
                                Ringers
                            </th>
                            <th className="p-3 text-sm font-semibold tracking-wide text-center">Ringer %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {playerStats.filter(s => s.gamesPlayed > 0).map((stat, index) => (
                             <tr key={stat.playerId} className="hover:bg-brand-bg">
                                <td className="p-3 text-center font-bold text-lg">{index + 1}</td>
                                <td className="p-3">
                                    <div className="flex items-center space-x-3">
                                        <img src={stat.avatarUrl} alt={stat.name} className="w-10 h-10 rounded-full" />
                                        <span className="font-medium">{stat.name}</span>
                                    </div>
                                </td>
                                <td className="p-3 text-center">{stat.gamesPlayed}</td>
                                <td className="p-3 text-center">{stat.winRate.toFixed(1)}%</td>
                                <td className="p-3 text-center font-bold text-brand-primary text-lg">{stat.ringers}</td>
                                <td className="p-3 text-center">{stat.ringerPercentage.toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {playerStats.filter(s => s.gamesPlayed > 0).length === 0 && <p className="text-center text-brand-text-secondary py-10">No player stats to show yet. Play some matches!</p>}
            </div>
        </div>
    );
};

export default PlayerStats;