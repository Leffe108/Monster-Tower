
var MIN_FLOOR = -5;
var MAX_FLOOR = 100;

/*
 * Commands for altering building
 */

function BuildingInit() {
	g_room_floors = {};
	g_stair_floors = {};
	g_reachable_floors = {};

	RebuildReachableFloors(); // make floor 0 accessible

	if (INITIAL_BUILDING) {
		for (var floor = 0; floor < 3; floor++) {
			BuildRoom('office', floor, 18);
			BuildRoom('office', floor, 18+4);
			BuildRoom('office', floor, 18-4);
		}
	}
}

/**
 * @param room_type, the room type id
 */
function BuildRoom(room_type, floor_num, x) {

	var floors_container = IsStairLayerRoom(room_type) ? g_stair_floors : g_room_floors;
	var floor_data = GetFloorData(floors_container, floor_num, true);
	var room_def = g_room_types[room_type];

	// Has free spot?
	var insert_index = GetRoomInsertIndex(floors_container, floor_data, x, room_def.width);
	if (insert_index === false) {
		return false;
	}

	var room_instance = {
		x: x,
		floor: floor_num,
		width: room_def.width,
		def: room_def,
		state: ROOM_STATE_FOR_RENT,
		rent_day: 0, // simulation day when room was rent
		build_day: g_simulation_day, // simulation day when room was built
		not_reachable_counter: 0, // 0 or time it has not been reachable (via stairs)
	};
	if (IsStairLayerRoom(room_type)) room_instance.state = ROOM_STATE_OPEN;
	if (room_type === 'town-hall-room') room_instance.state = ROOM_STATE_CLOSED;

	floor_data.splice(insert_index, 0, room_instance);
	AddOverlayItemForRoom(room_instance);

	if (IsStairLayerRoom(room_type)) RebuildReachableFloors();

	return true;
};

function AddOverlayItemForRoom(room_data) {
	var screen_pos = MapToScreen(room_data.x, room_data.floor);
	room_data.overlay_item = AddOverlayItem(room_data, room_data.def.name, screen_pos[0], screen_pos[1], room_data.def.width * 16, 'nav', 'room');
}

function DemolishRoom(room_instance) {

	var floors_container = IsStairLayerRoom(room_instance.def.id) ? g_stair_floors : g_room_floors;
	var floor_data = GetFloorData(floors_container, room_instance.floor, false);
	assert(floor_data !== null);

	for (var i = 0; i < floor_data.length; i++) {
		if (floor_data[i] === room_instance) {
			floor_data.splice(i, 1);

			var screen_pos = MapToScreen(room_instance.x, room_instance.floor_num);
			RemoveOverlayItem(room_instance.overlay_item);
			if (IsStairLayerRoom(room_instance.def.id)) RebuildReachableFloors();
			return;
		}
	}
}

function CanBuildRoomHere(room_type, x, floor_num) {

	// Stairs are different enough so they are handled separate
	if (IsStairLayerRoom(room_type)) return CanBuildStairHere(room_type, x, floor_num);

	// Town Hall Room can only be built once
	if (room_type === 'town-hall-room' && GetRoomCount(room_type) > 0) return false;

	var room_def = g_room_types[room_type];
	if (floor_num in g_room_floors) {
		// if existing floor, check for conflict with rooms
		var floor_data = g_room_floors[floor_num];
		if (!IsFloorFreeForRoomHere(g_room_floors, floor_data, x, room_def.width)) {
			return false;
		}
	}

	if (floor_num === 0) return true;

	if (floor_num > 0) {
		// Make sure there is a room on the floor below
		if ((floor_num - 1) in g_room_floors) {
			var floor_below_data = g_room_floors[floor_num-1];

			return DoesRoomsCoverXArea(floor_below_data, x, room_def.width)
/*
			// List of x coords that the new room will occupy
			var has_support = {};
			for (var i = 0; i < room_def.width; i++) {
				has_support[x + i] = false;
			}

			// Set x coords of new room to true if there is a room part
			// exactly below it.
			for (var i = 0; i < floor_below_data.length; i++) {
				
				for (var room_i_x = 0; room_i_x < floor_below_data[i].width; room_i_x++) {
					var support_x = floor_below_data[i].x + room_i_x;
					if (support_x in has_support) has_support[support_x] = true;
				}
			}

			// Check that all room parts are true
			for (support_x in has_support) {
				if (has_support[support_x] === false) return false;
			}

			// has support!
			return true;*/
		} else {
			// no roomes on current or floor below
			return false;
		}
	} else {
		if (room_type === 'office') return false;

		return true; // anywhere in underground is ok
	}
}

function CanBuildStairHere(room_type, x, floor_num) {
	assert(IsStairLayerRoom(room_type));
	var room_def = g_room_types[room_type];

	// Stairs cannot be built over floor 15
	if (room_type === 'stair' && floor_num > 15) return false;

	// A stair must be built on a floor with room
	if (!(floor_num in g_room_floors)) return false;

	// Check for conflict with other stairs
	if (floor_num in g_stair_floors) {
		var floor_data = g_stair_floors[floor_num];
		if (!IsFloorFreeForRoomHere(g_stair_floors, floor_data, x, room_def.width)) {
			return false;
		}
	}

	// There must be room(s) covering all x-space that the stair covers
	return DoesRoomsCoverXArea(g_room_floors[floor_num], x, room_def.width);
}

