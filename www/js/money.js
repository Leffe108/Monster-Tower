/**
 * Module: Money
 */

/* global Animation, Room, RoomType, g_bank_balance:true, g_simulation_time, g_room_floors, g_stair_floors, g_canvas */

/* exported Money */
var Money = (function() {

	var init = function() {
		g_bank_balance = 10000;
	};

	var update = function(time) {
		// g_simulation_time repeat incrementing [0, 60*24] each day
		if (g_simulation_time - time < 0) {
			// New date

			var balance_change = 0;
			var floor_containers = [g_room_floors, g_stair_floors];
			for (var i_fc = 0; i_fc < floor_containers.length; i_fc++) {
				var floor_container = floor_containers[i_fc];
				for(var floor_num in floor_container) {
					var floor_data = floor_container[floor_num];
					for (var i = 0; i < floor_data.length; i++) {
						var room_data = floor_data[i];

						// Only charge once for each elevator
						if (RoomType.isElevator(room_data.def.id) && room_data.pieceName !== 'top') {
							continue;
						}

						balance_change -= room_data.def.maint_cost;
						if (room_data.state !== Room.ROOM_STATE_FOR_RENT) {
							balance_change += room_data.def.rent_income;
						}
					}
				}
			}

			if (balance_change < 0) {
				animateCost();
			} else if (balance_change > 0) {
				animateIncome();
			}

			g_bank_balance += balance_change;
		}
	};

	var tryBuy = function(cost) {
		if (cost <= g_bank_balance) {
			g_bank_balance -= cost;
			animateCost();
			return true;
		} else {
			return false;
		}
	};

	var animateCost = function () {
		Animation.create('cost', g_canvas.width - 64, g_canvas.height - 32);
	};
	var animateIncome = function() {
		Animation.create('money', g_canvas.width - 64, g_canvas.height - 32);
	};

	// Export:
	return {
		init: init,
		update: update,

		tryBuy: tryBuy,
		animateCost: animateCost,
		animateIncome: animateIncome,
	};
})();
