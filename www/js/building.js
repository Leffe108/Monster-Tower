/*
 * Module: Building
 *
 * Commands for altering building
 */

/* global g_room_floors:true, g_stair_floors:true, g_reachable_floors:true, g_canvas, g_room_types, g_simulation_day */
/* global Gui, Room, RoomType */
/* global assert, MapToScreen, INITIAL_BUILDING */

/* exported Building */
var Building = (function() {

	var MIN_FLOOR = -5;
	var MAX_FLOOR = 100;

	var init = function() {
		g_room_floors = {};
		g_stair_floors = {};
		g_reachable_floors = {};

		rebuildReachableFloors(); // make floor 0 accessible

		if (INITIAL_BUILDING) {
			for (var floor = 0; floor < 3; floor++) {
				buildRoom('office', floor, 18);
				buildRoom('office', floor, 18+4);
				buildRoom('office', floor, 18-4);
			}
		}
	};

	/**
	 * Build room
	 * @param room_type, the room type id
	 * @param pieceName null or name of pieceName piece. Defaults to null. Don't set when calling from outside - only used to recursively create elevator top/bottom pieces.
	 * @return room instance if successful, otherwise null.
	 */
	var buildRoom = function(room_type, floor_num, x, pieceName) {
		pieceName = pieceName || null;

		if (!canBuildRoomHere(room_type, x, floor_num, pieceName)) return null;

		var floors_container = RoomType.isStairLayerRoom(room_type) ? g_stair_floors : g_room_floors;
		var floor_data = _getFloorData(floors_container, floor_num, true);
		var room_def = g_room_types[room_type];

		// Has free spot?
		var insert_index = _getRoomInsertIndex(floor_data, x, room_def.width);
		if (insert_index === false) {
			return null;
		}

		var room_instance = _newRoomInstance(room_def, x, floor_num, pieceName);
		floor_data.splice(insert_index, 0, room_instance);
		addOverlayItemForRoom(room_instance);

		if (RoomType.isElevator(room_type) && pieceName === null) {
			/* Build elevator bottom/top pieces */
			var bottom_piece = buildRoom(room_type, floor_num - 1, x, 'bottom');
			var top_piece = buildRoom(room_type, floor_num + 1, x, 'top');

			/* Elevator instance */
			var elevator = {
				x: x, // when we only have a pointer to the elevator and want to look up pieces
				cars: [{ floor: floor_num, occupancy: 0 }],
				min_floor: floor_num - 1, // min floor, including bottom piece
				max_floor: floor_num + 1, // max floor, including top piece
			};
			room_instance.elevator = elevator;
			bottom_piece.elevator = elevator;
			top_piece.elevator = elevator;
		}
		if (RoomType.isStairLayerRoom(room_type) && pieceName === null) rebuildReachableFloors();

		return room_instance;
	};

	/**
	 * Add GUI overlay for room
	 */
	var addOverlayItemForRoom = function(room_data) {
		var screen_pos = MapToScreen(room_data.x, room_data.floor);
		if (screen_pos[1] >= g_canvas.height) return;
		var width = Math.min(screen_pos[0] + room_data.width * 16, g_canvas.width) - screen_pos[0];
		room_data.overlay_item = Gui.addOverlayItem(room_data, room_data.def.name, screen_pos[0], screen_pos[1], width, 'nav', RoomType.isStairLayerRoom(room_data.def.id) ? 'stair' : 'room');
	};

	/**
	 * Demolish room
	 */
	var demolishRoom = function(room_instance) {

		// Elevators are made up of several room pieces on multiple floors.
		var min_floor = null;
		var max_floor = null;
		if (RoomType.isElevator(room_instance.def.id)) {
			assert(room_instance.elevator !== null);
			min_floor = room_instance.elevator.min_floor;
			max_floor = room_instance.elevator.max_floor;
		} else {
			// Other room types has only one piece at one floor.
			min_floor = room_instance.floor;
			max_floor = room_instance.floor;
		}

		var floors_container = RoomType.isStairLayerRoom(room_instance.def.id) ? g_stair_floors : g_room_floors;
		for (var floor = min_floor; floor <= max_floor; floor++) {
			_deleteRoomPiece(floors_container, room_instance.x, floor);
		}

		if (RoomType.isStairLayerRoom(room_instance.def.id)) rebuildReachableFloors();
	};

	/**
	 * Get room data for given location in the building.
	 * Use getStairLayerRoomAt if it is a stair layer room type.
	 * @return room data or null
	 */
	var getRoomAt = function(x, floor_num) {
		return _getRoomAt(g_room_floors, x, floor_num);
	};

	/**
	 * Get room data of stair layer room for given location in the building.
	 * @return room data or null
	 */
	var getStairLayerRoomAt = function(x, floor_num) {
		return _getRoomAt(g_stair_floors, x, floor_num);
	};

	/**
	 * Check if rectangle given by x: [x, x+width], floor:[min_floor, max_floor] is
	 * free on the given room layer.
	 * @param floors_container The room layer container to check.
	 * @param x Left border of rectangle in map coordinate
	 * @param width Map width along x axis of the rectangle
	 * @param min_floor Lowest floor in rectangle
	 * @param max_floor Highest floor in rectangle
	 * @return true if the complete rectangle is free from rooms in floors_container, otherwise false
	 * @pre min_floor <= max_floor
	 */
	var _isVerticalRangeFree = function(floors_container, x, width, min_floor, max_floor) {
		assert(min_floor <= max_floor);
		for (var floor = min_floor; floor <= max_floor; floor++) {
			var floor_data = _getFloorData(floors_container, floor, false);
			if (floor_data !== null && !_isFloorFreeForRoomHere(floor_data, x, width)) {
				return false;
			}
		}
		return true;
	};

	/**
	 * Check if rectangle given by x: [x, x+width], floor:[min_floor, max_floor] has
	 * complete room coverage.
	 * @param x Left border of rectangle in map coordinate
	 * @param width Map width along x axis of the rectangle
	 * @param min_floor Lowest floor in rectangle
	 * @param max_floor Highest floor in rectangle
	 * @return true if the complete rectangle has room coverage, otherwise false
	 * @pre min_floor <= max_floor
	 */
	var _hasVerticalRangeRoomCoverage = function(x, width, min_floor, max_floor) {
		assert(min_floor <= max_floor);
		for (var floor = min_floor; floor <= max_floor; floor++) {
			if (!(floor in g_room_floors) || !_doesRoomsCoverXArea(g_room_floors[floor], x, width)) {
				return false;
			}
		}
		return true;
	};

	/**
	 * Change given elevator top/bottom to new floor.
	 * @param elevator The elevator data
	 * @param editEnd Which end to edit. 'top' or 'bottom'
	 * @param newFloor The new floor for top/bottom piece of the elevator. The shaft will
	 *        get extended or shortened to fit with this change.
	 * @param onlyCheck If true, the method will only check if it is possible and then return true/false. Defaults to false.
	 * @return true if edit is successful, otherwise false. If no change of min/max floor is requested, edit will be successful.
	 */
	var editElevatorEnd = function(elevator, editEnd, newFloor, onlyCheck) {
		assert(['bottom','top'].indexOf(editEnd) !== -1);
		onlyCheck = onlyCheck || false;

		// Do not allow the elevator floor range to be too small.
		if (editEnd === 'top' ? newFloor < elevator.min_floor + 2 : newFloor > elevator.max_floor - 2) return false;

		// Do not allow elevator floor range to exceed maximum defined by the room type
		var room_def = getStairLayerRoomAt(elevator.x, elevator.max_floor).def;
		if (editEnd === 'top' ? newFloor >= elevator.min_floor + room_def.elevator_max_floor_range + 2 :
				newFloor <= elevator.max_floor - room_def.elevator_max_floor_range - 2) {
			return false;
		}

		if (editEnd === 'top') {
			if (newFloor > elevator.max_floor) {
				// extend top
				// - check for clearance + rooms behind elevator shaft
				if (!_isVerticalRangeFree(g_stair_floors, elevator.x, room_def.width, elevator.max_floor + 1, newFloor)) return false;
				if (!_hasVerticalRangeRoomCoverage(elevator.x, room_def.width, elevator.max_floor, newFloor - 1)) return false;

				if (onlyCheck) return true;

				// - move top
				_moveRoomPiece(g_stair_floors, {x: elevator.x, floor: elevator.max_floor}, {x: elevator.x, floor: newFloor});

				// add shaft pieces
				for (var floor = elevator.max_floor; floor < newFloor; floor++) {
					assert(_cloneRoomPiece(g_stair_floors, {x: elevator.x, floor: elevator.max_floor-1}, {x: elevator.x, floor: floor}));
				}
			} else if (newFloor < elevator.max_floor) {
				if (onlyCheck) return true;

				// remove shaft pieces
				for (floor = newFloor; floor < elevator.max_floor; floor++) {
					_deleteRoomPiece(g_stair_floors, elevator.x, floor);
				}

				// move top
				_moveRoomPiece(g_stair_floors, {x: elevator.x, floor: elevator.max_floor}, {x: elevator.x, floor: newFloor});
			} else {
				// No floor change
				if (onlyCheck) return true;
			}

			elevator.max_floor = newFloor;
		} else {
			// Bottom
			if (newFloor < elevator.min_floor) {
				// extend bottom
				// - check for clearance + rooms behind elevator shaft
				if (!_isVerticalRangeFree(g_stair_floors, elevator.x, room_def.width, newFloor, elevator.min_floor - 1)) return false;
				if (!_hasVerticalRangeRoomCoverage(elevator.x, room_def.width, newFloor + 1, elevator.min_floor)) return false;

				if (onlyCheck) return true;

				// - move bottom
				_moveRoomPiece(g_stair_floors, {x: elevator.x, floor: elevator.min_floor}, {x: elevator.x, floor: newFloor});

				// add shaft pieces
				for (floor = newFloor + 1; floor <= elevator.min_floor; floor++) {
					assert(_cloneRoomPiece(g_stair_floors, {x: elevator.x, floor: elevator.min_floor+1}, {x: elevator.x, floor: floor}));
				}
			} else if (newFloor > elevator.min_floor) {
				if (onlyCheck) return true;

				// remove shaft pieces
				for (floor = elevator.min_floor + 1; floor <= newFloor; floor++) {
					_deleteRoomPiece(g_stair_floors, elevator.x, floor);
				}

				// move bottom
				_moveRoomPiece(g_stair_floors, {x: elevator.x, floor: elevator.min_floor}, {x: elevator.x, floor: newFloor});
			} else {
				// No floor change
				if (onlyCheck) return true;
			}
			elevator.min_floor = newFloor;
		}
		rebuildReachableFloors();
		return true;
	};

	/* eslint no-console: 0 */
	/**
	 * Check for errors in elevator data. Will write errors to console.log.
	 * @return true if no errors were found, otherwise false
	 */
	var validateElevators = function() {

		var handled_elevators = [];
		var result = true;
		var error = function(message) {
			console.log(message);
			result = false;
		};

		for (var floor = Building.MAX_FLOOR; floor >= Building.MIN_FLOOR; floor--) {
			if (!(floor in g_stair_floors)) continue;

			var floor_data = g_stair_floors[floor];
			for (var i = 0; i < floor_data.length; i++) {
				if (floor !== floor_data[i].floor) {
					error('Elvator error at [x: ' + floor_data[i].x + ', floor: ' + floor + ']: room_data.floor is different from the floor it is stored in');
				}
				if (RoomType.isElevator(floor_data[i].def.id)) {
					if (floor_data[i].elevator === null || floor_data[i].elevator === undefined) {
						error('Elvator error at [x: ' + floor_data[i].x + ', floor: ' + floor + ']: no elevator data');
						continue;
					}
					if (handled_elevators.indexOf(floor_data[i].elevator) === -1) {
						// not yet handled elevator
						var elevator = floor_data[i].elevator;

						if (floor_data[i].pieceName !== 'top') error('Elvator error at [x: ' + floor_data[i].x + ', floor: ' + floor + ']: piece with max floor number has not pieceName === "top"');

						// Find all pieces
						var all_pieces = [];
						var piece_floors = [];
						var bottom_piece = null;
						(function() {
							for (var p_floor = Building.MAX_FLOOR; p_floor >= Building.MIN_FLOOR; p_floor--) {
								if (!(p_floor in g_stair_floors)) continue;
								var p_floor_data = g_stair_floors[p_floor];
								for (var p_i = 0; p_i < p_floor_data.length; p_i++) {
									var piece = p_floor_data[p_i];
									if (piece.elevator === floor_data[i].elevator) {
										all_pieces.push(piece);
										if (piece_floors.indexOf(p_floor) !== -1) {
											error('Elvator error at [x: ' + p_floor_data[i].x + ', floor: ' + p_floor + ']: more than one elevator piece of the same elevator here');
										} else {
											piece_floors.push(p_floor);
										}
										if (piece.pieceName === 'bottom') bottom_piece = piece.pieceName;
										if ([null, 'top', 'bottom'].indexOf(piece.pieceName) === -1) {
											error('Elvator error at [x: ' + p_floor_data[i].x + ', floor: ' + p_floor + ']: invalid .pieceName value: ' + p_floor_data[i].pieceName);
										}
									}
								}
							}
						})();

						if (all_pieces.length !== (elevator.max_floor - elevator.min_floor + 1)) {
							error('Elvator error at [x: ' + floor_data[i].x + ', floor: ' + floor + ']: this elevator has different number of pieces than floors');
						}
						if (piece_floors.length !== (elevator.max_floor - elevator.min_floor + 1)) {
							error('Elvator error at [x: ' + floor_data[i].x + ', floor: ' + floor + ']: this elevator doesn\'t have exactly one piece at each floor');
						}
						if (bottom_piece === null) {
							error('Elvator error at [x: ' + floor_data[i].x + ', floor: ' + floor + ']: no bottom piece');
						}
						if (elevator.max_floor - elevator.min_floor + 1 < 3) {
							error('Elvator error at [x: ' + floor_data[i].x + ', floor: ' + floor + ']: violating min floor range of 3 floors including top/bottom piece');
						}
						if (elevator.max_floor - elevator.min_floor + 1 > floor_data[i].def.elevator_max_floor_range) {
							error('Elvator error at [x: ' + floor_data[i].x + ', floor: ' + floor + ']: violating elevator max floor range of ' + floor_data[i].def.elevator_max_floor_range + ' floors');
						}

						handled_elevators.push(elevator);
					}
				}
			}
		}

		return result;
	};

	/**
	 * Check if a room can be built at given map position.
	 * @param room_type Any room type including stairs
	 * @param pieceName null or piece name. Defaults to null. See build() for more info.
	 */
	var canBuildRoomHere = function(room_type, x, floor_num, pieceName) {
		pieceName = pieceName || null;

		// Stairs are different enough so they are handled separate
		if (RoomType.isStairLayerRoom(room_type)) return _canBuildStairHere(room_type, x, floor_num, pieceName);

		// Town Hall Room can only be built once
		if (room_type === 'town-hall-room' && Room.getCount(room_type) > 0) return false;

		var room_def = g_room_types[room_type];
		if (floor_num in g_room_floors) {
			// if existing floor, check for conflict with rooms
			var floor_data = g_room_floors[floor_num];
			if (!_isFloorFreeForRoomHere(floor_data, x, room_def.width)) {
				return false;
			}
		}

		if (floor_num === 0) return true;

		if (floor_num > 0) {
			// Make sure there is a room on the floor below
			if ((floor_num - 1) in g_room_floors) {
				var floor_below_data = g_room_floors[floor_num-1];

				return _doesRoomsCoverXArea(floor_below_data, x, room_def.width);
			} else {
				// no roomes on current or floor below
				return false;
			}
		} else {
			if (room_type === 'office') return false;

			return true; // anywhere in underground is ok
		}
	};

	/**
	 * Check if a stair can be built at given map position.
	 * @param room_type A stair room type
	 * @param pieceName null or piece name. Defaults to null. See build() for more info.
	 */
	var _canBuildStairHere = function(room_type, x, floor_num, pieceName) {
		assert(RoomType.isStairLayerRoom(room_type));
		pieceName = pieceName || null;
		var room_def = g_room_types[room_type];

		// Elevator need free space above/below
		if (RoomType.isElevator(room_type) && pieceName === null &&
				(!_canBuildStairHere(room_type, x, floor_num - 1, 'bottom') ||
				!_canBuildStairHere(room_type, x, floor_num + 1, 'top'))) {
			return false;
		}
		assert(!RoomType.isElevator(room_type) || pieceName === null || ['bottom', 'top'].indexOf(pieceName) !== -1);

		// Elevator top/bottom pieces do not need room - only the main piece
		var skip_has_room = RoomType.isElevator(room_type) && pieceName !== null;

		// Stairs cannot be built over floor 15
		if (room_type === 'stair' && floor_num > 15) return false;

		// A stair must be built on a floor with room
		if (!skip_has_room && !(floor_num in g_room_floors)) return false;

		// Check for conflict with other stairs
		if (floor_num in g_stair_floors) {
			var floor_data = g_stair_floors[floor_num];
			if (!_isFloorFreeForRoomHere(floor_data, x, room_def.width)) {
				return false;
			}
		}

		// There must be room(s) covering all x-space that the stair covers
		if (skip_has_room) return true;
		return _doesRoomsCoverXArea(g_room_floors[floor_num], x, room_def.width);
	};

	/**
	 * Return the building height in number of floors (above ground)
	 */
	var getBuildingHeight = function() {
		for (var i = MAX_FLOOR; i > MIN_FLOOR; i--) {
			if (i in g_room_floors) return i + 1;
		}
		return 0;
	};

	/**
	 * Rebuilds g_reachable_floors. Should be called when a stair is built/demolished
	 */
	var rebuildReachableFloors = function() {

		g_reachable_floors = {};
		g_reachable_floors[0] = true;

		// Upwards from entry level
		for (var floor_num = 0; floor_num <= MAX_FLOOR; floor_num++) {
			if (floor_num in g_stair_floors && _hasFloorRoomOfType(g_stair_floors[floor_num], 'stair')) {
				g_reachable_floors[floor_num + 1] = true;
			} else if (_canReachAdjLevelByElevator(floor_num, 1)) {
				g_reachable_floors[floor_num + 1] = true;
			} else {
				break;
			}
		}

		// Downwards from entry level
		for (floor_num = 0; floor_num >= MIN_FLOOR; floor_num--) {
			if ((floor_num - 1) in g_stair_floors && _hasFloorRoomOfType(g_stair_floors[floor_num-1], 'stair')) {
				g_reachable_floors[floor_num - 1] = true;
			} else if (_canReachAdjLevelByElevator(floor_num, -1)) {
				g_reachable_floors[floor_num - 1] = true;
			} else {
				break;
			}
		}

		// Elevators are built as one unit per floor. And they need to be over each other to connect.
		for (floor_num = 0; floor_num <= MAX_FLOOR; floor_num++) {
			if (!(floor_num in g_stair_floors)) continue;
		}
	};

	// --- helpers ---

	var _getFloorData = function(floors_container, floor_num, add_if_missing) {
		if (!(floor_num in floors_container)) {
			if (add_if_missing) {
				floors_container[floor_num] = [];
			} else {
				return null;
			}
		}
		return floors_container[floor_num];
	};

	var _isFloorFreeForRoomHere = function(floor_data, room_x, room_width) {
		return _getRoomInsertIndex(floor_data, room_x, room_width) !== false;
	};

	/** Returns room data or null */
	var _getRoomAt = function(floors_container, x, floor_num) {
		var floor_data = _getFloorData(floors_container, floor_num, false);
		if (floor_data === null) return null;
		return _getRoomAtX(floor_data, x);
	};

	/** Returns room data or null */
	var _getRoomAtX = function(floor_data, x) {
		for (var i = 0; i < floor_data.length; i++) {
			if (floor_data[i].x === x) return floor_data[i];
		}
		return null;
	};

	/*
	 * Compute index in floor_data where to insert given room.
	 * If there is not space for a new room, boolean false is
	 * returned.
	 */
	var _getRoomInsertIndex = function(floor_data, room_x, room_width) {
		if (floor_data.length <= 0) return 0;
		if (room_x + room_width <= floor_data[0].x) return 0;
		if (floor_data[floor_data.length-1].x + floor_data[floor_data.length-1].width <= room_x) return floor_data.length;

		for (var i = 0; i < floor_data.length - 1; i++) {
			if (floor_data[i].x + floor_data[i].width <= room_x &&
					room_x + room_width <= floor_data[i+1].x) return i+1;
		}

		return false;
	};

	var _hasFloorRoomOfType = function(floor_data, room_type) {
		for (var i = 0; i < floor_data.length; i++) {
			if (floor_data[i].def.id === room_type) return true;
		}
		return false;
	};


	/**
	 * @param level_change 1 for going up, and -1 for going down.
	 */
	var _canReachAdjLevelByElevator = function(floor_num, level_change) {

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
			if (RoomType.isElevator(floor_data[i].def.id) && floor_data[i].pieceName === null) {
				for (var i_other = 0; i_other < other_floor_data.length; i_other++) {
					if (RoomType.isElevator(other_floor_data[i_other].def.id) &&
							other_floor_data[i_other].pieceName === null &&
							floor_data[i].x == other_floor_data[i_other].x) {
						return true;
					}
				}
			}
		}

		return false;
	};

	/**
	 * Check if there are rooms that fully cover a given area in X-dimension.
	 * @param floor_data The floor to check if it contains room that cover the X-area
	 */
	var _doesRoomsCoverXArea = function(floor_data, x, width) {
		// List of x coords that should all be covered by any room
		var is_covered = {};
		for (var i = 0; i < width; i++) {
			is_covered[x + i] = false;
		}

		// Set x coords of is_covered to true if there is a room part
		// exactly covering it
		for (i = 0; i < floor_data.length; i++) {

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
	};

	/**
	 * Creates a new room instance and return it. It is not added to any floor container.
	 */
	var _newRoomInstance = function(room_def, x, floor, pieceName) {
		var room_instance = {
			x: x,
			floor: floor,
			width: room_def.width,
			def: room_def,
			state: Room.ROOM_STATE_FOR_RENT,
			rent_day: 0, // simulation day when room was rent
			build_day: g_simulation_day, // simulation day when room was built
			not_reachable_counter: 0, // 0 or time it has not been reachable (via stairs)
			pieceName: pieceName, // name of piece or null
			elevator: null,    // pointer to elevator data or null
		};
		if (RoomType.isStairLayerRoom(room_def.id)) room_instance.state = Room.ROOM_STATE_OPEN;
		if (room_def.id === 'town-hall-room') room_instance.state = Room.ROOM_STATE_CLOSED;

		return room_instance;
	};

	/**
	 * Deletes a room instance at given map coordinate. Does not delete linked elevator parts.
	 * Removes overlay
	 */
	var _deleteRoomPiece = function(floors_container, x, floor) {
		var floor_data = _getFloorData(floors_container, floor, false);
		assert(floor_data !== null);

		for (var i = 0; i < floor_data.length; i++) {
			if (floor_data[i].x === x) {
				var room_instance = floor_data[i];
				floor_data.splice(i, 1);

				Gui.removeOverlayItem(room_instance.overlay_item);
				return;
			}
		}
	};

	/**
	 * Move a room from one place to another. Will fail if the target
	 * place is not free. Will not change any linked elevator parts.
	 * @param from {x: , floor: }
	 * @param to {x: , floor: }
	 * @pre A room exist at from place
	 */
	var _moveRoomPiece = function(floors_container, from, to) {
		var room_instance = _getRoomAt(floors_container, from.x, from.floor);

		var from_floor_data = _getFloorData(floors_container, from.floor, false);
		assert(from_floor_data !== null);

		// Is destination free?
		var to_floor_data = _getFloorData(floors_container, to.floor, true);
		if (!_isFloorFreeForRoomHere(to_floor_data, to.x, room_instance.def.width)) return false;

		// Remove from 'from' floor
		Gui.removeOverlayItem(room_instance.overlay_item);
		room_instance.overlay_item = null;
		var n = from_floor_data.length;
		for (var i = 0; i < from_floor_data.length; i++) {
			if (from_floor_data[i] === room_instance) {
				from_floor_data.splice(i, 1);
				break;
			}
		}
		assert(n === from_floor_data.length + 1);

		// Add to 'to' floor
		i = _getRoomInsertIndex(to_floor_data, to.x, room_instance.def.width);
		assert(i !== false);
		to_floor_data.splice(i, 0, room_instance);

		// update x, room and create overlay
		room_instance.x = to.x;
		room_instance.floor = to.floor;
		addOverlayItemForRoom(room_instance);

		return true;
	};

	/**
	 * Clone a room piece from one place to another. Will fail if the target
	 * place is not free. Adds overlay for cloned instance.
	 * @param from {x: , floor: }
	 * @param to {x: , floor: }
	 * @pre A room exist at from place
	 */
	var _cloneRoomPiece = function(floors_container, from, to) {
		var room_instance = _getRoomAt(floors_container, from.x, from.floor);

		var from_floor_data = _getFloorData(floors_container, from.floor, false);
		assert(from_floor_data !== null);

		// Is destination free?
		var to_floor_data = _getFloorData(floors_container, to.floor, true);
		if (!_isFloorFreeForRoomHere(to_floor_data, to.x, room_instance.def.width)) return false;

		// Create new room instance
		var clone_instance = _newRoomInstance(room_instance.def, to.x, to.floor, room_instance.pieceName);
		clone_instance.elevator = room_instance.elevator;
		clone_instance.build_day = room_instance.build_day; // use build day of cloned room piece

		// Add to 'to' floor
		var i = _getRoomInsertIndex(to_floor_data, to.x, room_instance.def.width);
		assert(i !== false);
		to_floor_data.splice(i, 0, clone_instance);

		addOverlayItemForRoom(clone_instance);

		return true;
	};

	// Export:
	return {
		/* consts */
		MIN_FLOOR: MIN_FLOOR,
		MAX_FLOOR: MAX_FLOOR,

		/* functions */
		init: init,
		buildRoom: buildRoom,
		addOverlayItemForRoom: addOverlayItemForRoom,
		demolishRoom: demolishRoom,
		editElevatorEnd: editElevatorEnd,
		validateElevators: validateElevators,
		getRoomAt: getRoomAt,
		getStairLayerRoomAt: getStairLayerRoomAt,
		canBuildRoomHere: canBuildRoomHere,
		getBuildingHeight: getBuildingHeight,
		rebuildReachableFloors: rebuildReachableFloors,
	};
})();
