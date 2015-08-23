/**** FILE js/js/helper.js STARTS HERE ****/
/*
 * Utility functions
 */

/**
 * From: http://stackoverflow.com/a/15313435
 */
function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

/**
 * Draws a rectangle to the canvas. Specify either fillStyle or strokeStyle
 * in order for something to be drawn. You can also specify both if you want
 * both fill and a border.
 * @param fillStyle String with the fill style to use for the rectangle. If an empty string is given, no fill is drawn.
 * @param strokeStyle String with the stroke/border style to use for the rectangle. If an empty string is given no border is drawn.
 * @param x The left border of the rectangle.
 * @param y The top border of the rectangle.
 * @param width The width of the rectangle
 * @param height The height of the rectangle.
 */
function DrawRect(fillStyle, strokeStyle, x, y, width, height) {
	g_context.beginPath();
	g_context.rect(x, y, width, height);
	if (fillStyle != "") {
		g_context.fillStyle = fillStyle;
		g_context.fill();
	}
	if (strokeStyle != "") {
		g_context.strokeStyle = strokeStyle;
		g_context.stroke();
	}
}

/**
 * The first character of given string will be 
 * converted to upper case and the result is
 * returned. (input string is not changed)
 * @param string The input string
 * @return The resulting string
 */
function StrFirstToUpper(string) {
	return string.substr(0, 1).toLocaleUpperCase() +
		string.substr(1);
}
/**** FILE js/js/gui.js STARTS HERE ****/
/*
 * GUI related stuff
 */

var ANIMATION_MAX_TIME = 2.0;

var BOTTOM_WINDOW_Z = 10; ///< z-index of the window displayed at the bottom of the open window stack.

var OVERLAY_NAV = 1;   // toolbar + click on rooms
var OVERLAY_BUILD_NEW = 2; // place new rooms
var OVERLAY_WINDOWS = 3;
var OVERLAY_GAME_OVER = 4;

/**
 * Creates an animation.
 *
 * Animations for now is moving an image upwards while rotating it.
 */
function Animation(image, start_x, start_y) {
	this.x = start_x;
	this.y = start_y;
	this.angle = 0;
	this.image = image;
	this.timer = 0;
}

function UpdateAnimations(time) {
	for (var i = 0; i < g_animations.length; i++) {
		var animation = g_animations[i];
		animation.timer += time;
		if (animation.timer > ANIMATION_MAX_TIME) {
			g_animations.splice(i, 1);
			i--;
		} else {
			var N_ROTATIONS = 0.75;
			animation.y -= time * 15.0;
			animation.angle = animation.timer * N_ROTATIONS * Math.PI*2 / ANIMATION_MAX_TIME;
		}
	}
}

/**
 * Draws all Animations
 */
function DrawAnimations() {
	for (var i = 0; i < g_animations.length; i++) {
		var animation = g_animations[i];
		var start_alpha = 0.5;
		g_context.globalAlpha = start_alpha * (ANIMATION_MAX_TIME - animation.timer) / (ANIMATION_MAX_TIME);
		DrawImage(animation.image, animation.x, animation.y, animation.angle);
		g_context.globalAlpha = 1.0;
	}
}

/**
 * Initialize GUI-related stuff
 */
function InitGUI() {
	g_animations = [];
	g_open_windows = [];

	InitGameOverOverlay();
	InitToolbar();
}

/**
 * @param overlay OVERLAY_WINDOWS or OVERLAY_NAV
 */
function SwitchOverlay(overlay) {
	$('#gui-nav-overlay').addClass('hidden');
	$('#gui-build-new-overlay').addClass('hidden');
	$('#gui-window-overlay').addClass('hidden');
	$('#gui-game-over-overlay').addClass('hidden');
	if (overlay === OVERLAY_WINDOWS) {
		$('#gui-window-overlay').removeClass('hidden');
		$('#gui-window-overlay').focus();
	} else if (overlay == OVERLAY_NAV) {
		$('#gui-nav-overlay').removeClass('hidden');
		$('#gui-nav-overlay').focus();
	} else if (overlay == OVERLAY_BUILD_NEW) {
		$('#gui-build-new-overlay').removeClass('hidden');
		$('#gui-build-new-overlay').focus();
	} else if (overlay == OVERLAY_GAME_OVER) {
		$('#gui-game-over-overlay').removeClass('hidden');
		$('#gui-game-over-overlay a.play-again').focus();
	}
}

