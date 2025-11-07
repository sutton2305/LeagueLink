import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Team, TournamentBracket, BracketNode, League, RoundRobinMatch, Player, BracketParticipant, BracketMatchParticipant } from '../types';
import TournamentIcon from './icons/TournamentIcon';
import SwordsIcon from './icons/SwordsIcon';
import HorseshoeIcon from './icons/HorseshoeIcon';

type MatchToStart = ({ teamAId: string, teamBId: string } | { playerAId: string, playerBId: string }) & { description?: string };

interface BracketsProps {
    league: League;
    teams: Team[];
    setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
    players: Player[];
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
    playerRingerStats: Record<string, number>;
    brackets: TournamentBracket[];
    setBrackets: React.Dispatch<React.SetStateAction<TournamentBracket[]>>;
    onBracketUpdate: (bracketId: string, updatedBracket: TournamentBracket) => void;
    onStartLiveMatch: (ids: MatchToStart, source: any) => void;
}

// Helper to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const generateSingleEliminationBracket = (
    name: string,
    leagueId: string,
    participants: (Team | Player)[],
    participantType: 'team' | 'player',
    numberOfPits: number
): TournamentBracket => {
    const numParticipants = participants.length;
    const numRounds = Math.ceil(Math.log2(numParticipants));
    const bracketSize = Math.pow(2, numRounds);
    const numByes = bracketSize - numParticipants;

    const shuffledParticipants = shuffleArray(participants).map(p => ({ id: p.id, name: p.name, avatarUrl: (p as Player).avatarUrl }));

    const rounds: BracketNode[][] = [];

    // --- Round 1 ---
    const round1: BracketNode[] = [];
    const participantsInRound1 = shuffledParticipants.slice(numByes);
    const byes = shuffledParticipants.slice(0, numByes);
    
    for (let i = 0; i < participantsInRound1.length; i += 2) {
        const matchId = `R1-M${round1.length + 1}`;
        const participantA = participantsInRound1[i];
        const participantB = participantsInRound1[i+1];
        round1.push({
            id: matchId,
            participantA: { id: participantA.id, name: participantA.name, score: null, avatarUrl: participantA.avatarUrl },
            participantB: { id: participantB?.id || null, name: participantB?.name || 'TBD', score: null, avatarUrl: participantB?.avatarUrl },
            winnerId: null,
            matchIdentifier: matchId,
            nextMatchId: null,
        });
    }
    rounds.push(round1);

    // --- Subsequent Rounds ---
    for (let i = 1; i < numRounds; i++) {
        const previousRoundMatches = rounds[i - 1].length;
        const byesInPreviousRound = i === 1 ? byes.length : 0;
        const totalFeeders = previousRoundMatches + byesInPreviousRound;
        const currentRoundSize = totalFeeders / 2;

        const currentRound: BracketNode[] = [];
        for (let j = 0; j < currentRoundSize; j++) {
            const matchId = `R${i + 1}-M${j + 1}`;
            currentRound.push({
                id: matchId,
                participantA: { id: null, name: 'TBD', score: null },
                participantB: { id: null, name: 'TBD', score: null },
                winnerId: null,
                matchIdentifier: matchId,
                nextMatchId: null,
            });
        }
        rounds.push(currentRound);
    }
    
    // --- Link Matches and Propagate Byes ---
    for (let i = 0; i < numRounds - 1; i++) {
        const currentRound = rounds[i];
        const nextRound = rounds[i + 1];
        
        const feeders = i === 0 
            ? [...currentRound, ...byes.map(b => ({ id: b.id, isBye: true }))]
            : currentRound;

        for (let j = 0; j < feeders.length; j += 2) {
            const nextMatchIndex = Math.floor(j / 2);
            if (nextRound[nextMatchIndex]) {
                if (!feeders[j].isBye) {
                    (feeders[j] as BracketNode).nextMatchId = nextRound[nextMatchIndex].id;
                }
                 if (feeders[j + 1] && !feeders[j+1].isBye) {
                    (feeders[j+1] as BracketNode).nextMatchId = nextRound[nextMatchIndex].id;
                }
            }
        }
    }
    
    byes.forEach((byeParticipant, index) => {
        const matchIndexInR2 = Math.floor(index / 2);
        const slot = index % 2 === 0 ? 'participantA' : 'participantB';
        if(rounds[1] && rounds[1][matchIndexInR2]) {
            rounds[1][matchIndexInR2][slot] = { id: byeParticipant.id, name: byeParticipant.name, score: null, avatarUrl: byeParticipant.avatarUrl };
        }
    });

    return {
        id: `bracket-${Date.now()}`,
        leagueId,
        name,
        type: 'single-elimination',
        participantType,
        participants: shuffledParticipants,
        rounds,
        numberOfPits,
    };
};

const generateRoundRobinTournament = (
    name: string,
    leagueId: string,
    participantsList: (Team | Player)[],
    participantType: 'team' | 'player',
    numberOfPits: number
): TournamentBracket => {
    // The final list of participants for the bracket object should be the original ones.
    const tournamentParticipants = participantsList.map(p => ({ id: p.id, name: p.name, avatarUrl: (p as Player).avatarUrl }));
    
    // Make a mutable copy for scheduling.
    let scheduleParticipants = [...tournamentParticipants];
    
    const matches: RoundRobinMatch[] = [];

    // If odd number of participants, add a dummy "bye" participant for scheduling.
    if (scheduleParticipants.length % 2 !== 0) {
        scheduleParticipants.push({ id: 'bye', name: 'Bye', avatarUrl: undefined });
    }

    const numParticipants = scheduleParticipants.length;
    const numRounds = numParticipants - 1;
    const half = numParticipants / 2;
    
    // First participant is fixed, the rest rotate.
    const rotatingParticipants = scheduleParticipants.slice(1);
    const fixedParticipant = scheduleParticipants[0];

    for (let round = 0; round < numRounds; round++) {
        const currentRoundParticipants = [fixedParticipant, ...rotatingParticipants];
        
        for (let i = 0; i < half; i++) {
            const participantA = currentRoundParticipants[i];
            const participantB = currentRoundParticipants[numParticipants - 1 - i];

            // Don't create an actual match if one of the participants is the "bye" dummy.
            if (participantA.id === 'bye' || participantB.id === 'bye') {
                continue;
            }

            matches.push({
                id: `rr-match-${participantA.id}-${participantB.id}`,
                participantA: { id: participantA.id, name: participantA.name, score: null, avatarUrl: participantA.avatarUrl },
                participantB: { id: participantB.id, name: participantB.name, score: null, avatarUrl: participantB.avatarUrl },
                winnerId: null,
            });
        }

        // Rotate participants for the next round (move last element to the front of rotating list)
        rotatingParticipants.unshift(rotatingParticipants.pop()!);
    }

    return {
        id: `bracket-${Date.now()}`,
        leagueId,
        name,
        type: 'round-robin',
        participantType,
        participants: tournamentParticipants, // Use original list of participants
        matches,
        numberOfPits,
    };
};

