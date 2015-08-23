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
