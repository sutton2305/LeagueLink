import React, { useState } from 'react';
import { Team, Player, PlayerRole } from '../types';
import CalendarIcon from './icons/CalendarIcon';

interface TeamManagementProps {
    teams: Team[];
    setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
    players: Player[];
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
    leagueId: string;
    onViewSchedule: (teamId: string) => void;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ teams, setTeams, players, setPlayers, leagueId, onViewSchedule }) => {
    const [name, setName] = useState('');
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        if (editingTeam) {
            setTeams(teams.map(t => t.id === editingTeam.id ? { ...t, name } : t));
            setEditingTeam(null);
        } else {
            const newTeam: Team = {
                id: `team-${Date.now()}`,
                name,
                leagueId,
            };
            setTeams([...teams, newTeam]);
        }
        setName('');
    };

    const handleEdit = (team: Team) => {
        setEditingTeam(team);
        setName(team.name);
    };

    const handleDelete = (teamId: string) => {
        if (window.confirm('Are you sure? This will not delete players, but they will become teamless.')) {
            setTeams(teams.filter(t => t.id !== teamId));
        }
    };

    const handleAssignRole = (playerId: string, teamId: string, role: PlayerRole | '') => {
        setPlayers(currentPlayers => {
            const newPlayers = [...currentPlayers];
            
            if (role === 'Captain') {
                // Demote existing captain on this team if there is one
                const oldCaptainIndex = newPlayers.findIndex(p => p.teamId === teamId && p.role === 'Captain');
                if (oldCaptainIndex > -1) {
                    const oldCaptain = { ...newPlayers[oldCaptainIndex] };
                    delete oldCaptain.role;
                    newPlayers[oldCaptainIndex] = oldCaptain;
                }
            }

            // Assign the new role
            const playerIndex = newPlayers.findIndex(p => p.id === playerId);
            if (playerIndex > -1) {
                 const player = { ...newPlayers[playerIndex] };
                 if (role) {
                    player.role = role;
                 } else {
                    delete player.role;
                 }
                 newPlayers[playerIndex] = player;
            }

            return newPlayers;
        });
    };

    const RoleBadge: React.FC<{role: PlayerRole}> = ({ role }) => {
        const style = role === 'Captain' ? 'bg-yellow-500 text-yellow-900' : 'bg-gray-500 text-gray-900';
        const text = role === 'Captain' ? 'C' : 'Co';
        return <span className={`ml-2 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${style}`}>{text}</span>
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <form onSubmit={handleSubmit} className="bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary mb-4">{editingTeam ? 'Edit Team' : 'Create New Team'}</h2>
                <input
                    type="text"
                    placeholder="Team Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    required
                />
                <div className="mt-4 flex space-x-2">
                    <button type="submit" className="bg-brand-primary text-brand-bg font-bold py-2 px-6 rounded-lg hover:bg-brand-secondary transition-colors">
                        {editingTeam ? 'Update Team' : 'Create Team'}
                    </button>
                    {editingTeam && <button onClick={() => { setEditingTeam(null); setName(''); }} type="button" className="bg-gray-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>}
                </div>
            </form>

            <div className="bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary mb-4">Team List</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teams.map(team => {
                        const teamPlayers = players.filter(p => p.teamId === team.id);
                        return (
                            <div key={team.id} className="bg-brand-bg p-4 rounded-lg">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-lg">{team.name}</h3>
                                    <div className="space-x-2 flex-shrink-0 flex items-center">
                                        <button onClick={() => onViewSchedule(team.id)} title="View Team Schedule" className="text-brand-primary hover:text-brand-secondary p-1">
                                            <CalendarIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleEdit(team)} className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                                        <button onClick={() => handleDelete(team.id)} className="text-red-500 hover:text-red-400 text-sm">Delete</button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                     {teamPlayers.length > 0 ? teamPlayers.map(p => (
                                        <div key={p.id} className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <img src={p.avatarUrl} alt={p.name} title={p.name} className="w-10 h-10 rounded-full border-2 border-brand-surface"/>
                                                <span className="ml-3 font-medium">{p.name}</span>
                                                {p.role && <RoleBadge role={p.role}/>}
                                            </div>
                                            <select 
                                                value={p.role || ''} 
                                                onChange={e => handleAssignRole(p.id, team.id, e.target.value as PlayerRole | '')} 
                                                className="bg-gray-700 border border-gray-600 rounded text-sm px-2 py-1"
                                            >
                                                <option value="">Set Role</option>
                                                <option value="Captain">Captain</option>
                                                <option value="Co-Captain">Co-Captain</option>
                                            </select>
                                        </div>
                                    )) : <p className="text-sm text-brand-text-secondary">No players assigned.</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TeamManagement;