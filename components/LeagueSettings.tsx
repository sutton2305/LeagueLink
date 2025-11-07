
import React, { useState } from 'react';
import { League, Player, Team, Match, TournamentBracket, TeamStanding, PlayerStatsData } from '../types';
import RepeatIcon from './icons/RepeatIcon';
import DownloadIcon from './icons/DownloadIcon';
import TrophyIcon from './icons/TrophyIcon';

interface LeagueSettingsProps {
    league: League;
    onRolloverLeague: (sourceLeagueId: string, newLeagueName: string, keepTeams: boolean) => void;
    players: Player[];
    teams: Team[];
    matches: Match[];
    brackets: TournamentBracket[];
}

const LeagueSettings: React.FC<LeagueSettingsProps> = ({ league, onRolloverLeague, players, teams, matches, brackets }) => {
    const [leagueName, setLeagueName] = useState(league.name);
    const [winScore, setWinScore] = useState(league.winScore.toString());
    const [playersPerTeam, setPlayersPerTeam] = useState<number>(league.playersPerTeam);
    const [pointsPerRinger, setPointsPerRinger] = useState(league.pointsPerRinger.toString());

    const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
    const [newLeagueName, setNewLeagueName] = useState(`${league.name} ${new Date().getFullYear() + 1}`);
    const [keepTeams, setKeepTeams] = useState(true);

    const handleSave = () => {
        // In a real app, this would call a function from props to update state in App.tsx
        alert('Settings saved! (This is a mock-up, functionality is not fully implemented)');
    };

    const handleDelete = () => {
         if (window.confirm('Are you sure you want to delete this league? This action cannot be undone.')) {
            alert('League deleted! (This is a mock-up, functionality is not fully implemented)');
         }
    }

    const handleCopyId = () => {
        navigator.clipboard.writeText(league.id)
            .then(() => alert('League ID copied to clipboard!'))
            .catch(err => {
                console.error('Failed to copy: ', err);
                alert('Failed to copy ID.');
            });
    };
    
    const handleConfirmRollover = () => {
        if (!newLeagueName.trim()) {
            alert('Please enter a name for the new season.');
            return;
        }
        onRolloverLeague(league.id, newLeagueName, keepTeams);
        setIsRolloverModalOpen(false);
    }

    const openRolloverModal = () => {
        setNewLeagueName(`${league.name} ${new Date().getFullYear() + 1}`);
        setKeepTeams(true);
        setIsRolloverModalOpen(true);
    };

    const handleDownloadReport = () => {
        // --- DATA AGGREGATION ---
        // 1. Champions
        const champions = brackets.map(bracket => {
            let winnerName = 'N/A';
            const participantsMap = new Map(bracket.participants.map(p => [p.id, p.name]));
            if (bracket.type === 'round-robin') {
                const standings: Record<string, number> = {};
                bracket.participants.forEach(p => { standings[p.id] = 0; });
                // FIX: The type of `m.winnerId` is `string | null`. A `typeof` check is needed
                // to safely use it as an index for the `standings` object.
                bracket.matches?.forEach(m => { if (typeof m.winnerId === 'string') standings[m.winnerId]++; });
                const winnerId = Object.entries(standings).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
                if (winnerId) winnerName = participantsMap.get(winnerId) || 'Unknown';
            } else {
                const finalMatch = bracket.rounds?.[bracket.rounds.length - 1]?.[0];
                // FIX: The type of `finalMatch.winnerId` is `string | null`. A `typeof` check is needed
                // to safely pass it to `participantsMap.get`, which expects a `string`.
                if (finalMatch?.winnerId && typeof finalMatch.winnerId === 'string') {
                    winnerName = participantsMap.get(finalMatch.winnerId) || 'Unknown';
                }
            }
            return { name: bracket.name, winner: winnerName };
        }).filter(c => c.winner !== 'N/A');

        // 2. Final Standings
        const standingsData = (() => {
            const stats: Record<string, Omit<TeamStanding, 'teamName' | 'players'>> = {};
            teams.forEach(team => { stats[team.id] = { teamId: team.id, wins: 0, losses: 0, gamesPlayed: 0, pointsFor: 0, pointsAgainst: 0, pointDifferential: 0 }; });
            matches.forEach(match => {
                const teamAId = match.teamA.id; const teamBId = match.teamB.id;
                if (!stats[teamAId] || !stats[teamBId]) return;
                stats[teamAId].gamesPlayed++; stats[teamBId].gamesPlayed++;
                stats[teamAId].pointsFor += match.scoreA; stats[teamAId].pointsAgainst += match.scoreB;
                stats[teamBId].pointsFor += match.scoreB; stats[teamBId].pointsAgainst += match.scoreA;
                if (match.winner === 'A') { stats[teamAId].wins++; stats[teamBId].losses++; } else { stats[teamBId].wins++; stats[teamAId].losses++; }
                stats[teamAId].pointDifferential = stats[teamAId].pointsFor - stats[teamAId].pointsAgainst;
                stats[teamBId].pointDifferential = stats[teamBId].pointsFor - stats[teamBId].pointsAgainst;
            });
            return Object.values(stats).map(ts => ({ ...ts, teamName: teams.find(t => t.id === ts.teamId)?.name || '?' })).sort((a, b) => b.wins - a.wins || b.pointDifferential - a.pointDifferential);
        })();

        // 3. Player Leaderboard
        const playerStats = (() => {
            const stats: Record<string, { ringers: number, gamesPlayed: number, totalShoesPitched: number }> = {};
            players.forEach(p => { stats[p.id] = { ringers: 0, gamesPlayed: 0, totalShoesPitched: 0 }; });
            matches.forEach(match => {
                const playerIdsInMatch = [...match.teamA.players, ...match.teamB.players].map(p => p.id);
                Object.entries(match.playerStats).forEach(([playerId, pStats]) => {
                    if (stats[playerId]) {
                        // Cast pStats to PlayerStatsData to access its properties safely, as its type is inferred as 'unknown'.
                        const pStatsData = pStats as PlayerStatsData;
                        stats[playerId].ringers += pStatsData.ringers;
                        stats[playerId].totalShoesPitched += pStatsData.totalShoesPitched;
                    }
                });
                playerIdsInMatch.forEach(id => { if (stats[id]) stats[id].gamesPlayed++; });
            });
            return Object.entries(stats).map(([playerId, stat]) => ({ ...stat, playerId, name: players.find(p => p.id === playerId)?.name || '?', ringerPercentage: stat.totalShoesPitched > 0 ? (stat.ringers / stat.totalShoesPitched) * 100 : 0, })).sort((a, b) => b.ringers - a.ringers);
        })();
        
        // 4. Match History
        const sortedMatches = [...matches].sort((a, b) => a.timestamp - b.timestamp);
        
        // --- HTML & PDF GENERATION ---
        let htmlContent = `
            <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Season Report: ${league.name}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #1a1a1a; color: #f5f5f5; padding: 1.5rem; -webkit-print-color-adjust: exact; color-adjust: exact; }
                @media print { body { background-color: #1a1a1a !important; color: #f5f5f5 !important; } }
                h1, h2 { color: #facc15; border-bottom: 2px solid #2a2a2a; padding-bottom: 0.5rem; margin-top: 2rem; }
                h1 { font-size: 2.25rem; } h2 { font-size: 1.75rem; }
                table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
                th, td { border: 1px solid #4a4a4a; padding: 0.75rem; text-align: left; }
                th { background-color: #2a2a2a; font-weight: bold; }
                tr:nth-child(even) { background-color: #222; }
                ul { list-style-type: none; padding: 0; }
                li { background-color: #2a2a2a; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem; }
                .rank { text-align: center; } .numeric { text-align: right; }
                .pd-positive { color: #4ade80; } .pd-negative { color: #f87171; }
            </style></head><body><h1>Season Report: ${league.name}</h1>`;
        
        if (champions.length > 0) {
            htmlContent += `<h2>🏆 Champions</h2><ul>`;
            champions.forEach(c => { htmlContent += `<li><strong>${c.name}:</strong> ${c.winner}</li>`; });
            htmlContent += `</ul>`;
        }
        if (standingsData.length > 0) {
            htmlContent += `<h2>📊 Final League Standings</h2><table><thead><tr><th class="rank">Rank</th><th>Team</th><th class="rank">GP</th><th class="rank">W</th><th class="rank">L</th><th class="numeric">PF</th><th class="numeric">PA</th><th class="numeric">PD</th></tr></thead><tbody>`;
            standingsData.forEach((team, index) => {
                const pdClass = team.pointDifferential > 0 ? 'pd-positive' : team.pointDifferential < 0 ? 'pd-negative' : '';
                const pdText = team.pointDifferential > 0 ? `+${team.pointDifferential}` : team.pointDifferential;
                htmlContent += `<tr><td class="rank">${index + 1}</td><td>${team.teamName}</td><td class="rank">${team.gamesPlayed}</td><td class="rank">${team.wins}</td><td class="rank">${team.losses}</td><td class="numeric">${team.pointsFor}</td><td class="numeric">${team.pointsAgainst}</td><td class="numeric ${pdClass}">${pdText}</td></tr>`;
            });
            htmlContent += `</tbody></table>`;
        }
        if (playerStats.length > 0 && playerStats.some(p => p.gamesPlayed > 0)) {
            htmlContent += `<h2>🐎 Player Leaderboard (by Ringers)</h2><table><thead><tr><th class="rank">Rank</th><th>Player</th><th class="rank">GP</th><th class="numeric">Ringers</th><th class="numeric">Ringer %</th></tr></thead><tbody>`;
            playerStats.filter(p => p.gamesPlayed > 0).forEach((p, index) => {
                htmlContent += `<tr><td class="rank">${index + 1}</td><td>${p.name}</td><td class="rank">${p.gamesPlayed}</td><td class="numeric">${p.ringers}</td><td class="numeric">${p.ringerPercentage.toFixed(1)}%</td></tr>`;
            });
            htmlContent += `</tbody></table>`;
        }
        if (sortedMatches.length > 0) {
            htmlContent += `<h2>📜 Full Match History</h2><ul>`;
            sortedMatches.forEach(match => {
                const date = new Date(match.timestamp).toLocaleString();
                htmlContent += `<li><strong>${date}:</strong> ${match.teamA.name} (${match.scoreA}) vs ${match.teamB.name} (${match.scoreB})</li>`;
            });
            htmlContent += `</ul>`;
        }
        htmlContent += `</body></html>`;
        
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
        document.body.appendChild(iframe);
        iframe.contentWindow?.document.open();
        iframe.contentWindow?.document.write(htmlContent);
        iframe.contentWindow?.document.close();
        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => { document.body.removeChild(iframe); }, 100);
        };
    };


    return (
        <>
            <div className="max-w-2xl mx-auto bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-brand-primary mb-6">League Settings</h2>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">League Name</label>
                        <input type="text" value={leagueName} onChange={e => setLeagueName(e.target.value)} className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Score to Win</label>
                        <input type="number" value={winScore} onChange={e => setWinScore(e.target.value)} className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" min="1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Players Per Team (for a match)</label>
                        <input type="number" value={playersPerTeam} onChange={e => setPlayersPerTeam(parseInt(e.target.value, 10) || 1)} className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" min="1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Points Per Ringer (after cancelling)</label>
                        <input type="number" value={pointsPerRinger} onChange={e => setPointsPerRinger(e.target.value)} className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" min="0" />
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <h3 className="text-lg font-semibold text-brand-primary">Share League</h3>
                        <p className="text-sm text-brand-text-secondary mt-1 mb-3">Share this ID with other users to allow them to join and view your league.</p>
                        <div className="flex gap-2">
                            <input type="text" readOnly value={league.id} className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text-secondary cursor-pointer" onClick={handleCopyId} />
                            <button onClick={handleCopyId} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
                                Copy
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <button onClick={handleSave} className="w-full bg-brand-primary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-secondary transition-colors">
                            Save Changes
                        </button>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t border-gray-700">
                        <h3 className="text-lg font-semibold text-brand-primary flex items-center gap-2"><TrophyIcon className="w-5 h-5"/>Season Report</h3>
                        <p className="text-sm text-brand-text-secondary mt-1 mb-3">Download a print-friendly PDF summarizing the entire season, including final standings, player stats, and tournament champions.</p>
                        <button onClick={handleDownloadReport} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                            <DownloadIcon className="w-5 h-5"/>
                            Download Season Report
                        </button>
                    </div>

                    <div className="pt-4 mt-4 border-t border-gray-700">
                        <h3 className="text-lg font-semibold text-brand-primary flex items-center gap-2"><RepeatIcon className="w-5 h-5"/>Season Management</h3>
                        <p className="text-sm text-brand-text-secondary mt-1 mb-3">Create a new, clean league for the next season based on this one. Players and teams can be carried over, but match history and stats will be reset.</p>
                        <button onClick={openRolloverModal} className="w-full bg-brand-secondary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-primary transition-colors">
                            Roll Over to New Season
                        </button>
                    </div>

                    <div className="pt-4 mt-4 border-t border-red-900/50">
                        <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
                        <p className="text-sm text-brand-text-secondary mt-1 mb-3">Deleting a league is permanent. All associated players, teams, and matches will be lost.</p>
                        <button onClick={handleDelete} className="w-full bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors">
                            Delete League
                        </button>
                    </div>
                </div>
            </div>

            {isRolloverModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setIsRolloverModalOpen(false)}>
                    <div className="bg-brand-surface rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold text-brand-primary mb-4">Start a New Season</h3>
                        <p className="text-brand-text-secondary mb-6">This will create a new league based on '{league.name}'. Match history and stats will be reset for a fresh start.</p>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="new-league-name" className="block text-sm font-medium text-brand-text-secondary mb-1">New Season Name</label>
                                <input
                                    id="new-league-name"
                                    type="text"
                                    value={newLeagueName}
                                    onChange={e => setNewLeagueName(e.target.value)}
                                    className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>
                            <div>
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={keepTeams}
                                        onChange={e => setKeepTeams(e.target.checked)}
                                        className="form-checkbox text-brand-primary bg-brand-bg border-gray-500 rounded focus:ring-brand-secondary h-5 w-5"
                                    />
                                    <span className="ml-3 text-brand-text">Keep existing teams and player assignments</span>
                                </label>
                                <p className="text-xs text-brand-text-secondary ml-8 mt-1">Players will be copied to the new season regardless. Uncheck this to make all players free agents in the new season.</p>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end gap-4">
                            <button onClick={() => setIsRolloverModalOpen(false)} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>
                            <button onClick={handleConfirmRollover} className="bg-brand-primary text-brand-bg font-bold py-2 px-6 rounded-lg hover:bg-brand-secondary transition-colors">Confirm & Create</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default LeagueSettings;