/**
 * Add a nav overlay element for given building
 *
 * overlay: 'nav' or 'build-new'
 * nav_type: 
 *   'nav' overlay has: 'room', 'toolbar'
 *   'build-new' overlay has: 'build_new', 'toolbar'
 */
function AddOverlayItem(data, title, screen_x, screen_y, screen_width, overlay, nav_type) {
	var overlay_id = 'gui-' + overlay + '-overlay';

	var container = $('#' + overlay_id).find('ul[data-nav-type=' + nav_type + ']');
	var li = $('<li class="gui-overlay-item">');
	var a = $('<a tabindex="0">');
	if (nav_type == 'room') {
		a.on('click', function() {
			ShowWindow(GetRoomWindow(data));
		});
	} else if (nav_type == 'toolbar') {
		a.on('click', function() {
			ToolbarClick(data);
		});
	} else if (nav_type == 'build_new') {
		a.on('click', function() {
			if (g_bank_balance < data.room_def.buy_cost) {
				ShowCannotAffordWindow(g_room_types[room_type]);
				return;
			}
			if (BuildRoom(data.room_def.id, data.floor, data.x)) {
				g_bank_balance -= data.room_def.buy_cost;
				AnimateCost();
				PlaySoundEffect('build');

				// Continue to build same type - rebuild DOM overlay
				RebuildBuildNewOverlay(data.room_def);
			}
		});
	}
	a.css('width', screen_width + 'px');
	a.on('keypress', OnLinkKeypress);
	a.on('mouseover', function() {
		g_hovered_overlay_item = data;
	});
	a.on('mouseout', function() {
		if (g_hovered_overlay_item !== null && 
				g_hovered_overlay_item.screen_x === screen_x &&
				g_hovered_overlay_item.screen_y === screen_y) {
			g_hovered_overlay_item = null;
		}
	});
	a.attr('title', title);
	li.css('left', screen_x);
	li.css('top', screen_y);
	li.append(a);
	container.append(li);
	return li;
}

/**
 * Remove a nav overlay
 * @param overlay_item The return value from AddOverlayItem
 */
function RemoveOverlayItem(overlay_item) {
	overlay_item.remove();
}

function GetRoomBuildCostLabel(room_type) {
	return '(costs ' + MoneyStr(g_room_types[room_type].buy_cost) + ')';
}

function InitToolbar() {
	RebuildToolbars();
}
function RebuildToolbars() {

	// Remove old overlays
	$('#gui-nav-overlay').find('ul[data-nav-type=toolbar]').find('li').remove();
	$('#gui-build-new-overlay').find('ul[data-nav-type=toolbar]').find('li').remove();

	// Update g_toolbar_buildable_rooms
	var master_room_toolbar = ['stair', 'elevator', 'office', 'cafeteria', 'flower-shop', 'town-hall-room'];
	g_toolbar_buildable_rooms = [];
	for (var i = 0; i < master_room_toolbar.length; i++) {
		var room_def = g_room_types[master_room_toolbar[i]];
		if (g_game_star_level >= room_def.min_stars) {
			g_toolbar_buildable_rooms.push(master_room_toolbar[i]);
		}
	}

	// Toolbar in nav overlay
	var x = 0;
	var y = 0;
	AddOverlayItem({
		id: 'help',
	}, 'Help', x, y, 32, 'nav', 'toolbar');
	x += 32;
	AddOverlayItem({
		id: 'view_up',
	}, 'Scroll view up', x, y, 32, 'nav', 'toolbar');
	x += 32;
	AddOverlayItem({
		id: 'view_down',
	}, 'Scroll view down', x, y, 32, 'nav', 'toolbar');
	x += 32;

	AddOverlayItem({
		id: 'game_star_level',
	}, 'Game level', x, y, 96, 'nav', 'toolbar');
	x += 96;

	for (var i = 0; i < g_toolbar_buildable_rooms.length; i++) {
		var room_type = g_toolbar_buildable_rooms[i];
		var room_def = g_room_types[room_type];

		if (room_type === 'town-hall-room') {
			// Town Hall Room doesn't fit on the first row
			x = 0;
			y += 32; 
		}

		AddOverlayItem({
			id: 'build_' + room_type,
		}, 'Bulid ' + room_def.name + ' ' + GetRoomBuildCostLabel(room_type), x, y, g_room_types[room_type].width * 16, 'nav', 'toolbar');
		x += g_room_types[room_type].width * 16;
	}

	// Toolbar in build-new mode/overlay
	x = 0;
	AddOverlayItem({
		id: 'abort_build_new',
	}, 'Stop building more', x, 0, 32, 'build-new', 'toolbar');
	x += 32;
	AddOverlayItem({
		id: 'view_up',
	}, 'Scroll view up', x, 0, 32, 'build-new', 'toolbar');
	x += 32;
	AddOverlayItem({
		id: 'view_down',
	}, 'Scroll view down', x, 0, 32, 'build-new', 'toolbar');
	x += 32;
}

