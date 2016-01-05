/*
 * Module: MtImage (MT = Monster Tower)
 *
 * Loading and drawing of images. Drawing routines silently skip
 * drawing images until they have loaded.
 */

/*global RoomType, g_room_types, g_context, g_canvas*/
/*eslint no-unused-vars: [2, {"args": "all", "varsIgnorePattern": "MtImage"}]*/

var MtImage = (function() {

	var _images = null;

	var init = function() {
		_images = {};
	};

	/**
	 * Loads all images except those depending
	 * on what room types that are defined.
	 */
	var loadStatic = function() {
		_loadImage("map1", 0, 0);
		_loadImage("map2", 0, 0);

		_loadImage("underground", 0, 0);
		_loadImage("sky", 0, 0);
		_loadImage("ceiling", 0, 0);
		_loadImage("build", 0, 0);
		_loadImage("money", 16, 16); // green money
		_loadImage("cost", 16, 16);

		// GUI
		_loadImage("build-complete", 0, 0);
		_loadImage("load", 0, 0);
		_loadImage("save", 0, 0);
		_loadImage("help", 0, 0);
		_loadImage("view-up", 0, 0);
		_loadImage("view-down", 0, 0);
		_loadImage("view-left", 0, 0);
		_loadImage("view-right", 0, 0);
		_loadImage("game-over", 0, 0);
		_loadImage("won", 0, 0);
		_loadImage("game-star-level-no-star", 0, 0);
		_loadImage("game-star-level-1", 0, 0);
		_loadImage("game-star-level-2", 0, 0);
		_loadImage("game-star-level-3", 0, 0);
	};

	/** Loads images based on defined room types. */
	var loadRoomTypeImages = function() {
		for (var id in g_room_types) {
			_loadImage(g_room_types[id].image, 0, 0);
			if (RoomType.isStairLayerRoom(id)) {
				_loadImage(g_room_types[id].image + '-build-icon', 0, 0);
				if (id === 'elevator') {
					_loadImage(g_room_types[id].image + '-top', 0, 0);
					_loadImage(g_room_types[id].image + '-bottom', 0, 0);
				}
			} else {
				_loadImage(g_room_types[id].image + '-closed', 0, 0);
				if (id !== 'town-hall-room') _loadImage(g_room_types[id].image + '-for-rent', 0, 0);
			}
		}
	};

	/**
	 * @param name The name identifier of the image which is also the file name excluding '.png'.
	 * @param base_x X offset to the point in the image that will be rendered as 0,0 of this image
	 * @param base_y Y offset to the point in the image that will be rendered as 0,0 of this image
	 */
	var _loadImage = function(name, base_x, base_y) {
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
		_images[name] = img;
	};

	/**
	 * Draws an image at x,y, if the image has loaded
	 * x and y will be floored to integers if they are not
	 * already integers.
	 * @param image The image name
	 * @param angle Rotation angle. Defaults to 0
	 */
	var draw = function(image, x, y, angle) {
		if (angle == null) angle = 0;
		var img = _images[image];
		if (img.complete && img.width > 0) { // .complete is always true in FF
			g_context.save();
			g_context.translate(Math.floor(x), Math.floor(y));
			g_context.rotate(angle);
			g_context.drawImage(img, -img.base_x, -img.base_y);
			g_context.restore();
		}
	};
	/**
	 * Draws an image centered on the canvas, if the image has loaded.
	 * @param image The image name
	 */
	var drawCentered = function(image) {
		var img = _images[image];
		if (!img.complete || img.width <= 0) return;
		var x = g_canvas.width/2 - img.width/2;
		var y = g_canvas.height/2 - img.height/2;
		draw(image, x, y);
	};

	// Export:
	return {
		init: init,
		loadStatic: loadStatic,
		loadRoomTypeImages: loadRoomTypeImages,
		draw: draw,
		drawCentered: drawCentered,
	};

})();
