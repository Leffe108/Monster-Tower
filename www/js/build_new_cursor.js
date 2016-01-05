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

	var _cursor_data = null; // data for the build new room cursor

	/**
	 * App startup initialization of cursor.
	 *
	 * When starting to build a room type, call #start to set up the cursor
	 * width and other data specific to each room type.
	 */
	var init = function() {
		_cursor_data = {};

		var cursor = $('#gui-build-new-cursor');
		assert(cursor.length !== 0);
		var a = cursor.find('a');

		_cursor_data = {
			/* Map position of cursor */
			x: 0,
			floor: 0,

			room_def: null, // Room def of type to build or null.
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

			var d_x = 0; 
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

			// Move a whole cursor width at the time if Ctrl key is depressed while using one of the arrow keys
			if (e.ctrlKey && [37, 40, 38, 39].indexOf(e.which) !== -1) {
				d_x *= _cursor_data.room_def.width;
				d_floor *= 5;
				ctrl_use = true;
			}

			// Avoid calling preventDefault when modifier key is depressed unless we make use of it.
			// At least on Chrome this would disable default browser bindings like Ctrl+H => History
			if (!ctrl_use && e.ctrlKey) return;
			if (e.shiftKey) return;
			if (e.altKey) return;

			if (d_x !== 0 || d_floor !== 0) {
				_moveCursor(d_x, d_floor);
				e.preventDefault();
			}
		});

		a.on('click', function() {
			_cursorClick();
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
			var x = Math.floor(map_pos[0] - (_cursor_data.room_def.width - 0.5) / 2.0);
			var floor = Math.floor(map_pos[1]);

			_setCursorPosition(x, floor);
		});
	};

	/**
	 * Click handler for cursor. Handles both mouse click and keyboard enter key.
	 */
	var _cursorClick = function() {
		assert(_cursor_data.room_def !== null, 'Build cursor has no room type');
		if (g_bank_balance < _cursor_data.room_def.buy_cost) {
			Gui.showCannotAffordWindow(_cursor_data.room_def);
			return;
		}
		if (Building.buildRoom(_cursor_data.room_def.id, _cursor_data.floor, _cursor_data.x)) {
			g_bank_balance -= _cursor_data.room_def.buy_cost;
			Money.animateCost();
			PlaySoundEffect('build');

			if (RoomType.isElevator(_cursor_data.room_def.id)) {
				// User probably want to adjust elevator floor range after building it
				stop();
			} else {
				// Continue to build same room type - update cursor can build status
				_updateCanBuildStatus();
			}
		}
	};

	/**
	 * Draws room image at cursor position if cursor is visible, focused and room can be built.
	 */
	var draw = function() {
		if (!_isVisible()) return;

		if (_cursor_data.room_def !== null && _cursor_data.can_build &&
				_cursor_data.dom.cursor.find('a:focus').length !== 0) {
			/* Build cursor: Draw room at cursor position. */
			var room_def = _cursor_data.room_def;
			var screen_pos = MapToScreen(_cursor_data.x, _cursor_data.floor);
			var y_offset = room_def.id === 'stair' ? -16 : 0;
			MtImage.draw(room_def.image, screen_pos[0], screen_pos[1] + y_offset);
		}
	};

	/**
	 * Move build cursor by delta x and delta floor.
	 * @param d_x delta x
	 * @param d_floor delta floor
	 */
	var _moveCursor = function(d_x, d_floor) {
		_setCursorPosition(_cursor_data.x + d_x, _cursor_data.floor + d_floor);
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

			(function(){
				var cursor = _cursor_data.dom.cursor;
				cursor.css('left', screen_pos[0]);
				cursor.css('top', screen_pos[1]);
			})();

			_updateCanBuildStatus();
		}
	};

	/**
	 * Updates the position of cursor on screen from current map position, if the
	 * cursor is visible.
	 */
	var updateScreenPosition = function() {
		if (_isVisible()) {
			_setCursorPosition(_cursor_data.x, _cursor_data.floor);
		}
	};

	/**
	 * Check if cursor is visible
	 */
	var _isVisible = function() {
		return !_cursor_data.dom.cursor.parent().hasClass('hidden');
	};

	/**
	 * Updates build cursor regarding if room can be built at current position.
	 */
	var _updateCanBuildStatus = function() {
		var cursor = _cursor_data.dom.cursor;
		var a = _cursor_data.dom.a;

		_cursor_data.can_build = Building.canBuildRoomHere(_cursor_data.room_def.id, _cursor_data.x, _cursor_data.floor);
		if (_cursor_data.can_build) {
			cursor.addClass('can-build');
			cursor.removeClass('cannot-build');
			a.attr('title', 'Build ' + _cursor_data.room_def.name);
		} else {
			cursor.removeClass('can-build');
			cursor.addClass('cannot-build');
			a.attr('title', 'Cannot build ' + _cursor_data.room_def.name + ' here');
		}
	};

	/**
	 * Set the room type that the build new cursor will build
	 * @param room_def the room definition of the room
	 */
	var _setBuildCursorRoomType = function(room_def) {
		_cursor_data.room_def = room_def;

		var cursor = _cursor_data.dom.cursor;
		var a = _cursor_data.dom.a;

		a.css('width',  (room_def.width * 16) + 'px');
		var screen_pos = MapToScreen(_cursor_data.x, _cursor_data.floor);
		cursor.css('left', screen_pos[0]);
		cursor.css('top', screen_pos[1]);

		_updateCanBuildStatus();
	};

	/**
	 * Start build cursor with given room type.
	 * @param room_def the room definition of the room
	 */
	var start = function(room_def) {
		_setBuildCursorRoomType(room_def);
		Gui.switchOverlay(Gui.OVERLAY_BUILD_NEW);
	};

	/**
	 * Stop the build new cursor and return to nav overlay
	 */
	var stop = function() {
		_cursor_data.room_def = null;
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
