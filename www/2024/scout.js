"use strict"

$(document).ready(function(){

	$('.onstage-state').click(toggleOnstage)

	function toggleOnstage(){
		var onstage = $('#onstage-input').prop('checked')
		$('#not-onstage').toggle(!onstage)
		$('#is-onstage').toggle(onstage)
	}

	var cycles = []
	var cycle
	cycleInterrupt()

	$('.placement').click(function(){
		cycleStage("placement")
	})

	$('.collectSource').click(function(){
		cycleStage("collect")
	})

	setInterval(function(){
		$('#currentCycleTimer').text(":" + ((""+Math.round((cycle.startTime==0?0:(Date.now()-cycle.startTime))/1000)).padStart(2, "0")))
	}, 100)

	function cycleStage(place){
		if (cycle.stage==0 || cycle.lastPlace==place){
			cycle.stage = 1
			cycle.startTime = Date.now()
		} else if (cycle.stage==1){
			cycle.stage = 2
		} else {
			var cycleTime = Math.round((Date.now() - cycle.startTime)/1000)
			if (cycleTime >= 7){ // Faster than seven seconds is not possible, scouter error.
				cycles.push(cycleTime)
				$('input[name="full_cycle_fastest_seconds"]').val(Math.min(...cycles))
				$('input[name="full_cycle_average_seconds"]').val(Math.round(cycles.reduce((a,b) => a + b, 0) / cycles.length))
				$('input[name="full_cycle_count"]').val(cycles.length)
			}
			cycle.stage = 1
			cycle.startTime = Date.now()
		}
		cycle.lastPlace = place
	}

	onShowScouting.push(function(){
		cycleInterrupt()
		cycles=[]
		toggleOnstage()
		return true
	})

	function cycleInterrupt(){
		cycle = {
			startTime: 0,
			lastPlace: "",
			stage: 0
		}
	}

	$('.count,button,label').click(function(){
		if (!$(this).is('.placement,.collectSource')) cycleInterrupt()
	})
})
