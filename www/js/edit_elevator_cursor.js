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

	var _x = null;        // Map x coordinate of cursor
	var _floor = null;    // Map floor of cursor

	var _room_def = null; // room def of elevator - for convince

	var _elevator = null;  // Room elevator to edit
	var _edit_end = null;  //'top' or 'bottom'
	var _can_build = null; // True if cursor action can execute at current location

	var _dom = { // DOM elements of the cursor. Note: these are actually jQuery objcets.
		cursor: null, // wrapper element
		a: null,      // link <a>
	};

	/**
	 * App startup initialization of cursor.
	 *
	 * When cursor is to be used, call #start to set up the cursor
	 * width and other data specific to each room type.
	 */
	var init = function() {

		var cursor = $('#gui-edit-elevator-cursor');
		assert(cursor.length !== 0);
		var a = cursor.find('a');

		/* Initialize cursor data. */
		_x = 0;
		_floor = 0;
		_room_def = null;
		_elevator = null;
		_edit_end = null;
		_can_build = false;
		_dom.cursor = cursor;
		_dom.a = a;

		/*
		 * Arrow keys do not fire keypress on all browsers. So use 'keydown' event rather than 'keypress'
		 * as not everyone feel at home with hjkl.
		 */
		a.on('keydown', function(e) {
			var d_floor = 0;
			switch (e.which) {
				case 13: // Enter/return
					this.click();
					e.preventDefault();
					return;

				case 27: // Escape
					stop();
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
			if (canvas_y <= 32) return; // avoid moving the build cursor ontop of stop edit elevator toolbar button.
			var map_pos = ScreenToMap(canvas_x, canvas_y);

			var floor = Math.floor(map_pos[1]);
			_setCursorPosition(floor);
		});

		overlay.on('click', function() {
			stop();
		});

	};

	/**
	 * Click handler for cursor. Handles both mouse click and keyboard enter key.
	 */
	var _cursorClick = function() {
		// Stop cursor
		_elevator = null;
		_edit_end = null;
		Gui.switchOverlay(Gui.OVERLAY_NAV);
	};

	/**
	 * Move cursor by delta floor.
	 * @param d_floor delta floor
	 */
	var _moveCursor = function(d_floor) {
		_setCursorPosition(_floor + d_floor);
	};

	/**
	 * Move cursor to given floor. If a position outside of the screen is given
	 * it will be clamped so that the full room is visible within the screen.
	 * x will try to stay at elevator, as long as it is on screen.
	 * @param floor the map floor coordinate
	 */
	var _setCursorPosition = function(floor) {
		var x = _elevator.x;
		var screen_pos = MapToScreen(x, floor);

		// Clamp position to be within screen
		while (screen_pos[0] < 0) {
			x++;
			screen_pos = MapToScreen(x, floor);
		}
		while (screen_pos[0] + _room_def.width * 16 > g_canvas.width) {
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

		if (x !== _x || floor !== _floor) {
			_x = x;
			_floor = floor;

			_editElevator();
			_updateCanBuildStatus();
		}

		// We don't know the old screen location as view might have shifted since last position update.
		(function(){
			var cursor = _dom.cursor;
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
			_setCursorPosition(_floor);
		}
	};

	/**
	 * Check if cursor is visible
	 */
	var _isVisible = function() {
		return !_dom.cursor.parent().hasClass('hidden');
	};

	/**
	 * Edit elevator top/down to match the floor of cursor
	 */
	var _editElevator = function() {
		var new_floor = _floor;
		var elevator = _elevator;

		// Ensure that the elevator will have at least one non top/bottom piece after the edit
		// + will not violate floor range restriction
		if (_edit_end === 'top') {
			new_floor = Math.max(new_floor, elevator.min_floor + 2);
			new_floor = Math.min(new_floor, elevator.min_floor + _room_def.elevator_max_floor_range + 1);
		} else {
			new_floor = Math.min(new_floor, elevator.max_floor - 2);
			new_floor = Math.max(new_floor, elevator.max_floor - _room_def.elevator_max_floor_range - 1);
		}

		if(new_floor !== (_edit_end === 'top' ? elevator.max_floor : elevator.min_floor)) {
			// Edit if new_floor is different
			if (Building.editElevatorEnd(elevator, _edit_end, new_floor)) {
				PlaySoundEffect('build');
			}
		}
	};

	/**
	 * Updates build cursor regarding if room can be built at current position.
	 */
	var _updateCanBuildStatus = function() {
		var cursor_floor = _floor;
		var elevator = _elevator;

		_can_build = Building.editElevatorEnd(elevator, _edit_end, cursor_floor);

		var cursor = _dom.cursor;
		var a = _dom.a;
		if (_can_build) {
			cursor.addClass('can-build');
			cursor.removeClass('cannot-build');
			a.attr('title', _room_def.name + ' ' + _edit_end + ', at floor: ' + cursor_floor);
		} else {
			cursor.removeClass('can-build');
			cursor.addClass('cannot-build');
			a.attr('title', 'Cannot adjust ' + _room_def.name + ' ' + _edit_end + ' to floor ' + cursor_floor);
		}
	};

	/**
	 * Get the edited elevator piece
	 */
	var _getPiece = function() {
		return Building.getStairLayerRoomAt(_elevator.x,  _edit_end === 'top' ? _elevator.max_floor : _elevator.min_floor);
	};

	/**
	 * Set the elevator to edit
	 * @param elevator The elevator data of the elevator to edit
	 * @param editEnd 'bottom' or 'top'
	 */
	var _setElevatorToEdit = function(elevator, editEnd) {
		assert(['top','bottom'].indexOf(editEnd) !== -1);

		_elevator = elevator;
		_edit_end = editEnd;
		var piece = _getPiece();
		_room_def = piece.def;
		assert(RoomType.isElevator(_room_def.id));

		var cursor = _dom.cursor;
		var a = _dom.a;

		// move cursor to elevator piece
		_x = piece.x;
		_floor = piece.floor;

		a.css('width',  (piece.def.width * 16) + 'px');
		var screen_pos = MapToScreen(_x, _floor);
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
	 * Stop edit elevator cursor and return to nav overlay
	 */
	var stop = function() {
		_elevator = null;
		_edit_end = null;
		Gui.switchOverlay(Gui.OVERLAY_NAV);
	};

	// Export:
	return {
		init: init,

		updateScreenPosition: updateScreenPosition,

		start: start,
		stop: stop,
	};
})();

