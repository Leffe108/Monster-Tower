/*
 * Monitor the game and decides how far you reached
 */

var GameLevel = (function() {

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
	 *
	 * @note When adding new items, don't forget to update IsValidGameWinLose function
	 */
	var GWL_GAME_OVER = 0;   // You lost
	var GWL_NORMAL_PLAY = 1; // Game started. You didn't lose nor win yet
	var GWL_WON = 10;         // You won. Shows winning screen
	var GWL_WON_CONTINUE_PLAY = 11; // Continue to play (hide winning screen)

	/*
	 * The Game Star Level (GSL) start at GSL_NO_STAR and can then progress
	 * to max number of stars
	 *
	 * @note When adding new items, don't forget to update IsValidGameStarLevel function
	 */
	var GSL_NO_STAR = 0;
	var GSL_STAR1 = 1; // Code assumes that STAR1 is 1, STAR2 is 2 etc. in generic code
	var GSL_STAR2 = 2;
	var GSL_STAR3 = 3;


	var init = function() {
		g_game_win_lose = GWL_NORMAL_PLAY;
		g_game_star_level = GSL_NO_STAR;
	};

	var update = function(time) {
		// Update Win/Lose
		if (g_game_win_lose == GWL_WON_CONTINUE_PLAY) return;

		if (g_bank_balance < -10000) {
			g_game_win_lose = GWL_GAME_OVER;
		}

		if (g_game_win_lose > GWL_GAME_OVER) {
			if (Building.getBuildingHeight() >= WIN_GAME_MIN_FLOORS) {
				g_game_win_lose = GWL_WON;
			}
		}

		// Update stars
		switch (g_game_star_level) {
			case GSL_NO_STAR:
				if (Room.getRentedCount('office') >= STAR1_MIN_OFFICE_RENTED) {
					_setGameStarLevel(g_game_star_level + 1);
				}
				break;
			case GSL_STAR1:
				if (Room.getRentedCount('office') >= STAR2_MIN_OFFICE_RENTED &&
						Room.getRentedCount('cafeteria') >= STAR2_MIN_CAFETERIA &&
						Building.getBuildingHeight() >= STAR2_MIN_FLOORS) {
					_setGameStarLevel(g_game_star_level + 1);
				}
				break;
			case GSL_STAR2:
				if (Room.getRentedCount('office') >= STAR3_MIN_OFFICE_RENTED &&
						Room.getRentedCount('cafeteria') >= STAR3_MIN_CAFETERIA &&
						Room.getRentedCount('flower-shop') >= STAR3_MIN_FLOWER_SHOP &&
						Building.getBuildingHeight() >= STAR3_MIN_FLOORS) {
					_setGameStarLevel(g_game_star_level + 1);
				}
				break;
			case GSL_STAR3:
				break;
			default:
				break;
		}
	};

	var _setGameStarLevel = function(star_level) {
		g_game_star_level = star_level;
		var stars = g_game_star_level;
		var s = stars >= 2 || stars === 0 ? 's' : '';
		if (stars > 0) {
			Gui.showWindow(Gui.getMessageWindow('You leveled up!', ['Your monster tower now have ' + stars + ' star' + s]));
			PlaySoundEffect('new-star');
		}

		// Build toolbar may change due to new rooms being available
		RebuildToolbars();
	};

	var isGameOver = function() {
		return g_game_win_lose === GWL_GAME_OVER;
	};

	/**
	 * Is game won, but not (yet) continued to play?
	 */
	var isGameWon = function() {
		return g_game_win_lose === GWL_WON;
	};

	/**
	 * Continue play after winning the game
	 */
	var wonContinuePlay = function() {
		assert(g_game_win_lose === GWL_WON);
		g_game_win_lose = GWL_WON_CONTINUE_PLAY;
	}

	/**
	 * Validate if given value is a valid Game Win Lose value
	 */
	var isValidGameWinLose = function(value) {
		if (typeof value !== 'number') return false;
		return [
			GWL_GAME_OVER,
			GWL_NORMAL_PLAY,
			GWL_WON,
			GWL_WON_CONTINUE_PLAY,
		].indexOf(value) !== -1;
	};

	/**
	 * Validate if given value is a valid Game Star Level value.
	 */
	var isValidGameStarLevel = function(value) {
		if (typeof value !== 'number') return false;
		return [
			GSL_NO_STAR,
			GSL_STAR1,
			GSL_STAR2,
			GSL_STAR3,
		].indexOf(value) !== -1;
	};

	// Export:
	return {
		/* enum consts */
		STAR1_MIN_OFFICE_RENTED: STAR1_MIN_OFFICE_RENTED,

		STAR2_MIN_OFFICE_RENTED: STAR2_MIN_OFFICE_RENTED,
		STAR2_MIN_CAFETERIA: STAR2_MIN_CAFETERIA,
		STAR2_MIN_FLOORS: STAR2_MIN_FLOORS,

		STAR3_MIN_OFFICE_RENTED: STAR3_MIN_OFFICE_RENTED,
		STAR3_MIN_CAFETERIA: STAR3_MIN_CAFETERIA,
		STAR3_MIN_FLOWER_SHOP: STAR3_MIN_FLOWER_SHOP,
		STAR3_MIN_FLOORS: STAR3_MIN_FLOORS,

		WIN_GAME_MIN_FLOORS: WIN_GAME_MIN_FLOORS,

		GSL_NO_STAR: GSL_NO_STAR,
		GSL_STAR1: GSL_STAR1,
		GSL_STAR2: GSL_STAR2,
		GSL_STAR3: GSL_STAR3,

		/* functions */
		init: init,
		update: update,

		isGameOver: isGameOver,
		isGameWon: isGameWon,
		wonContinuePlay: wonContinuePlay,
		isValidGameWinLose: isValidGameWinLose,

		isValidGameStarLevel: isValidGameStarLevel,
	}
})();
