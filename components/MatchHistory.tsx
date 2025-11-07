
import React, { useState } from 'react';
import { Match, Player } from '../types';
import { MatchHistoryIcon } from './icons/MatchHistoryIcon';
import { generateMatchCommentary } from '../services/geminiService';
import HorseshoeIcon from './icons/HorseshoeIcon';

interface MatchHistoryProps {
  matches: Match[];
}

const PlayerStatLine: React.FC<{player: Player, stats: { ringers: number }}> = ({ player, stats }) => (
    <div className="flex items-center text-sm text-brand-text-secondary">
        <span>{player.name}:</span>
        <div className="flex items-center ml-auto">
            <span className="mr-1 font-semibold">{stats.ringers}</span>
            <HorseshoeIcon className="w-4 h-4 text-brand-primary" />
        </div>
    </div>
);

const MatchCard: React.FC<{ match: Match }> = ({ match }) => {
    const [commentary, setCommentary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateCommentary = async () => {
        setIsLoading(true);
        const result = await generateMatchCommentary(match);
        setCommentary(result);
        setIsLoading(false);
    }
    
    const teamAName = match.teamA.name;
    const teamBName = match.teamB.name;
    const isTeamAWinner = match.winner === 'A';

    return (
        <div className="bg-brand-bg p-4 rounded-lg shadow-md border border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-brand-text-secondary">{new Date(match.timestamp).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-5 items-center justify-between gap-4">
                <div className={`col-span-2 text-center p-2 rounded-lg ${isTeamAWinner ? 'bg-yellow-900/50' : ''}`}>
                    <p className="font-semibold">{teamAName}</p>
                </div>
                <div className="col-span-1 flex items-center justify-center">
                    <div className={`text-2xl font-bold ${isTeamAWinner ? 'text-brand-primary' : 'text-brand-text'}`}>{match.scoreA}</div>
                    <div className="text-xl font-light text-brand-text-secondary mx-3">vs</div>
                    <div className={`text-2xl font-bold ${!isTeamAWinner ? 'text-brand-primary' : 'text-brand-text'}`}>{match.scoreB}</div>
                </div>
                <div className={`col-span-2 text-center p-2 rounded-lg ${!isTeamAWinner ? 'bg-yellow-900/50' : ''}`}>
                    <p className="font-semibold">{teamBName}</p>
                </div>
            </div>
            {match.description && (
                <div className="text-center text-sm text-brand-text-secondary italic mt-3 pt-2 border-t border-gray-700/50">
                    {match.description}
                </div>
            )}
             <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                 <h4 className="col-span-full text-xs font-bold uppercase text-brand-text-secondary mb-1">Player Stats</h4>
                {match.teamA.players.map(p => <PlayerStatLine key={p.id} player={p} stats={match.playerStats[p.id]}/>)}
                {match.teamB.players.map(p => <PlayerStatLine key={p.id} player={p} stats={match.playerStats[p.id]}/>)}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
                {commentary ? (
                    <div className="text-brand-text-secondary italic p-3 bg-gray-800 rounded-md">
                        <p className="font-bold text-brand-primary mb-1">AI Commentary:</p>
                        {commentary}
                    </div>
                ) : (
                    <button onClick={handleGenerateCommentary} disabled={isLoading}
                        className="w-full text-sm bg-brand-primary text-brand-bg font-bold py-2 px-4 rounded-lg hover:bg-brand-secondary transition-colors disabled:bg-gray-600">
                        {isLoading ? 'Generating...' : '✨ Generate AI Commentary'}
                    </button>
                )}
            </div>
        </div>
    )
}

const MatchHistory: React.FC<MatchHistoryProps> = ({ matches }) => {
  const sortedMatches = [...matches].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-brand-surface p-6 rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold text-brand-primary mb-6 flex items-center">
          <MatchHistoryIcon className="w-8 h-8 mr-3" />
          Match History
        </h2>
        {sortedMatches.length > 0 ? (
          <div className="space-y-4">
            {sortedMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <p className="text-brand-text-secondary text-center py-10">No matches have been recorded in this league yet.</p>
        )}
      </div>
    </div>
  );
};

export default MatchHistory;