
function MoneyInit() {
	g_bank_balance = 10000;
}

function TryBuy(cost) {
	if (cost <= g_bank_balance) {
		g_bank_balance -= cost;
		AnimateCost();
		return true;
	} else {
		return false;
	}
}

function AnimateCost() {
	g_animations.push(new Animation('cost', g_canvas.width - 64, g_canvas.height - 32));
}
function AnimateIncome() {
	g_animations.push(new Animation('money', g_canvas.width - 64, g_canvas.height - 32));
}

function UpdateMoney(time) {

	// g_simulation_time repeat incrementing [0, 60*24] each day, but this works still
	var prev = Math.floor((g_simulation_time - time) / (24 * 60));
	var now = Math.floor((g_simulation_time / (24 *60))); 
	if (g_simulation_time - time < 0) {
		// New date

		var balance_change = 0;
		for(floor_num in g_room_floors) {
			var floor_data = g_room_floors[floor_num];
			for (var i = 0; i < floor_data.length; i++) {
				var room_data = floor_data[i];
				
				balance_change -= room_data.def.maint_cost;
				if (room_data.state !== ROOM_STATE_FOR_RENT) {
					balance_change += room_data.def.rent_income;
				}
			}
		}

		if (balance_change < 0) {
			AnimateCost();
		} else if (balance_change > 0) {
			AnimateIncome();
		}

		g_bank_balance += balance_change;
	}
}
