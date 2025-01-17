"use strict"

$.ajaxSetup({
	cache: true
});

var eventId=(location.hash.match(/^\#(?:(?:.*\&)?(?:(?:file|event)\=))?(20[0-9]{2}[a-zA-Z0-9\-]+)(?:\.[a-z\.]+)?(?:\&.*)?$/)||["",""])[1],
eventYear = eventId.replace(/([0-9]{4}).*/,'$1'),
eventVenue = eventId.replace(/[0-9]{4}(.*)/,'$1'),
eventName = eventYear+(eventYear?" ":"")+eventVenue,
eventMatches,
eventAlliances,
eventStats,
eventStatsByTeam={},
eventStatsByMatchTeam={},
eventScores,
eventFiles,
eventTeams,
eventInfo,
eventPitData,
eventSubjectiveData,
eventTeamsInfo,
BOT_POSITIONS = ['R1','R2','R3','B1','B2','B3'],
MATCH_TYPE_SORT = {
	'pm':'00',
	'qm':'01',
	'qf':'02',
	'sf':'03',
	'1p':'04',
	'2p':'05',
	'3p':'06',
	'4p':'07',
	'5p':'08',
	'sf':'09',
	'f':'10',
}

if (eventId && eventId != localStorage.getItem("last_event_id")){
	localStorage.setItem("last_event_id", eventId)
	localStorage.setItem("last_event_name", eventName)
	localStorage.setItem("last_event_year", eventYear)
}

function eventAjax(file,callback){
	$.ajax({
		async: true,
		beforeSend: function(xhr){
			xhr.overrideMimeType("text/plain;charset=UTF-8");
		},
		url: file,
		timeout: 5000,
		type: "GET",
		success: callback,
		error: function(xhr,status,err){
			console.error(file,err)
			callback("")
		}
	})
}

function csvToArrayOfMaps(csv){
	var arr = []
	var lines = csv.split(/[\r\n]+/)
	if (lines.length>0){
		var headers = lines.shift().split(/,/)
		for(var i=0; i<lines.length; i++){
			if (lines[i]){
				var data = lines[i].split(/[,]/).map(s=>s.trim())
				var map = {}
				for (var j=0; j<data.length; j++){
					map[headers[j]] = /^[0-9]+$/.test(data[j])?parseInt(data[j]):unescapeField(data[j])
				}
				arr.push(map)
			}
		}
	}
	return arr
}

function unescapeField(s){
	return s
		.replace(/⏎/g, "\n")
		.replace(/״/g, "\"")
		.replace(/،/g, ",")
}

function scheduleSortKey(match){
	var event = match.event,
	id = match.Match,
	m = id.match(/^(pm|qm|qf|sf|(?:[1-5]p)|f)([0-9]+)$/)
	if (!m) return match
	return event + "---" + MATCH_TYPE_SORT[m[1]] + "---" + m[2].padStart(12,'0')
}

function loadEventSchedule(callback){
	if (eventMatches){
		if (callback) callback(eventMatches)
		return
	}
	eventAjax(`/data/${eventId}.schedule.csv`,function(text){
		eventMatches=csvToArrayOfMaps(text)
		eventMatches.sort((a,b)=>scheduleSortKey(a).localeCompare(scheduleSortKey(b)))
		var teams = {}
		for (var i=0; i<eventMatches.length; i++){
			for (var j=0; j<BOT_POSITIONS.length; j++){
				teams[eventMatches[i][BOT_POSITIONS[j]]] = 1
			}
		}
		eventTeams = Object.keys(teams).map(t=>parseInt(t)).sort((a,b)=>{a-b})
		if (callback) callback(eventMatches)
	})
}

function loadTeamsInfo(callback){
	loadEventSchedule(function(){
		if (eventTeamsInfo){
			if (callback) callback(eventTeamsInfo)
			return
		}
		eventTeamsInfo={}
		$.getJSON(`/data/${eventId}.teams.json`, function(json){
			json.teams.forEach(function(team){
				eventTeamsInfo[parseInt(team.teamNumber)] = team
			})
		}).always(function(){
			if (callback) callback(eventTeamsInfo)
		})
	})
}

function loadEventScores(callback){
	loadEventSchedule(function(){
		if (eventScores){
			if (callback) callback(eventScores)
			return
		}
		eventScores={}
		$.getJSON(`/data/${eventId}.scores.qualification.json`, function(json){
			json.MatchScores.forEach(function(score){
				eventScores[`qm${score.matchNumber}`] = score
			})
		}).always(function(){
			$.getJSON(`/data/${eventId}.scores.playoff.json`, function(json){
				eventMatches.forEach(function(match){
					if (!/^pm|qm/.test(match.Match)){
						eventScores[match.Match] = json.MatchScores.shift()
					}
				})
			}).always(function(){
				if (callback) callback(eventScores)
			})
		})
	})
}

function loadAlliances(callback){
	if (eventAlliances){
		if (callback) callback(eventAlliances)
		return
	}
	eventAjax(`/data/${eventId}.alliances.csv`,function(text){
		eventAlliances=csvToArrayOfMaps(text)
		if (callback) callback(eventAlliances)
	})
}

function loadEventStats(callback, includePractice){
	if (eventStats){
		if (callback) callback(eventStats, eventStatsByTeam, eventStatsByMatchTeam)
		return
	}
	if (eventYear && eventId){
		$.getScript(`/${eventYear}/aggregate-stats.js`, function(){
			eventAjax(`/data/${eventId}.scouting.csv`,function(text){
				eventStats=csvToArrayOfMaps(text)
				aggregateAllEventStats(includePractice)
				if (callback) callback(eventStats, eventStatsByTeam, eventStatsByMatchTeam)
			})
		})
	}
}

function haveNonPracticeMatchForEachTeam(){
	var practiceTeams = {}
	forEachTeamMatch(function(team,match){
		if (/^pm[0-9]+$/.test(match))practiceTeams[team]=1
	})
	forEachTeamMatch(function(team,match){
		if (!/^pm[0-9]+$/.test(match))delete practiceTeams[team]
	})
	return Object.keys(practiceTeams).length == 0
}

function forEachTeamMatch(callback){
	eventStats.forEach(function(scout){
		callback(scout['team'],scout['match'],scout)
	})
}

function matchHasTeam(m,t){
	if (!m || !t) return false
	return !!(BOT_POSITIONS.reduce((sum,pos)=>sum+(m[pos]==t?1:0),0))
}

function matchScoutingDataCount(m){
	if (!m) return false
	return BOT_POSITIONS.reduce((sum,pos)=>sum+(eventStatsByMatchTeam[`${m.Match}-${m[pos]}`]?1:0),0)
}

var statsIncludePractice = true

function aggregateAllEventStats(includePractice){
	if (typeof includePractice != "boolean"){
		includePractice=!haveNonPracticeMatchForEachTeam()
	}
	statsIncludePractice = includePractice
	$('.aggregationIncludesPractice').text(includePractice?"include":"exclude")
	eventStatsByTeam = {}
	eventStatsByMatchTeam = {}
	forEachTeamMatch(function(team,match,scout){
		if (!/^pm[0-9]+$/.test(match) || includePractice){
			var aggregate = eventStatsByTeam[team] || {}
			aggregateStats(scout, aggregate)
			eventStatsByTeam[team] = aggregate
		} else {
			aggregateStats(scout, {})
		}
		var mt=`${match}-${team}`
		scout.old=eventStatsByMatchTeam[mt]
		eventStatsByMatchTeam[mt]=scout
	})
}

function loadEventFiles(callback){
	if (eventFiles){
		if (callback) callback(eventFiles)
		return
	}
	eventAjax(`/event-files.cgi?event=${eventId}`,function(text){
		eventFiles=text.split(/[\n\r]+/).filter(x=>/\./.test(x))
		if (callback) callback(eventFiles)
	})
}

function loadEventInfo(callback){
	if (eventInfo){
		if (callback) callback(eventInfo)
		return
	}
	eventAjax(`/data/${eventId}.event.csv`,function(text){
		if (text){
			eventInfo = csvToArrayOfMaps(text)[0]
			if (eventInfo.name)	eventName = (eventInfo.name.includes(eventYear)?"":`${eventYear} `)+eventInfo.name
		} else {
			eventInfo = []
		}
		localStorage.setItem("last_event_name", eventName)
		if (callback) callback(eventInfo)
	})
}

function loadPitScouting(callback){
	if (eventPitData){
		if (callback) callback(eventPitData)
		return
	}
	eventAjax(`/data/${eventId}.pit.csv`,function(text){
		eventPitData = {}
		csvToArrayOfMaps(text).forEach(function(teamData){
			eventPitData[teamData.team]=teamData
		})
		if (callback) callback(eventPitData)
	})
}

function loadSubjectiveScouting(callback){
	if (eventSubjectiveData){
		if (callback) callback(eventSubjectiveData)
		return
	}
	eventAjax(`/data/${eventId}.subjective.csv`,function(text){
		eventSubjectiveData = {}
		csvToArrayOfMaps(text).forEach(function(teamData){
			eventSubjectiveData[teamData.team]=teamData
		})
		if (callback) callback(eventSubjectiveData)
	})
}

function getUploads(){
	var uploads = []
	var year = eventId.substring(0,4)
	for (var i in localStorage){
		if (new RegExp(`^${year}.*_.*_`).test(i)) {
			uploads.push(localStorage.getItem(i))
		}
	}
	return uploads
}

function getMatchName(matchId){
	return matchId
		.replace(/^pm/, "Prac­tice ")
		.replace(/^qm/, "Qual­ific­ation ")
		.replace(/^qf/, "Quar­ter-final ")
		.replace(/^sf/, "Semi-final ")
		.replace(/^1p/, "Play­offs first round ")
		.replace(/^2p/, "Play­offs second round ")
		.replace(/^3p/, "Play­offs third round ")
		.replace(/^4p/, "Play­offs fourth round ")
		.replace(/^5p/, "Play­offs fifth round ")
		.replace(/^f/, "Final ")
}

function getShortMatchName(matchId){
	return matchId
		.replace(/^pm/, "Prac ")
		.replace(/^qm/, "Qual ")
		.replace(/^qf/, "QF ")
		.replace(/^sf/, "SF ")
		.replace(/^1p/, "Play­off R1 M")
		.replace(/^2p/, "Play­off R2 M")
		.replace(/^3p/, "Play­off R3 M")
		.replace(/^4p/, "Play­off R4 M")
		.replace(/^5p/, "Play­off R5 M")
		.replace(/^f/, "Final ")
}
