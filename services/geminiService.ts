import { GoogleGenAI, Type } from "@google/genai";
import { Match, Player, PlayerStats } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini features will not work.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const generateMatchCommentary = async (match: Match): Promise<string> => {
    if (!process.env.API_KEY) {
        return "Gemini API key is not configured. Please set the API_KEY environment variable.";
    }
  
  const teamAPlayers = match.teamA.players.map(p => p.name).join(' and ');
  const teamBPlayers = match.teamB.players.map(p => p.name).join(' and ');
  const winner = match.winner === 'A' ? teamAPlayers : teamBPlayers;
  const finalScore = `${match.scoreA} to ${match.scoreB}`;

  const playerRingerStats = Object.keys(match.playerStats).map(playerId => {
    const player = [...match.teamA.players, ...match.teamB.players].find(p => p.id === playerId);
    return `${player?.name || 'A player'} had ${match.playerStats[playerId].ringers} ringers.`;
  }).join('\n');


  const prompt = `
    Generate a short, exciting sports commentary for a horseshoes match with the following details:
    - Team A: ${teamAPlayers}
    - Team B: ${teamBPlayers}
    - Final Score: ${finalScore}
    - Winning Team: ${winner}
    - Key Stats: 
      ${playerRingerStats}

    Keep it under 100 words and make it sound like a professional sports announcer recapping the game's highlights, mentioning the ringers.
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating commentary:", error);
    return "Could not generate commentary at this time. Please check the API key and network connection.";
  }
};

export const simulateMatch = async (
    teamAPlayers: Player[], 
    teamBPlayers: Player[], 
    winScore: number, 
    pointsPerRinger: number
): Promise<Omit<Match, 'id' | 'timestamp' | 'leagueId' | 'teamA' | 'teamB'>> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY not configured.");
    }

    const teamAPlayerNames = teamAPlayers.map(p => p.name).join(' and ');
    const teamBPlayerNames = teamBPlayers.map(p => p.name).join(' and ');
    const allPlayers = [...teamAPlayers, ...teamBPlayers];

    const prompt = `
    Simulate a game of horseshoes between two teams.
    Team A consists of: ${teamAPlayerNames}.
    Team B consists of: ${teamBPlayerNames}.
    The game is played to ${winScore} points.
    A ringer is worth ${pointsPerRinger} points after cancellation. Other points are scored for shoes close to the stake.
    
    Provide a realistic final score where one team reaches at least ${winScore} points and wins. The losing team's score should be less than the winning team's score.
    Also provide plausible stats for each player. Each player throws a similar number of shoes (e.g., between 10 and 40). A good ringer percentage for a player is between 10% and 40%. The number of ringers should be an integer.
    
    Respond with a JSON object.
    `;
    
    const playerProperties = allPlayers.reduce((acc, player) => {
        acc[player.id] = {
            type: Type.OBJECT,
            properties: {
                ringers: {
                    type: Type.INTEGER,
                    description: `Number of ringers for ${player.name}`,
                },
                totalShoesPitched: {
                    type: Type.INTEGER,
                    description: `Total shoes pitched by ${player.name}`,
                },
            },
            required: ['ringers', 'totalShoesPitched'],
        };
        return acc;
    }, {} as any);

    const schema = {
        type: Type.OBJECT,
        properties: {
            scoreA: { type: Type.INTEGER, description: "Final score for Team A" },
            scoreB: { type: Type.INTEGER, description: "Final score for Team B" },
            winner: { type: Type.STRING, enum: ['A', 'B'], description: "Winning team, 'A' or 'B'" },
            playerStats: {
                type: Type.OBJECT,
                properties: playerProperties,
            },
        },
        required: ['scoreA', 'scoreB', 'winner', 'playerStats'],
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });

        const resultJson = JSON.parse(response.text);
        
        // Basic validation in case the model doesn't follow instructions perfectly
        if (resultJson.winner === 'A' && resultJson.scoreA < winScore) resultJson.scoreA = winScore;
        if (resultJson.winner === 'B' && resultJson.scoreB < winScore) resultJson.scoreB = winScore;
        if (resultJson.winner === 'A' && resultJson.scoreA <= resultJson.scoreB) resultJson.scoreB = resultJson.scoreA - 1;
        if (resultJson.winner === 'B' && resultJson.scoreB <= resultJson.scoreA) resultJson.scoreA = resultJson.scoreB - 1;

        return resultJson as Omit<Match, 'id' | 'timestamp' | 'leagueId' | 'teamA' | 'teamB'>;
    } catch (error) {
        console.error("Error simulating match:", error);
        throw new Error("Could not simulate match at this time. Check your API key and network connection.");
    }
};