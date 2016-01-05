/*
 * Module: EditElevatorCursor
 *
 * The cursor is a dom-node that can be moved around on the screen using mouse and keyboard.
 * With it the user can select a location in the map to perform an action.
 */

/* global Building, Gui, RoomType */
/* global g_canvas */
/* global assert, MapToScreen, ScreenToMap, PlaySoundEffect */

/* exported EditElevatorCursor */
var EditElevatorCursor = (function() {

	var _cursor_data = null; // data for the edit elevator cursor

	/**
	 * App startup initialization of cursor.
	 *
	 * When cursor is to be used, call #start to set up the cursor
	 * width and other data specific to each room type.
	 */
	var init = function() {
		_cursor_data = {};

		var cursor = $('#gui-edit-elevator-cursor');
		assert(cursor.length !== 0);
		var a = cursor.find('a');

		_cursor_data = {
			/* Map position of cursor */
			x: 0,
			floor: 0,

			room_def: null, // room def of elevator - for convince

			elevator: null, // Room elevator to edit
			edit_end: null,  //'top' or 'bottom'
			can_build: false, // True if cursor action can execute at current location

			dom: { // DOM elements of the cursor. Note: these are actually jQuery objcets.
				cursor: cursor, // wrapper element
				a: a,           // link <a>
			},
		};

		/*
		 * Arrow keys do not fire keypress on all browsers. So use 'keydown' event rather than 'keypress'
		 * as not everyone feel at home with hjkl.
		 */
		a.on('keydown', function(e) {
			if (e.which === 13) {
				this.click();
				e.preventDefault();
				return;
			}

			var d_floor = 0;
			switch (e.which) {
				case 13: // Enter/return
					this.click();
					e.preventDefault();
					return;

				case 27: // Escape
					abort();
					e.preventDefault();
					return;

				case 40: // Arrow down
				case 74: // j
					d_floor--;
					break;
				case 38: // Arrow up
				case 75: // k
					d_floor++;
					break;
			}

			var ctrl_use = false;

			// Move 5 floors at the time if ctrl key is depressed.
			if (e.ctrlKey && [37, 40, 38, 39].indexOf(e.which) !== -1) {
				d_floor *= 5;
				ctrl_use = true;
			}

			// Avoid calling preventDefault when modifier key is depressed unless we make use of it.
			// At least on Chrome this would disable default browser bindings like Ctrl+H => History
			if (!ctrl_use && e.ctrlKey) return;
			if (e.shiftKey) return;
			if (e.altKey) return;

			if (d_floor !== 0) {
				_moveCursor(d_floor);
				e.preventDefault();
			}
		});

		a.on('click', function() {
			_cursorClick();
		});

		a.on('mouseenter', function() {
			a.focus();
		});

		var overlay = $('#gui-edit-elevator-overlay');
		assert(overlay.length !== 0, 'overlay not found');
		overlay.on('mousemove', function(e) {
			var offset = overlay.offset();
			var canvas_x = e.pageX - offset.left;
			var canvas_y = e.pageY - offset.top;
			if (canvas_y <= 32) return; // avoid moving the build cursor ontop of abort build toolbar button.
			var map_pos = ScreenToMap(canvas_x, canvas_y);

			var floor = Math.floor(map_pos[1]);
			_setCursorPosition(floor);
		});

		overlay.on('click', function() {
			abort();
		});

	};

	/**
	 * Click handler for cursor. Handles both mouse click and keyboard enter key.
	 */
	var _cursorClick = function() {
		// Stop cursor
		_cursor_data.elevator = null;
		_cursor_data.edit_end = null;
		Gui.switchOverlay(Gui.OVERLAY_NAV);
	};

	/**
	 * Move cursor by delta floor.
	 * @param d_floor delta floor
	 */
	var _moveCursor = function(d_floor) {
		_setCursorPosition(_cursor_data.floor + d_floor);
	};

	/**
	 * Move cursor to given floor. If a position outside of the screen is given
	 * it will be clamped so that the full room is visible within the screen.
	 * x will try to stay at elevator, as long as it is on screen.
	 * @param floor the map floor coordinate
	 */
	var _setCursorPosition = function(floor) {
		var x = _cursor_data.elevator.x;
		var screen_pos = MapToScreen(x, floor);

		// Clamp position to be within screen
		while (screen_pos[0] < 0) {
			x++;
			screen_pos = MapToScreen(x, floor);
		}
		while (screen_pos[0] + _cursor_data.room_def.width * 16 > g_canvas.width) {
			x--;
			screen_pos = MapToScreen(x, floor);
		}
		while (screen_pos[1] < 31) { // do not allow positioning on the top toolbar row
			floor--;
			screen_pos = MapToScreen(x, floor);
		}
		while (screen_pos[1] + 32 > g_canvas.height) {
			floor++;
			screen_pos = MapToScreen(x, floor);
		}

		if (x !== _cursor_data.x || floor !== _cursor_data.floor) {
			_cursor_data.x = x;
			_cursor_data.floor = floor;

			_editElevator();
			_updateCanBuildStatus();
		}

		// We don't know the old screen location as view might have shifted since last position update.
		(function(){
			var cursor = _cursor_data.dom.cursor;
			cursor.css('left', screen_pos[0]);
			cursor.css('top', screen_pos[1]);
		})();
	};

	/**
	 * Updates the position of cursor on screen from current map position, if the
	 * cursor is visible.
	 */
	var updateScreenPosition = function() {
		if (_isVisible()) {
			_setCursorPosition(_cursor_data.floor);
		}
	};

	/**
	 * Check if cursor is visible
	 */
	var _isVisible = function() {
		return !_cursor_data.dom.cursor.parent().hasClass('hidden');
	};

	/**
	 * Edit elevator top/down to match the floor of cursor
	 */
	var _editElevator = function() {
		var new_floor = _cursor_data.floor;
		var elevator = _cursor_data.elevator;

		// Ensure that the elevator will have at least one non top/bottom piece after the edit
		// + will not violate floor range restriction
		if (_cursor_data.edit_end === 'top') {
			new_floor = Math.max(new_floor, elevator.min_floor + 2);
			new_floor = Math.min(new_floor, elevator.min_floor + _cursor_data.room_def.elevator_max_floor_range + 1);
		} else {
			new_floor = Math.min(new_floor, elevator.max_floor - 2);
			new_floor = Math.max(new_floor, elevator.max_floor - _cursor_data.room_def.elevator_max_floor_range - 1);
		}

		if(new_floor !== (_cursor_data.edit_end === 'top' ? elevator.max_floor : elevator.min_floor)) {
			// Edit if new_floor is different
			if (Building.editElevatorEnd(elevator, _cursor_data.edit_end, new_floor)) {
				PlaySoundEffect('build');
			}
		}
	};

	/**
	 * Updates build cursor regarding if room can be built at current position.
	 */
	var _updateCanBuildStatus = function() {
		var cursor_floor = _cursor_data.floor;
		var elevator = _cursor_data.elevator;

		_cursor_data.can_build = Building.editElevatorEnd(elevator, _cursor_data.edit_end, cursor_floor);

		var cursor = _cursor_data.dom.cursor;
		var a = _cursor_data.dom.a;
		if (_cursor_data.can_build) {
			cursor.addClass('can-build');
			cursor.removeClass('cannot-build');
			a.attr('title', _cursor_data.room_def.name + ' ' + _cursor_data.edit_end + ', at floor: ' + cursor_floor);
		} else {
			cursor.removeClass('can-build');
			cursor.addClass('cannot-build');
			a.attr('title', 'Cannot adjust ' + _cursor_data.room_def.name + ' ' + _cursor_data.edit_end + ' to floor ' + cursor_floor);
		}
	};

	/**
	 * Get the edited elevator piece
	 */
	var _getPiece = function() {
		return Building.getStairLayerRoomAt(_cursor_data.elevator.x,  _cursor_data.edit_end === 'top' ? _cursor_data.elevator.max_floor : _cursor_data.elevator.min_floor);
	};

	/**
	 * Set the elevator to edit
	 * @param elevator The elevator data of the elevator to edit
	 * @param editEnd 'bottom' or 'top'
	 */
	var _setElevatorToEdit = function(elevator, editEnd) {
		assert(['top','bottom'].indexOf(editEnd) !== -1);

		_cursor_data.elevator = elevator;
		_cursor_data.edit_end = editEnd;
		var piece = _getPiece();
		_cursor_data.room_def = piece.def;
		assert(RoomType.isElevator(_cursor_data.room_def.id));

		var cursor = _cursor_data.dom.cursor;
		var a = _cursor_data.dom.a;

		// move cursor to elevator piece
		_cursor_data.x = piece.x;
		_cursor_data.floor = piece.floor;

		a.css('width',  (piece.def.width * 16) + 'px');
		var screen_pos = MapToScreen(_cursor_data.x, _cursor_data.floor);
		cursor.css('left', screen_pos[0]);
		cursor.css('top', screen_pos[1]);

		_updateCanBuildStatus();
	};

	/**
	 * Start edit given elevator top/bottom floor
	 * @param elevator The elevator data of the elevator to edit
	 * @param editEnd 'bottom' or 'top'
	 */
	var start = function(elevator, editEnd) {
		_setElevatorToEdit(elevator, editEnd);
		Gui.switchOverlay(Gui.OVERLAY_EDIT_ELEVATOR);
	};

	/**
	 * Abort the edit elevator cursor
	 */
	var abort = function() {
		_cursor_data.elevator = null;
		_cursor_data.edit_end = null;
		Gui.switchOverlay(Gui.OVERLAY_NAV);
	};

	// Export:
	return {
		init: init,

		updateScreenPosition: updateScreenPosition,

		start: start,
		abort: abort,
	};
})();

