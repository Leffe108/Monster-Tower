/*
 * Main
 */

/* global Animation, Building, GameLevel, Gui, Money, MtImage, Room, RoomType */
/* global assert, DrawRect */
/* exported g_game_win_lose, g_game_star_level, g_reachable_floors, g_floor_stair_distance, g_room_types */
/* exported INITIAL_BUILDING */

// Global variables
var g_request_animation_frame_fn = null; // The requestAnimationFrame function 
var g_canvas = null; // The hidden canvas to draw to
var g_canvas_visible = null; // The visible canvas
var g_view_offset_floor = null;
var g_view_offset_x = null;
var g_context = null;
var g_dirty_screen = null; // needs redraw? true/false
var g_logo_timer = null;
var g_simulation_time = null; // unit: minutes (total 24*60 a day)
var g_simulation_day = null; // day counter
var g_game_win_lose = null; // WL_* from game_level.js
var g_game_star_level = null; // GSL_* from game_level.js
var g_last_loop = null; // last loop time
var g_game_speed = null;
var g_game_paused = null;
var g_bank_balance = null; // amount of money for our company
var g_room_floors = null; // Table. Key is floor number. contains array with rooms on each floor.
var g_stair_floors = null; // Table. Key is floor number. Contains array with stairs on each floor.
var g_room_types = null; // key: room type id. Defiend in rooms.js
var g_reachable_floors = null; // Table. key is floor number. Has one entry for each floor that can be reached. Rebuilt when a stair is built/demolished
var g_floor_stair_distance = null; // Table. key is floor number. For reachable floors, it contain the number of stairs needed to go to level 0.


// Debug var to turn off intro
var DISABLE_LOGO_INTRO = false;
// Debug var to place an initial building
var INITIAL_BUILDING = false;

// Methods

function InitCanvas() {
	// Create two canvases for double buffering.
	// On some browsers/devices the game flickers without it.
	g_canvas = document.createElement("canvas");
	g_canvas.className = 'canvas';
	g_canvas.setAttribute('aria-hidden', true);
	g_canvas.setAttribute('aria-live', 'off');
	g_canvas_visible = document.createElement("canvas");
	g_canvas_visible.className = 'canvas';
	g_canvas_visible.setAttribute('aria-hidden', true);
	g_canvas_visible.setAttribute('aria-live', 'off');

	var game = document.getElementById('game');
	game.appendChild(g_canvas);
	game.appendChild(g_canvas_visible);

	SwapCanvas();

	g_view_offset_floor = -4;
	g_view_offset_x = 0;

	ResizeCanvas();

	window.onresize = function() {
		ResizeCanvas();
		Gui.positionWindows();
		Gui.rebuildToolbars();
		if (Gui.isBuildNewOverlayActive()) Gui.updateBuildCursorScreenPosition();
		Gui.rebuildNavOverlay();
	};
}

function ResizeCanvas() {
	var width = Math.floor(window.innerWidth / 16) * 16;
	var height = Math.floor(window.innerHeight / 32) * 32;
	g_canvas.width = width;
	g_canvas.height = height;
	g_canvas_visible.width = width;
	g_canvas_visible.height = height;
	$('#game').css('width', width);
	$('#game').css('height', height);
	$('#game').children().css('width', width);
	$('#game').children().css('height', height);
	g_dirty_screen = true;
}

function SwapCanvas() {
	// Swap visibility
	g_canvas.style.visibility = 'visible';
	g_canvas_visible.style.visibility = 'hidden';

	// Swap references
	var new_visible = g_canvas;
	g_canvas = g_canvas_visible;
	g_canvas_visible = new_visible;

	// Get context of the new hidden canvas
	g_context = g_canvas.getContext("2d");
}

function InitGameState()
{
	g_simulation_time = 0;
	g_simulation_day = 0;
	g_game_speed = 100.0;
	g_game_paused = true;

	GameLevel.init();
	Money.init();
	RoomType.init();
	Building.init();
}

/**
 * @param time Seconds since last Update
 */
