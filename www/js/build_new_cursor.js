/*
 * Module: BuildNewCursor 
 *
 * The cursor is a dom-node that can be moved around on the screen using mouse and keyboard.
 * With it the user can select a location in the map to perform an action.
 */

/* global Building, Gui, Money, MtImage, RoomType */
/* global g_canvas, g_bank_balance:true */
/* global assert, MapToScreen, ScreenToMap, PlaySoundEffect */

/* exported BuildNewCursor */
var BuildNewCursor = (function() {

	var _x = null;        // Map x coordinate of cursor
	var _floor = null;    // Map floor of cursor

	var _rect_mode = null; // True if rect mode is active, otherwise false
	var _rect_from_x = null;     // Start corner of rect
	var _rect_from_floor = null; // Start corner of rect

	var _room_def = null;  // Room def of type to build or null.
	var _can_build = null; // True if cursor action can execute at current location

	var _dom = { // DOM elements of the cursor. Note: these are actually jQuery objcets.
		cursor: null, // wrapper element
		a: null,      // link <a>
	};

	/**
	 * App startup initialization of cursor.
	 *
	 * When starting to build a room type, call #start to set up the cursor
	 * width and other data specific to each room type.
	 */
	var init = function() {
		var cursor = $('#gui-build-new-cursor');
		assert(cursor.length !== 0);
		var a = cursor.find('a');

		/* Initialize cursor data. */
		_x = 0;
		_floor = 0;
		_rect_mode = false;
		_rect_from_x = null;
		_rect_from_floor = null;
		_rect_mode = null;
		_room_def = null;
		_can_build = false;
		_dom.cursor = cursor;
		_dom.a = a;

		/*
		 * Arrow keys do not fire keypress on all browsers. So use 'keydown' event rather than 'keypress'
		 * as not everyone feel at home with hjkl.
		 */
		a.on('keydown', function(e) {
			var d_x = 0; 
			var d_floor = 0;
			_setRectMode(e.shiftKey, false);
			switch (e.which) {
				case 13: // Enter/return
					_cursorClick();
					e.preventDefault();
					return;

				case 27: // Escape
					stop();
					e.preventDefault();
					return;

				case 37: // Arrow left
				case 72: // h
					d_x--;
					break;
				case 40: // Arrow down
				case 74: // j
					d_floor--;
					break;
				case 38: // Arrow up
				case 75: // k
					d_floor++;
					break;
				case 39: // Arrow right
				case 76: // l
					d_x++;
					break;
			}

			var ctrl_use = false;

			// Move a whole cursor width at the time if Ctrl or Shift key is depressed while using one of the arrow keys
			if ((e.ctrlKey || e.shiftKey) && [37, 39].indexOf(e.which) !== -1) {
				d_x *= _room_def.width;
				ctrl_use = e.ctrlKey;
			}
			if (e.ctrlKey && [40, 38].indexOf(e.which) !== -1) {
				d_floor *= 5;
				ctrl_use = true;
			}

			// Avoid calling preventDefault when modifier key is depressed unless we make use of it.
			// At least on Chrome this would disable default browser bindings like Ctrl+H => History
			if (!ctrl_use && e.ctrlKey) return;
			if (e.altKey) return;

			if (d_x !== 0 || d_floor !== 0) {
				_moveCursor(d_x, d_floor);
				e.preventDefault();
			}
		});

		a.on('keyup', function(e) {
			_setRectMode(e.shiftKey, false);
		});

		a.on('mousedown', function(e) {
			_setRectMode(true, true);
		});

		a.on('mouseup', function(e) {
			_setRectMode(_rect_mode || e.shiftKey, false);
			_cursorClick();
			_setRectMode(e.shiftKey, true);
		});

		a.on('mouseenter', function() {
			a.focus();
		});

		var overlay = $('#gui-build-new-overlay');
		assert(overlay.length !== 0, 'overlay not found');
		overlay.on('mousemove', function(e) {
			var offset = overlay.offset();
			var canvas_x = e.pageX - offset.left;
			var canvas_y = e.pageY - offset.top;
			if (canvas_y <= 32) return; // avoid moving the build cursor ontop of stop build toolbar button.
			var map_pos = ScreenToMap(canvas_x, canvas_y);

			// Adjust so cursor center follows mouse pointer.
			var x = Math.floor(map_pos[0] - (_room_def.width - 0.5) / 2.0);
			var floor = Math.floor(map_pos[1]);

			_setCursorPosition(x, floor);
		});
	};

	/**
	 * Click handler for cursor. Handles both mouse click and keyboard enter key.
	 */
	var _cursorClick = function() {
		assert(_room_def !== null, 'Build cursor has no room type');
		if (g_bank_balance < _room_def.buy_cost) {
			Gui.showCannotAffordWindow(_room_def);
			return;
		}

		/* Build all rooms */
		var rect = _getRectBoundaries();
		var max_build_x = rect.min_x + (rect.x_count - 1) * _room_def.width; // left x for rightmost room
		var any_built = false;
		for (var ix = 0; ix < rect.x_count; ix++) {
			// When building rect start from the last click location.
			var x = _rect_mode && _x < _rect_from_x ? max_build_x - ix * _room_def.width : rect.min_x + ix * _room_def.width;

			// For floors however, it only make sense to build from bottom up to top regardless of click order.
			for (var floor = rect.min_floor; floor <= rect.max_floor; floor++) {
				if (g_bank_balance < _room_def.buy_cost) {
					break; // ran out of money
				}
				if (Building.buildRoom(_room_def.id, floor, x)) {
					g_bank_balance -= _room_def.buy_cost;
					any_built = true;
				}
			}
		}

		/* User feedback */
		if (any_built) {
			Money.animateCost();
			PlaySoundEffect('build');
		}
		if (RoomType.isElevator(_room_def.id)) {
			// User probably want to adjust elevator floor range after building it
			stop();
		} else {
			// Continue to build same room type - update cursor can build status
			_updateCanBuildStatus();
		}

		_rect_from_x = _x;
		_rect_from_floor = _floor;
	};

	var _setRectMode = function(newValue, updateFrom) {
		updateFrom = updateFrom || false;
		if (_rect_mode !== newValue) {
			_rect_mode = newValue === true;

			if (_rect_mode && updateFrom) {
				_rect_from_x = _x;
				_rect_from_floor = _floor;
			}

			_updateDomCursor();
		}
	};

	/**
	 * Draws room image at cursor position if cursor is visible, focused and room can be built.
	 */
	var draw = function() {
		if (!_isVisible()) return;

		if (_room_def !== null && _can_build &&
				_dom.cursor.find('a:focus').length !== 0) {

			/* Build cursor: Draw room at cursor position. */
			var room_def = _room_def;

			var rect = _getRectBoundaries();
			var max_build_x = rect.min_x + (rect.x_count - 1) * _room_def.width; // left x for rightmost room
			for (var ix = 0; ix < rect.x_count; ix++) {
				// When building rect start from the last click location.
				var x = _rect_mode && _x < _rect_from_x ? max_build_x - ix * _room_def.width : rect.min_x + ix * _room_def.width;

				// Only display rooms at first floor. It becomes a bit complex to correctly visualize
				// all other floors correctly at all possible situations.
				var floor = rect.min_floor;
				var can_build = Building.canBuildRoomHere(_room_def.id, x, floor);
				if (can_build) {
					var screen_pos = MapToScreen(x, floor);
					var y_offset = room_def.id === 'stair' ? -16 : 0;
					MtImage.draw(room_def.image, screen_pos[0], screen_pos[1] + y_offset);
				}
			}
		}
	};

	/**
	 * Move build cursor by delta x and delta floor.
	 * @param d_x delta x
	 * @param d_floor delta floor
	 */
	var _moveCursor = function(d_x, d_floor) {
		_setCursorPosition(_x + d_x, _floor + d_floor);
	};

	/**
	 * Move cursor to given x and floor. If a position outside of the screen
	 * is given it will be clamped so that the full room is visible within the screen.
	 * @param x the map x coordinate
	 * @param floor the map floor coordinate
	 */
	var _setCursorPosition = function(x, floor) {
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

			_updateDomCursor();
			_updateCanBuildStatus();
		}
	};

	/**
	 * Calculates the build rectangle boundaries. When _rect_mode is false,
	 * a 1x1 room rectangle is returned at current cursor position.
	 */
	var _getRectBoundaries = function() {
		if (_rect_mode) {
			// When x range is not a multiplier of room width, the rect should be
			// such that _rect_from_x is respected regardless of rect direction.
			var min_x = Math.min(_rect_from_x, _x);
			var max_x = Math.max(_rect_from_x, _x);
			var x_count = Math.floor(Math.abs(_x - _rect_from_x) / _room_def.width) + 1;
			var x0 = _x < _rect_from_x ? max_x - (x_count - 1) * _room_def.width : min_x;

			var min_floor = Math.min(_floor, _rect_from_floor);
			var max_floor = Math.max(_floor, _rect_from_floor);
			var y_count = Math.floor(Math.abs(_floor - _rect_from_floor)) + 1;

			return {
				min_x: x0,
				x_count: x_count,

				min_floor: min_floor,
				max_floor: max_floor,
				y_count: y_count,
			};
		} else {
			return {
				min_x: _x,
				x_count: 1,

				min_floor: _floor,
				max_floor: _floor,
				y_count: 1,
			};
		}
	}

	/**
	 * Updates the DOM cursor top, left, width and height.
	 */
	var _updateDomCursor = function() {
		/* Get position and size. */
		var rect = _getRectBoundaries();

		var screen_pos = MapToScreen(rect.min_x, rect.max_floor);
		var screen_width = rect.x_count * _room_def.width * 16;
		var screen_height = rect.y_count * 32;

		/* Update DOM. */
		_dom.a.css('width',  screen_width + 'px');
		_dom.a.css('height',  screen_height + 'px');
		_dom.cursor.css('left', screen_pos[0]);
		_dom.cursor.css('top', screen_pos[1]);
	};

	/**
	 * Updates the position of cursor on screen from current map position, if the
	 * cursor is visible.
	 */
	var updateScreenPosition = function() {
		if (_isVisible()) {
			_setCursorPosition(_x, _floor);
		}
	};

	/**
	 * Check if cursor is visible
	 */
	var _isVisible = function() {
		return !_dom.cursor.parent().hasClass('hidden');
	};

	/**
	 * Updates build cursor regarding if room can be built at current position.
	 */
	var _updateCanBuildStatus = function() {
		var cursor = _dom.cursor;
		var a = _dom.a;

		// Can build become true when at least one of the cursor rect area rooms can be built.
		// In non-rect mode that means only one room position checked.
		var rect = _getRectBoundaries();
		var max_build_x = rect.min_x + (rect.x_count - 1) * _room_def.width; // left x for rightmost room
		var new_can_build = false;
		for (var ix = 0; ix < rect.x_count; ix++) {
			// When building rect start from the last click location.
			var x = _rect_mode && _x < _rect_from_x ? max_build_x - ix * _room_def.width : rect.min_x + ix * _room_def.width;
			console.log('x:' + x);
			for (var floor = rect.min_floor; floor <= rect.max_floor; floor++) {
				new_can_build = Building.canBuildRoomHere(_room_def.id, x, floor);
				if (new_can_build) break;
			}
			if (new_can_build) break;
		}
		_can_build = new_can_build;

		if (_can_build) {
			cursor.addClass('can-build');
			cursor.removeClass('cannot-build');
			a.attr('title', 'Build ' + _room_def.name);
		} else {
			cursor.removeClass('can-build');
			cursor.addClass('cannot-build');
			a.attr('title', 'Cannot build ' + _room_def.name + ' here');
		}
	};

	/**
	 * Set the room type that the build new cursor will build
	 * @param room_def the room definition of the room
	 */
	var _setBuildCursorRoomType = function(room_def) {
		_room_def = room_def;

		_updateDomCursor();
		_updateCanBuildStatus();
	};

	/**
	 * Start build cursor with given room type.
	 * @param room_def the room definition of the room
	 */
	var start = function(room_def) {
		_rect_from_x = null;
		_rect_from_floor = null;
		_setBuildCursorRoomType(room_def);
		Gui.switchOverlay(Gui.OVERLAY_BUILD_NEW);
	};

	/**
	 * Stop the build new cursor and return to nav overlay
	 */
	var stop = function() {
		_room_def = null;
		Gui.switchOverlay(Gui.OVERLAY_NAV);
	};

	// Export:
	return {
		init: init,
		draw: draw,

		updateScreenPosition: updateScreenPosition,

		start: start,
		stop: stop,
	};
})();
