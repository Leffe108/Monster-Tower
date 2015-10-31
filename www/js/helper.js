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

/**
 * From: https://github.com/angular/angular.js/blob/v1.3.14/src/ngSanitize/sanitize.js#L435
 * Escapes all potentially dangerous characters, so that the
 * resulting string can be safely inserted into attribute or
 * element text.
 * @param value
 * @returns {string} escaped text
 */
function EncodeEntities(value) {
	// Regular Expressions for parsing tags and attributes
	var SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
		// Match everything outside of normal chars and " (quote character)
		NON_ALPHANUMERIC_REGEXP = /([^\#-~ |!])/g;

	return value.
		replace(/&/g, '&amp;').
		replace(SURROGATE_PAIR_REGEXP, function(value) {
			var hi = value.charCodeAt(0);
			var low = value.charCodeAt(1);
			return '&#' + (((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000) + ';';
		}).
		replace(NON_ALPHANUMERIC_REGEXP, function(value) {
			return '&#' + value.charCodeAt(0) + ';';
		}).
		replace(/</g, '&lt;').
		replace(/>/g, '&gt;');
}