const generateDoubleEliminationBracket = (
    name: string,
    leagueId: string,
    participants: (Team | Player)[],
    participantType: 'team' | 'player',
    numberOfPits: number
): TournamentBracket => {
    // Special case for 8 participants to create the playoff bracket from the user's image.
    if (participants.length === 8) {
        const p = shuffleArray(participants).map(p => ({ id: p.id, name: p.name, avatarUrl: (p as Player).avatarUrl, score: null }));
        const TBD: BracketMatchParticipant = { id: null, name: 'TBD', score: null };

        const createNode = (id: string, pA: BracketMatchParticipant, pB: BracketMatchParticipant, gameNumber: number, nextMatchId: string | null, loserDestId: string | null, identifier: string): BracketNode => ({
            id,
            participantA: { ...pA },
            participantB: { ...pB },
            winnerId: null,
            matchIdentifier: identifier,
            nextMatchId,
            loserDestinationMatchId: loserDestId,
            gameNumber,
        });

        const G1 = createNode('G1', p[0], p[1], 1, 'G7', 'G5', 'R1-M1');
        const G2 = createNode('G2', p[2], p[3], 2, 'G7', 'G5', 'R1-M2');
        const G3 = createNode('G3', p[4], p[5], 3, 'G8', 'G6', 'R1-M3');
        const G4 = createNode('G4', p[6], p[7], 4, 'G8', 'G6', 'R1-M4');

        const G7 = createNode('G7', TBD, TBD, 7, 'G12', 'G10', 'Winner\'s Semifinal 1');
        const G8 = createNode('G8', TBD, TBD, 8, 'G12', 'G10', 'Winner\'s Semifinal 2');
        
        const G12 = createNode('G12', TBD, TBD, 12, null, null, 'Championship');

        const G5 = createNode('G5', TBD, TBD, 5, 'G11', 'G9', 'Consolation Semifinal 1');
        const G6 = createNode('G6', TBD, TBD, 6, 'G11', 'G9', 'Consolation Semifinal 2');

        const G11 = createNode('G11', TBD, TBD, 11, null, null, 'Consolation Final');

        const G9 = createNode('G9', TBD, TBD, 9, null, null, '7th Place Game');
        const G10 = createNode('G10', TBD, TBD, 10, null, null, '3rd Place Game');

        return {
            id: `bracket-${Date.now()}`,
            leagueId,
            name,
            type: 'double-elimination',
            participantType,
            participants: p,
            rounds: [[G1, G2, G3, G4], [G7, G8], [G12]],
            loserRounds: [[G5, G6], [G11], [G9, G10]], // Grouped for easier retrieval
        };
    }
    
    // FIX: A proper double-elimination bracket requires at least 3 participants.
    // For 2 participants, it defaults to a single match (functionally single elimination).
    if (participants.length < 3) {
        const wb = generateSingleEliminationBracket(name, leagueId, participants, participantType, numberOfPits);
        wb.type = 'double-elimination'; // Keep type consistent
        if (wb.rounds && wb.rounds.length > 0 && wb.rounds[wb.rounds.length - 1].length > 0) {
            wb.rounds[wb.rounds.length - 1][0].matchIdentifier = 'Grand Final';
        }
        return wb;
    }
    
    // --- Generic Double Elimination for N participants ---

    // 1. Generate Winner's Bracket
    const wb = generateSingleEliminationBracket(name, leagueId, participants, participantType, numberOfPits);
    
    // 2. Generate Loser's Bracket Structure
    const loserRounds: BracketNode[][] = [];
    const TBD: BracketMatchParticipant = { id: null, name: 'TBD', score: null };
    let gameCounter = wb.rounds.flat().length + 1;

    let lbRoundIndex = 0;
    for (let wbRoundIndex = 0; wbRoundIndex < wb.rounds.length; wbRoundIndex++) {
        const wbRound = wb.rounds[wbRoundIndex];
        const numMatches = wbRound.length / (wbRoundIndex === 0 ? 2 : 1);

        if (numMatches < 1 && wbRoundIndex > 0) continue;

        // Add a round for losers of this WB round to play previous LB winners
        const dropDownRound: BracketNode[] = [];
        const numDropDownMatches = Math.ceil(numMatches);
        for (let i = 0; i < numDropDownMatches; i++) {
            dropDownRound.push({
                id: `LB-R${lbRoundIndex + 1}-M${i + 1}`,
                participantA: TBD, participantB: TBD, winnerId: null,
                matchIdentifier: `LB-R${lbRoundIndex + 1}-M${i + 1}`,
                nextMatchId: null, gameNumber: gameCounter++
            });
        }
        if(dropDownRound.length > 0) {
            loserRounds.push(dropDownRound);
            lbRoundIndex++;
        }
        
        // Add a round for the winners of the previous LB round to play each other
        if (numDropDownMatches / 2 >= 1) {
            const consolidationRound: BracketNode[] = [];
            for (let i = 0; i < Math.floor(numDropDownMatches / 2); i++) {
                consolidationRound.push({
                    id: `LB-R${lbRoundIndex + 1}-M${i + 1}`,
                    participantA: TBD, participantB: TBD, winnerId: null,
                    matchIdentifier: `LB-R${lbRoundIndex + 1}-M${i + 1}`,
                    nextMatchId: null, gameNumber: gameCounter++
                });
            }
            if(consolidationRound.length > 0) {
                loserRounds.push(consolidationRound);
                lbRoundIndex++;
            }
        }
    }
    // Remove last empty round if it exists
    if (loserRounds.length > 0 && loserRounds[loserRounds.length - 1]?.length === 0) {
        loserRounds.pop();
    }

    // 3. Link Loser's Bracket matches
    for (let i = 0; i < loserRounds.length - 1; i++) {
        const currentRound = loserRounds[i];
        const nextRound = loserRounds[i + 1];
        for (let j = 0; j < currentRound.length; j++) {
            if(nextRound && nextRound[Math.floor(j/2)]) {
                currentRound[j].nextMatchId = nextRound[Math.floor(j / 2)].id;
            }
        }
    }

    // 4. Link Winner's Bracket losers to Loser's Bracket
    let lbRoundCursor = 0;
    for (let wbRoundIndex = 0; wbRoundIndex < wb.rounds.length; wbRoundIndex++) {
        const wbRound = wb.rounds[wbRoundIndex];
        const correspondingLBRound = loserRounds[lbRoundCursor];
        if (!correspondingLBRound) continue;

        for (let i = 0; i < wbRound.length; i++) {
            // FIX: Correctly link losers to the destination match. For WB Round 1, two losers
            // feed into one LB match. For other rounds, it's often 1-to-1.
            // Using this logic prevents an out-of-bounds access error when wbRound.length > correspondingLBRound.length.
            const targetMatchIndex = wbRoundIndex === 0 ? Math.floor(i / 2) : i;
            const targetMatch = correspondingLBRound[targetMatchIndex];
            if (targetMatch) {
                wbRound[i].loserDestinationMatchId = targetMatch.id;
            }
        }
        lbRoundCursor += wbRoundIndex < 2 ? 1 : 2; // Imperfect cursor logic, but previous fix prevents a crash.
    }

    // 5. Create Grand Final
    const grandFinal: BracketNode = {
        id: 'Grand-Final',
        participantA: TBD, participantB: TBD, winnerId: null,
        matchIdentifier: 'Grand Final', nextMatchId: null,
        gameNumber: gameCounter
    };
    
    const wbFinal = wb.rounds[wb.rounds.length - 1][0];
    
    // FIX: Only create grand final links if a loser bracket was successfully generated.
    if (loserRounds.length > 0 && loserRounds[loserRounds.length - 1].length > 0) {
        const lbFinal = loserRounds[loserRounds.length - 1][0];
        wbFinal.nextMatchId = grandFinal.id;
        if(lbFinal) lbFinal.nextMatchId = grandFinal.id;
        wbFinal.loserDestinationMatchId = null; // Winner of WB Final doesn't have a loser destination

        // Add Grand Final as the last round of the Winner's bracket
        wb.rounds.push([grandFinal]);
    }

    // Assign game numbers to winner's bracket
    let wbGameCounter = 1;
    wb.rounds.forEach(r => r.forEach(m => m.gameNumber = wbGameCounter++));

    return {
        ...wb,
        type: 'double-elimination',
        loserRounds: loserRounds,
    };
};

