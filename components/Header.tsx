
import React from 'react';
import { League, User } from '../types';
import TrophyIcon from './icons/TrophyIcon';

interface HeaderProps {
    user: User;
    leagues: League[];
    activeLeagueId: string | null;
    onLeagueChange: (leagueId: string) => void;
    onSignOut: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, leagues, activeLeagueId, onLeagueChange, onSignOut }) => {
    return (
        <header className="bg-brand-surface shadow-md p-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center">
                <TrophyIcon className="w-8 h-8 text-brand-primary mr-3"/>
                <h1 className="text-2xl font-bold text-brand-text">League Link</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
                {leagues.length > 0 && (
                     <select
                        value={activeLeagueId || ''}
                        onChange={(e) => onLeagueChange(e.target.value)}
                        className="bg-brand-bg border border-gray-600 rounded-md px-2 sm:px-3 py-2 text-brand-text text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-primary"
                     >
                        <option value="" disabled>Select a league...</option>
                        {leagues.map(league => (
                            <option key={league.id} value={league.id}>{league.name}</option>
                        ))}
                    </select>
                )}
                <div className="flex items-center space-x-2 sm:space-x-4">
                    <span className="text-sm text-brand-text-secondary hidden sm:inline truncate max-w-xs">{user.email}</span>
                    <button onClick={onSignOut} className="text-sm bg-brand-primary text-brand-bg font-bold py-2 px-3 sm:px-4 rounded-lg hover:bg-brand-secondary transition-colors">
                        Sign Out
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
