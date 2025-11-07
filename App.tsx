
import React, { useState, useEffect, useMemo } from 'react';
import { User, League, Player, Team, SignUpData } from './types';
import Dashboard from './components/Dashboard';
import CreateLeague from './components/CreateLeague';
import Header from './components/Header';
import Login from './components/Login';
import { requestNotificationPermission } from './utils/notifications';
import { db } from './services/database';

const App: React.FC = () => {
    const [users, setUsers] = useState(() => db.getUsers());
    const [currentUser, setCurrentUser] = useState(() => db.getCurrentUser());
    const [leagues, setLeagues] = useState(() => db.getLeagues());
    const [activeLeagueId, setActiveLeagueId] = useState(() => db.getActiveLeagueId());
    const [joinedLeagueIds, setJoinedLeagueIds] = useState<string[]>([]);

    // Persist state changes back to the database (localStorage)
    useEffect(() => { db.saveUsers(users); }, [users]);
    useEffect(() => { db.saveCurrentUser(currentUser); }, [currentUser]);
    useEffect(() => { db.saveLeagues(leagues); }, [leagues]);
    useEffect(() => { db.saveActiveLeagueId(activeLeagueId); }, [activeLeagueId]);
    useEffect(() => {
        if (currentUser) {
            db.saveJoinedLeagueIds(currentUser.id, joinedLeagueIds);
        }
    }, [currentUser, joinedLeagueIds]);

    // Re-fetch joined leagues when user changes
    useEffect(() => {
        if (currentUser) {
            setJoinedLeagueIds(db.getJoinedLeagueIds(currentUser.id));
        } else {
            setJoinedLeagueIds([]);
        }
    }, [currentUser]);

    useEffect(() => {
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
        setLeagues(prev => [...prev, newLeague]);
        setActiveLeagueId(newLeague.id);
    };

    const handleJoinLeague = (leagueId: string): boolean => {
        if (!currentUser) return false;
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

        const newLeague: League = { ...sourceLeague, id: `league-${Date.now()}`, name: newLeagueName };
        const sourcePlayers = db.getPlayers(sourceLeagueId);
        const sourceTeams = db.getTeams(sourceLeagueId);
        const newPlayers: Player[] = [];
        const newTeams: Team[] = [];
        const oldToNewTeamIdMap = new Map<string, string>();

        if (keepTeams && sourceTeams.length > 0) {
            sourceTeams.forEach(team => {
                const newTeamId = `team-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                oldToNewTeamIdMap.set(team.id, newTeamId);
                newTeams.push({ ...team, id: newTeamId, leagueId: newLeague.id });
            });
        }

        sourcePlayers.forEach(player => {
            const newPlayer: Player = {
                ...player,
                id: `player-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                leagueId: newLeague.id,
                role: undefined,
                teamId: keepTeams && player.teamId ? oldToNewTeamIdMap.get(player.teamId) || null : null,
            };
            newPlayers.push(newPlayer);
        });

        db.savePlayers(newLeague.id, newPlayers);
        db.saveTeams(newLeague.id, newTeams);
        db.saveMatches(newLeague.id, []);
        db.saveScheduledMatches(newLeague.id, []);
        db.saveChatMessages(newLeague.id, []);
        db.saveBrackets(newLeague.id, []);

        setLeagues(prev => [...prev, newLeague]);
        setActiveLeagueId(newLeague.id);
        alert(`Successfully rolled over to new season: "${newLeague.name}"! You are now managing the new league.`);
    };
    
    const handleUpdateLeague = (updatedLeague: League) => {
        setLeagues(prev => prev.map(l => l.id === updatedLeague.id ? updatedLeague : l));
        alert('League settings saved!');
    };
    
    const handleDeleteLeague = (leagueId: string) => {
        if (!window.confirm('Are you sure you want to delete this league? This action is permanent and will delete all associated data.')) return;
        
        setLeagues(prev => prev.filter(l => l.id !== leagueId));
        db.clearLeagueData(leagueId);

        users.forEach(user => {
            const joined = db.getJoinedLeagueIds(user.id);
            if (joined.includes(leagueId)) {
                db.saveJoinedLeagueIds(user.id, joined.filter(id => id !== leagueId));
            }
        });
        
        setJoinedLeagueIds(prev => prev.filter(id => id !== leagueId));

        if (activeLeagueId === leagueId) {
            setActiveLeagueId(null);
        }
        alert('League successfully deleted.');
    };

    const handleSignUp = (data: SignUpData): boolean => {
        const existingUser = users.find(u => u.email.toLowerCase() === data.email.toLowerCase());
        if (existingUser) {
            alert("An account with this email already exists.");
            return false;
        }
        const newUser: User = { id: `user-${Date.now()}`, email: data.email, password: data.password };
        setUsers([...users, newUser]);
        setCurrentUser(newUser);
        alert("Sign up successful! You are now logged in.");
        return true;
    };

    const handleLogin = (user: User) => {
        setCurrentUser(user);
    };

    const handleSignOut = () => {
        setCurrentUser(null);
        setActiveLeagueId(null);
    };

    const userLeagues = useMemo(() => {
        const owned = leagues.filter(l => l.ownerId === currentUser?.id);
        const joined = leagues.filter(l => joinedLeagueIds.includes(l.id));
        const allUserLeaguesMap = new Map<string, League>();
        owned.forEach(l => allUserLeaguesMap.set(l.id, l));
        joined.forEach(l => allUserLeaguesMap.set(l.id, l));
        return Array.from(allUserLeaguesMap.values());
    }, [leagues, currentUser, joinedLeagueIds]);

    const activeLeague = userLeagues.find(l => l.id === activeLeagueId);

    if (!currentUser) {
        return <Login onLogin={handleLogin} onSignUp={handleSignUp} users={users} />;
    }

    return (
        <div className="bg-brand-bg min-h-screen text-brand-text">
            <Header
                user={currentUser}
                leagues={userLeagues}
                activeLeagueId={activeLeagueId}
                onLeagueChange={setActiveLeagueId}
                onSignOut={handleSignOut}
            />
            <main className="p-4 sm:p-6 lg:p-8">
                {activeLeague ? (
                    <Dashboard 
                        key={activeLeague.id} 
                        league={activeLeague} 
                        currentUser={currentUser} 
                        onRolloverLeague={handleLeagueRollover} 
                        onUpdateLeague={handleUpdateLeague}
                        onDeleteLeague={handleDeleteLeague}
                    />
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
