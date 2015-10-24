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

					if (screen_pos[1] >= g_canvas.height) continue;

					var overlay_data = {
						room_def: room_def,
						floor: floor_num,
						x: x,
					};
					var width = Math.min(screen_pos[0] + room_def.width * 16, g_canvas.width) - screen_pos[0];
					AddOverlayItem(overlay_data, 'Build on floor ' + floor_num + ', x: ' + x, 
							screen_pos[0], screen_pos[1], width, 'build-new', 'build_new');
				}
			}
		}
	}
}

/** Rebuilds the nav overlay except for toolbars, use RebuildToolbars for that. */
function RebuildNavOverlay(room_def) {

	$('#gui-nav-overlay').find('ul[data-nav-type=room]').find('li').remove();

	for (var floor_num = MIN_FLOOR; floor_num <= MAX_FLOOR; floor_num++) {
		var floor_containers = [g_room_floors, g_stair_floors];
		for (var i_fc = 0; i_fc < floor_containers.length; i_fc++) {
			var floor_container = floor_containers[i_fc];

			if (floor_num in floor_container) {
				floor_data = floor_container[floor_num];

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
