/*
 * Save/load
 */

var SaveLoad = (function() {

	/**
	 * Return the current game state as a JSON string.
	 */
	var saveGameStateToJsonStr = function() {
		return JSON.stringify({
			'simulation_time' : g_simulation_time,
			'simulation_day' : g_simulation_day,
			'game_win_lose': g_game_win_lose,
			'game_star_level': g_game_star_level,
			'bank_balance': g_bank_balance,
			'room_floors': _saveRoomListToJsonObj(g_room_floors),
			'stair_floors': _saveRoomListToJsonObj(g_stair_floors),
		});
	}

	/**
	 * Load game state from provided JSON string
	 */
	var loadGameStateFromJsonStr = function(json_str) {
		// Parse JSON str to object
		try {
			var obj = JSON.parse(json_str);
			if (obj === null) return false;
		} catch (e) {
			return false;
		}

		// Load data
		try {
			InitGameState();

			// Import
			g_simulation_time = obj.simulation_time;
			g_game_win_lose = obj.game_win_lose;
			g_game_star_level = obj.game_star_level;
			g_bank_balance = obj.bank_balance;
			g_room_floors = _loadRoomFloorsFromJsonObj(obj.room_floors);
			g_stair_floors = _loadRoomFloorsFromJsonObj(obj.stair_floors);

			// Validation
			var valid = true;
			valid &= typeof g_simulation_time === 'number';
			valid &= GameLevel.isValidGameWinLose(g_game_win_lose);
			valid &= GameLevel.isValidGameStarLevel(g_game_star_level);
			valid &= typeof g_bank_balance === 'number';
			valid &= g_room_floors !== false;
			valid &= g_stair_floors !== false;
			if (!valid) {
				InitGameState();
				return false;
			}

			RebuildReachableFloors();

			return true;
		} catch(e) {
			InitGameState();
			return false;
		}
	}

	/**
	 * Return a object ready for JSON string conversion where 
	 * the room.def pointer has been changed into the room 
	 * definition id string.
	 */
	var _saveRoomListToJsonObj = function(floor_container) {
		var result = {};
		for (floor in floor_container) {
			result[floor] = [];
			for (var i_room = 0; i_room < floor_container[floor].length; i_room++) {
				var room = floor_container[floor][i_room];

				// Create a copy and change def into the id string
				var room_copy = JSON.parse(JSON.stringify(room));
				room_copy.def = room.def.id;
				room_copy.overlay_item = null; // Don't save the overlay item
				result[floor].push(room_copy);
			}
		}
		return result;
	}

	/**
	 * Iterate over the imported object from JSON string
	 * and update all room.def from strings to pointers.
	 *
	 * If the room type doesn't exist, the method
	 * returns boolean false, otherwise the floor
	 * container.
	 */
	var _loadRoomFloorsFromJsonObj = function(floor_container) {
		if (typeof floor_container !== 'object') return false;

		for (floor in floor_container) {
			for (var i_room = 0; i_room < floor_container[floor].length; i_room++) {
				var room = floor_container[floor][i_room];

				if (!room.def in g_room_types) return false;
				room.def = g_room_types[room.def];
				room.overlay_item = null;
				if (!ValidateRoom(room)) return false;
			}
		}

		return floor_container;
	}

	// Export:
	return {
		saveGameStateToJsonStr: saveGameStateToJsonStr,
		loadGameStateFromJsonStr: loadGameStateFromJsonStr,
	}
})();
