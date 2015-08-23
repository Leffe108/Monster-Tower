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
