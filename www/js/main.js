
// Global variables
var g_canvas = null; // The hidden canvas to draw to
var g_canvas_visible = null; // The visible canvas
var g_view_offset_floor = null;
var g_view_offset_x = null;
var g_context = null;
var g_dirty_screen = null; // needs redraw? true/false
var g_logo_timer = null;
var g_images = null;
var g_animations = null;
var g_open_windows = null; // gui open windows
var g_hovered_overlay_item = null; // null or object with keys 'screen_x', 'screen_y' and 'data'.
var g_toolbar_buildable_rooms = null; // array of rooms that can currently be built. The order affects toolbars
var g_current_build_room_type = null; // null or the room type selected for build
var g_simulation_time = null; // unit: minutes (total 24*60 a day)
var g_simulation_day = null; // day counter
var g_game_win_lose = null; // WL_* from game_level.js
var g_game_star_level = null; // GSL_* from game_level.js
var g_last_loop = null;
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
requestAnimationFrame = null;

function InitCanvas() {
	// Create two canvases for double buffering.
	// On some browsers/devices the game flickers without it.
	g_canvas = document.createElement("canvas");
	g_canvas.className = 'canvas';
	g_canvas_visible = document.createElement("canvas");
	g_canvas_visible.className = 'canvas';

	var game = document.getElementById('game');
	game.appendChild(g_canvas);
	game.appendChild(g_canvas_visible);

	SwapCanvas();

	g_view_offset_floor = -4;
	g_view_offset_x = 0;

	ResizeCanvas();

	window.onresize = function() {
		ResizeCanvas();
		PositionWindows();
		RebuildToolbars();
		if (IsBuildNewOverlayActive()) RebuildBuildNewOverlay(g_current_build_room_type);
		RebuildNavOverlay();
	}
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

/**
 * @param name The name identifier of the image which is also the file name excluding '.png'.
 * @param base_x X offset to the point in the image that will be rendered as 0,0 of this image
 * @param base_y Y offset to the point in the image that will be rendered as 0,0 of this image
 */
function LoadImage(name, base_x, base_y) {
	var img = new Image();
	img.id = name;
	// custom members
	img.base_x = base_x;
	img.base_y = base_y;
	img.complete = false;

	img.onLoad = function (e) {
		e = e || window.event;
		var target = e.target || e.srcElement;
		target.complete = true;
	};
	img.src = "images/" + name + ".png";
	g_images[name] = img;
}

// Loads images into g_images[name]
function LoadImages() {
	g_images = {};

	LoadImage("map1", 0, 0);
	LoadImage("map2", 0, 0);

	LoadImage("underground", 0, 0);
	LoadImage("sky", 0, 0);
	LoadImage("ceiling", 0, 0);
	LoadImage("build", 0, 0);
	LoadImage("money", 16, 16); // green money
	LoadImage("cost", 16, 16);

	// GUI
	LoadImage("build-complete", 0, 0);
	LoadImage("help", 0, 0);
	LoadImage("view-up", 0, 0);
	LoadImage("view-down", 0, 0);
	LoadImage("view-left", 0, 0);
	LoadImage("view-right", 0, 0);
	LoadImage("game-over", 0, 0);
	LoadImage("won", 0, 0);
	LoadImage("game-star-level-no-star", 0, 0);
	LoadImage("game-star-level-1", 0, 0);
	LoadImage("game-star-level-2", 0, 0);
	LoadImage("game-star-level-3", 0, 0);
}

function LoadGameDefImages() {
	for (id in g_room_types) {
		LoadImage(g_room_types[id].image, 0, 0);
		if (IsStairLayerRoom(id)) {
			LoadImage(g_room_types[id].image + '-build-icon', 0, 0);
		} else {
			LoadImage(g_room_types[id].image + '-closed', 0, 0);
			if (id !== 'town-hall-room') LoadImage(g_room_types[id].image + '-for-rent', 0, 0);
		}
	}
}

function InitGameState()
{
	g_simulation_time = 0;
	g_simulation_day = 0;
	g_game_speed = 100.0;
	g_game_paused = true;

	GameLevelInit();
	MoneyInit();
	RoomTypeInit();
	BuildingInit();
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
			ShowWindow(GetIntroWindow());
		} else {
			return; // continue to show logo - don't update game state
		}
	}

	// If game was just lost, enable click detection on game over
	// screen to reload game.
	if ((IsGameOver() || IsGameWon()) && !IsGameOverOverlayActive()) {
		while (HasOpenWindows()) CloseTopWindow();
		SwitchOverlay(OVERLAY_GAME_OVER);
		g_dirty_screen = true;
	}

	// Progress game time unless paused
	// - pause when window is open, as many display stats that don't update unless the
	//   window is re-opened.
	var old_paused = g_game_paused;
	g_game_paused = IsIntroWindowOpen() || HasOpenWindows() || IsGameOver() || IsGameWon();
	if (!g_game_paused) {
		g_simulation_time += time; // one second = one in-game minute
		while (g_simulation_time > 24 * 60) {
			g_simulation_time -= 24 * 60;
			g_simulation_day++;
		}

		UpdateRooms(time);
		UpdateMoney(time);
		UpdateGameLevel(time);

		g_dirty_screen = true;
	} else if (!old_paused) {
		// just became paused
		g_dirty_screen = true;
	}

	if (g_animations.length > 0) {
		g_dirty_screen = true;
	}

	// Always update GUI
	UpdateAnimations(gui_time);
	UpdateWindows(gui_time);
}

