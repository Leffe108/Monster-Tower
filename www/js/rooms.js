/*
 * Room types
 */

var ROOM_STATE_FOR_RENT = 'for-rent';
var ROOM_STATE_OPEN = 'open';
var ROOM_STATE_CLOSED = 'closed';

function RoomTypeInit() {

	g_room_types = {};
	g_room_types['office'] = {
		id: 'office',
		name: 'Office',
		image: 'office',
		width: 64/16,
		buy_cost: 1200,
		demolish_cost: 300,
		maint_cost: 400,
		rent_income: 800,
		min_stars: 0, // min number of stars before room is available
	};

	g_room_types['stair'] = {
		id: 'stair', // Stair have quite a bit of special handling that hooks up to this ID
		name: 'Stair',
		image: 'stair',
		width: 48/16,
		buy_cost: 400,
		demolish_cost: 50,
		maint_cost: 0,
		rent_income: 0,
		min_stars: 0,
		max_floor: 15,
	};

	g_room_types['elevator'] = {
		id: 'elevator', // Elevator have quite a bit of special handling that hooks up to this ID
		name: 'Elevator',
		image: 'elevator',
		width: 48/16,
		buy_cost: 4000,
		demolish_cost: 50,
		maint_cost: 2000,
		rent_income: 0,
		min_stars: 2,
	};

	g_room_types['cafeteria'] = {
		id: 'cafeteria',
		name: 'Cafeteria',
		image: 'cafeteria',
		width: 112/16,
		buy_cost: 8000,
		demolish_cost: 2000,
		maint_cost: 1000,
		rent_income: 2000,
		min_stars: 1,
	};

	g_room_types['flower-shop'] = {
		id: 'flower-shop',
		name: 'Flower shop',
		image: 'flower-shop',
		width: 80/16,
		buy_cost: 6000,
		demolish_cost: 1700,
		maint_cost: 800,
		rent_income: 1200,
		min_stars: 2,
	};

	g_room_types['town-hall-room'] = {
		id: 'town-hall-room',
		name: 'Town Hall Room',
		image: 'town-hall-room',
		width: 192/16,
		buy_cost: 50000,
		demolish_cost: 10000,
		maint_cost: 5000,
		rent_income: 0,
		min_stars: 3,
	};

	// After adding a room, also add it to master_room_toolbar in gui.js for it to show up in the toolbar.
}

function IsStairLayerRoom(room_type) {
	return room_type === 'stair' || room_type === 'elevator';

}

function UpdateRooms(time) {

	var prev_h = Math.floor((g_simulation_time - time) / 60);
	var now_h = Math.floor((g_simulation_time / 60)); 
	if (prev_h < now_h) {
		// New hour
		
		var k = 0;
		for(floor_num in g_room_floors) {
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
				var rand = Math.random();
				if (room_data.def.id !== 'town-hall-room') {
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
}

function GetRoomRentedCount(room_type) {
	var count = 0;

	var floors_container = room_type === 'stair' ? g_stair_floors : g_room_floors;
	for(floor_num in floors_container) {
		var floor_data = floors_container[floor_num];
		for (var i = 0; i < floor_data.length; i++) {
			var room_data = floor_data[i];

			if (room_data.def.id === room_type && room_data.state !== ROOM_STATE_FOR_RENT) {
				count++;
			}
		}
	}

	return count;
}

function GetRoomCount(room_type) {
	var count = 0;

	var floors_container = room_type === 'stair' ? g_stair_floors : g_room_floors;
	for(floor_num in floors_container) {
		var floor_data = floors_container[floor_num];
		for (var i = 0; i < floor_data.length; i++) {
			var room_data = floor_data[i];

			if (room_data.def.id === room_type) {
				count++;
			}
		}
	}

	return count;
}

function ValidateRoom(room) {
	// Currently only room.state is validated
	return [
		ROOM_STATE_FOR_RENT,
		ROOM_STATE_OPEN,
		ROOM_STATE_CLOSED,
	].indexOf(room.state) !== -1;
}
