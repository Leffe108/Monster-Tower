/*
 * GUI related stuff
 */

/* global Building, GameLevel, Money, Room, RoomType, SaveLoad, MtImage, BuildNewCursor */
/* global g_bank_balance:true, g_canvas, g_dirty_screen:true, g_logo_timer:true, g_game_star_level, g_room_types, g_room_floors, g_stair_floors, g_view_offset_x:true, g_view_offset_floor:true */
/* global EncodeEntities, InitGameState, MapToScreen, MoneyStr, StrFirstToUpper, DISABLE_LOGO_INTRO:true */
/* exported g_dirty_screen, g_logo_timer, DISABLE_LOGO_INTRO */

/* exported Gui */
var Gui = (function() {
	var BOTTOM_WINDOW_Z = 10; ///< z-index of the window displayed at the bottom of the open window stack.

	var OVERLAY_NAV = 1;   // toolbar + click on rooms
	var OVERLAY_BUILD_NEW = 2; // place new rooms
	var OVERLAY_WINDOWS = 3;
	var OVERLAY_GAME_OVER = 4;

	var _open_windows = []; // list of open windows
	var _toolbar_buildable_rooms = null; // array of rooms that can currently be built. The order affects toolbars
	/**
	 * Initialize GUI-related stuff
	 */
	var init = function() {
		_open_windows = [];

		initGameOverOverlay();
		initToolbar();
	};

	/**
	 * @param overlay OVERLAY_WINDOWS or OVERLAY_NAV
	 */
	var switchOverlay = function(overlay) {
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
			$('#gui-build-new-cursor').find('a').focus();
		} else if (overlay == OVERLAY_GAME_OVER) {
			$('#gui-game-over-overlay').removeClass('hidden');
			$('#gui-game-over-overlay a.play-again').focus();
		}
	};

	/**
	 * Add a nav overlay element for given building
	 *
	 * overlay: 'nav' or 'build-new'
	 * nav_type:
	 *   'nav' overlay has: 'room', 'toolbar'
	 *   'build-new' overlay has: 'toolbar'
	 */
	var addOverlayItem = function(data, title, screen_x, screen_y, screen_width, overlay, nav_type) {
		var overlay_id = 'gui-' + overlay + '-overlay';

		var container = $('#' + overlay_id).find('ul[data-nav-type=' + nav_type + ']');
		var li = $('<li class="gui-overlay-item">');
		var a = $('<a tabindex="0">');
		if (nav_type == 'room') {
			a.on('click', function() {
				roomClick(data);
			});
		} else if (nav_type == 'toolbar') {
			a.on('click', function() {
				toolbarClick(data);
			});
		}
		a.css('width', screen_width + 'px');
		a.on('keypress', onLinkKeypress);
		a.attr('title', title);
		li.css('left', screen_x);
		li.css('top', screen_y);
		li.append(a);
		container.append(li);
		return li;
	};

	/**
	 * Remove a nav overlay
	 * @param overlay_item The return value from addOverlayItem
	 */
	var removeOverlayItem = function(overlay_item) {
		overlay_item.remove();
	};

	var getRoomBuildCostLabel = function(room_type) {
		return '(costs ' + MoneyStr(g_room_types[room_type].buy_cost) + ')';
	};

	var initToolbar = function() {
		rebuildToolbars();
	};
	var rebuildToolbars = function() {

		// Remove old overlays
		$('#gui-nav-overlay').find('ul[data-nav-type=toolbar]').find('li').remove();
		$('#gui-build-new-overlay').find('ul[data-nav-type=toolbar]').find('li').remove();

		// Update _toolbar_buildable_rooms
		var master_room_toolbar = ['stair', 'elevator', 'office', 'cafeteria', 'flower-shop', 'town-hall-room'];
		_toolbar_buildable_rooms = [];
		for (var i = 0; i < master_room_toolbar.length; i++) {
			var room_def = g_room_types[master_room_toolbar[i]];
			if (g_game_star_level >= room_def.min_stars) {
				_toolbar_buildable_rooms.push(master_room_toolbar[i]);
			}
		}

		// Toolbar in nav overlay
		var x = 0;
		var y = 0;
		addOverlayItem({
			id: 'help',
		}, 'Help', x, y, 32, 'nav', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'load',
		}, 'Load', x, y, 32, 'nav', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'save',
		}, 'Save', x, y, 32, 'nav', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'view_up',
		}, 'Scroll view up', x, y, 32, 'nav', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'view_down',
		}, 'Scroll view down', x, y, 32, 'nav', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'view_left',
		}, 'Scroll view left', x, y, 32, 'nav', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'view_right',
		}, 'Scroll view right', x, y, 32, 'nav', 'toolbar');
		x += 32;

		addOverlayItem({
			id: 'game_star_level',
		}, 'Game level', x, y, 96, 'nav', 'toolbar');
		x += 96;

		for (i = 0; i < _toolbar_buildable_rooms.length; i++) {
			var room_type = _toolbar_buildable_rooms[i];
			room_def = g_room_types[room_type];

			if (room_type === 'town-hall-room') {
				// Town Hall Room doesn't fit on the first row
				x = 0;
				y += 32;
			}

			addOverlayItem({
				id: 'build_' + room_type,
			}, 'Bulid ' + room_def.name + ' ' + getRoomBuildCostLabel(room_type), x, y, g_room_types[room_type].width * 16, 'nav', 'toolbar');
			x += g_room_types[room_type].width * 16;
		}

		// Toolbar in build-new mode/overlay
		x = 0;
		addOverlayItem({
			id: 'abort_build_new',
		}, 'Stop building more', x, 0, 32, 'build-new', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'view_up',
		}, 'Scroll view up', x, 0, 32, 'build-new', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'view_down',
		}, 'Scroll view down', x, 0, 32, 'build-new', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'view_left',
		}, 'Scroll view left', x, y, 32, 'build-new', 'toolbar');
		x += 32;
		addOverlayItem({
			id: 'view_right',
		}, 'Scroll view right', x, y, 32, 'build-new', 'toolbar');
		x += 32;
	};

	var initGameOverOverlay = function() {
		var won = GameLevel.isGameWon();
		var a = $('<a tabindex="0" class="play-again">');
		a.on('click', function() {
			if (GameLevel.isGameWon()) {
				GameLevel.wonContinuePlay();
				switchOverlay(OVERLAY_NAV);
			} else {
				location.reload(); // Reload page
			}
		});
		a.on('keypress', onLinkKeypress);
		a.attr('title', won ? 'Continue to play' : 'Play again');
		$('#gui-game-over-overlay').append(a);
	};

	/** Rebuilds the nav overlay except for toolbars, use rebuildToolbars for that. */
	var rebuildNavOverlay = function() {

		$('#gui-nav-overlay').find('ul[data-nav-type=room]').find('li').remove();

		for (var floor_num = Building.MIN_FLOOR; floor_num <= Building.MAX_FLOOR; floor_num++) {
			var floor_containers = [g_room_floors, g_stair_floors];
			for (var i_fc = 0; i_fc < floor_containers.length; i_fc++) {
				var floor_container = floor_containers[i_fc];

				if (floor_num in floor_container) {
					var floor_data = floor_container[floor_num];

					for (var i = 0; i < floor_data.length; i++) {
						var room_data = floor_data[i];
						var screen_pos = MapToScreen(room_data.x, floor_num);

						// Don't add nav overlays ontop of toolbar. Cause problems for users
						// not aware that they can use tab to select the toolbar button overlay.
						if (screen_pos[1] < 32) continue;

						Building.addOverlayItemForRoom(room_data);
					}
				}
			}
		}

	};

	var drawToolbar = function() {
		var x = 0;
		var y = 0;
		if (isNavOverlayActive()) {
			MtImage.draw('help', x, y, 0);
			x += 32;
			MtImage.draw('load', x, y, 0);
			x += 32;
			MtImage.draw('save', x, y, 0);
			x += 32;
			MtImage.draw('view-up', x, y, 0);
			x += 32;
			MtImage.draw('view-down', x, y, 0);
			x += 32;
			MtImage.draw('view-left', x, y, 0);
			x += 32;
			MtImage.draw('view-right', x, y, 0);
			x += 32;

			var star_button_image = '';
			switch (g_game_star_level) {
				case GameLevel.GSL_NO_STAR:
					star_button_image = 'game-star-level-no-star';
					break;
				case GameLevel.GSL_STAR1:
				case GameLevel.GSL_STAR2:
				case GameLevel.GSL_STAR3:
					star_button_image = 'game-star-level-' + g_game_star_level;
					break;
			}
			MtImage.draw(star_button_image, x, y, 0);
			x += 96;

			for (var i = 0; i < _toolbar_buildable_rooms.length; i++) {
				var room_type = _toolbar_buildable_rooms[i];
				var room_def = g_room_types[room_type];

				if (room_type === 'town-hall-room') {
					// Town Hall Room doesn't fit on the first row
					x = 0;
					y += 32;
				}

				var suffix = room_type === 'stair' || room_type === 'elevator' ? '-build-icon' : '';
				MtImage.draw(room_def.image + suffix, x, y, 0);
				//MtImage.draw('build', x + (g_room_types[room_type].width * 16 - 32) / 2, 0, 0);
				x += g_room_types[room_type].width * 16;
			}

		} else if (isBuildNewOverlayActive()) {
			MtImage.draw('build-complete', x, 0, 0);
			x += 32;
			MtImage.draw('view-up', x, 0, 0);
			x += 32;
			MtImage.draw('view-down', x, 0, 0);
			x += 32;
			MtImage.draw('view-left', x, 0, 0);
			x += 32;
			MtImage.draw('view-right', x, 0, 0);
			x += 32;
		}
	};

	var roomClick = function(room_data) {
		showWindow(getRoomWindow(room_data));
	};

	var toolbarClick = function(toolbar_button) {

		// Handle build_<room_type>
		for (var room_type in g_room_types) {
			if (toolbar_button.id === 'build_' + room_type) {
				if (room_type === 'town-hall-room' && Room.getCount(room_type) > 0) {
					showWindow(getMessageWindow('Only one', ['Only one room of this type can be built.']));
				} else if (g_bank_balance < g_room_types[room_type].buy_cost) {
					showCannotAffordWindow(g_room_types[room_type]);
				} else {
					BuildNewCursor.start(g_room_types[room_type]);
				}
				return;
			}
		}

		// Handle other toolbar buttons
		switch (toolbar_button.id) {
			case 'help':
				showWindow(getHelpWindow());
				break;
			case 'load':
				showWindow(getLoadWindow());
				break;
			case 'save':
				showWindow(getSaveWindow());
				break;
			case 'view_up':
				g_view_offset_floor++;
				BuildNewCursor.updateScreenPosition();
				rebuildNavOverlay();
				break;
			case 'view_down':
				g_view_offset_floor--;
				BuildNewCursor.updateScreenPosition();
				rebuildNavOverlay();
				break;
			case 'view_left':
				g_view_offset_x+= 5;
				BuildNewCursor.updateScreenPosition();
				rebuildNavOverlay();
				break;
			case 'view_right':
				g_view_offset_x-= 5;
				BuildNewCursor.updateScreenPosition();
				rebuildNavOverlay();
				break;
			case 'abort_build_new':
				BuildNewCursor.abort();
				break;
			case 'game_star_level':
				showWindow(getGameStarLevelWindow());
				break;
		}

	};

	var showCannotAffordWindow = function(room_def) {
		var aoeui = {a: 0, o: 0, e: 0, u: 0, i: 0};
		var a = room_def.id.substr(0, 1) in aoeui ? 'an' : 'a';
		showWindow(getMessageWindow('Low bank balance', ['You cannot afford ' + a + ' ' + g_room_types[room_def.id].name]));
	};

	/**
	 * Is the intro window open?
	 */
	var isIntroWindowOpen = function() {
		return _open_windows.length > 0 && _open_windows[0].type === 'intro';
	};
	/**
	 * Is the game over overlay active?
	 */
	var isGameOverOverlayActive = function() {
		return !$('#gui-game-over-overlay').hasClass('hidden');
	};
	var isNavOverlayActive = function() {
		return !$('#gui-nav-overlay').hasClass('hidden');
	};
	var isBuildNewOverlayActive = function() {
		return !$('#gui-build-new-overlay').hasClass('hidden');
	};

	var hasOpenWindows = function() {
		return _open_windows.length > 0;
	};

	/**
	 * Window constructor
	 */
	var Window = function(caption) {
		this.type = 'window';
		this.widgets = [
			new WidLabel(caption, 'center', 'h2'),
			new WidClose(),
		];
		this.dom_node = null; ///< Reference to DOM node object
	};

	/**
	 * Get a window with a caption and then
	 * lines of text.
	 * @param caption String with caption text
	 * @param lines Array of strings. Lines with 0-length string will be rendered as WidSpacer.
	 * @note Don't call with 'new'
	 */
	var getMessageWindow = function(caption, lines) {
		var w = new Window();
		w.type = 'intro';
		w.widgets = [
			new WidLabel(caption, 'center', 'h2'),
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
	};

	/*
	 * Factory for room window
	 * Don't call with 'new'
	 */
	var getRoomWindow = function(room) {
		var w = new Window();
		w.type = 'room';
		w.room = room;
		w.widgets = [];

		var for_rent = room.state === Room.ROOM_STATE_FOR_RENT;

		w.widgets.push(new WidLabel(StrFirstToUpper(room.def.name) + ' at floor ' + room.floor, 'center', 'h2'));
		w.widgets.push(new WidValue("Maintenance cost", MoneyStr(room.def.maint_cost) + ' / day'));
		if (!RoomType.isStairLayerRoom(room.def.id)) { // Stairs give no income
			w.widgets.push(new WidValue("Rent income", MoneyStr(for_rent ? 0 : room.def.rent_income) + ' / day'));
		}
		w.widgets.push(new WidCostAction('Demolish', MoneyStr(room.def.demolish_cost), 'demolish'));
		w.widgets.push(new WidClose());
		return w;
	};

	/*
	 * Factory for game star level window
	 * Don't call with 'new'
	 */
	var getGameStarLevelWindow = function() {
		var w = new Window();
		w.type = 'game_star_level';
		w.widgets = [];

		var stars = g_game_star_level;
		var s = stars >= 2 || stars === 0 ? 's' : '';
		var req_next_star_str = 'Requirements for next star: [you got / you need]';
		w.widgets.push(new WidLabel('You have ' + stars + ' star' + s, 'center', 'h2'));
		switch (g_game_star_level) {
			case GameLevel.GSL_NO_STAR:
				w.widgets.push(new WidSpacer());
				w.widgets.push(new WidSpacer());
				w.widgets.push(new WidLabel(req_next_star_str, 'left'));
				w.widgets.push(new WidValue("Rented offices", Room.getRentedCount('office') + ' / ' + GameLevel.STAR1_MIN_OFFICE_RENTED));
				break;
			case GameLevel.GSL_STAR1:
				w.widgets.push(new WidSpacer());
				w.widgets.push(new WidSpacer());
				w.widgets.push(new WidLabel(req_next_star_str, 'left'));
				w.widgets.push(new WidValue("Number of floors", Building.getBuildingHeight() + ' / ' + GameLevel.STAR2_MIN_FLOORS));
				w.widgets.push(new WidValue("Rented offices", Room.getRentedCount('office') + ' / ' + GameLevel.STAR2_MIN_OFFICE_RENTED));
				w.widgets.push(new WidValue("Rented cafeteria", Room.getRentedCount('cafeteria') + ' / ' + GameLevel.STAR2_MIN_CAFETERIA));
				break;
			case GameLevel.GSL_STAR2:
				w.widgets.push(new WidSpacer());
				w.widgets.push(new WidSpacer());
				w.widgets.push(new WidLabel(req_next_star_str, 'left'));
				w.widgets.push(new WidValue("Number of floors", Building.getBuildingHeight() + ' / ' + GameLevel.STAR3_MIN_FLOORS));
				w.widgets.push(new WidValue("Rented offices", Room.getRentedCount('office') + ' / ' + GameLevel.STAR3_MIN_OFFICE_RENTED));
				w.widgets.push(new WidValue("Rented cafeteria", Room.getRentedCount('cafeteria') + ' / ' + GameLevel.STAR3_MIN_CAFETERIA));
				w.widgets.push(new WidValue("Rented flower shops", Room.getRentedCount('flower-shop') + ' / ' + GameLevel.STAR3_MIN_FLOWER_SHOP));
				break;
			case GameLevel.GSL_STAR3:
				w.widgets.push(new WidSpacer());
				w.widgets.push(new WidSpacer());
				w.widgets.push(new WidLabel('To win the game: [you have / you need]', 'left'));
				w.widgets.push(new WidValue("Number of floors", Building.getBuildingHeight() + ' / ' + GameLevel.WIN_GAME_MIN_FLOORS));
				break;
		}
		w.widgets.push(new WidClose());
		return w;
	};

	/*
	 * Factory for help window
	 * Don't call with 'new'
	 */
	var getHelpWindow = function() {
		var w = new Window();
		w.type = 'help';
		w.widgets = [
			new WidLabel('Help', 'center', 'h2'),
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
	};
	/*
	 * Factory for load window
	 * Don't call with 'new'
	 */
	var getLoadWindow = function() {
		var w = new Window();
		w.type = 'load';
		w.widgets = [
			new WidLabel('Load game', 'center', 'h2'),
			new WidSpacer(),
			new WidLabel(
				'Paste the save data below, and then click on Load game below. It is the text you got in ' +
				'the text box when you or your friend clicked on save.'
			),
			new WidTextArea('Save data', '', 'load_json'),
			new WidCostAction('Load game', MoneyStr(0), 'load_json_game'),
			new WidSpacer(),
			new WidSpacer(),
			new WidLabel('New game', 'center'),
			new WidCostAction('New game', MoneyStr(0), 'new_game'),
			new WidClose(),
		];
		return w;
	};
	/*
	 * Factory for save window
	 * Don't call with 'new'
	 */
	var getSaveWindow = function() {
		var w = new Window();
		w.type = 'save';
		w.widgets = [
			new WidLabel('Save game', 'center', 'h2'),
			new WidSpacer(),
			new WidLabel(
				'Copy save data text below and save somewhere safe, or email a friend:'
			),
			new WidTextArea('Save data', SaveLoad.saveGameStateToJsonStr(), 'save_json'),
			new WidClose(),
		];
		return w;
	};

	/*
	 * Factory for intro window
	 * Don't call with 'new'
	 */
	var getIntroWindow = function() {
		var w = new Window();
		w.type = 'intro';
		w.widgets = [
			new WidLabel('Welcome to Monster Tower', 'center', 'h2'),
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
	};

	/**
	 * Show a window
	 */
	var showWindow = function(w) {
		if (_open_windows.length == 0) {
			switchOverlay(OVERLAY_WINDOWS);
		}
		renderWindowHtml(w);
		positionWindows();
		_open_windows.push(w);
	};

	/**
	 * Close topmost window
	 */
	var closeTopWindow = function() {
		if (_open_windows.length == 0) return;
		$(_open_windows[_open_windows.length-1].dom_node).remove();
		_open_windows.pop();
		if (_open_windows.length == 0) {
			switchOverlay(OVERLAY_NAV);
		}
	};

	/**
	 * Position windows on the screen
	 */
	var positionWindows = function() {
		var windows = $('.window');
		if (windows.length === 0) return;
		var win_width = windows.css('width').replace('px', '');
		var win_height = windows.css('height').replace('px', '');

		var x = g_canvas.width/2 - win_width/2;
		var y = g_canvas.height/2 - win_height/2;

		windows.css('left', x + 'px');
		windows.css('top', y + 'px');
	};

	/**
	 * Creates DOM html elements for window and its widgets.
	 * The window html element is saved in w.dom_node and inserted
	 * into the gui overlay DOM node.
	 * This function also attach event handlers to clickable widgets
	 * to link them up with WidgetAction function.
	 * @param w Window
	 */
	var renderWindowHtml = function(w) {
		var window_div = document.createElement('div');
		window_div.className = 'window';

		var aria_div = document.createElement('div');
		aria_div.appendChild(document.createTextNode('Window content: '));
		aria_div.className = 'visually-hidden';
		window_div.appendChild(aria_div);

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
					$(widget_div).append('<'+widget.nodeName+' class="label" style="text-align:' + widget.align + '">' + widget.label + '</'+widget.nodeName+'>');
					break;
				case 'value':
					$(widget_div).append('<p class="label">' + widget.label + '</p>');
					$(widget_div).append('<p class="value">' + widget.value + '</p>');
					break;
				case 'value_edit':
					$(widget_div).append('<p class="label">' + widget.label + '</p>');
					$(widget_div).append('<input class="value" type="number" value="' + widget.value + '">');
					break;
				case 'textarea':
					$(widget_div).append('<p class="label">' + widget.label + '</p>');
					$(widget_div).append('<textarea>' + EncodeEntities(widget.value) + '</textarea>');
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
			_open_windows.pop();
			if (_open_windows.length == 0) {
				switchOverlay(OVERLAY_NAV);
			}
		});
		$(window_div).children('.wid-cost-action').children('.do-it').on('click', function() {
			var widget_name = $(this).parent().attr('data-wid-name');
			var widget_type = $(this).parent().attr('data-wid-type');
			WidgetAction(w, widget_name, widget_type);
		});
		$(window_div).find('a').on('keypress', onLinkKeypress);

		// Make new window appear ontop of any existing window
		// on screen.
		$(window_div).css('z-index', BOTTOM_WINDOW_Z + _open_windows.length);

		var overlay = document.getElementById('gui-window-overlay');
		overlay.appendChild(window_div);
		w.dom_node = window_div;
	};

	/**
	 * Widget constructor
	 */
	var Widget = function() {
		this.type = 'widget';
		this.name = '';
	};

	/**
	 * Just a label:
	 * <label>
	 * @param align 'center' or 'left'
	 * @param nodeName 'p', 'h1', 'h2' or anything. Defaults to 'p'
	 */
	var WidLabel = function(label, align, nodeName) {
		this.type = 'label';
		this.label = label;
		this.align = align;
		this.nodeName = nodeName || 'p';
	};
	WidLabel.prototype = new Widget();

	/**
	 * Value display:
	 * <label>:    <value>
	 */
	var WidValue = function(label, value) {
		this.type = 'value';
		this.label = label;
		this.value = value;
	};
	WidValue.prototype = new Widget();

	/**
	 * Value edit:
	 * <label>:    <value> <up/down buttons>
	 *
	 * @param name Logic name
	 */
	var WidValueEdit = function(label, value, name) {
		this.type = 'value_edit';
		this.label = label;
		this.value = value;
		this.name = name;
	};
	WidValueEdit.prototype = new Widget();

	/**
	 * Text area:
	 * <label>
	 * <textarea>
	 *
	 * @param name Logic name
	 */
	var WidTextArea = function(label, value, name) {
		this.type = 'textarea';
		this.label = label;
		this.value = value;
		this.name = name;
	};
	WidTextArea.prototype = new Widget();

	/**
	 * Cost Action
	 * <label>   <cost>    <Do it! button>
	 *
	 * @param name Logic name
	 */
	var WidCostAction = function(label, cost, name) {
		this.type = 'cost_action';
		this.label = label;
		this.cost = cost;
		this.name = name;
	};
	WidCostAction.prototype = new Widget();

	/**
	 * Close window
	 *            Click to close
	 */
	var WidClose = function() {
		this.type = 'close';
	};
	WidClose.prototype = new Widget();

	/**
	 * Spacer
	 */
	var WidSpacer = function() {
		this.type = 'spacer';
	};
	WidSpacer.prototype = new Widget();

	/*** Widget functions ***/

	/**
	 * Called when a click on a widget (with action) is detected.
	 */
	var WidgetAction = function(w, widget_name, widget_type) {
		// Close window?
		if (widget_type == 'close') {
			closeTopWindow();
			return;
		}

		// Window specific action
		switch (w.type) {
			case 'room':
				switch (widget_name) {
					case 'demolish':
						if (Money.tryBuy(w.room.def.demolish_cost)) {
							Building.demolishRoom(w.room);
							closeTopWindow();
						}
						break;
				}
				break;

			case 'help':
				switch (widget_name) {
					case 'show_intro':
						g_logo_timer = 0;
						DISABLE_LOGO_INTRO = false;
						closeTopWindow();
						break;
				}
				break;

			case 'load':
				switch (widget_name) {
					case 'new_game':
						InitGameState();
						closeTopWindow();
						rebuildToolbars();
						rebuildNavOverlay();
						if (isBuildNewOverlayActive()) switchOverlay(OVERLAY_NAV);
						break;

					case 'load_json_game':
						var json_str = $(w.dom_node).find('textarea').val();
						var loaded = SaveLoad.loadGameStateFromJsonStr(json_str);
						if (loaded) {
							closeTopWindow();
						} else {
							showWindow(getMessageWindow('Load failed', ['Loading the game data failed. :-(']));
							g_dirty_screen = true;
						}
						rebuildToolbars();
						rebuildNavOverlay();
						if (isBuildNewOverlayActive()) switchOverlay(OVERLAY_NAV);
						break;
				}
		}
	};

	/**
	 * Keypress event handler aimed at <a> tags
	 * that trigger click() event upon hitting
	 * enter key if the link is focused.
	 */
	var onLinkKeypress = function(e) {
		var key = e.which;
		if (key == 13) { // enter
			this.click();
			return false;
		}
	};

	/**
	 * Set the screen reader-only text which
	 * upon text change will be announced
	 * by screen reader.
	 * Used to inform about what happens in
	 * the game which is otherwise only shown
	 * visually on the canvas.
	 */
	var setGameAriaLiveText = function(text) {
		var element = document.getElementById('game-aria-live-text');
		element.textContent = text;
	};

	// Export:
	return {
		/* enum consts */
		OVERLAY_NAV: OVERLAY_NAV,
		OVERLAY_BUILD_NEW: OVERLAY_BUILD_NEW,
		OVERLAY_WINDOWS: OVERLAY_WINDOWS,
		OVERLAY_GAME_OVER: OVERLAY_GAME_OVER,

		/* functions */
		init: init,
		switchOverlay: switchOverlay,
		drawToolbar: drawToolbar,
		addOverlayItem: addOverlayItem,
		removeOverlayItem: removeOverlayItem,
		rebuildToolbars: rebuildToolbars,

		isGameOverOverlayActive: isGameOverOverlayActive,
		isBuildNewOverlayActive: isBuildNewOverlayActive,
		isIntroWindowOpen: isIntroWindowOpen,
		hasOpenWindows: hasOpenWindows,

		getIntroWindow: getIntroWindow,
		getMessageWindow: getMessageWindow,
		closeTopWindow: closeTopWindow,
		positionWindows: positionWindows,
		showWindow: showWindow,
		showCannotAffordWindow: showCannotAffordWindow,

		setGameAriaLiveText: setGameAriaLiveText,
	};
})();