function InitGameOverOverlay() {
	var won = IsGameWon();
	var a = $('<a tabindex="0" class="play-again">');
	a.on('click', function() {
		if (g_game_win_lose === GWL_WON) {
			g_game_win_lose = GWL_WON_CONTINUE_PLAY;
			SwitchOverlay(OVERLAY_NAV);
		} else {
			location.reload(); // Reload page
		}
	});
	a.on('keypress', OnLinkKeypress);
	a.attr('title', won ? 'Continue to play' : 'Play again');
	$('#gui-game-over-overlay').append(a);
}

/** Adds nav items for places where a room of given type can be placed */
function RebuildBuildNewOverlay(room_def) {

	$('#gui-build-new-overlay').find('ul[data-nav-type=build_new]').find('li').remove();

	for (var floor_num = MIN_FLOOR; floor_num <= MAX_FLOOR; floor_num++) {
		if (floor_num === 0 ||
				(floor_num in g_room_floors) || 
				((floor_num - 1) in g_room_floors) ||
				((floor_num + 1) in g_room_floors)) {
			floor_data = g_room_floors[floor_num];

			var min = ScreenToMap(0, 0);
			var max = ScreenToMap(g_canvas.width, 0);
			for (var x = min[0]; x < max[0]; x++) {
				if (CanBuildRoomHere(room_def.id, x, floor_num)) {
					var screen_pos = MapToScreen(x, floor_num);

					// Don't add build overlays ontop of toolbar. Cause problems for users
					// not aware that they can use tab to select the toolbar button overlay.
					if (screen_pos[1] < 32) continue;

					var overlay_data = {
						room_def: room_def,
						floor: floor_num,
						x: x,
					};
					AddOverlayItem(overlay_data, 'Build on floor ' + floor_num + ', x: ' + x, 
							screen_pos[0], screen_pos[1], room_def.width * 16, 'build-new', 'build_new');
				}
			}
		}
	}
}

/** Rebuilds the nav overlay except for toolbars, use RebuildToolbars for that. */
function RebuildNavOverlay(room_def) {

	$('#gui-nav-overlay').find('ul[data-nav-type=room]').find('li').remove();

	for (var floor_num = MIN_FLOOR; floor_num <= MAX_FLOOR; floor_num++) {
		if (floor_num in g_room_floors) {
			floor_data = g_room_floors[floor_num];

			for (var i = 0; i < floor_data.length; i++) {
				var room_data = floor_data[i];
				var screen_pos = MapToScreen(room_data.x, floor_num);

				// Don't add nav overlays ontop of toolbar. Cause problems for users
				// not aware that they can use tab to select the toolbar button overlay.
				if (screen_pos[1] < 32) continue;

				AddOverlayItemForRoom(room_data);
			}
		}
	}

}

function DrawToolbar() {
	var x = 0;
	var y = 0;
	if (IsNavOverlayActive()) {
		DrawImage('help', x, y, 0);
		x += 32;
		DrawImage('view-up', x, y, 0);
		x += 32;
		DrawImage('view-down', x, y, 0);
		x += 32;

		var star_button_image = '';
		switch (g_game_star_level) {
			case GSL_NO_STAR:
				star_button_image = 'game-star-level-no-star';
				break;
			case GSL_STAR1:
			case GSL_STAR2:
			case GSL_STAR3:
				star_button_image = 'game-star-level-' + g_game_star_level;
				break;
		}
		DrawImage(star_button_image, x, y, 0);
		x += 96;

		for (var i = 0; i < g_toolbar_buildable_rooms.length; i++) {
			var room_type = g_toolbar_buildable_rooms[i];
			var room_def = g_room_types[room_type];

			if (room_type === 'town-hall-room') {
				// Town Hall Room doesn't fit on the first row
				x = 0;
				y += 32; 
			}

			var suffix = room_type === 'stair' || room_type === 'elevator' ? '-build-icon' : '';
			DrawImage(room_def.image + suffix, x, y, 0);
			//DrawImage('build', x + (g_room_types[room_type].width * 16 - 32) / 2, 0, 0);
			x += g_room_types[room_type].width * 16;
		}

	} else if (IsBuildNewOverlayActive()) {
		DrawImage('build-complete', x, 0, 0);
		x += 32;
		DrawImage('view-up', x, 0, 0);
		x += 32;
		DrawImage('view-down', x, 0, 0);
		x += 32;
	}
}

