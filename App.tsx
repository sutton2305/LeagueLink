
import React, { useState, useEffect, useMemo } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { User, League, Player, Team } from './types';
import Dashboard from './components/Dashboard';
import CreateLeague from './components/CreateLeague';
import Header from './components/Header';
import { requestNotificationPermission } from './utils/notifications';

// Static user since login is removed.
const staticUser: User = { id: 'user_default_001', email: 'user@leaguelink.app' };


const App: React.FC = () => {
    const [leagues, setLeagues] = useLocalStorage<League[]>('leagues', []);
    const [activeLeagueId, setActiveLeagueId] = useLocalStorage<string | null>('activeLeagueId', null);
    const [joinedLeagueIds, setJoinedLeagueIds] = useLocalStorage<string[]>(`joined_leagues_${staticUser.id}`, []);
    
    const currentUser = staticUser;

    useEffect(() => {
        // Request permission for notifications
        requestNotificationPermission();
    }, []);

    const handleCreateLeague = (name: string, winScore: number) => {
        if (!currentUser) return;
        const newLeague: League = {
            id: `league-${Date.now()}`,
            name,
            winScore,
            playersPerTeam: 2, // default
            pointsPerRinger: 3, // default
            ownerId: currentUser.id,
        };
        const updatedLeagues = [...leagues, newLeague];
        setLeagues(updatedLeagues);
        setActiveLeagueId(newLeague.id);
    };

    const handleJoinLeague = (leagueId: string): boolean => {
        // Clean the input ID to remove surrounding quotes that might be added on copy-paste.
        const cleanedLeagueId = leagueId.trim().replace(/^"|"$|^'|'$/g, '');
        const leagueToJoin = leagues.find(l => l.id === cleanedLeagueId);

        if (!leagueToJoin) {
            alert("No league found with that ID.");
            return false;
        }

        if (leagueToJoin.ownerId === currentUser.id) {
            alert("You are the owner of this league.");
            setActiveLeagueId(leagueToJoin.id);
            return true;
        }

        if (joinedLeagueIds.includes(leagueToJoin.id)) {
            alert("You have already joined this league.");
            setActiveLeagueId(leagueToJoin.id);
            return true;
        }

        setJoinedLeagueIds(prev => [...prev, leagueToJoin.id]);
        setActiveLeagueId(leagueToJoin.id);
        alert(`Successfully joined league: ${leagueToJoin.name}!`);
        return true;
    };

    const handleLeagueRollover = (sourceLeagueId: string, newLeagueName: string, keepTeams: boolean) => {
        const sourceLeague = leagues.find(l => l.id === sourceLeagueId);
        if (!sourceLeague) {
            alert('Source league not found!');
            return;
        }

        // 1. Create new league
        const newLeague: League = {
            ...sourceLeague,
            id: `league-${Date.now()}`,
            name: newLeagueName,
        };

        // 2. Read source data from localStorage
        const sourcePlayers: Player[] = JSON.parse(localStorage.getItem(`players_${sourceLeagueId}`) || '[]');
        const sourceTeams: Team[] = JSON.parse(localStorage.getItem(`teams_${sourceLeagueId}`) || '[]');

        const newPlayers: Player[] = [];
        const newTeams: Team[] = [];
        const oldToNewTeamIdMap = new Map<string, string>();

        // 3. Process teams if keeping them
        if (keepTeams && sourceTeams.length > 0) {
            sourceTeams.forEach(team => {
                const newTeamId = `team-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                oldToNewTeamIdMap.set(team.id, newTeamId);
                newTeams.push({
                    ...team,
                    id: newTeamId,
                    leagueId: newLeague.id,
                });
            });
        }

        // 4. Process players
        sourcePlayers.forEach(player => {
            const newPlayerId = `player-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const newPlayer: Player = {
                ...player,
                id: newPlayerId,
                leagueId: newLeague.id,
                role: undefined, // Reset roles
                teamId: keepTeams && player.teamId ? oldToNewTeamIdMap.get(player.teamId) || null : null,
            };
            newPlayers.push(newPlayer);
        });

        // 5. Write new data to localStorage for the new league
        localStorage.setItem(`players_${newLeague.id}`, JSON.stringify(newPlayers));
        localStorage.setItem(`teams_${newLeague.id}`, JSON.stringify(newTeams));
        localStorage.setItem(`matches_${newLeague.id}`, '[]');
        localStorage.setItem(`scheduled_matches_${newLeague.id}`, '[]');
        localStorage.setItem(`chat_messages_${newLeague.id}`, '[]');
        localStorage.setItem(`tournaments_${newLeague.id}`, '[]');

        // 6. Update app state
        setLeagues(prev => [...prev, newLeague]);
        setActiveLeagueId(newLeague.id);

        alert(`Successfully rolled over to new season: "${newLeague.name}"! You are now managing the new league.`);
    };

    const userLeagues = useMemo(() => {
        const owned = leagues.filter(l => l.ownerId === currentUser?.id);
        const joined = leagues.filter(l => joinedLeagueIds.includes(l.id));
        
        // Use a map to ensure uniqueness if a user joins their own league somehow
        const allUserLeaguesMap = new Map<string, League>();
        owned.forEach(l => allUserLeaguesMap.set(l.id, l));
        joined.forEach(l => allUserLeaguesMap.set(l.id, l));

        return Array.from(allUserLeaguesMap.values());
    }, [leagues, currentUser, joinedLeagueIds]);


    const activeLeague = userLeagues.find(l => l.id === activeLeagueId);

    return (
        <div className="bg-brand-bg min-h-screen text-brand-text">
            <Header
                user={currentUser}
                leagues={userLeagues}
                activeLeagueId={activeLeagueId}
                onLeagueChange={setActiveLeagueId}
            />
            <main className="p-4 sm:p-6 lg:p-8">
                {activeLeague && currentUser ? (
                    <Dashboard key={activeLeague.id} league={activeLeague} currentUser={currentUser} onRolloverLeague={handleLeagueRollover} />
                ) : (
                    <CreateLeague
                        onCreateLeague={handleCreateLeague}
                        hasLeagues={userLeagues.length > 0}
                        onJoinLeague={handleJoinLeague}
                    />
                )}
            </main>
        </div>
    );
};

export default App;
