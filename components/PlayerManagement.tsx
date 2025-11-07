import React, { useState } from 'react';
import { Player, Team } from '../types';

interface PlayerManagementProps {
    players: Player[];
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
    teams: Team[];
    leagueId: string;
}

const PlayerManagement: React.FC<PlayerManagementProps> = ({ players, setPlayers, teams, leagueId }) => {
    const [name, setName] = useState('');
    const [newAvatar, setNewAvatar] = useState<string | null>(null); // For base64 data URL
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                alert("File is too large! Please select an image under 2MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        if (editingPlayer) {
            const updatedAvatar = newAvatar || editingPlayer.avatarUrl;
            setPlayers(players.map(p => p.id === editingPlayer.id ? { ...p, name, avatarUrl: updatedAvatar } : p));
        } else {
            const newPlayer: Player = {
                id: `player-${Date.now()}`,
                name,
                avatarUrl: newAvatar || `https://api.dicebear.com/8.x/bottts/svg?seed=${encodeURIComponent(name)}`,
                teamId: null,
                leagueId,
            };
            setPlayers([...players, newPlayer]);
        }
        handleCancelEdit();
    };
    
    const handleEdit = (player: Player) => {
        setEditingPlayer(player);
        setName(player.name);
        setNewAvatar(null);
    };

    const handleCancelEdit = () => {
        setEditingPlayer(null);
        setName('');
        setNewAvatar(null);
    }

    const handleDelete = (playerId: string) => {
        if (window.confirm('Are you sure you want to delete this player?')) {
            setPlayers(players.filter(p => p.id !== playerId));
        }
    };

    const handleAssignTeam = (playerId: string, teamId: string) => {
        setPlayers(players.map(p => p.id === playerId ? { ...p, teamId: teamId || null } : p));
    };

    const defaultAvatar = `https://api.dicebear.com/8.x/bottts/svg?seed=${encodeURIComponent(name || 'new-player')}`;

    const filteredPlayers = players.filter(player =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <form onSubmit={handleSubmit} className="bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary mb-6">{editingPlayer ? 'Edit Player' : 'Add New Player'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="flex flex-col items-center justify-center">
                        <img
                            src={newAvatar || editingPlayer?.avatarUrl || defaultAvatar}
                            alt="Avatar Preview"
                            className="w-32 h-32 rounded-full object-cover bg-brand-bg border-4 border-gray-600"
                        />
                        <label htmlFor="avatar-upload" className="mt-4 cursor-pointer bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm text-center">
                           Upload Picture
                        </label>
                        <input
                            id="avatar-upload"
                            type="file"
                            accept="image/png, image/jpeg"
                            className="hidden"
                            onChange={handleImageChange}
                        />
                         {newAvatar && (
                            <button onClick={() => setNewAvatar(null)} type="button" className="mt-2 text-sm text-red-400 hover:underline">
                                Remove
                            </button>
                        )}
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <label htmlFor="player-name" className="block text-sm font-medium text-brand-text-secondary mb-1">Player Name</label>
                        <input
                            id="player-name"
                            type="text"
                            placeholder="Enter player's name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            required
                        />
                        <p className="text-xs text-brand-text-secondary">If no picture is uploaded, a robot avatar will be generated based on the name.</p>
                    </div>
                </div>

                <div className="mt-6 flex space-x-2 border-t border-gray-700 pt-6">
                    <button type="submit" className="bg-brand-primary text-brand-bg font-bold py-2 px-6 rounded-lg hover:bg-brand-secondary transition-colors">
                        {editingPlayer ? 'Update Player' : 'Add Player'}
                    </button>
                    {editingPlayer && <button onClick={handleCancelEdit} type="button" className="bg-gray-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>}
                </div>
            </form>

            <div className="bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary mb-4">Player List</h2>
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Search players by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                </div>
                <div className="space-y-3">
                    {filteredPlayers.map(player => (
                        <div key={player.id} className="bg-brand-bg p-4 rounded-lg flex items-center justify-between">
                            <div className="flex items-center">
                                <img src={player.avatarUrl} alt={player.name} className="w-12 h-12 rounded-full mr-4 object-cover"/>
                                <div>
                                    <p className="font-semibold">{player.name}</p>
                                    <select value={player.teamId || ''} onChange={e => handleAssignTeam(player.id, e.target.value)} className="bg-gray-700 border border-gray-600 rounded text-sm px-2 py-1 mt-1">
                                        <option value="">No Team</option>
                                        {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-x-2">
                                <button onClick={() => handleEdit(player)} className="text-blue-400 hover:text-blue-300">Edit</button>
                                <button onClick={() => handleDelete(player.id)} className="text-red-500 hover:text-red-400">Delete</button>
                            </div>
                        </div>
                    ))}
                    {players.length > 0 && filteredPlayers.length === 0 && (
                        <p className="text-center text-brand-text-secondary py-4">No players found matching "{searchTerm}".</p>
                    )}
                    {players.length === 0 && <p className="text-center text-brand-text-secondary py-4">No players have been added yet.</p>}
                </div>
            </div>
        </div>
    );
};

export default PlayerManagement;