function ToolbarClick(toolbar_button) {

	// Handle build_<room_type>
	for (room_type in g_room_types) {
		if (toolbar_button.id === 'build_' + room_type) {
			if (room_type === 'town-hall-room' && GetRoomCount(room_type) > 0) {
				ShowWindow(GetMessageWindow('Only one', ['Only one room of this type can be built.']));
			} else if (g_bank_balance < g_room_types[room_type].buy_cost) {
				ShowCannotAffordWindow(g_room_types[room_type]);
			} else {
				g_current_build_room_type = g_room_types[room_type];
				RebuildBuildNewOverlay(g_room_types[room_type]);
				SwitchOverlay(OVERLAY_BUILD_NEW);
			}
			return;
		}
	}

	// Handle other toolbar buttons
	switch (toolbar_button.id) {
		case 'help':
			ShowWindow(GetHelpWindow());
			break;
		case 'view_up':
			g_view_offset_floor++;
			if (IsBuildNewOverlayActive()) RebuildBuildNewOverlay(g_current_build_room_type);
			RebuildNavOverlay();
			break;
		case 'view_down':
			g_view_offset_floor--;
			if (IsBuildNewOverlayActive()) RebuildBuildNewOverlay(g_current_build_room_type);
			RebuildNavOverlay();
			break;
		case 'abort_build_new':
			SwitchOverlay(OVERLAY_NAV);
			break;
		case 'game_star_level':
			ShowWindow(GetGameStarLevelWindow());
			break;
	}

}

function ShowCannotAffordWindow(room_def) {
	var aoeui = {a: 0, o: 0, e: 0, u: 0, i: 0};
	var a = room_def.id.substr(0, 1) in aoeui ? 'an' : 'a';
	ShowWindow(GetMessageWindow('Low bank balance', ['You cannot afford ' + a + ' ' + g_room_types[room_type].name]));
}

/**
 * Is the intro window open?
 */
function IsIntroWindowOpen() {
	return g_open_windows.length > 0 && g_open_windows[0].type === 'intro';
}
/**
 * Is the game over overlay active?
 */
function IsGameOverOverlayActive() {
	return !$('#gui-game-over-overlay').hasClass('hidden');
}
function IsNavOverlayActive() {
	return !$('#gui-nav-overlay').hasClass('hidden');
}
function IsBuildNewOverlayActive() {
	return !$('#gui-build-new-overlay').hasClass('hidden');
}

function HasOpenWindows() {
	return g_open_windows.length > 0;
}

/**
 * Window constructor
 */
function Window(caption) {
	this.type = 'window';
	this.widgets = [
		new WidLabel(caption, 'center'),
		new WidClose(),
	];
	this.dom_node = null; ///< Reference to DOM node object
}

/**
 * Get a window with a caption and then
 * lines of text. 
 * @param caption String with caption text
 * @param lines Array of strings. Lines with 0-length string will be rendered as WidSpacer.
 * @note Don't call with 'new'
 */
function GetMessageWindow(caption, lines) {
	var w = new Window();
	w.type = 'intro';
	w.widgets = [
		new WidLabel(caption, 'center'),
	];
	for (var i = 0; i < lines.length; i++) {
		if (lines[i] == '') {
			w.widgets.push(new WidSpacer());
		} else {
			w.widgets.push(new WidLabel(lines[i], 'left'));
		}
	}
	w.widgets.push(new WidClose());
	return w;
}

/*
 * Factory for room window
 * Don't call with 'new'
 */
function GetRoomWindow(room) {
	var w = new Window();
	w.type = 'room';
	w.room = room;
	w.widgets = [];

	var for_rent = room.state === ROOM_STATE_FOR_RENT;

	w.widgets.push(new WidLabel(StrFirstToUpper(room.def.name) + ' at floor ' + room.floor, 'center'));
	w.widgets.push(new WidValue("Maintenance cost", MoneyStr(room.def.maint_cost) + ' / day'));
	if (!IsStairLayerRoom(room.def.id)) { // Stairs give no income
		w.widgets.push(new WidValue("Rent income", MoneyStr(for_rent ? 0 : room.def.rent_income) + ' / day'));
	}
	w.widgets.push(new WidCostAction('Demolish', MoneyStr(room.def.demolish_cost), 'demolish'));
	w.widgets.push(new WidClose());
	return w;
}