function Update(time) {
	var gui_time = time; // GUI time is not affected by speed modifier
	time *= g_game_speed; // Apply speed modifier

	// Still showing the logo?
	if (g_logo_timer >= 0 && !DISABLE_LOGO_INTRO) {
		g_logo_timer += gui_time;
		g_dirty_screen = true;
		if (g_logo_timer > 3) {
			g_logo_timer = -1;
			Gui.setGameAriaLiveText('Intro is over. Game world now shows and ontop of that a window.');
			Gui.showWindow(Gui.getIntroWindow());
		} else {
			return; // continue to show logo - don't update game state
		}
	}

	// If game was just lost, enable click detection on game over
	// screen to reload game.
	if ((GameLevel.isGameOver() || GameLevel.isGameWon()) && !Gui.isGameOverOverlayActive()) {
		while (Gui.hasOpenWindows()) Gui.closeTopWindow();
		Gui.switchOverlay(Gui.OVERLAY_GAME_OVER);
		g_dirty_screen = true;
	}

	// Progress game time unless paused
	// - pause when window is open, as many display stats that don't update unless the
	//   window is re-opened.
	var old_paused = g_game_paused;
	g_game_paused = Gui.isIntroWindowOpen() || Gui.hasOpenWindows() || GameLevel.isGameOver() || GameLevel.isGameWon();
	if (!g_game_paused) {
		g_simulation_time += time; // one second = one in-game minute
		while (g_simulation_time > 24 * 60) {
			g_simulation_time -= 24 * 60;
			g_simulation_day++;
		}

		Room.updateAll(time);
		Money.update(time);
		GameLevel.update();

		g_dirty_screen = true;
	} else if (!old_paused) {
		// just became paused
		g_dirty_screen = true;
	}

	if (Animation.hasAny()) {
		g_dirty_screen = true;
	}

	// Always update GUI
	Animation.updateAll(gui_time);
}
function TimeStr(time) {
	var h = "" + Math.floor(time / 60);
	var m = "" + Math.floor(Math.floor(time - h * 60) / 15) * 15;
	if (h.length < 2) h = "0" + h;
	if (m.length < 2) m = "0" + m;
	return h + ":" + m;
}
function MoneyStr(amount) {
	return amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + ' bucks';
}
// return [x, y] on screen
function MapToScreen(x, floor) {
	return [
		(x + g_view_offset_x) * 16,
		g_canvas.height - (floor - g_view_offset_floor) * 32,
	];
}
// return [x, floor] on map
function ScreenToMap(x, y) {
	var map_pos = [
		x / 16 - g_view_offset_x,
		(g_canvas.height - y) / 32 + g_view_offset_floor,
	];

	var int_floor = Math.floor(map_pos[1]);
	if (map_pos[1] > int_floor) map_pos[1] += 1.0;

	return map_pos;
}
function GetSkyColor() {
	var color_day = [202, 248, 254];
	var color_night = [69, 81, 82];

	var alfa = null; // 0 at night and 1 at day
	var raise_start = 5 * 60;
	var raise_end = 7 * 60;
	var sunset_start = 20 * 60;
	var sunset_end = 22 * 60;
	if (g_simulation_time <= raise_start || g_simulation_time >= sunset_end) {
		alfa = 0;
	} else if (g_simulation_time >= raise_end && g_simulation_time <= sunset_start) {
		alfa = 1;
	} else if (g_simulation_time > raise_start && g_simulation_time < raise_end) {
		alfa = (g_simulation_time - raise_start) / (raise_end - raise_start);
	} else if (g_simulation_time > sunset_start && g_simulation_time < sunset_end) {
		alfa = 1 - (g_simulation_time - sunset_start) / (sunset_end - sunset_start);
	} else {
		assert(false);
	}

	var color_blend = [null, null, null];
	for (var i = 0; i < 3; i++) {
		color_blend[i] = Math.round(color_day[i] * alfa + color_night[i] * (1-alfa));
	}

	return 'rgb(' + color_blend[0] + ', ' + color_blend[1] + ', ' + color_blend[2] + ')';
}
function Render() {
	// Should a splash screen be displayed?
	var splash_screen_image = null;
	if (g_logo_timer >= 0 && !DISABLE_LOGO_INTRO) {
		splash_screen_image = g_logo_timer < 1 ? "map1" : "map2";
	} else if (GameLevel.isGameOver()) {
		splash_screen_image = "game-over";
	} else if (GameLevel.isGameWon()) {
		splash_screen_image = "won";
	}
	if (splash_screen_image !== null) {
		DrawRect('rgb(255, 255, 255)', '', 0, 0, g_canvas.width, g_canvas.height);
		MtImage.drawCentered(splash_screen_image);
		SwapCanvas();
		return;
	}

	//console.log(MapToScreen(2, -2));
	//console.log(ScreenToMap(288, 384));

	var sky_color = GetSkyColor();
	for (var y = 0; y < g_canvas.height / 32; y++) {
		for (var x = 0; x < g_canvas.width / 16; x++) {

			var screen_x = x*16;
			var screen_y = y*32;
			var map_pos = ScreenToMap(screen_x, screen_y);
			var map_x = map_pos[0];
			var map_y = map_pos[1];

			// Only draw background at 32x32
			if (Math.abs(map_x % 2) == Math.abs(g_view_offset_x % 2)) {
				if (map_y >= 0) {
					DrawRect(sky_color, '', screen_x, screen_y, 32, 32, sky_color);
				} else {
					MtImage.draw("underground", screen_x, screen_y);
				}

				if (map_y == -1) MtImage.draw("ceiling", screen_x, screen_y);
			}
		}
	}

	// Draw rooms
	for (var floor_num = Building.MIN_FLOOR; floor_num <= Building.MAX_FLOOR; floor_num++) {
		if (floor_num in g_room_floors) {
			var floor_data = g_room_floors[floor_num];

			for (var i = 0; i < floor_data.length; i++) {
				var room = floor_data[i];
				var screen_pos = MapToScreen(room.x, floor_num);

				var add = '';
				if (room.state === Room.ROOM_STATE_FOR_RENT) add = '-for-rent';
				else if (room.state === Room.ROOM_STATE_CLOSED) add = '-closed';
				MtImage.draw(room.def.image + add, screen_pos[0], screen_pos[1]);
			}
		}
	}

	// Draw stairs
	for (floor_num = Building.MAX_FLOOR; floor_num >= Building.MIN_FLOOR; floor_num--) { // stairs overlap and need to be drawn from top to down
		if (floor_num in g_stair_floors) {
			floor_data = g_stair_floors[floor_num];

			for (i = 0; i < floor_data.length; i++) {
				var stair = floor_data[i];
				if (stair.def.id !== 'stair') continue;
				screen_pos = MapToScreen(stair.x, floor_num);

				add = '';
				MtImage.draw(stair.def.image + add, screen_pos[0], screen_pos[1] - 16);
			}
		}
	}
	// Draw elevators
	for (floor_num = Building.MIN_FLOOR; floor_num <= Building.MAX_FLOOR; floor_num++) { // elevators overlap (but other way than stairs) 
		if (floor_num in g_stair_floors) {
			floor_data = g_stair_floors[floor_num];

			for (i = 0; i < floor_data.length; i++) {
				var elevator = floor_data[i];
				if (!RoomType.isElevator(elevator.def.id)) continue;
				screen_pos = MapToScreen(elevator.x, floor_num);

				add = '';
				MtImage.draw(elevator.def.image + add, screen_pos[0], screen_pos[1]);
			}
		}
	}

	Gui.drawBuildCursor();
	Gui.drawToolbar();

	// Draw animations
	Animation.drawAll();

	// Current time & speed
	g_context.fillStyle = "rgb(255, 255, 255)";
	g_context.font = "14px Verdana";
	g_context.textAlign = "left";
	g_context.textBaseline = "bottom";
	g_context.fillText("day: " + g_simulation_day + "  time: " + TimeStr(g_simulation_time) + " " + (g_game_paused ? ' paused ' : '') + ' ' + Building.getBuildingHeight() + ' floors', 4, g_canvas.height - 4);

	// Bank balance
	g_context.textAlign = "right";
	g_context.fillText(MoneyStr(g_bank_balance), g_canvas.width - 4, g_canvas.height - 4);

	// Last, swap visible buffer
	SwapCanvas();
}

// Main game loop
function Main() {
	var now = Date.now();
	var delta = now - g_last_loop;

	Update(delta / 1000);
	if (g_dirty_screen) Render();
	g_dirty_screen = false;

	g_last_loop = now;

	// Request to do this again ASAP
	if (g_request_animation_frame_fn ) {
		g_request_animation_frame_fn(Main);
	} else {
		window.setTimeout(Main, 1);
	}
}


function Init() {
	g_logo_timer = 0;
	InitCanvas();
	MtImage.init();
	MtImage.loadStatic();
	InitGameState();
	Animation.init();
	Gui.init();
	MtImage.loadRoomTypeImages();

	if (DISABLE_LOGO_INTRO) {
		Gui.switchOverlay(Gui.OVERLAY_NAV);
	} else {
		Gui.setGameAriaLiveText('Game intro: A map of Netherlands is displayed. A small town Monster is shown south-west of The Hague and Amsterdam.');
	}

	// Cross-browser support for requestAnimationFrame
	var w = window;
	g_request_animation_frame_fn = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.msRequestAnimationFrame || w.mozRequestAnimationFrame;
	
	// Start main loop
	g_last_loop = Date.now();
	Main();
}

// Call Init
Init();
