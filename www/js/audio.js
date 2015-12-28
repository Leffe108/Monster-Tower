/*
 * Audio play functions
 */

/* exported PlaySoundEffect */

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