/*
 * Factory for game star level window
 * Don't call with 'new'
 */
function GetGameStarLevelWindow() {
	var w = new Window();
	w.type = 'game_star_level';
	w.widgets = [];

	var stars = g_game_star_level;
	var s = stars >= 2 || stars === 0 ? 's' : '';
	var req_next_star_str = 'Requirements for next star: [you got / you need]';
	w.widgets.push(new WidLabel('You have ' + stars + ' star' + s, 'center'));
	switch (g_game_star_level) {
		case GSL_NO_STAR:
			w.widgets.push(new WidSpacer());
			w.widgets.push(new WidSpacer());
			w.widgets.push(new WidLabel(req_next_star_str, 'left'));
			w.widgets.push(new WidValue("Rented offices", GetRoomRentedCount('office') + ' / ' + STAR1_MIN_OFFICE_RENTED));
			break;
		case GSL_STAR1:
			w.widgets.push(new WidSpacer());
			w.widgets.push(new WidSpacer());
			w.widgets.push(new WidLabel(req_next_star_str, 'left'));
			w.widgets.push(new WidValue("Number of floors", GetBuildingHeight() + ' / ' + STAR2_MIN_FLOORS));
			w.widgets.push(new WidValue("Rented offices", GetRoomRentedCount('office') + ' / ' + STAR2_MIN_OFFICE_RENTED));
			w.widgets.push(new WidValue("Rented cafeteria", GetRoomRentedCount('cafeteria') + ' / ' + STAR2_MIN_CAFETERIA));
			break;
		case GSL_STAR2:
			w.widgets.push(new WidSpacer());
			w.widgets.push(new WidSpacer());
			w.widgets.push(new WidLabel(req_next_star_str, 'left'));
			w.widgets.push(new WidValue("Number of floors", GetBuildingHeight() + ' / ' + STAR3_MIN_FLOORS));
			w.widgets.push(new WidValue("Rented offices", GetRoomRentedCount('office') + ' / ' + STAR3_MIN_OFFICE_RENTED));
			w.widgets.push(new WidValue("Rented cafeteria", GetRoomRentedCount('cafeteria') + ' / ' + STAR3_MIN_CAFETERIA));
			w.widgets.push(new WidValue("Rented flower shops", GetRoomRentedCount('flower-shop') + ' / ' + STAR3_MIN_FLOWER_SHOP));
			break;
		case GSL_STAR3:
			w.widgets.push(new WidSpacer());
			w.widgets.push(new WidSpacer());
			w.widgets.push(new WidLabel('To win the game: [you have / you need]', 'left'));
			w.widgets.push(new WidValue("Number of floors", GetBuildingHeight() + ' / ' + WIN_GAME_MIN_FLOORS));
			break;
	}
	w.widgets.push(new WidClose());
	return w;
}

/*
 * Factory for help window
 * Don't call with 'new'
 */
function GetHelpWindow() {
	var w = new Window();
	w.type = 'help';
	w.widgets = [
		new WidLabel('Help', 'center'),
		new WidSpacer(),
		new WidLabel(
			'Remember to build stairs or elevators so people ' +
			'can reach your offices and other rooms.', 'left'
		),
		new WidSpacer(),
		new WidLabel('How do I level up?', 'center'),
		new WidLabel(
			'Click on the 3 stars in the toolbar and you will see ' +
			'what the requirements are to reach the next level.', 'left'
		),
		new WidSpacer(),
		new WidLabel('How to build higher than level 15?', 'center'),
		new WidLabel(
			'Stairs can be used to reach up to level 15. ' +
			'If you want to build higher you need to unlock ' +
			'the elevator and use that to reach higher up.', 'left'
		),
		new WidSpacer(),
		new WidCostAction('Show intro again', MoneyStr(0), 'show_intro'),
		new WidClose(),
	];
	return w;
}
/*
 * Factory for intro window
 * Don't call with 'new'
 */
function GetIntroWindow() {
	var w = new Window();
	w.type = 'intro';
	w.widgets = [
		new WidLabel('Welcome to Monster Tower', 'center'),
		new WidLabel(
			'Monster is a small town nearby The Hague in the ' +
			'Netherlands.', 'left'
		),
		new WidLabel(
			'The mayor think it should be nice if it had a ' +
			'large tower to show its larger neighbour how ' +
			'much better it is in Monster', 'left'
		),
		new WidSpacer(),
		new WidLabel(
			'Your task is to build this tower.', 'left'
		),
		new WidClose(),
	];
	return w;
}

