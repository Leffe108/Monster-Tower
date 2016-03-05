/**
 * Module: Room
 *
 * Functions that work with room instances
 */

/* global RoomType, g_simulation_time, g_simulation_day, g_room_floors, g_stair_floors, g_reachable_floors */

/* exported Room */
var Room = (function() {

	var ROOM_STATE_FOR_RENT = 'for-rent';
	var ROOM_STATE_OPEN = 'open';
	var ROOM_STATE_CLOSED = 'closed';

	/**
	 * Update all rooms in the building
	 */
	var updateAll = function(time) {

		var prev_h = Math.floor((g_simulation_time - time) / 60);
		var now_h = Math.floor((g_simulation_time / 60));
		if (prev_h < now_h) {
			// New hour

			var k = 0;
			for(var floor_num in g_room_floors) {
				var floor_data = g_room_floors[floor_num];
				for (var i = 0; i < floor_data.length; i++) {
					var room_data = floor_data[i];
					k++;

					// Check stair access
					if (!(floor_num in g_reachable_floors)) {
						if (room_data.not_reachable_counter < 10000) { // avoid overrun
							room_data.not_reachable_counter += 60; // check runs every hour
						}
					} else {
						room_data.not_reachable_counter = 0;
					}

					// Rent / for rent status
					// Applies to rooms that can generate income when rented out. Rooms without
					// income are regarded as facilities that never get ROOM_STATE_FOR_RENT.
					if (room_data.def.rent_income !== 0) {
						var rand = Math.random();
						if (room_data.state === ROOM_STATE_FOR_RENT) {
							if (floor_num in g_reachable_floors && // room must be reachable to be rented
									rand > 0.8) {
								room_data.state = ROOM_STATE_CLOSED;
								room_data.rent_day = g_simulation_day;
							}
						} else {
							// if out of reach for at least 8 hours, the contract is canceled at a high chance
							if (room_data.not_reachable_counter >= 8 * 60 && rand > 0.4) {
								room_data.state = ROOM_STATE_FOR_RENT;
							}
							// Rent is for at least 4 days
							else if (g_simulation_day - room_data.rent_day > 4 && rand > 0.95) {
								room_data.state = ROOM_STATE_FOR_RENT;
							}
						}
					}

					// open/close
					if (room_data.state !== ROOM_STATE_FOR_RENT) {
						var open_hours = {
							'lobby': [5, 23],
							'cafeteria': [11, 15],
							'flower-shop': [14, 18],
							'town-hall-room': [10, 17],
						};
						if (room_data.def.id in open_hours) {
							var open = open_hours[room_data.def.id][0];
							var close = open_hours[room_data.def.id][1];
							if (now_h == open) {
								room_data.state = ROOM_STATE_OPEN;
							} else if (now_h == close) {
								room_data.state = ROOM_STATE_CLOSED;
							}
						} else {
							if (now_h > 5 + k % 3 && now_h < 12) {
								room_data.state = ROOM_STATE_OPEN;
							} else if (now_h > 17 + k % 3 && now_h < 23) {
								room_data.state = ROOM_STATE_CLOSED;
							}
						}
					}
				}
			}
		}
	};

	var getRentedCount = function(room_type) {
		var count = 0;

		var floors_container = room_type === 'stair' ? g_stair_floors : g_room_floors;
		for(var floor_num in floors_container) {
			var floor_data = floors_container[floor_num];
			for (var i = 0; i < floor_data.length; i++) {
				var room_data = floor_data[i];

				if (room_data.def.id === room_type && room_data.state !== ROOM_STATE_FOR_RENT) {
					count++;
				}
			}
		}

		return count;
	};

	var getCount = function(room_type) {
		var count = 0;

		var floors_container = room_type === 'stair' ? g_stair_floors : g_room_floors;
		for(var floor_num in floors_container) {
			var floor_data = floors_container[floor_num];
			for (var i = 0; i < floor_data.length; i++) {
				var room_data = floor_data[i];

				if (room_data.def.id === room_type) {
					count++;
				}
			}
		}

		return count;
	};

	/**
	 * Validate given room instance.
	 * @param room Room instance to validate
	 * @return true if room validates, otherwise false.
	 */
	var validate = function(room) {
		// room.state
		return ([
			ROOM_STATE_FOR_RENT,
			ROOM_STATE_OPEN,
			ROOM_STATE_CLOSED,
		].indexOf(room.state) !== -1) &&
		// Stair layer: must only use open state
		(!RoomType.isStairLayerRoom(room.def.id) || (
				room.state === ROOM_STATE_OPEN
		));
	};

	// Export:
	return {
		/* enum constants */
		ROOM_STATE_FOR_RENT: ROOM_STATE_FOR_RENT,
		ROOM_STATE_OPEN: ROOM_STATE_OPEN,
		ROOM_STATE_CLOSED: ROOM_STATE_CLOSED,

		/* functions */
		updateAll: updateAll,
		getRentedCount: getRentedCount,
		getCount: getCount,
		validate: validate,
	};
})();
