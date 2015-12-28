/**
 * Module: Animation
 */

/* global MtImage, g_context */
/* eslint no-unused-vars: [2, {"args": "all", "varsIgnorePattern": "Animation"}] */

var Animation = (function() {

	var _ANIMATION_MAX_TIME = 2.0;
	var _animations = null;

	var init = function() {
		_animations = [];
	};

	/**
	 * Create an animation and add it to the list of animations that
	 * get updated/drawn using updateAll and drawAll.
	 *
	 * Animations for now is an image that moves upwards and rotates.
	 */
	var create = function(image, start_x, start_y) {
		_animations.push({
			x: start_x,
			y: start_y,
			angle: 0,
			image: image,
			timer: 0,
		});
	};

	/**
	 * Update all animations
	 */
	var updateAll = function(time) {
		for (var i = 0; i < _animations.length; i++) {
			var animation = _animations[i];
			animation.timer += time;
			if (animation.timer > _ANIMATION_MAX_TIME) {
				_animations.splice(i, 1);
				i--;
			} else {
				var N_ROTATIONS = 0.75;
				animation.y -= time * 15.0;
				animation.angle = animation.timer * N_ROTATIONS * Math.PI*2 / _ANIMATION_MAX_TIME;
			}
		}
	};

	/**
	 * Has any animations that need to get drawn?
	 */
	var hasAny = function() {
		return _animations.length;
	}

	/**
	 * Draws all Animations
	 */
	var drawAll = function() {
		for (var i = 0; i < _animations.length; i++) {
			var animation = _animations[i];
			var start_alpha = 0.5;
			g_context.globalAlpha = start_alpha * (_ANIMATION_MAX_TIME - animation.timer) / (_ANIMATION_MAX_TIME);
			MtImage.draw(animation.image, animation.x, animation.y, animation.angle);
			g_context.globalAlpha = 1.0;
		}
	};

	// Export:
	return {
		init: init,
		create: create,
		updateAll: updateAll,
		drawAll: drawAll,
		hasAny: hasAny,
	};
})();
