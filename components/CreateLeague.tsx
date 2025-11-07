import React, { useState } from 'react';
import TrophyIcon from './icons/TrophyIcon';

interface CreateLeagueProps {
    onCreateLeague: (name: string, winScore: number) => void;
    hasLeagues: boolean;
    onJoinLeague: (leagueId: string) => boolean;
}

const CreateLeague: React.FC<CreateLeagueProps> = ({ onCreateLeague, hasLeagues, onJoinLeague }) => {
    const [name, setName] = useState('');
    const [winScore, setWinScore] = useState('21');
    const [joinLeagueId, setJoinLeagueId] = useState('');

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const score = parseInt(winScore, 10);
        if (name.trim() && !isNaN(score) && score > 0) {
            onCreateLeague(name.trim(), score);
        } else {
            alert('Please enter a valid name and a positive number for the win score.');
        }
    };

    const handleJoinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (joinLeagueId.trim()) {
            onJoinLeague(joinLeagueId.trim());
        } else {
            alert('Please enter a League ID to join.');
        }
    }

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
            <div className="max-w-lg w-full text-center">
                <div className="mb-8">
                    <TrophyIcon className="w-16 h-16 mx-auto text-brand-primary" />
                    <h2 className="mt-4 text-3xl font-bold text-brand-text">
                        {hasLeagues ? "Welcome Back!" : "Welcome to League Link!"}
                    </h2>
                    <p className="mt-2 text-brand-text-secondary">
                        {hasLeagues ? "Select a league from the dropdown, or create/join a new one." : "Create your first league or join an existing one to get started."}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
                    {/* Create League Form */}
                    <form onSubmit={handleCreateSubmit} className="p-8 bg-brand-surface rounded-2xl shadow-2xl space-y-4 text-left">
                        <h3 className="text-xl font-bold text-center text-brand-text mb-4">Create a New League</h3>
                        <div>
                            <label htmlFor="league-name" className="block text-sm font-medium text-brand-text-secondary mb-1">League Name</label>
                            <input
                                id="league-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Office Ping Pong Championship"
                                required
                                className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>
                        <div>
                            <label htmlFor="win-score" className="block text-sm font-medium text-brand-text-secondary mb-1">Score to Win</label>
                            <input
                                id="win-score"
                                type="number"
                                value={winScore}
                                onChange={(e) => setWinScore(e.target.value)}
                                required
                                min="1"
                                className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-brand-primary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-secondary transition-colors"
                        >
                            Create League
                        </button>
                    </form>

                    {/* Join League Form */}
                    <form onSubmit={handleJoinSubmit} className="p-8 bg-brand-surface rounded-2xl shadow-2xl space-y-4 text-left">
                        <h3 className="text-xl font-bold text-center text-brand-text mb-4">Join an Existing League</h3>
                        <div>
                            <label htmlFor="join-league-id" className="block text-sm font-medium text-brand-text-secondary mb-1">League ID</label>
                            <input
                                id="join-league-id"
                                type="text"
                                value={joinLeagueId}
                                onChange={(e) => setJoinLeagueId(e.target.value)}
                                placeholder="Enter League ID from owner"
                                required
                                className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-brand-secondary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-primary transition-colors"
                        >
                            Join League
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateLeague;