/**
 * Draws an image at x,y.
 * x and y will be floored to integers if they are not
 * already integers.
 * @param angle Rotation angle. Defaults to 0
 */
function DrawImage(image, x, y, angle) {
	if (angle == null) angle = 0;
	var img = g_images[image];
	if (img.complete && img.width > 0) { // .complete is always true in FF
		g_context.save();
		g_context.translate(Math.floor(x), Math.floor(y));
		g_context.rotate(angle);
		g_context.drawImage(img, -img.base_x, -img.base_y);
		g_context.restore();
	}
}
/**
 * Draws an image centered on the canvas.
 */
function DrawImageCentered(image) {
	var img = g_images[image];
	if (!img.complete || img.width <= 0) return;
	var x = g_canvas.width/2 - img.width/2;
	var y = g_canvas.height/2 - img.height/2;
	DrawImage(image, x, y);
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
		g_canvas.height - (floor - g_view_offset_floor) * 32
	];
}
// return [x, floor] on map
function ScreenToMap(x, y) {
	return [
		x / 16 - g_view_offset_x,
		(g_canvas.height - y) / 32 + g_view_offset_floor
	];
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
	} else if (IsGameOver()) {
		splash_screen_image = "game-over";
	} else if (IsGameWon()) {
		splash_screen_image = "won";
	}
	if (splash_screen_image !== null) {
		DrawRect('rgb(255, 255, 255)', '', 0, 0, g_canvas.width, g_canvas.height);
		DrawImageCentered(splash_screen_image);
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
					DrawImage("underground", screen_x, screen_y);
				}

				if (map_y == -1) DrawImage("ceiling", screen_x, screen_y);
			}
		}
	}

	// Draw rooms
	for (var floor_num = MIN_FLOOR; floor_num <= MAX_FLOOR; floor_num++) {
		if (floor_num in g_room_floors) {
			floor_data = g_room_floors[floor_num];

			for (var i = 0; i < floor_data.length; i++) {
				var room = floor_data[i];
				var screen_pos = MapToScreen(room.x, floor_num);

				var add = '';
				if (room.state === ROOM_STATE_FOR_RENT) add = '-for-rent';
				else if (room.state === ROOM_STATE_CLOSED) add = '-closed';
				DrawImage(room.def.image + add, screen_pos[0], screen_pos[1]);
			}
		}
	}

	// Draw stairs
	for (var floor_num = MAX_FLOOR; floor_num >= MIN_FLOOR; floor_num--) { // stairs overlap and need to be drawn from top to down
		if (floor_num in g_stair_floors) {
			floor_data = g_stair_floors[floor_num];

			for (var i = 0; i < floor_data.length; i++) {
				var stair = floor_data[i];
				if (stair.def.id !== 'stair') continue;
				var screen_pos = MapToScreen(stair.x, floor_num);

				var add = '';
				DrawImage(stair.def.image + add, screen_pos[0], screen_pos[1] - 16);
			}
		}
	}
	// Draw elevators
	for (var floor_num = MIN_FLOOR; floor_num <= MAX_FLOOR; floor_num++) { // elevators overlap (but other way than stairs) 
		if (floor_num in g_stair_floors) {
			floor_data = g_stair_floors[floor_num];

			for (var i = 0; i < floor_data.length; i++) {
				var elevator = floor_data[i];
				if (elevator.def.id !== 'elevator') continue;
				var screen_pos = MapToScreen(elevator.x, floor_num);

				var add = '';
				DrawImage(elevator.def.image + add, screen_pos[0], screen_pos[1]);
			}
		}
	}

	// Draw build hover
	if (g_hovered_overlay_item !== null &&
			('room_def' in g_hovered_overlay_item) // toolbar buttons can exist in build mode as overlay items, but they don't have a room def
			&& IsBuildNewOverlayActive()) {
		var room_def = g_hovered_overlay_item.room_def;
		var y_offset = room_def.id === 'stair' ? -16 : 0;
		var screen_pos = MapToScreen(g_hovered_overlay_item.x, g_hovered_overlay_item.floor);
		DrawImage(room_def.image, screen_pos[0], screen_pos[1] + y_offset);
	}

	DrawToolbar();

	// Draw animations
	DrawAnimations();

	// Current time & speed
	g_context.fillStyle = "rgb(255, 255, 255)";
	g_context.font = "14px Verdana";
	g_context.textAlign = "left";
	g_context.textBaseline = "bottom";
	g_context.fillText("day: " + g_simulation_day + "  time: " + TimeStr(g_simulation_time) + " " + (g_game_paused ? ' paused ' : '') + ' ' + GetBuildingHeight() + ' floors', 4, g_canvas.height - 4);

	// Bank balance
	g_context.textAlign = "right";
	g_context.fillText(MoneyStr(g_bank_balance), g_canvas.width - 4, g_canvas.height - 4);

	// Draw GUI
	DrawWindows();

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
	if (requestAnimationFrame) {
		requestAnimationFrame(Main);
	} else {
		window.setTimeout(Main, 1);
	}
}


function Init() {
	g_logo_timer = 0;
	InitCanvas();
	LoadImages();
	InitGameState();
	InitGUI();
	LoadGameDefImages();

	if (DISABLE_LOGO_INTRO) SwitchOverlay(OVERLAY_NAV);

	// Cross-browser support for requestAnimationFrame
	var w = window;
	requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.msRequestAnimationFrame || w.mozRequestAnimationFrame;
	
	// Start main loop
	g_last_loop = Date.now();
	Main();
}

// Call Init
Init();
