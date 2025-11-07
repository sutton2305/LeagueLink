import React, { useMemo } from 'react';
import { Match, TeamStanding, Player, Team } from '../types';
import TrophyIcon from './icons/TrophyIcon';

interface StandingsProps {
  matches: Match[];
  teams: Team[];
  players: Player[];
}

const Standings: React.FC<StandingsProps> = ({ matches, teams, players }) => {
  const standingsData = useMemo<TeamStanding[]>(() => {
    const stats: Record<string, Omit<TeamStanding, 'teamName' | 'players'>> = {};

    teams.forEach(team => {
        stats[team.id] = { teamId: team.id, wins: 0, losses: 0, gamesPlayed: 0, pointsFor: 0, pointsAgainst: 0, pointDifferential: 0 };
    });

    matches.forEach(match => {
        const teamAId = match.teamA.id;
        const teamBId = match.teamB.id;
        
        if (!stats[teamAId] || !stats[teamBId]) return;

        stats[teamAId].gamesPlayed += 1;
        stats[teamBId].gamesPlayed += 1;
        stats[teamAId].pointsFor += match.scoreA;
        stats[teamAId].pointsAgainst += match.scoreB;
        stats[teamBId].pointsFor += match.scoreB;
        stats[teamBId].pointsAgainst += match.scoreA;

        if (match.winner === 'A') {
            stats[teamAId].wins += 1;
            stats[teamBId].losses += 1;
        } else {
            stats[teamBId].wins += 1;
            stats[teamAId].losses += 1;
        }

        stats[teamAId].pointDifferential = stats[teamAId].pointsFor - stats[teamAId].pointsAgainst;
        stats[teamBId].pointDifferential = stats[teamBId].pointsFor - stats[teamBId].pointsAgainst;
    });

    return Object.values(stats).map(teamStat => {
        const teamInfo = teams.find(t => t.id === teamStat.teamId);
        const teamPlayers = players.filter(p => p.teamId === teamStat.teamId);
        return {
            ...teamStat,
            teamName: teamInfo?.name || 'Unknown Team',
            players: teamPlayers
        }
    }).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointDifferential - a.pointDifferential;
    });
  }, [matches, teams, players]);

  return (
    <div className="max-w-6xl mx-auto bg-brand-surface p-6 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold text-brand-primary mb-6 flex items-center">
        <TrophyIcon className="w-8 h-8 mr-3"/>
        League Standings
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b-2 border-brand-primary">
            <tr>
              <th className="p-3 text-sm font-semibold tracking-wide text-center">Rank</th>
              <th className="p-3 text-sm font-semibold tracking-wide">Team</th>
              <th className="p-3 text-sm font-semibold tracking-wide text-center">GP</th>
              <th className="p-3 text-sm font-semibold tracking-wide text-center">W</th>
              <th className="p-3 text-sm font-semibold tracking-wide text-center">L</th>
              <th className="p-3 text-sm font-semibold tracking-wide text-center">PF</th>
              <th className="p-3 text-sm font-semibold tracking-wide text-center">PA</th>
              <th className="p-3 text-sm font-semibold tracking-wide text-center">PD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {standingsData.filter(t => t.gamesPlayed > 0).length > 0 ? standingsData.filter(t => t.gamesPlayed > 0).map((team, index) => (
              <tr key={team.teamId} className="hover:bg-brand-bg">
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <span className={`font-bold text-lg ${index === 0 ? 'text-brand-primary' : ''}`}>
                      {index + 1}
                    </span>
                    {index === 0 && <TrophyIcon className="w-5 h-5 text-brand-primary" />}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    {team.players.length > 0 && <img src={team.players[0].avatarUrl} alt="" className="w-8 h-8 rounded-full border-2 border-gray-500" />}
                    {team.players.length > 1 && <img src={team.players[1].avatarUrl} alt="" className="w-8 h-8 rounded-full border-2 border-gray-500 -ml-4" />}
                    <span className="font-medium">{team.teamName}</span>
                  </div>
                </td>
                <td className="p-3 text-center">{team.gamesPlayed}</td>
                <td className="p-3 text-center font-semibold text-green-400">{team.wins}</td>
                <td className="p-3 text-center text-red-400">{team.losses}</td>
                <td className="p-3 text-center text-brand-text-secondary">{team.pointsFor}</td>
                <td className="p-3 text-center text-brand-text-secondary">{team.pointsAgainst}</td>
                <td className={`p-3 text-center font-bold ${team.pointDifferential > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {team.pointDifferential > 0 ? '+' : ''}{team.pointDifferential}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="text-center py-10 text-brand-text-secondary">
                  No matches played yet. Go to 'Live Match' to record a game.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Standings;