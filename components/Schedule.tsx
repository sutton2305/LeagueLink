
import React, { useState, useMemo, useEffect } from 'react';
import { ScheduledMatch, Team } from '../types';
import UploadIcon from './icons/UploadIcon';
import DownloadIcon from './icons/DownloadIcon';
import SwordsIcon from './icons/SwordsIcon';
import CalendarIcon from './icons/CalendarIcon';
import ListViewIcon from './icons/ListViewIcon';

type MatchToStart = { teamAId: string, teamBId: string, description?: string };

interface ScheduleProps {
    scheduledMatches: ScheduledMatch[];
    setScheduledMatches: React.Dispatch<React.SetStateAction<ScheduledMatch[]>>;
    teams: Team[];
    setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
    leagueId: string;
    onStartMatch: (ids: MatchToStart) => void;
    scheduleFilter: { teamId: string | null };
    setScheduleFilter: React.Dispatch<React.SetStateAction<{ teamId: string | null }>>;
}

const Schedule: React.FC<ScheduleProps> = ({ scheduledMatches, setScheduledMatches, teams, setTeams, leagueId, onStartMatch, scheduleFilter, setScheduleFilter }) => {
    const [teamAId, setTeamAId] = useState('');
    const [teamBId, setTeamBId] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [description, setDescription] = useState('');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [importStatus, setImportStatus] = useState<{type: 'success' | 'error' | 'idle', message: string}>({type: 'idle', message: ''});
    const [view, setView] = useState<'list' | 'calendar'>('list');

    const teamsMap = useMemo(() => new Map(teams.map(t => [t.id, t.name])), [teams]);
    const teamsByName = useMemo(() => new Map(teams.map(t => [t.name.toLowerCase(), t.id])), [teams]);

    const sortedTeams = useMemo(() => {
        return [...teams].sort((a, b) => a.name.localeCompare(b.name));
    }, [teams]);

    const filteredMatches = useMemo(() => {
        if (!scheduleFilter.teamId) {
            return scheduledMatches;
        }
        return scheduledMatches.filter(match => match.teamAId === scheduleFilter.teamId || match.teamBId === scheduleFilter.teamId);
    }, [scheduledMatches, scheduleFilter.teamId]);

    const sortedMatches = useMemo(() => {
        return [...filteredMatches].sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateA.getTime() - dateB.getTime();
        });
    }, [filteredMatches]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!teamAId || !teamBId || !date || !time || teamAId === teamBId) {
            alert('Please fill out all fields and select two different teams.');
            return;
        }
        const newMatch: ScheduledMatch = {
            id: `scheduled-${Date.now()}`,
            teamAId,
            teamBId,
            date,
            time,
            leagueId,
            description: description.trim() ? description.trim() : undefined,
        };
        setScheduledMatches([...scheduledMatches, newMatch]);
        setTeamAId('');
        setTeamBId('');
        setDate('');
        setTime('');
        setDescription('');
    };

    const handleDelete = (matchId: string) => {
        if (window.confirm('Are you sure you want to delete this scheduled match?')) {
            setScheduledMatches(scheduledMatches.filter(m => m.id !== matchId));
        }
    }

    const processCsvFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setImportStatus({ type: 'error', message: 'Could not read the selected file.' });
                return;
            }
            
            const rows = text.split('\n').filter(row => row.trim() !== '');
            if (rows.length < 2) {
                setImportStatus({ type: 'error', message: 'CSV file must have a header row and at least one data row.' });
                return;
            }
            
            const header = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            const requiredHeaders = ["team a name", "team b name", "date", "time"];
            const optionalHeaders = ["description"];
            const headerIndices: Record<string, number> = {};
            
            [...requiredHeaders, ...optionalHeaders].forEach(reqHeader => {
                const index = header.findIndex(h => h === reqHeader);
                if (index !== -1) {
                    headerIndices[reqHeader] = index;
                }
            });

            if (!requiredHeaders.every(h => h in headerIndices)) {
                setImportStatus({ type: 'error', message: `CSV header is invalid. Must contain: ${requiredHeaders.join(', ')}` });
                return;
            }

            const newMatches: ScheduledMatch[] = [];
            const newlyCreatedTeams: Team[] = []; // Keep track of new teams to add them all at once
            const localTeamsByName = new Map(teamsByName); // Use a local map to handle duplicates within the same file
            const errors: string[] = [];

            const findTeamId = (name: string): string | undefined => {
                const nameLower = name.toLowerCase().trim();
                
                let id = localTeamsByName.get(nameLower);
                if (id) return id;

                if (!nameLower.startsWith('team ')) {
                    id = localTeamsByName.get(`team ${nameLower}`);
                    if (id) return id;
                }

                if (nameLower.startsWith('team ')) {
                    const nameWithoutPrefix = nameLower.substring(5).trim();
                    id = localTeamsByName.get(nameWithoutPrefix);
                    if (id) return id;
                }
                
                return undefined;
            };

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i].split(',');
                // FIX: Values from the CSV row array might be `undefined`. Use nullish coalescing to provide a
                // default empty string, allowing string methods like `.trim()` to be called without errors.
                const teamANameRaw = (row[headerIndices["team a name"]] ?? '').trim().replace(/"/g, '');
                const teamBNameRaw = (row[headerIndices["team b name"]] ?? '').trim().replace(/"/g, '');
                const matchDate = (row[headerIndices["date"]] ?? '').trim().replace(/"/g, '');
                const matchTime = (row[headerIndices["time"]] ?? '').trim().replace(/"/g, '');
                const rawMatchDescription = headerIndices["description"] !== undefined ? (row[headerIndices["description"]] ?? '').trim().replace(/"/g, '') : undefined;
                const matchDescription = rawMatchDescription || undefined;


                if (!teamANameRaw || !teamBNameRaw || !matchDate || !matchTime) {
                    errors.push(`Row ${i + 1} is missing required data.`);
                    continue;
                }

                if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate) || !/^\d{2}:\d{2}$/.test(matchTime)) {
                    errors.push(`Row ${i + 1} has an invalid date or time format. Please use YYYY-MM-DD for date and HH:MM (24-hour) for time. Found: date="${matchDate}", time="${matchTime}"`);
                    continue;
                }

                const parsedDateTime = new Date(`${matchDate}T${matchTime}`);
                if (isNaN(parsedDateTime.getTime())) {
                     errors.push(`Row ${i + 1} has an invalid date or time. Found: date="${matchDate}", time="${matchTime}"`);
                    continue;
                }

                if (teamANameRaw.toLowerCase() === teamBNameRaw.toLowerCase()) {
                    errors.push(`Teams cannot play against themselves on row ${i + 1}: "${teamANameRaw}"`);
                    continue;
                }
                
                let teamAId = findTeamId(teamANameRaw);
                if (!teamAId) {
                    const newTeam: Team = { id: `team-${Date.now()}-A-${i}`, name: teamANameRaw, leagueId };
                    newlyCreatedTeams.push(newTeam);
                    teamAId = newTeam.id;
                    localTeamsByName.set(newTeam.name.toLowerCase(), newTeam.id);
                }
                
                let teamBId = findTeamId(teamBNameRaw);
                 if (!teamBId) {
                    const newTeam: Team = { id: `team-${Date.now()}-B-${i}`, name: teamBNameRaw, leagueId };
                    newlyCreatedTeams.push(newTeam);
                    teamBId = newTeam.id;
                    localTeamsByName.set(newTeam.name.toLowerCase(), newTeam.id);
                }
                
                newMatches.push({
                    id: `scheduled-${Date.now()}-${i}`,
                    teamAId,
                    teamBId,
                    date: matchDate,
                    time: matchTime,
                    leagueId,
                    description: matchDescription,
                });
            }

            if (errors.length > 0) {
                setImportStatus({ type: 'error', message: `Import failed with ${errors.length} errors:\n- ${errors.slice(0, 5).join('\n- ')}` });
            } else if (newMatches.length > 0) {
                if(newlyCreatedTeams.length > 0) {
                    setTeams(prev => [...prev, ...newlyCreatedTeams]);
                }
                setScheduledMatches(prev => [...prev, ...newMatches]);
                
                let successMessage = `Successfully imported ${newMatches.length} matches!`;
                if (newlyCreatedTeams.length > 0) {
                    const newTeamNames = newlyCreatedTeams.map(t => t.name).join(', ');
                    successMessage += `\n\nCreated ${newlyCreatedTeams.length} new teams: ${newTeamNames}.`;
                }
                setImportStatus({ type: 'success', message: successMessage });
            } else {
                setImportStatus({ type: 'error', message: 'No new valid matches found to import.' });
            }
        };
        reader.readAsText(file);
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setImportStatus({ type: 'idle', message: '' });
        const file = e.target.files?.[0];
        if (file && file.type === "text/csv") {
            setCsvFile(file);
            processCsvFile(file);
        } else if (file) {
            setImportStatus({ type: 'error', message: 'Please select a valid .csv file.' });
            setCsvFile(null);
        }
        e.target.value = '';
    };

    const handleDownloadTemplate = () => {
        const csvContent = `"Team A Name","Team B Name","Date","Time","Description"\n"Alpha","Bravo","2024-08-15","18:30","Playoff Quarter-Finals"`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "schedule_template.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleClearFilter = () => {
        setScheduleFilter({ teamId: null });
    };

    const filteredTeamName = useMemo(() => {
        if (!scheduleFilter.teamId) return null;
        return teamsMap.get(scheduleFilter.teamId) || null;
    }, [scheduleFilter.teamId, teamsMap]);

    const CalendarView = () => {
        const [currentDate, setCurrentDate] = useState(new Date());
        const [selectedDate, setSelectedDate] = useState<string | null>(null);

        useEffect(() => {
            if (scheduleFilter.teamId) {
                const firstMatch = sortedMatches[0];
                if (firstMatch) {
                    const firstMatchDate = new Date(firstMatch.date + 'T00:00:00');
                    if (!isNaN(firstMatchDate.getTime())) {
                        setCurrentDate(firstMatchDate);
                    }
                } else {
                    setCurrentDate(new Date());
                }
            } else {
                setCurrentDate(new Date());
            }
        }, [scheduleFilter.teamId]);

        const matchesByDate = useMemo(() => {
            const map = new Map<string, ScheduledMatch[]>();
            sortedMatches.forEach(match => {
                const date = match.date;
                if (!map.has(date)) {
                    map.set(date, []);
                }
                map.get(date)!.push(match);
            });
            return map;
        }, [sortedMatches]);
    
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const daysInMonth = endOfMonth.getDate();
        const startDayOfWeek = startOfMonth.getDay();
    
        const calendarDays = [];
        // Previous month's padding
        for (let i = 0; i < startDayOfWeek; i++) {
            calendarDays.push({ key: `prev-${i}`, isPadding: true });
        }
        // Current month's days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateString = date.toISOString().split('T')[0];
            const isToday = new Date().toISOString().split('T')[0] === dateString;
            calendarDays.push({
                key: dateString,
                day,
                dateString,
                isToday,
                matches: matchesByDate.get(dateString) || [],
            });
        }
        // Next month's padding
        const remainingCells = 7 - (calendarDays.length % 7);
        if (remainingCells < 7) {
            for (let i = 0; i < remainingCells; i++) {
                calendarDays.push({ key: `next-${i}`, isPadding: true });
            }
        }

        const selectedDayMatches = selectedDate ? matchesByDate.get(selectedDate) : null;

        const changeMonth = (delta: number) => {
            setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
            setSelectedDate(null);
        };
    
        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-700">&lt;</button>
                    <h3 className="text-xl font-bold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-700">&gt;</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-brand-text-secondary mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map(day => (
                        <div
                            key={day.key}
                            onClick={() => !day.isPadding && setSelectedDate(day.dateString)}
                            className={`h-20 p-1.5 rounded-lg transition-colors text-sm ${day.isPadding ? 'bg-brand-bg/50' : 'bg-brand-bg cursor-pointer hover:bg-gray-700'} ${selectedDate === day.dateString ? 'ring-2 ring-brand-primary' : ''}`}
                        >
                            {!day.isPadding && (
                                <div className={`w-6 h-6 flex items-center justify-center rounded-full ${day.isToday ? 'bg-brand-primary text-brand-bg font-bold' : ''}`}>
                                    {day.day}
                                </div>
                            )}
                            {day.matches?.length > 0 && <div className="mt-1 w-2 h-2 bg-yellow-400 rounded-full mx-auto"></div>}
                        </div>
                    ))}
                </div>
                {selectedDayMatches && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <h4 className="font-bold mb-2">Matches on {new Date(selectedDate + 'T00:00:00').toLocaleDateString()}</h4>
                        {selectedDayMatches.map(match => (
                            <div key={match.id} className="bg-brand-bg p-3 rounded-lg flex items-center justify-between gap-2 mb-2">
                                <div>
                                    <p className="font-semibold text-sm">{teamsMap.get(match.teamAId)} vs {teamsMap.get(match.teamBId)}</p>
                                    <p className="text-xs text-brand-text-secondary">{match.time}</p>
                                </div>
                                <button onClick={() => onStartMatch({teamAId: match.teamAId, teamBId: match.teamBId, description: match.description})} className="bg-green-600 text-white font-bold py-1 px-2 rounded-lg hover:bg-green-700 transition-colors text-xs flex items-center gap-1">
                                    <SwordsIcon className="w-3 h-3" /> Start
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const ListView = () => (
        <div className="space-y-3">
            {sortedMatches.length > 0 ? sortedMatches.map(match => (
                 <div key={match.id} className="bg-brand-bg p-4 rounded-lg flex items-center justify-between gap-4">
                    <div className="flex-grow">
                        <p className="font-semibold">{teamsMap.get(match.teamAId) || 'Team A'} vs {teamsMap.get(match.teamBId) || 'Team B'}</p>
                        <p className="text-sm text-brand-text-secondary">{new Date(`${match.date}T${match.time}`).toLocaleString()}</p>
                        {match.description && <p className="text-sm text-brand-text-secondary italic mt-1">"{match.description}"</p>}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <button onClick={() => onStartMatch({teamAId: match.teamAId, teamBId: match.teamBId, description: match.description})} className="bg-green-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1">
                            <SwordsIcon className="w-4 h-4" /> Start
                        </button>
                        <button onClick={() => handleDelete(match.id)} className="text-red-500 hover:text-red-400 text-sm font-semibold">Delete</button>
                    </div>
                </div>
            )) : <p className="text-center text-brand-text-secondary py-4">No matches scheduled{filteredTeamName ? ` for ${filteredTeamName}` : ''}.</p>}
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <form onSubmit={handleSubmit} className="bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary mb-4">Schedule a Match</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select value={teamAId} onChange={e => setTeamAId(e.target.value)} required className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary">
                        <option value="">Select Team A</option>
                        {sortedTeams.filter(t => t.id !== teamBId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={teamBId} onChange={e => setTeamBId(e.target.value)} required className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary">
                        <option value="">Select Team B</option>
                        {sortedTeams.filter(t => t.id !== teamAId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                </div>
                <div className="mt-4">
                    <label htmlFor="match-description" className="block text-sm font-medium text-brand-text-secondary mb-1">Description (Optional)</label>
                    <input
                        id="match-description"
                        type="text"
                        placeholder="e.g., Playoffs - Round 1"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                </div>
                <button type="submit" className="mt-4 w-full bg-brand-primary text-brand-bg font-bold py-2 px-6 rounded-lg hover:bg-brand-secondary transition-colors">
                    Add to Schedule
                </button>
            </form>

            <div className="bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-brand-primary mb-4">Import Schedule from CSV</h2>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label htmlFor="csv-upload" className="w-full sm:w-auto flex-shrink-0 cursor-pointer bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center">
                        <UploadIcon className="w-5 h-5 mr-2" />
                        {csvFile ? 'Import Another File' : 'Import from CSV'}
                    </label>
                    <input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                    <span className="flex-grow text-brand-text-secondary text-sm truncate">{csvFile ? `Last import attempted: ${csvFile.name}` : 'Select a file to automatically import matches.'}</span>
                </div>
                {importStatus.type !== 'idle' && (
                    <div className={`mt-4 p-3 rounded-lg text-sm whitespace-pre-wrap ${importStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                        {importStatus.message}
                    </div>
                )}
                 <p className="text-xs text-brand-text-secondary mt-3">Required columns: <code className="bg-brand-bg px-1 rounded">Team A Name</code>, <code className="bg-brand-bg px-1 rounded">Team B Name</code>, <code className="bg-brand-bg px-1 rounded">Date</code> (YYYY-MM-DD), <code className="bg-brand-bg px-1 rounded">Time</code> (HH:MM). Optional: <code className="bg-brand-bg px-1 rounded">Description</code>.</p>
                 <div className="mt-4">
                     <button type="button" onClick={handleDownloadTemplate} className="flex items-center gap-2 text-sm bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
                        <DownloadIcon className="w-4 h-4" />
                        Download Template
                    </button>
                 </div>
            </div>

            <div className="bg-brand-surface p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h2 className="text-2xl font-bold text-brand-primary">Upcoming Schedule</h2>
                    <div className="flex items-center bg-brand-bg p-1 rounded-lg">
                        <button onClick={() => setView('calendar')} className={`px-3 py-1 text-sm font-bold rounded-md transition-colors flex items-center gap-2 ${view === 'calendar' ? 'bg-brand-primary text-brand-bg' : 'text-brand-text-secondary hover:bg-gray-700'}`}>
                            <CalendarIcon className="w-4 h-4" /> Calendar
                        </button>
                         <button onClick={() => setView('list')} className={`px-3 py-1 text-sm font-bold rounded-md transition-colors flex items-center gap-2 ${view === 'list' ? 'bg-brand-primary text-brand-bg' : 'text-brand-text-secondary hover:bg-gray-700'}`}>
                            <ListViewIcon className="w-4 h-4" /> List
                        </button>
                    </div>
                </div>
                {filteredTeamName && (
                    <div className="bg-brand-bg p-3 rounded-lg mb-4 flex items-center justify-between">
                        <p className="text-brand-text">
                            Showing matches for: <span className="font-bold text-brand-primary">{filteredTeamName}</span>
                        </p>
                        <button onClick={handleClearFilter} className="text-sm bg-gray-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-gray-700">
                            &times; Clear Filter
                        </button>
                    </div>
                )}
                {view === 'calendar' ? <CalendarView /> : <ListView />}
            </div>
        </div>
    );
};

export default Schedule;
