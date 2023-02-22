$(document).ready(function(){
    var data = {},
    types = ["alliances","event","pit","schedule","scouting"],
    teams = []
    types.forEach(function(csv){
        var file = `/data/${eventId}.${csv}.csv`
	    eventAjax(file ,function(text){
            if (csv=='schedule'){
                var teamMap = {}
                text.match(/\b[0-9]{4,}\b/g).forEach(function(team){
                    teamMap[team]=1
                })
                teams = Object.keys(teamMap)
                teams.forEach(function(team){
                    ["","-top"].forEach(function(suffix){
                        var image = `/data/${eventYear}/${team}${suffix}.jpg`
                        toDataURL(image, function(dataUrl) {
                            data[image] = dataUrl
                        })
                    })
                })
            }
            data[file] = text||""
        })
    })
    $('#siteSite').change(function(){
        var url = $('#siteSite').val()
        if (!url) url = "webscout.example.com"
        if (!/^https?\:\/\//.test(url)) url = "https://" + url
        url += "/admin/import.cgi"
        $('#transferForm').attr('action',url)
    })
    function done(){
        if (Object.keys(data).length != types.length + teams.length*2){
            setTimeout(done,100)
            return
        }
        Object.keys(data).forEach(function(key){
            if (!data[key]) delete data[key]
        })
        data = JSON.stringify(data)
        $('#download')
            .attr('href', window.URL.createObjectURL(new Blob([data], {type: 'text/json;charset=utf-8'})))
            .attr('download',`${eventId}.json`)
        $('#transferJson').val(data)
    }
    done()
})

// https://stackoverflow.com/a/20285053
function toDataURL(url, callback){
    var xhr = new XMLHttpRequest()
    xhr.onload = function(){
        var reader = new FileReader()
        reader.onloadend = function(){
            var url = reader.result
            if (!url.startsWith("data:image/jpeg;base64")) url = ""
            callback(url)
        }
        reader.readAsDataURL(xhr.response)
    }
    xhr.open('GET', url)
    xhr.responseType = 'blob'
    xhr.send()
}
  