const BracketMatch: React.FC<{
    node: BracketNode;
    participantType: 'team' | 'player';
    onScoreChange: (participantKey: 'participantA' | 'participantB', score: string) => void;
    onStartLiveMatch: () => void;
    players: Player[];
    playerRingerStats: Record<string, number>;
    registerRef: (id: string, el: HTMLElement | null) => void;
    loserDestinationGameNumber?: number;
}> = ({ node, participantType, onScoreChange, onStartLiveMatch, players, playerRingerStats, registerRef, loserDestinationGameNumber }) => {
    const isWinnerA = node.winnerId && node.winnerId === node.participantA.id;
    const isWinnerB = node.winnerId && node.winnerId === node.participantB.id;
    const matchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        registerRef(node.id, matchRef.current);
        return () => {
            registerRef(node.id, null);
        };
    }, [node.id, registerRef]);


    const ParticipantLine: React.FC<{participant: BracketMatchParticipant, isWinner: boolean, pKey: 'participantA' | 'participantB'}> = ({participant, isWinner, pKey}) => {
        const teamPlayers = participant.id && participantType === 'team' ? players.filter(p => p.teamId === participant.id) : [];
        return (
            <div className={`flex justify-between items-center px-3 py-2 ${isWinner ? 'font-bold text-brand-primary' : 'text-brand-text'}`}>
                <div className="flex items-center gap-2">
                    {participantType === 'player' && participant.avatarUrl && <img src={participant.avatarUrl} alt={participant.name} className="w-8 h-8 rounded-full" />}
                    <div>
                        <span className="truncate">{participant.name}</span>
                        {participantType === 'player' && participant.id && (
                            <div className="text-xs text-brand-text-secondary flex items-center gap-x-2 mt-1">
                                <HorseshoeIcon className="w-3 h-3 text-brand-primary" />
                                <span>{playerRingerStats[participant.id] ?? 0}</span>
                            </div>
                        )}
                        {participantType === 'team' && teamPlayers.length > 0 && (
                            <div className="text-xs text-brand-text-secondary flex items-center gap-x-2 mt-1">
                                {teamPlayers.map(p => (
                                    <div key={p.id} className="flex items-center">
                                        <span className="truncate">{p.name.split(' ')[0]}</span>
                                        <HorseshoeIcon className="w-3 h-3 mx-1 text-brand-primary" />
                                        <span>{playerRingerStats[p.id] ?? 0}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <input
                    type="number"
                    value={participant.score ?? ''}
                    onChange={e => onScoreChange(pKey, e.target.value)}
                    disabled={!participant.id || !!node.isBye}
                    className="w-12 text-center bg-gray-700 rounded ml-2 text-brand-text disabled:bg-gray-800 disabled:cursor-not-allowed"
                />
            </div>
        );
    }

    return (
        <div ref={matchRef} className="relative my-4">
            <div className="bg-brand-bg rounded-lg border border-gray-700 w-64 relative group">
                 {node.gameNumber && (
                    <span className="absolute top-1 right-1 text-xs font-bold text-brand-text-secondary bg-gray-800 px-1.5 py-0.5 rounded z-20">
                        G{node.gameNumber}
                    </span>
                 )}
                 <button
                    onClick={onStartLiveMatch}
                    disabled={!node.participantA.id || !node.participantB.id}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-brand-primary/80 rounded-full text-brand-bg opacity-0 group-hover:opacity-100 disabled:hidden transition-opacity z-10"
                    title="Live Score This Match"
                >
                    <SwordsIcon className="w-6 h-6" />
                </button>
                <div className="relative pt-2">
                    <ParticipantLine participant={node.participantA} isWinner={isWinnerA} pKey="participantA"/>
                    <div className="border-t border-gray-600"></div>
                    <ParticipantLine participant={node.participantB} isWinner={isWinnerB} pKey="participantB"/>
                </div>
            </div>
            {loserDestinationGameNumber && (
                <div className="text-center text-xs text-brand-text-secondary mt-1">
                    Loser to G{loserDestinationGameNumber}
                </div>
            )}
        </div>
    );
};

interface MatchCardProps {
    match: RoundRobinMatch | BracketNode;
    onScoreChange: (pKey: 'participantA' | 'participantB', score: string) => void;
    onStartLiveMatch: () => void;
    isCompleted?: boolean;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onScoreChange, onStartLiveMatch, isCompleted }) => {
    const isWinnerA = match.winnerId && match.winnerId === match.participantA.id;
    const isWinnerB = match.winnerId && match.winnerId === match.participantB.id;
    
    return (
        <div className={`p-2 rounded-lg relative group ${isCompleted ? 'bg-gray-800/60' : 'bg-yellow-900/50'}`}>
            <div className="flex items-center justify-between gap-2">
                {/* Participant A */}
                <div className="flex-1 flex items-center gap-2">
                    <span className={`truncate text-sm font-medium flex-1 text-left ${isWinnerA ? 'text-brand-primary' : ''}`}>{match.participantA.name}</span>
                    <input 
                        type="number" 
                        value={match.participantA.score ?? ''}
                        onChange={e => onScoreChange('participantA', e.target.value)} 
                        className="w-10 text-center bg-gray-700 rounded text-brand-text text-sm"
                        disabled={isCompleted}
                    />
                </div>
                
                <span className="text-gray-400 text-sm">vs</span>

                {/* Participant B */}
                <div className="flex-1 flex items-center gap-2 flex-row-reverse">
                     <span className={`truncate text-sm font-medium flex-1 text-right ${isWinnerB ? 'text-brand-primary' : ''}`}>{match.participantB.name}</span>
                    <input 
                        type="number" 
                        value={match.participantB.score ?? ''}
                        onChange={e => onScoreChange('participantB', e.target.value)} 
                        className="w-10 text-center bg-gray-700 rounded text-brand-text text-sm"
                        disabled={isCompleted}
                    />
                </div>
            </div>

            {!isCompleted && (
                 <button
                    onClick={onStartLiveMatch}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1.5 bg-brand-primary/80 rounded-full text-brand-bg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Live Score This Match"
                >
                    <SwordsIcon className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};

const RoundRobinDisplay: React.FC<{
    bracket: TournamentBracket;
    onScoreChange: (matchIndex: number, pKey: 'participantA' | 'participantB', score: string) => void;
    onStartLiveMatch: (matchId: string, pA_id: string, pB_id: string) => void;
}> = ({ bracket, onScoreChange, onStartLiveMatch }) => {
    const { numberOfPits = 1 } = bracket;

    const [activePitMatches, setActivePitMatches] = useState<(RoundRobinMatch | null)[]>([]);

    useEffect(() => {
        const allUnfinishedMatches = bracket.matches?.filter(m => !m.winnerId) || [];

        setActivePitMatches(currentPitMatches => {
            // Validate current pits: remove finished matches and adjust size
            let newPitMatches = currentPitMatches
                .map(matchInPit => {
                    if (!matchInPit) return null;
                    const stillUnfinished = allUnfinishedMatches.some(m => m.id === matchInPit.id);
                    return stillUnfinished ? matchInPit : null;
                })
                .slice(0, numberOfPits);
            while (newPitMatches.length < numberOfPits) {
                newPitMatches.push(null);
            }

            // Identify busy teams and matches in pits
            const busyTeamIds = new Set<string>();
            const pitMatchIds = new Set<string>();
            newPitMatches.forEach(match => {
                if (match) {
                    busyTeamIds.add(match.participantA.id!);
                    busyTeamIds.add(match.participantB.id!);
                    pitMatchIds.add(match.id);
                }
            });

            // Get the pool of available matches
            let availableMatches = allUnfinishedMatches.filter(m => !pitMatchIds.has(m.id));

            // Fill empty pits
            for (let i = 0; i < numberOfPits; i++) {
                if (newPitMatches[i] === null) { // Pit is empty
                    let suitableMatchIndex = -1;
                    const suitableMatch = availableMatches.find((match, index) => {
                        if (!busyTeamIds.has(match.participantA.id!) && !busyTeamIds.has(match.participantB.id!)) {
                            suitableMatchIndex = index;
                            return true;
                        }
                        return false;
                    });

                    if (suitableMatch) {
                        newPitMatches[i] = suitableMatch;
                        busyTeamIds.add(suitableMatch.participantA.id!);
                        busyTeamIds.add(suitableMatch.participantB.id!);
                        availableMatches.splice(suitableMatchIndex, 1);
                    }
                }
            }
            
            // Compare and return
            if (JSON.stringify(currentPitMatches) === JSON.stringify(newPitMatches)) {
                return currentPitMatches;
            }
            return newPitMatches;
        });
    }, [bracket.matches, numberOfPits]);

    const onDeckQueue = useMemo(() => {
        const pitMatchIds = new Set(activePitMatches.filter(Boolean).map(m => m!.id));
        return bracket.matches?.filter(m => !m.winnerId && !pitMatchIds.has(m.id)) || [];
    }, [bracket.matches, activePitMatches]);

    const standings = useMemo(() => {
        const stats: Record<string, { wins: number; losses: number; ties: number; gamesPlayed: number; pName: string }> = {};
        bracket.participants.forEach(p => {
            stats[p.id] = { wins: 0, losses: 0, ties: 0, gamesPlayed: 0, pName: p.name };
        });

        bracket.matches?.forEach(match => {
            if (match.winnerId) {
                stats[match.participantA.id!].gamesPlayed++;
                stats[match.participantB.id!].gamesPlayed++;
                if (match.winnerId === match.participantA.id) {
                    stats[match.participantA.id!].wins++;
                    stats[match.participantB.id!].losses++;
                } else if (match.winnerId === match.participantB.id) {
                    stats[match.participantB.id!].wins++;
                    stats[match.participantA.id!].losses++;
                }
            } else if (match.participantA.score !== null && match.participantB.score !== null && match.participantA.score === match.participantB.score) {
                 stats[match.participantA.id!].gamesPlayed++;
                 stats[match.participantB.id!].gamesPlayed++;
                 stats[match.participantA.id!].ties++;
                 stats[match.participantB.id!].ties++;
            }
        });

        return Object.values(stats).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    }, [bracket]);

    const onDeckMatchesToDisplay = onDeckQueue.slice(0, 5);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-brand-surface p-4 rounded-xl">
                <h3 className="text-xl font-bold text-brand-primary mb-4">Live Matches</h3>
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                    {/* Pits Section */}
                    <div className={`grid grid-cols-1 ${numberOfPits > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
                        {activePitMatches.map((match, index) => {
                            return (
                                <div key={match ? match.id : `pit-${index}`} className="bg-brand-bg p-3 rounded-lg flex flex-col min-h-[120px]">
                                    <h4 className="font-bold text-lg text-center text-brand-text-secondary mb-1">
                                        <span className="text-brand-primary">Pit {index + 1}</span>
                                    </h4>
                                    {match ? (
                                        <>
                                            <p className="text-xs text-center text-green-400 uppercase font-semibold mb-2">Now Playing</p>
                                            <MatchCard
                                                match={match}
                                                onScoreChange={(pKey, score) => {
                                                    const matchIndexInOriginalArray = bracket.matches?.findIndex(m => m.id === match.id) ?? -1;
                                                    if (matchIndexInOriginalArray !== -1) {
                                                        onScoreChange(matchIndexInOriginalArray, pKey, score);
                                                    }
                                                }}
                                                onStartLiveMatch={() => onStartLiveMatch(match.id, match.participantA.id!, match.participantB.id!)}
                                            />
                                        </>
                                    ) : (
                                        <div className="text-center text-brand-text-secondary flex-grow flex items-center justify-center">
                                            <div>
                                                <p className="text-xs uppercase font-semibold text-gray-500 mb-2">Open</p>
                                                <p>{(bracket.matches?.filter(m => !m.winnerId).length || 0) > 0 ? 'Waiting for available teams...' : 'All matches complete.'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* On Deck Queue */}
                    {onDeckMatchesToDisplay.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-700">
                            <h3 className="text-xl font-bold text-brand-primary mb-2 text-center">Next Up</h3>
                            <p className="text-sm text-center text-brand-text-secondary mb-4">These games will start in the next available pit.</p>
                            <div className="space-y-2 max-w-md mx-auto">
                                {onDeckMatchesToDisplay.map((match, index) => (
                                    <div key={match.id} className="p-2 rounded-lg bg-gray-800/50 opacity-80 text-center flex items-center justify-center gap-2">
                                        <span className="font-bold text-brand-text-secondary">{index + 1}.</span>
                                        <span className="truncate text-sm font-medium">{match.participantA.name}</span>
                                        <span className="text-gray-400 text-sm mx-2">vs</span>
                                        <span className="truncate text-sm font-medium">{match.participantB.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="lg:col-span-1 bg-brand-surface p-4 rounded-xl">
                <h3 className="text-xl font-bold text-brand-primary mb-4">Standings</h3>
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-600">
                          <th className="pb-2">Participant</th>
                          <th className="text-center pb-2">W</th>
                          <th className="text-center pb-2">L</th>
                          <th className="text-center pb-2">T</th>
                          <th className="text-center pb-2">GP</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {standings.map(p => (
                            <tr key={p.pName}>
                                <td className="py-2 truncate font-medium">{p.pName}</td>
                                <td className="text-center py-2 text-green-400">{p.wins}</td>
                                <td className="text-center py-2 text-red-400">{p.losses}</td>
                                <td className="text-center py-2 text-gray-400">{p.ties}</td>
                                <td className="text-center py-2 font-bold">{p.gamesPlayed}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface BracketConnectorsProps {
    bracket: TournamentBracket;
    elementRefs: Record<string, HTMLElement>;
    containerRef: React.RefObject<HTMLDivElement>;
}

const BracketConnectors: React.FC<BracketConnectorsProps> = ({ bracket, elementRefs, containerRef }) => {
    const [paths, setPaths] = useState<string[]>([]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const newPaths: string[] = [];
        const allRounds = [...(bracket.rounds || []), ...(bracket.loserRounds || [])].flat();

        for (const match of allRounds) {
            if (!match.nextMatchId) continue;

            const fromEl = elementRefs[match.id];
            const toEl = elementRefs[match.nextMatchId];

            if (fromEl && toEl) {
                const containerRect = container.getBoundingClientRect();
                const fromRect = fromEl.getBoundingClientRect();
                const toRect = toEl.getBoundingClientRect();

                const startX = fromRect.right - containerRect.left;
                const startY = fromRect.top + fromRect.height / 2 - containerRect.top;

                const endX = toRect.left - containerRect.left;
                const endY = toRect.top + toRect.height / 2 - containerRect.top;

                const midX = startX + 32; // 32px is half of the margin between rounds

                const path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
                newPaths.push(path);
            }
        }

        setPaths(newPaths);
    }, [bracket, elementRefs, containerRef]);

    return (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
            <g fill="none" stroke="#6b7280" strokeWidth="2">
                {paths.map((d, i) => (
                    <path key={i} d={d} />
                ))}
            </g>
        </svg>
    );
};

const EliminationDisplay: React.FC<{
    bracket: TournamentBracket;
    onScoreChange: (bracketType: 'winners' | 'losers', roundIdx: number, matchIdx: number, pKey: 'participantA' | 'participantB', score: string) => void;
    // FIX: Updated signature to pass the full BracketNode object to resolve type errors.
    onStartLiveMatch: (bracketType: 'winners' | 'losers', roundIdx: number, matchIdx: number, node: BracketNode) => void;
    players: Player[];
    playerRingerStats: Record<string, number>;
    registerRef: (id: string, el: HTMLElement | null) => void;
    title: string;
    bracketKey: 'rounds' | 'loserRounds';
}> = ({ bracket, onScoreChange, onStartLiveMatch, players, playerRingerStats, registerRef, title, bracketKey }) => {
    const rounds = bracket[bracketKey] || [];
    if (!rounds || rounds.length === 0) return null;

    const bracketType = bracketKey === 'rounds' ? 'winners' : 'losers';

    const gameNumberMap = useMemo(() => {
        const map = new Map<string, number>();
        bracket.rounds?.flat().forEach(m => { if(m.gameNumber) map.set(m.id, m.gameNumber) });
        bracket.loserRounds?.flat().forEach(m => { if(m.gameNumber) map.set(m.id, m.gameNumber) });
        return map;
    }, [bracket]);

    return (
        <div>
            <h2 className={`text-2xl font-bold ${bracketType === 'winners' ? 'text-brand-primary' : 'text-yellow-600'} mb-4 text-center`}>{title}</h2>
            <div className="bg-brand-surface p-4 rounded-xl">
                <div className="flex">
                    {rounds.map((round, roundIndex) => (
                        <div key={`${bracketKey}-${roundIndex}`} className="flex flex-col justify-around mr-16">
                            <h3 className="text-center font-bold text-brand-primary text-xl mb-4">
                                {bracketType === 'winners' && roundIndex === rounds.length - 1 ? 'Grand Final' : `Round ${roundIndex + 1}`}
                            </h3>
                            {round.map((node, matchIndex) => {
                                const loserDestinationGameNumber = node.loserDestinationMatchId
                                    ? gameNumberMap.get(node.loserDestinationMatchId)
                                    : undefined;

                                return (
                                    <BracketMatch
                                        key={node.id}
                                        node={node}
                                        participantType={bracket.participantType}
                                        onScoreChange={(pKey, score) => onScoreChange(bracketType, roundIndex, matchIndex, pKey, score)}
                                        // FIX: Pass the full 'node' object instead of individual properties to match the updated signature.
                                        onStartLiveMatch={() => node.participantA.id && node.participantB.id && onStartLiveMatch(bracketType, roundIndex, matchIndex, node)}
                                        players={players}
                                        playerRingerStats={playerRingerStats}
                                        registerRef={registerRef}
                                        loserDestinationGameNumber={loserDestinationGameNumber}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

type EliminationMatchWithSource = BracketNode & {
    _source: { type: 'winners' | 'losers', roundIndex: number, matchIndex: number }
};

const EliminationGamesView: React.FC<{
    bracket: TournamentBracket;
    onScoreChange: (match: EliminationMatchWithSource, pKey: 'participantA' | 'participantB', score: string) => void;
    onStartLiveMatch: (match: EliminationMatchWithSource) => void;
}> = ({ bracket, onScoreChange, onStartLiveMatch }) => {
    const { numberOfPits = 1 } = bracket;

    const allMatches = useMemo((): EliminationMatchWithSource[] => {
        if (!bracket) return [];
        const flattened: EliminationMatchWithSource[] = [];
        (bracket.rounds || []).forEach((round, roundIndex) => {
            round.forEach((match, matchIndex) => {
                flattened.push({ ...match, _source: { type: 'winners', roundIndex, matchIndex } });
            });
        });
        (bracket.loserRounds || []).forEach((round, roundIndex) => {
            round.forEach((match, matchIndex) => {
                flattened.push({ ...match, _source: { type: 'losers', roundIndex, matchIndex } });
            });
        });
        return flattened.sort((a, b) => (a.gameNumber || 999) - (b.gameNumber || 999));
    }, [bracket]);

    const completedMatches = useMemo(() => allMatches.filter(m => m.winnerId), [allMatches]);
    const playableMatches = useMemo(() => allMatches.filter(m => !m.winnerId && m.participantA.id && m.participantB.id), [allMatches]);

    const [activePitMatches, setActivePitMatches] = useState<(EliminationMatchWithSource | null)[]>([]);

    useEffect(() => {
        setActivePitMatches(currentPitMatches => {
            let newPitMatches = currentPitMatches
                .map(matchInPit => {
                    if (!matchInPit) return null;
                    const stillUnfinished = !completedMatches.some(m => m.id === matchInPit.id);
                    return stillUnfinished ? matchInPit : null;
                })
                .slice(0, numberOfPits);
            while (newPitMatches.length < numberOfPits) newPitMatches.push(null);

            const busyParticipantIds = new Set<string>();
            const pitMatchIds = new Set<string>();
            newPitMatches.forEach(match => {
                if (match) {
                    busyParticipantIds.add(match.participantA.id!);
                    busyParticipantIds.add(match.participantB.id!);
                    pitMatchIds.add(match.id);
                }
            });

            let availableMatches = playableMatches.filter(m => !pitMatchIds.has(m.id));

            for (let i = 0; i < numberOfPits; i++) {
                if (newPitMatches[i] === null) {
                    let suitableMatchIndex = -1;
                    const suitableMatch = availableMatches.find((match, index) => {
                        if (!busyParticipantIds.has(match.participantA.id!) && !busyParticipantIds.has(match.participantB.id!)) {
                            suitableMatchIndex = index;
                            return true;
                        }
                        return false;
                    });
                    if (suitableMatch) {
                        newPitMatches[i] = suitableMatch;
                        busyParticipantIds.add(suitableMatch.participantA.id!);
                        busyParticipantIds.add(suitableMatch.participantB.id!);
                        availableMatches.splice(suitableMatchIndex, 1);
                    }
                }
            }
            if (JSON.stringify(currentPitMatches) === JSON.stringify(newPitMatches)) return currentPitMatches;
            return newPitMatches;
        });
    }, [playableMatches, completedMatches, numberOfPits]);

    const onDeckQueue = useMemo(() => {
        const pitMatchIds = new Set(activePitMatches.filter(Boolean).map(m => m!.id));
        return playableMatches.filter(m => !pitMatchIds.has(m.id));
    }, [playableMatches, activePitMatches]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-brand-surface p-4 rounded-xl">
                 <div className="max-h-[70vh] overflow-y-auto pr-2">
                    {/* Pits Section */}
                    <div className={`grid grid-cols-1 ${numberOfPits > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
                        {activePitMatches.map((match, index) => (
                            <div key={match ? match.id : `pit-${index}`} className="bg-brand-bg p-3 rounded-lg flex flex-col min-h-[120px]">
                                <h4 className="font-bold text-lg text-center text-brand-text-secondary mb-1">
                                    <span className="text-brand-primary">Pit {index + 1}</span>
                                </h4>
                                {match ? (
                                    <>
                                        <p className="text-xs text-center text-green-400 uppercase font-semibold mb-2">
                                            Now Playing (Game {match.gameNumber})
                                        </p>
                                        <MatchCard match={match} onScoreChange={(pKey, score) => onScoreChange(match, pKey, score)} onStartLiveMatch={() => onStartLiveMatch(match)} />
                                    </>
                                ) : (
                                     <div className="text-center text-brand-text-secondary flex-grow flex items-center justify-center">
                                         <p>{playableMatches.length > 0 ? 'Waiting for available participants...' : 'All matches complete.'}</p>
                                     </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* On Deck Queue */}
                    {onDeckQueue.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-700">
                             <h3 className="text-xl font-bold text-brand-primary mb-2 text-center">On Deck</h3>
                             <div className="space-y-2 max-w-md mx-auto">
                                {onDeckQueue.slice(0, 5).map((match) => (
                                    <div key={match.id} className="p-2 rounded-lg bg-gray-800/50 opacity-80 text-center flex items-center justify-center gap-2">
                                        <span className="font-bold text-brand-text-secondary">G{match.gameNumber}:</span>
                                        <span className="truncate text-sm font-medium">{match.participantA.name}</span>
                                        <span className="text-gray-400 text-sm mx-2">vs</span>
                                        <span className="truncate text-sm font-medium">{match.participantB.name}</span>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                 </div>
            </div>
            <div className="lg:col-span-1 bg-brand-surface p-4 rounded-xl">
                <h3 className="text-xl font-bold text-brand-primary mb-4">Completed ({completedMatches.length})</h3>
                <div className="max-h-[65vh] overflow-y-auto pr-2 space-y-2">
                     {completedMatches.map(match => (
                        <MatchCard key={match.id} match={match} onScoreChange={(pKey, score) => onScoreChange(match, pKey, score)} onStartLiveMatch={() => {}} isCompleted />
                     ))}
                </div>
            </div>
        </div>
    );
};


const Brackets: React.FC<BracketsProps> = ({ league, teams, setTeams, players, setPlayers, playerRingerStats, brackets, setBrackets, onBracketUpdate, onStartLiveMatch }) => {
    const [activeBracketId, setActiveBracketId] = useState<string | null>(brackets.length > 0 ? brackets[0].id : null);
    
    const [isCreating, setIsCreating] = useState<boolean>(brackets.length === 0);
    const [bracketName, setBracketName] = useState('');
    const [bracketType, setBracketType] = useState<'single-elimination' | 'double-elimination' | 'round-robin'>('single-elimination');
    const [participantType, setParticipantType] = useState<'team' | 'player'>('team');
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
    const [newTeamName, setNewTeamName] = useState('');
    const [newPlayerName, setNewPlayerName] = useState('');
    const [numberOfPits, setNumberOfPits] = useState(1);

    const [viewMode, setViewMode] = useState<'bracket' | 'games'>('bracket');
    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const panWrapperRef = useRef<HTMLDivElement>(null);
    const isPanning = useRef(false);
    const panStart = useRef({ x: 0, y: 0 });

    const [elementRefs, setElementRefs] = useState<Record<string, HTMLElement>>({});
    const bracketContainerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const activeBracket = useMemo(() => brackets.find(b => b.id === activeBracketId), [brackets, activeBracketId]);
    
    const registerRef = useCallback((id: string, el: HTMLElement | null) => {
        setElementRefs(prev => {
            const newRefs = { ...prev };
            if (el) {
                newRefs[id] = el;
            } else {
                delete newRefs[id];
            }
            return newRefs;
        });
    }, []);

     useLayoutEffect(() => {
        const container = bracketContainerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(() => {
            setDimensions({
                width: container.offsetWidth,
                height: container.offsetHeight,
            });
        });

        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [activeBracket]); // Rerun when bracket changes

    const handleZoom = (delta: number, isButton = false) => {
        setScale(prev => Math.max(0.2, Math.min(2.5, prev + (isButton ? delta : -delta * 0.001))));
    };
    
    const resetZoomPan = () => {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
    };

    const handlePanStart = (e: React.MouseEvent) => {
        isPanning.current = true;
        panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
        if (panWrapperRef.current) panWrapperRef.current.style.cursor = 'grabbing';
    };

    const handlePanMove = (e: React.MouseEvent) => {
        if (!isPanning.current) return;
        e.preventDefault();
        setTranslate({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    };

    const handlePanEnd = () => {
        isPanning.current = false;
        if (panWrapperRef.current) panWrapperRef.current.style.cursor = 'grab';
    };

    const handleParticipantToggle = (id: string) => {
        setSelectedParticipantIds(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    const handleAddNewTeam = () => {
        if (newTeamName.trim() === '') return;
        const newTeam: Team = {
            id: `team-${Date.now()}`,
            name: newTeamName.trim(),
            leagueId: league.id,
        };
        setTeams(prev => [...prev, newTeam]);
        setSelectedParticipantIds(prev => [...prev, newTeam.id]);
        setNewTeamName('');
    };

    const handleAddNewPlayer = () => {
        if (newPlayerName.trim() === '') return;
        const newPlayer: Player = {
            id: `player-${Date.now()}`,
            name: newPlayerName.trim(),
            avatarUrl: `https://api.dicebear.com/8.x/bottts/svg?seed=${encodeURIComponent(newPlayerName.trim())}`,
            teamId: null,
            leagueId: league.id,
        };
        setPlayers(prev => [...prev, newPlayer]);
        setSelectedParticipantIds(prev => [...prev, newPlayer.id]);
        setNewPlayerName('');
    };

    const handleGenerateRandomTeams = () => {
        const selectedPlayers = players.filter(p => selectedParticipantIds.includes(p.id));

        if (selectedPlayers.length < 2 || selectedPlayers.length % 2 !== 0) {
            alert('Please select an even number of players (at least 2) to generate teams.');
            return;
        }

        const shuffledPlayers = shuffleArray(selectedPlayers);
        const newTeams: Team[] = [];
        const updatedPlayers: Player[] = JSON.parse(JSON.stringify(players)); // Deep copy

        for (let i = 0; i < shuffledPlayers.length; i += 2) {
            const playerA = shuffledPlayers[i] as Player;
            const playerB = shuffledPlayers[i + 1] as Player;

            const newTeam: Team = {
                id: `team-${Date.now()}-${i}`,
                name: `${playerA.name.split(' ')[0]} & ${playerB.name.split(' ')[0]}`,
                leagueId: league.id,
            };
            newTeams.push(newTeam);

            const playerAIndex = updatedPlayers.findIndex(p => p.id === playerA.id);
            if (playerAIndex !== -1) updatedPlayers[playerAIndex].teamId = newTeam.id;

            const playerBIndex = updatedPlayers.findIndex(p => p.id === playerB.id);
            if (playerBIndex !== -1) updatedPlayers[playerBIndex].teamId = newTeam.id;
        }

        setTeams(prev => [...prev, ...newTeams]);
        setPlayers(updatedPlayers);
        setParticipantType('team');
        setSelectedParticipantIds(newTeams.map(t => t.id));
        alert(`${newTeams.length} teams have been randomly generated and selected.`);
    };

    const handleCreateBracket = (e: React.FormEvent) => {
        e.preventDefault();
        const participants = participantType === 'team'
            ? teams.filter(t => selectedParticipantIds.includes(t.id))
            : players.filter(p => selectedParticipantIds.includes(p.id));

        if (bracketName.trim() === '' || participants.length < 2) {
            alert('Please provide a name and select at least 2 participants.');
            return;
        }

        let newBracket: TournamentBracket;
        switch (bracketType) {
            case 'single-elimination':
                newBracket = generateSingleEliminationBracket(bracketName, league.id, participants, participantType, numberOfPits);
                let seGameCounter = 1;
                newBracket.rounds?.forEach(round => round.forEach(match => { match.gameNumber = seGameCounter++; }));
                break;
            case 'double-elimination':
                newBracket = generateDoubleEliminationBracket(bracketName, league.id, participants, participantType, numberOfPits);
                break;
            case 'round-robin':
                newBracket = generateRoundRobinTournament(bracketName, league.id, participants, participantType, numberOfPits);
                break;
            default: return;
        }

        setBrackets(prev => [...prev, newBracket]);
        setActiveBracketId(newBracket.id);
        setBracketName('');
        setSelectedParticipantIds([]);
        setBracketType('single-elimination');
        setIsCreating(false);
    };

    // FIX: Refactored to accept the full BracketNode to prevent type errors.
    const handleEliminationStartMatch = (
        bracketType: 'winners' | 'losers',
        roundIdx: number,
        matchIdx: number,
        node: BracketNode
    ) => {
        if (!activeBracket) return;
        const pA_id = node.participantA.id!;
        const pB_id = node.participantB.id!;
        const matchId = node.id;

        const ids: Partial<MatchToStart> = activeBracket.participantType === 'team' ? { teamAId: pA_id, teamBId: pB_id } : { playerAId: pA_id, playerBId: pB_id };
        const source = { bracketId: activeBracket.id, matchId, type: bracketType, roundIndex: roundIdx, matchIndex: matchIdx };
        const description = `${activeBracket.name}: ${node.matchIdentifier || `G${node.gameNumber}` || node.id}`;
        onStartLiveMatch({ ...ids, description } as MatchToStart, source);
    };

    const handleEliminationGamesStartMatch = (match: EliminationMatchWithSource) => {
         handleEliminationStartMatch(
             match._source.type, 
             match._source.roundIndex, 
             match._source.matchIndex, 
             match
        );
    };

    const handleEliminationScoreChange = (bracketType: 'winners' | 'losers', roundIdx: number, matchIdx: number, pKey: 'participantA' | 'participantB', score: string) => {
        if (!activeBracket) return;
        
        const bracketToUpdate = JSON.parse(JSON.stringify(activeBracket)) as TournamentBracket;
        const rounds = bracketType === 'winners' ? bracketToUpdate.rounds : bracketToUpdate.loserRounds;
        if (!rounds) return;
        
        const matchToUpdate = rounds[roundIdx][matchIdx];
        const newScore = score === '' ? null : parseInt(score, 10);
        
        matchToUpdate[pKey].score = isNaN(newScore!) ? null : newScore;
        
        if (matchToUpdate.participantA.score !== null && matchToUpdate.participantB.score !== null) {
            if (matchToUpdate.participantA.score > matchToUpdate.participantB.score) matchToUpdate.winnerId = matchToUpdate.participantA.id;
            else if (matchToUpdate.participantB.score > matchToUpdate.participantA.score) matchToUpdate.winnerId = matchToUpdate.participantB.id;
            else matchToUpdate.winnerId = null;
        } else {
            matchToUpdate.winnerId = null;
        }

        const allRounds = [...(bracketToUpdate.rounds || []), ...(bracketToUpdate.loserRounds || [])];
        const findMatchById = (id: string | null) => {
            if (!id) return null;
            for (const round of allRounds) {
                const found = round.find(m => m.id === id);
                if (found) return found;
            }
            return null;
        };
        
        const winner = matchToUpdate.winnerId ? (matchToUpdate.winnerId === matchToUpdate.participantA.id ? matchToUpdate.participantA : matchToUpdate.participantB) : null;
        const loser = matchToUpdate.winnerId ? (matchToUpdate.winnerId === matchToUpdate.participantA.id ? matchToUpdate.participantB : matchToUpdate.participantA) : null;

        if (matchToUpdate.nextMatchId && winner) {
            const nextMatch = findMatchById(matchToUpdate.nextMatchId);
            if (nextMatch) {
                const feedingMatches = allRounds.flat().filter(m => m.nextMatchId === nextMatch.id).sort((a,b) => (a.gameNumber ?? 0) - (b.gameNumber ?? 0));
                const feederIndex = feedingMatches.findIndex(m => m.id === matchToUpdate.id);
                const slot = feederIndex === 0 ? 'participantA' : 'participantB';
                nextMatch[slot] = { id: winner.id, name: winner.name, score: null, avatarUrl: winner.avatarUrl };
            }
        }

        if (loser && loser.id && matchToUpdate.loserDestinationMatchId) {
            const destMatch = findMatchById(matchToUpdate.loserDestinationMatchId);
            if (destMatch) {
                const loserFeedingMatches = allRounds.flat()
                    .filter(m => m.loserDestinationMatchId === destMatch.id)
                    .sort((a, b) => (a.gameNumber ?? 0) - (b.gameNumber ?? 0));

                const feederIndex = loserFeedingMatches.findIndex(m => m.id === matchToUpdate.id);
                const slot = feederIndex === 0 ? 'participantA' : 'participantB';

                if (destMatch[slot]?.id === null) {
                     destMatch[slot] = { id: loser.id, name: loser.name, score: null, avatarUrl: loser.avatarUrl };
                } else {
                    const fallbackSlot = slot === 'participantA' ? 'participantB' : 'participantA';
                    if(destMatch[fallbackSlot]?.id === null) {
                        destMatch[fallbackSlot] = { id: loser.id, name: loser.name, score: null, avatarUrl: loser.avatarUrl };
                    }
                }
            }
        }
        
        onBracketUpdate(activeBracket.id, bracketToUpdate);
    };

    const handleRoundRobinScoreChange = (matchIndex: number, pKey: 'participantA' | 'participantB', score: string) => {
        if (!activeBracket || !activeBracket.matches) return;
        
        const newBracket = JSON.parse(JSON.stringify(activeBracket));
        const match = newBracket.matches![matchIndex];
        const newScore = score === '' ? null : parseInt(score, 10);
        match[pKey].score = isNaN(newScore!) ? null : newScore;
        if (match.participantA.score !== null && match.participantB.score !== null) {
            if (match.participantA.score > match.participantB.score) match.winnerId = match.participantA.id;
            else if (match.participantB.score > match.participantA.score) match.winnerId = match.participantB.id;
            else match.winnerId = null;
        } else {
            match.winnerId = null;
        }
        onBracketUpdate(activeBracket.id, newBracket);
    };

    const handleDeleteBracket = (bracketId: string) => {
        if (window.confirm("Are you sure you want to delete this bracket? This action cannot be undone.")) {
            const remainingBrackets = brackets.filter(b => b.id !== bracketId);
            setBrackets(remainingBrackets);
            if (activeBracketId === bracketId) {
                setActiveBracketId(remainingBrackets.length > 0 ? remainingBrackets[0].id : null);
                if (remainingBrackets.length === 0) setIsCreating(true);
            }
        }
    };

    const EightTeamPlayoffDisplay = () => {
        if (!activeBracket) return null;

        const findMatch = (gameNumber: number): BracketNode | undefined => {
            return [...(activeBracket.rounds || []), ...(activeBracket.loserRounds || [])].flat().find(m => m.gameNumber === gameNumber);
        };

        const matches = {
            G1: findMatch(1), G2: findMatch(2), G3: findMatch(3), G4: findMatch(4),
            G5: findMatch(5), G6: findMatch(6), G7: findMatch(7), G8: findMatch(8),
            G9: findMatch(9), G10: findMatch(10), G11: findMatch(11), G12: findMatch(12),
        };
        
        const getMatchProps = (node: BracketNode, bracketKey: 'rounds' | 'loserRounds') => {
             const round = activeBracket[bracketKey]?.find(r => r.some(m => m.id === node.id));
             const roundIndex = activeBracket[bracketKey]?.findIndex(r => r === round) ?? -1;
             const matchIndex = round?.findIndex(m => m.id === node.id) ?? -1;
             const bracketType = bracketKey === 'rounds' ? 'winners' : 'losers';

            return {
                key: node.id,
                node,
                participantType: activeBracket.participantType,
                onScoreChange: (pKey: 'participantA' | 'participantB', score: string) => handleEliminationScoreChange(bracketType, roundIndex, matchIndex, pKey, score),
                onStartLiveMatch: () => handleEliminationStartMatch(bracketType, roundIndex, matchIndex, node),
                players,
                playerRingerStats,
                registerRef: () => {},
            };
        };

        if (Object.values(matches).some(m => !m)) {
            return <div className="text-center p-8">Error: Could not construct playoff bracket. Please try re-creating it.</div>;
        }
        
        return (
            <div className="bg-brand-surface p-4 rounded-xl overflow-x-auto">
                <div className="flex justify-center items-start gap-8 min-w-[1200px]">
                    {/* Consolation Bracket */}
                    <div className="flex flex-col items-center">
                        <h3 className="font-bold text-xl text-yellow-600 mb-4">Consolation Bracket</h3>
                        <div className="flex items-center gap-8">
                            <div className="flex flex-col justify-around">
                                <BracketMatch {...getMatchProps(matches.G5!, 'loserRounds')} />
                                <BracketMatch {...getMatchProps(matches.G6!, 'loserRounds')} />
                            </div>
                            <div className="flex flex-col justify-center">
                                <BracketMatch {...getMatchProps(matches.G11!, 'loserRounds')} />
                            </div>
                        </div>
                    </div>

                    {/* Winner's Bracket */}
                    <div className="flex flex-col items-center">
                        <h3 className="font-bold text-xl text-brand-primary mb-4">Winner's Bracket</h3>
                        <div className="flex items-center gap-8">
                            <div className="flex flex-col justify-around">
                                <BracketMatch {...getMatchProps(matches.G1!, 'rounds')} />
                                <BracketMatch {...getMatchProps(matches.G2!, 'rounds')} />
                                <BracketMatch {...getMatchProps(matches.G3!, 'rounds')} />
                                <BracketMatch {...getMatchProps(matches.G4!, 'rounds')} />
                            </div>
                            <div className="flex flex-col justify-around">
                                <BracketMatch {...getMatchProps(matches.G7!, 'rounds')} />
                                <BracketMatch {...getMatchProps(matches.G8!, 'rounds')} />
                            </div>
                            <div className="flex flex-col justify-center">
                                <BracketMatch {...getMatchProps(matches.G12!, 'rounds')} />
                            </div>
                        </div>
                    </div>
                </div>
                {/* Placement Games */}
                <div className="mt-8 pt-8 border-t-2 border-gray-700 flex justify-center gap-16">
                     <div className="flex flex-col items-center">
                        <h3 className="font-bold text-lg text-brand-text-secondary mb-2">7th Place</h3>
                        <BracketMatch {...getMatchProps(matches.G9!, 'loserRounds')} />
                     </div>
                     <div className="flex flex-col items-center">
                        <h3 className="font-bold text-lg text-brand-text-secondary mb-2">3rd Place</h3>
                        <BracketMatch {...getMatchProps(matches.G10!, 'loserRounds')} />
                     </div>
                </div>
            </div>
        );
    };

    if (isCreating) {
        const availableParticipants = participantType === 'team' ? teams : players;
        return (
            <div className="max-w-4xl mx-auto bg-brand-surface p-6 rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-brand-primary mb-6 flex items-center">
                    <TournamentIcon className="w-8 h-8 mr-3"/>
                    Create a Tournament
                </h2>
                <form onSubmit={handleCreateBracket}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Tournament Name</label>
                        <input type="text" value={bracketName} onChange={e => setBracketName(e.target.value)} className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" placeholder="e.g., Spring Season Playoffs" />
                    </div>
                     <div className="mb-4">
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Format</label>
                        <div className="flex space-x-4">
                           <label className="flex items-center"><input type="radio" value="single-elimination" checked={bracketType === 'single-elimination'} onChange={e => setBracketType(e.target.value as any)} className="form-radio text-brand-primary bg-brand-bg"/> <span className="ml-2">Single Elimination</span></label>
                           <label className="flex items-center"><input type="radio" value="double-elimination" checked={bracketType === 'double-elimination'} onChange={e => setBracketType(e.target.value as any)} className="form-radio text-brand-primary bg-brand-bg"/> <span className="ml-2">Playoff Bracket</span></label>
                           <label className="flex items-center"><input type="radio" value="round-robin" checked={bracketType === 'round-robin'} onChange={e => setBracketType(e.target.value as any)} className="form-radio text-brand-primary bg-brand-bg"/> <span className="ml-2">Round Robin</span></label>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Number of Pits</label>
                        <input type="number" value={numberOfPits} onChange={e => setNumberOfPits(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-full bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" min="1" required />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-brand-text-secondary mb-1">Participants</label>
                        <div className="flex space-x-4">
                           <label className="flex items-center"><input type="radio" value="team" checked={participantType === 'team'} onChange={e => { setParticipantType('team'); setSelectedParticipantIds([]); }} className="form-radio text-brand-primary bg-brand-bg"/> <span className="ml-2">Teams</span></label>
                           <label className="flex items-center"><input type="radio" value="player" checked={participantType === 'player'} onChange={e => { setParticipantType('player'); setSelectedParticipantIds([]); }} className="form-radio text-brand-primary bg-brand-bg"/> <span className="ml-2">Players</span></label>
                        </div>
                    </div>

                    {participantType === 'player' && (
                        <div className="my-4 p-3 bg-brand-bg rounded-lg text-center">
                            <button type="button" onClick={handleGenerateRandomTeams} disabled={selectedParticipantIds.length < 2 || selectedParticipantIds.length % 2 !== 0} className="bg-brand-secondary text-brand-bg font-bold py-2 px-4 rounded-lg hover:bg-brand-primary transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-sm">
                                Generate Random Teams (2 players per team)
                            </button>
                            <p className="text-xs text-brand-text-secondary mt-2">Select an even number of players to enable this option.</p>
                        </div>
                    )}

                    {participantType === 'team' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Add New Team</label>
                            <div className="flex gap-2">
                                <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="flex-grow bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" placeholder="Enter new team name" onKeyDown={(e) => {if(e.key === 'Enter'){ e.preventDefault(); handleAddNewTeam();}}}/>
                                <button type="button" onClick={handleAddNewTeam} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">Add</button>
                            </div>
                        </div>
                    )}
                    {participantType === 'player' && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Add New Player</label>
                            <div className="flex gap-2">
                                <input type="text" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} className="flex-grow bg-brand-bg border border-gray-600 rounded-lg px-4 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary" placeholder="Enter new player name" onKeyDown={(e) => {if(e.key === 'Enter'){ e.preventDefault(); handleAddNewPlayer();}}}/>
                                <button type="button" onClick={handleAddNewPlayer} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">Add</button>
                            </div>
                        </div>
                    )}
                    <div className="mb-6">
                         <label className="block text-sm font-medium text-brand-text-secondary mb-2">Select Participants ({selectedParticipantIds.length})</label>
                         <div className="max-h-60 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2 p-2 bg-brand-bg rounded-lg">
                             {availableParticipants.map(p => (
                                 <label key={p.id} className={`flex items-center p-2 rounded-md cursor-pointer ${selectedParticipantIds.includes(p.id) ? 'bg-brand-primary text-brand-bg' : 'bg-gray-700'}`}>
                                     <input type="checkbox" checked={selectedParticipantIds.includes(p.id)} onChange={() => handleParticipantToggle(p.id)} className="form-checkbox text-brand-primary bg-brand-bg border-gray-500 rounded focus:ring-brand-secondary" />
                                     <span className="ml-3 font-medium">{p.name}</span>
                                 </label>
                             ))}
                         </div>
                    </div>
                    <div className="flex gap-4">
                        <button type="submit" className="flex-grow bg-brand-primary text-brand-bg font-bold py-3 px-6 rounded-lg hover:bg-brand-secondary transition-colors">Generate Tournament</button>
                        {brackets.length > 0 && <button type="button" onClick={() => setIsCreating(false)} className="bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-700">Cancel</button>}
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div>
            <div className="max-w-6xl mx-auto mb-6 bg-brand-surface p-4 rounded-xl shadow-lg flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <TournamentIcon className="w-8 h-8 text-brand-primary"/>
                    <select value={activeBracketId ?? ''} onChange={e => setActiveBracketId(e.target.value)} className="bg-brand-bg border border-gray-600 rounded-md px-3 py-2 text-brand-text text-xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary">
                        {brackets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setIsCreating(true)} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm">Create New</button>
                    {activeBracketId && <button onClick={() => handleDeleteBracket(activeBracketId)} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm">Delete Current</button>}
                </div>
            </div>
            
            {activeBracket && (
                <>
                {activeBracket.type === 'double-elimination' && activeBracket.participants.length === 8 ? (
                    <EightTeamPlayoffDisplay />
                ) : activeBracket.type !== 'round-robin' ? (
                     <>
                        <div className="flex justify-center items-center gap-2 mb-4 p-2 bg-brand-surface rounded-lg max-w-sm mx-auto">
                            <button onClick={() => setViewMode('bracket')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors w-full ${viewMode === 'bracket' ? 'bg-brand-primary text-brand-bg' : 'bg-brand-bg text-brand-text-secondary hover:bg-gray-700'}`}>
                                Bracket View
                            </button>
                            <button onClick={() => setViewMode('games')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors w-full ${viewMode === 'games' ? 'bg-brand-primary text-brand-bg' : 'bg-brand-bg text-brand-text-secondary hover:bg-gray-700'}`}>
                                Games View
                            </button>
                        </div>
                        {viewMode === 'games' ? (
                            <EliminationGamesView 
                                bracket={activeBracket}
                                onScoreChange={(match, pKey, score) => handleEliminationScoreChange(match._source.type, match._source.roundIndex, match._source.matchIndex, pKey, score)}
                                onStartLiveMatch={handleEliminationGamesStartMatch}
                            />
                        ) : (
                            <div ref={panWrapperRef} className="relative overflow-hidden cursor-grab h-[80vh] bg-brand-surface/50 rounded-lg" onMouseDown={handlePanStart} onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd} onWheel={(e) => handleZoom(e.deltaY)}>
                                <div className="absolute top-2 right-2 z-10 bg-brand-surface p-1.5 rounded-lg shadow-lg flex flex-col gap-1.5">
                                    <button onClick={() => handleZoom(0.2, true)} className="w-8 h-8 flex items-center justify-center bg-brand-bg rounded hover:bg-gray-700 font-bold text-xl">+</button>
                                    <button onClick={() => handleZoom(-0.2, true)} className="w-8 h-8 flex items-center justify-center bg-brand-bg rounded hover:bg-gray-700 font-bold text-xl">-</button>
                                    <button onClick={resetZoomPan} className="w-8 h-8 flex items-center justify-center bg-brand-bg rounded hover:bg-gray-700 text-xs">Reset</button>
                                </div>
                                <div style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transformOrigin: 'top left' }}>
                                    <div ref={bracketContainerRef} className="relative inline-block p-8">
                                        {activeBracket.type === 'double-elimination' ? (
                                            <div className="flex flex-col gap-8">
                                                <EliminationDisplay bracket={activeBracket} onScoreChange={handleEliminationScoreChange} onStartLiveMatch={handleEliminationStartMatch} players={players} playerRingerStats={playerRingerStats} registerRef={registerRef} title="Winner's Bracket" bracketKey="rounds" />
                                                <EliminationDisplay bracket={activeBracket} onScoreChange={handleEliminationScoreChange} onStartLiveMatch={handleEliminationStartMatch} players={players} playerRingerStats={playerRingerStats} registerRef={registerRef} title="Loser's Bracket" bracketKey="loserRounds" />
                                            </div>
                                        ) : ( // single-elimination
                                            <EliminationDisplay bracket={activeBracket} onScoreChange={handleEliminationScoreChange} onStartLiveMatch={handleEliminationStartMatch} players={players} playerRingerStats={playerRingerStats} registerRef={registerRef} title="" bracketKey="rounds" />
                                        )}
                                        <BracketConnectors bracket={activeBracket} elementRefs={elementRefs} containerRef={bracketContainerRef} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <RoundRobinDisplay 
                        bracket={activeBracket} 
                        onScoreChange={handleRoundRobinScoreChange}
                        onStartLiveMatch={(matchId, pA_id, pB_id) => {
                            const description = `${activeBracket.name}: ${activeBracket.participants.find(p => p.id === pA_id)?.name} vs ${activeBracket.participants.find(p => p.id === pB_id)?.name}`;
                            const ids = activeBracket.participantType === 'team' ? { teamAId: pA_id, teamBId: pB_id } : { playerAId: pA_id, playerBId: pB_id };
                            onStartLiveMatch(
                                { ...ids, description } as MatchToStart,
                                { bracketId: activeBracket.id, matchId, type: 'round-robin' }
                            );
                        }}
                    />
                )}
                </>
            )}
        </div>
    );
};

export default Brackets;