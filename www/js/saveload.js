/*
 * Save/load
 */

/* global Building, GameLevel, Room, RoomType */
/* global g_simulation_time:true, g_simulation_day:true, g_game_win_lose:true, g_game_star_level:true, g_stair_floors:true, g_bank_balance:true, g_room_floors:true, g_stair_floors:true, g_room_types */
/* global InitGameState */

/* exported SaveLoad */
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
	};

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
			_removeOldElevators();
			_linkElevators();

			// Validation
			var valid = true;
			valid &= typeof g_simulation_time === 'number';
			valid &= GameLevel.isValidGameWinLose(g_game_win_lose);
			valid &= GameLevel.isValidGameStarLevel(g_game_star_level);
			valid &= typeof g_bank_balance === 'number';
			valid &= g_room_floors !== false;
			valid &= g_stair_floors !== false;
			valid &= Building.validateElevators();
			if (!valid) {
				InitGameState();
				return false;
			}

			Building.rebuildReachableFloors();

			return true;
		} catch(e) {
			InitGameState();
			return false;
		}
	};

	/**
	 * Return a object ready for JSON string conversion where 
	 * the room.def pointer has been changed into the room 
	 * definition id string.
	 */
	var _saveRoomListToJsonObj = function(floor_container) {
		var result = {};
		for (var floor in floor_container) {
			result[floor] = [];
			for (var i_room = 0; i_room < floor_container[floor].length; i_room++) {
				var room = floor_container[floor][i_room];

				// Create a copy and change def into the id string
				var room_copy = JSON.parse(JSON.stringify(room));
				room_copy.def = room.def.id;
				room_copy.overlay_item = null; // Don't save the overlay item
				if (RoomType.isElevator(room.def.id) && room.pieceName !== 'top') {
					room_copy.elevator = null; // Only save one copy of the elevator data - in the top piece.
				}
				result[floor].push(room_copy);
			}
		}
		return result;
	};

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

		for (var floor in floor_container) {
			for (var i_room = 0; i_room < floor_container[floor].length; i_room++) {
				var room = floor_container[floor][i_room];

				if (!(room.def in g_room_types)) return false;
				room.def = g_room_types[room.def];
				room.overlay_item = null;
				if (!Room.validate(room)) return false;
			}
		}

		return floor_container;
	};

	/**
	 * Removes elevators with the old format (no .elevator nor .pieceName)
	 */
	var _removeOldElevators = function() {
		var removed_elevator = false;
		for (var floor = Building.MIN_FLOOR; floor <= Building.MAX_FLOOR; floor++) {
			if (!(floor in g_stair_floors)) continue;

			var floor_data = g_stair_floors[floor];
			for (var i = 0; i < floor_data.length; i++) {
				if (RoomType.isElevator(floor_data[i].def.id)) {
					if (typeof floor_data[i].pieceName === 'undefined' ||
							typeof floor_data[i].elevator === 'undefined') {
						// Old elevator without .elevator and top/bottom pieces found.

						// For now delete them. Later maybe revisit and add converter.
						floor_data.splice(i, 1);
						i--;
						removed_elevator = true;
					}
				}
			}
		}
		return removed_elevator;
	};

	/**
	 * Set up the .elevator pointer for all elevator pieces.
	 * @pre top pieces has .elevator data with correct min/max floor data.
	 */
	var _linkElevators = function() {

		// Start from top, so the first elevator piece we find is the top part which is
		// where the elevator data is stored in the save.
		for (var floor = Building.MAX_FLOOR; floor >= Building.MIN_FLOOR; floor--) {
			if (!(floor in g_stair_floors)) continue;

			var floor_data = g_stair_floors[floor];
			for (var i = 0; i < floor_data.length; i++) {
				if (RoomType.isElevator(floor_data[i].def.id)) {
					// Found elevator top - propagate .elevator to other parts
					if (floor_data[i].pieceName === 'top') {
						for (var el_floor = floor - 1; el_floor >= floor_data[i].elevator.min_floor; el_floor--) {
							var el_part = Building.getStairLayerRoomAt(floor_data[i].x, el_floor);
							el_part.elevator = floor_data[i].elevator;
						}
					}
				}
			}
		}
	};


	// Export:
	return {
		saveGameStateToJsonStr: saveGameStateToJsonStr,
		loadGameStateFromJsonStr: loadGameStateFromJsonStr,
	};
})();
