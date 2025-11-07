import React from 'react';
import { League, User } from '../types';
import TrophyIcon from './icons/TrophyIcon';

interface HeaderProps {
    user: User;
    leagues: League[];
    activeLeagueId: string | null;
    onLeagueChange: (leagueId: string) => void;
}

const Header: React.FC<HeaderProps> = ({ user, leagues, activeLeagueId, onLeagueChange }) => {
    return (
        <header className="bg-brand-surface shadow-md p-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center">
                <TrophyIcon className="w-8 h-8 text-brand-primary mr-3"/>
                <h1 className="text-2xl font-bold text-brand-text">League Link</h1>
            </div>
            <div className="flex items-center space-x-4">
                {leagues.length > 0 && (
                     <select
                        value={activeLeagueId || ''}
                        onChange={(e) => onLeagueChange(e.target.value)}
                        className="bg-brand-bg border border-gray-600 rounded-md px-3 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                     >
                        <option value="" disabled>Select a league...</option>
                        {leagues.map(league => (
                            <option key={league.id} value={league.id}>{league.name}</option>
                        ))}
                    </select>
                )}
            </div>
        </header>
    );
};

export default Header;