/**
 * Show a window
 */
function ShowWindow(w) {
	if (g_open_windows.length == 0) {
		SwitchOverlay(OVERLAY_WINDOWS);
	}
	RenderWindowHtml(w);
	g_open_windows.push(w);
}

/**
 * Close topmost window
 */
function CloseTopWindow() {
	if (g_open_windows.length == 0) return;
	$(g_open_windows[g_open_windows.length-1].dom_node).remove();
	g_open_windows.pop();
	if (g_open_windows.length == 0) {
		SwitchOverlay(OVERLAY_NAV);
	}
}

/**
 * Draw windows
 */
function DrawWindows() {
	// Windows are HTML dom nodes drawn by the browser
}

function UpdateWindows(gui_time) {
	// Windows use browser click handler
}

/**
 * Creates DOM html elements for window and its widgets. 
 * The window html element is saved in w.dom_node and inserted
 * into the gui overlay DOM node.
 * This function also attach event handlers to clickable widgets
 * to link them up with WidgetAction function.
 * @param w Window
 */
function RenderWindowHtml(w) {
	var window_div = document.createElement('div');
	window_div.className = 'window';
	var spacer = false; // was previous widget a spacer?
	for (var i = 0; i < w.widgets.length; i++) {
		var widget = w.widgets[i];
		var widget_div = document.createElement('div');
		widget_div.className = 'widget wid-' + widget.type.replace('_', '-');
		$(widget_div).attr('data-wid-name', widget.name);
		$(widget_div).attr('data-wid-type', widget.type);
		switch (widget.type) {
			case 'spacer':
				spacer = true;
				continue;
			case 'label':
				$(widget_div).append('<p class="label" style="text-align:' + widget.align + '">' + widget.label + '</p>');
				break;
			case 'value':
				$(widget_div).append('<p class="label">' + widget.label + '</p>');
				$(widget_div).append('<p class="value">' + widget.value + '</p>');
				break;
			case 'value_edit':
				$(widget_div).append('<p class="label">' + widget.label + '</p>');
				$(widget_div).append('<input class="value" type="number" value="' + widget.value + '">');
				break;
			case 'cost_action':
				$(widget_div).append('<p class="label">' + widget.label + '</p>');
				$(widget_div).append('<p class="cost">' + widget.cost + '</p>');
				$(widget_div).append('<a class="do-it" tabindex="0">Do it!</a>');
				break;
			case 'close':
				$(widget_div).append('<a class="close" tabindex="0">Click to close</a>');
		}
		if (spacer) {
			widget_div.className += ' extra-top-margin';
			spacer = false;
		}
		
		window_div.appendChild(widget_div);
	}

	$(window_div).children('.wid-close').children('.close').on('click', function() {
		$(this).parent().parent().remove();
		g_open_windows.pop();
		if (g_open_windows.length == 0) {
			SwitchOverlay(OVERLAY_NAV);
		}
	});
	$(window_div).children('.wid-cost-action').children('.do-it').on('click', function() {
		var widget_name = $(this).parent().attr('data-wid-name');
		var widget_type = $(this).parent().attr('data-wid-type');
		WidgetAction(w, widget_name, widget_type);
	});
	$(window_div).find('a').on('keypress', OnLinkKeypress);

	// Make new window appear ontop of any existing window
	// on screen.
	$(window_div).css('z-index', BOTTOM_WINDOW_Z + g_open_windows.length);
	
	var overlay = document.getElementById('gui-window-overlay');
	overlay.appendChild(window_div);
	w.dom_node = window_div;
}

/**
 * Widgets
 */
function Widget() {
	this.type = 'widget';
	this.name = '';
}

/** 
 * Just a label:
 * <label>
 * @param align 'center' or 'left'
 */
function WidLabel(label, align) {
	this.type = 'label';
	this.label = label;
	this.align = align
}
WidLabel.prototype = new Widget();

/** 
 * Value display:
 * <label>:    <value>
 */
function WidValue(label, value) {
	this.type = 'value';
	this.label = label;
	this.value = value;
}
WidValue.prototype = new Widget();

/** 
 * Value edit:
 * <label>:    <value> <up/down buttons>
 *
 * @param name Logic name
 */
