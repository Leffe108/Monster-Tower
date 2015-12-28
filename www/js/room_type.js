/**
 * Module: Room type
 */

/* global g_room_types:true */

/* exported RoomType */
var RoomType = (function() {

	var init = function() {

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

		// After adding a room type, also add it to master_room_toolbar in gui.js for it to show up in the toolbar.
	};

	/**
	 * Is the room a stair layer type of room? Eg. a room used to move between floors.
	 * @param room_type room type name
	 */
	var isStairLayerRoom = function(room_type) {
		return room_type === 'stair' || room_type === 'elevator';

	};

	/**
	 * Is the room an elevator?
	 * @param room_type room type name
	 */
	var isElevator = function(room_type) {
		return room_type === 'elevator';
	};

	// Export:
	return {
		init: init,
		isStairLayerRoom: isStairLayerRoom,
		isElevator: isElevator,
	};
})();