/**
 * Return the building height in number of floors (above ground)
 */
function GetBuildingHeight() {
	for (var i = MAX_FLOOR; i > MIN_FLOOR; i--) {
		if (i in g_room_floors) return i + 1;
	}
	return 0;
}

/**
 * Rebuilds g_reachable_floors. Should be called when a stair is built/demolished
 */
function RebuildReachableFloors() {

	g_reachable_floors = {};
	g_reachable_floors[0] = true;

	// Upwards from entry level
	for (var floor_num = 0; floor_num <= MAX_FLOOR; floor_num++) {
		if (floor_num in g_stair_floors && HasFloorRoomOfType(g_stair_floors[floor_num], 'stair')) {
			g_reachable_floors[floor_num + 1] = true;
		} else if (CanReachAdjLevelByElevator(floor_num, 1)) {
			g_reachable_floors[floor_num + 1] = true;
		} else {
			break;
		}
	}

	// Downwards from entry level
	for (var floor_num = 0; floor_num >= MIN_FLOOR; floor_num--) {
		if ((floor_num - 1) in g_stair_floors && HasFloorRoomOfType(g_stair_floors[floor_num-1], 'stair')) {
			g_reachable_floors[floor_num - 1] = true;
		} else if (CanReachAdjLevelByElevator(floor_num, -1)) {
			g_reachable_floors[floor_num - 1] = true;
		} else {
			break;
		}
	}

	// Elevators are built as one unit per floor. And they need to be over each other to connect.
	for (var floor_num = 0; floor_num <= MAX_FLOOR; floor_num++) {
		if (!(floor_num in g_stair_floors)) continue;


	}
}

// --- helpers ---

function GetFloorData(floors_container, floor_num, add_if_missing) {
	if (!(floor_num in floors_container)) {
		if (add_if_missing) {
			floors_container[floor_num] = [];
		} else {
			return null;
		}
	}
	return floors_container[floor_num];
}

function IsFloorFreeForRoomHere(floors_container, floor_data, room_x, room_width) {
	return GetRoomInsertIndex(floors_container, floor_data, room_x, room_width) !== false;
}

/*
 * Compute index in floor_data where to insert given room.
 * If there is not space for a new room, boolean false is
 * returned.
 */
function GetRoomInsertIndex(floors_container, floor_data, room_x, room_width) {
	if (floor_data.length <= 0) return 0;
	if (room_x + room_width <= floor_data[0].x) return 0;
	if (floor_data[floor_data.length-1].x + floor_data[floor_data.length-1].width <= room_x) return floor_data.length;

	for (var i = 0; i < floor_data.length - 1; i++) {
		if (floor_data[i].x + floor_data[i].width <= room_x &&
				room_x + room_width <= floor_data[i+1].x) return i+1;
	}

	return false;
}

function HasFloorRoomOfType(floor_data, room_type) {
	for (var i = 0; i < floor_data.length; i++) {
		if (floor_data[i].def.id === room_type) return true;
	}
	return false;
}


/**
 * @param level_change 1 for going up, and -1 for going down.
 */
function CanReachAdjLevelByElevator(floor_num, level_change) {

	assert(level_change === 1 || level_change === -1);

	// Check that the floors has any stair/elevator at all.
	if (!((floor_num) in g_stair_floors)) return false;
	if (!((floor_num + level_change) in g_stair_floors)) return false;

	// Check if there is an elevator connection 

	// Iterate all elevators on this floor and check if they connect to an
	// elevator on the floor above/below
	
	var floor_data = g_stair_floors[floor_num];
	var other_floor_data = g_stair_floors[floor_num + level_change];
	for (var i = 0; i < floor_data.length; i++) {
		if (floor_data[i].def.id === 'elevator') {
			for (var i_other = 0; i_other < other_floor_data.length; i_other++) {
				if (other_floor_data[i_other].def.id === 'elevator' &&
						floor_data[i].x == other_floor_data[i_other].x) {
					return true;
				}
			}
		}
	}

	return false;
}

/**
 * Check if there are rooms that fully cover a given area in X-dimension.
 * @param floor_data The floor to check if it contains room that cover the X-area
 */
function DoesRoomsCoverXArea(floor_data, x, width) {
	// List of x coords that should all be covered by any room
	var is_covered = {};
	for (var i = 0; i < width; i++) {
		is_covered[x + i] = false;
	}

	// Set x coords of is_covered to true if there is a room part
	// exactly covering it
	for (var i = 0; i < floor_data.length; i++) {
		
		for (var room_i_x = 0; room_i_x < floor_data[i].width; room_i_x++) {
			var support_x = floor_data[i].x + room_i_x;
			if (support_x in is_covered) is_covered[support_x] = true;
		}
	}

	// Check that all of the X area is covered
	for (support_x in is_covered) {
		if (is_covered[support_x] === false) return false;
	}

	return true;
}
