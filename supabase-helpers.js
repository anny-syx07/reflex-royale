
const supabase = require('./supabase');

/**
 * Track player stats (Upsert)
 * @param {string} playerId - Socket ID or UUID
 * @param {string} nickname - Player name
 */
async function trackPlayer(playerId, nickname) {
    if (!supabase) return;

    try {
        // Upsert player: update username/score if exists, otherwise insert
        // Note: usage of 'on_conflict' requires a unique constraint on the conflict column
        // We assume 'username' or 'id' is unique. 
        // Since playerId in socket.io changes, we might want to track by 'username' if we want persistence across sessions?
        // Or if we strictly use socket.id, it resets every time. 
        // The original firebase code used 'playerId'(socket.id) as doc ID.
        // But for SQL, we might want to use 'username' as the unique key if we want long-term stats.
        // Let's stick to 'username' as the key for persistent stats, or map socketID to a user.

        // For this implementation, let's assume we identify by username for stats (better for "Management")

        const { data, error } = await supabase
            .from('players')
            .upsert({
                username: nickname,
                // We'll update created_at only on insert? No, upsert handles it.
                // We just want to ensure the player exists.
            }, { onConflict: 'username' })
            .select();

        if (error) throw error;

    } catch (error) {
        console.error('Supabase trackPlayer error:', error.message);
    }
}

/**
 * Update player score
 * @param {string} playerId - Socket ID (we might need to look up username or pass username)
 * @param {number} scoreGained 
 * @param {string} nickname - (Optional) needed if we track by username
 */
async function updatePlayerScore(playerId, scoreGained, nickname) {
    if (!supabase) return;

    try {
        // If we track by username
        if (nickname) {
            // Using rpc for atomic increment if available, or just simple read-update
            // For simplicity in JS:
            const { data: player } = await supabase.from('players').select('total_score').eq('username', nickname).single();
            if (player) {
                await supabase.from('players').update({ total_score: (player.total_score || 0) + scoreGained }).eq('username', nickname);
            }
        }
    } catch (error) {
        console.error('Supabase updatePlayerScore error:', error.message);
    }
}

/**
 * Save game result
 */
async function saveGameResult(gameId, gameMode, roomCode, players, winner) {
    if (!supabase) return;

    console.log(`[Supabase] Saving game ${gameId}...`);

    try {
        // Find host and winner IDs if they exist in players table
        // For now, we'll just store the text data or null if not found
        // To strictly link foreign keys, we need valid UUIDs from players table. 
        // This might be complex if players aren't fully synced.

        // Simplified approach: Create a row in game_sessions
        // We need to extend the table to support room_code, mode, and raw json data

        const { error } = await supabase
            .from('game_sessions')
            .insert({
                // id: gameId, // If gameId is not UUID, let postgres generate one, or ensure gameId is UUID
                status: 'finished',
                // For now, we omit host_id/winner_id FKs if we don't have their UUIDs easily
                // We'll rely on the JSON data for details
                // We need to ADD columns for room_code and game_data to the table!
                // Assuming we will run a migration to add these columns.
                room_code: roomCode,
                mode: gameMode,
                game_data: { players, winner, gameId }
            });

        if (error) {
            // If error is about missing columns, we might need to update schema
            console.error('Supabase saveGameResult SQL error:', error.message);
        } else {
            console.log('✅ [Supabase] Game saved!');
        }

    } catch (error) {
        console.error('Supabase saveGameResult error:', error.message);
    }
}

module.exports = { trackPlayer, updatePlayerScore, saveGameResult };