function WidValueEdit(label, value, name) {
	this.type = 'value_edit';
	this.label = label;
	this.value = value;
	this.name = name;
}
WidValueEdit.prototype = new Widget();

/** 
 * Cost Action
 * <label>   <cost>    <Do it! button>
 *
 * @param name Logic name
 */
function WidCostAction(label, cost, name) {
	this.type = 'cost_action';
	this.label = label;
	this.cost = cost;
	this.name = name;
}
WidCostAction.prototype = new Widget();

/** 
 * Close window
 *            Click to close
 */
function WidClose() {
	this.type = 'close';
}
WidClose.prototype = new Widget();

/** 
 * Spacer
 */
function WidSpacer() {
	this.type = 'spacer';
}
WidSpacer.prototype = new Widget();

/*** Widget functions ***/

/**
 * Called when a click on a widget (with action) is detected.
 */
function WidgetAction(w, widget_name, widget_type) {
	// Close window?
	if (widget_type == 'close') {
		CloseTopWindow();
		return;
	}

	// Window specific action
	switch (w.type) {
		case 'room':
			switch (widget_name) {
				case 'demolish':
					if (TryBuy(w.room.def.demolish_cost)) {
						DemolishRoom(w.room);
						CloseTopWindow();
					}
					break;
			}
			break;

		case 'help':
			switch (widget_name) {
				case 'show_intro':
					g_logo_timer = 0;
					DISABLE_LOGO_INTRO = false;
					CloseTopWindow();
					break;
			}
			break;
	}
}

/**
 * Keypress event handler aimed at <a> tags
 * that trigger click() event upon hitting
 * enter key if the link is focused.
 */
function OnLinkKeypress(e) {
	var key = e.which;
	if (key == 13) { // enter
		this.click();
		return false;
	}
}
/**** FILE js/js/audio.js STARTS HERE ****/
/*
 * Audio play functions
 */

/**
 * Play a sound effect.
 * @param effect The name of the sound effect used in index.html.
 *   Do not include leading 'sound-effect-' of the DOM element id.
 */
function PlaySoundEffect(effect) {
	var dom_element = document.getElementById('sound-effect-' + effect);
	if (dom_element.readyState <= 0) return;
	dom_element.pause();
	dom_element.currentTime = 0;
	dom_element.play();
}
/**** FILE js/js/money.js STARTS HERE ****/

function MoneyInit() {
	g_bank_balance = 10000;
}

function TryBuy(cost) {
	if (cost <= g_bank_balance) {
		g_bank_balance -= cost;
		AnimateCost();
		return true;
	} else {
		return false;
	}
}

function AnimateCost() {
	g_animations.push(new Animation('cost', g_canvas.width - 64, g_canvas.height - 32));
}
function AnimateIncome() {
	g_animations.push(new Animation('money', g_canvas.width - 64, g_canvas.height - 32));
}

function UpdateMoney(time) {

	// g_simulation_time repeat incrementing [0, 60*24] each day, but this works still
	var prev = Math.floor((g_simulation_time - time) / (24 * 60));
	var now = Math.floor((g_simulation_time / (24 *60))); 
	if (g_simulation_time - time < 0) {
		// New date

		var balance_change = 0;
		for(floor_num in g_room_floors) {
			var floor_data = g_room_floors[floor_num];
			for (var i = 0; i < floor_data.length; i++) {
				var room_data = floor_data[i];
				
				balance_change -= room_data.def.maint_cost;
				if (room_data.state !== ROOM_STATE_FOR_RENT) {
					balance_change += room_data.def.rent_income;
				}
			}
		}

		if (balance_change < 0) {
			AnimateCost();
		} else {
			AnimateIncome();
		}

		g_bank_balance += balance_change;
	}
}
/**** FILE js/js/rooms.js STARTS HERE ****/
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
/**** FILE js/js/building.js STARTS HERE ****/

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
/**** FILE js/js/game_level.js STARTS HERE ****/
/*
 * Monitor the game and decides how far you reached
 */

var STAR1_MIN_OFFICE_RENTED = 10; // Min number of rented offices to get star 1

var STAR2_MIN_OFFICE_RENTED = 30;
var STAR2_MIN_CAFETERIA = 1;
var STAR2_MIN_FLOORS = 10;

var STAR3_MIN_OFFICE_RENTED = 50;
var STAR3_MIN_CAFETERIA = 2;
var STAR3_MIN_FLOWER_SHOP = 3;
var STAR3_MIN_FLOORS = 20;

var WIN_GAME_MIN_FLOORS = 50;


/**
 * Game Win Lose (GWL) status.
 */
var GWL_GAME_OVER = 0;   // You lost
var GWL_NORMAL_PLAY = 1; // Game started. You didn't lose nor win yet
var GWL_WON = 10;         // You won. Shows winning screen
var GWL_WON_CONTINUE_PLAY = 11; // Continue to play (hide winning screen)

/*
 * The Game Star Level (GSL) start at GSL_NO_STAR and can then progress
 * to max number of stars
 */
var GSL_NO_STAR = 0;
var GSL_STAR1 = 1; // Code assumes that STAR1 is 1, STAR2 is 2 etc. in generic code
var GSL_STAR2 = 2;
var GSL_STAR3 = 3;

function GameLevelInit() {
	g_game_win_lose = GWL_NORMAL_PLAY;
	g_game_star_level = GSL_NO_STAR;
}

function UpdateGameLevel(time) {
	// Update Win/Lose
	if (g_game_win_lose == GWL_WON_CONTINUE_PLAY) return;

	if (g_bank_balance < -10000) {
		g_game_win_lose = GWL_GAME_OVER;
	}

	if (g_game_win_lose > GWL_GAME_OVER) {
		if (GetBuildingHeight() >= WIN_GAME_MIN_FLOORS) {
			g_game_level = GWL_WON;
		}
	}

	// Update stars
	switch (g_game_star_level) {
		case GSL_NO_STAR:
			if (GetRoomRentedCount('office') >= STAR1_MIN_OFFICE_RENTED) {
				SetGameStarLevel(g_game_star_level + 1);
			}
			break;
		case GSL_STAR1:
			if (GetRoomRentedCount('office') >= STAR2_MIN_OFFICE_RENTED &&
					GetRoomRentedCount('cafeteria') >= STAR2_MIN_CAFETERIA &&
					GetBuildingHeight() >= STAR2_MIN_FLOORS) {
				SetGameStarLevel(g_game_star_level + 1);
			}
			break;
		case GSL_STAR2:
			if (GetRoomRentedCount('office') >= STAR3_MIN_OFFICE_RENTED &&
					GetRoomRentedCount('cafeteria') >= STAR3_MIN_CAFETERIA &&
					GetRoomRentedCount('flower-shop') >= STAR3_MIN_FLOWER_SHOP &&
					GetBuildingHeight() >= STAR3_MIN_FLOORS) {
				SetGameStarLevel(g_game_star_level + 1);
			}
			break;
		case GSL_STAR3:
			break;
		default:
			break;
	}
}

function SetGameStarLevel(star_level) {
	g_game_star_level = star_level;
	var stars = g_game_star_level;
	var s = stars >= 2 || stars === 0 ? 's' : '';
	if (stars > 0) {
		ShowWindow(GetMessageWindow('You leveled up!', ['Your monster tower now have ' + stars + ' star' + s]));
		PlaySoundEffect('new-star');
	}

	// Build toolbar may change due to new rooms being available
	RebuildToolbars();
}

function IsGameOver() {
	return g_game_win_lose === GWL_GAME_OVER;
}

function IsGameWon() {
	return g_game_win_lose === GWL_WON;
}
/**** FILE js/js/main.js STARTS HERE ****/

// Global variables
var g_canvas = null;
var g_view_offset_floor = null;
var g_view_offset_x = null;
var g_context = null;
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
	g_canvas = document.createElement("canvas");
	g_context = g_canvas.getContext("2d"); 
	g_canvas.width = 640;
	g_canvas.height = 480;
	g_canvas.id = 'canvas';
	var game = document.getElementById('game');
	game.appendChild(g_canvas);

	g_view_offset_floor = -4;
	g_view_offset_x = 0;
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
	}

	// Progress game time unless paused
	// - pause when window is open, as many display stats that don't update unless the
	//   window is re-opened.
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
	// Should logo be displayed?
	if (g_logo_timer >= 0 && !DISABLE_LOGO_INTRO) {
		DrawImage(g_logo_timer < 1 ? "map1" : "map2", 0, 0);
		return;
	} else if (IsGameOver()) {
		DrawImage("game-over", 0, 0);
		return;
	} else if (IsGameWon()) {
		DrawImage("won", 0, 0);
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
			if (map_x % 2 == 0) {
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
}

// Main game loop
function Main() {
	var now = Date.now();
	var delta = now - g_last_loop;

	Update(delta / 1000);
	Render();

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
