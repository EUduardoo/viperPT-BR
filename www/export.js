"use strict"

function onLocalJs(){
	;(localStorage.getItem("transferHosts")||"").split(",").forEach(addHost)
	if (window.transferHosts) window.transferHosts.forEach(addHost)
	addHost('localhost')
}

function addHost(host){
	if (host && !$(`#hostOptions option[value="${host}"]`).length){
		$('#hostOptions').append($('<option>').attr('value',host))
	}
}

$(document).ready(function(){
	var dataFull = {},
	dataText = {},
	fullFileCount = -1,
	textFileCount = -1
	loadEventFiles(function(fileList){
		fullFileCount = fileList.length
		var textFiles = 0
		fileList.forEach(file=>{
			if (/\.jpg$/.test(file)){
				toDataURL(file, function(dataUrl) {
					dataFull[file] = dataUrl
				})
			} else {
				textFiles++
				eventAjax(file ,function(text){
					dataFull[file] = text||""
					dataText[file] = text||""
				})
			}
		})
		textFileCount = textFiles
	})
	$('.siteInput').change(function(){
		var url = $(this).val()
		if (/^((https?\/\/)?)([a-zA-Z0-9\-\.\:]+)(\/?)$/.test(url)){
			var hosts = (localStorage.getItem("transferHosts")||"").split(/,/),
			hostList = hosts.reduce((m,o)=>(m[o]=o,m),{})
			if (!hostList.hasOwnProperty(url)){
				hosts.push(url)
				hosts = hosts.slice(-5)
				localStorage.setItem("transferHosts",hosts.join(","))
			}
			addHost(url)
		}
		if (!url) url = "webscout.example.com"
		if (!/^https?\:\/\//.test(url)){
			var prefix = "http"
			if (/\./.test(url)) prefix="https" // fully qualified domain
			if (/^[0-9\.\:]+$/.test(url)) prefix="http" // IP address
			url = `${prefix}://${url}`
		}
		url = url.replace(/\/$/,"")
		url += "/admin/import.cgi"
		$(this).closest('form').attr('action',url)
	})
	$('#showInstructions').click(function(){
		showLightBox($('#instructions'))
		return false
	})
	$('title,h1').each(function(){
		$(this).text($(this).text().replace(/EVENT/, eventName))
	})
	function fullDataLoaded(){
		if (Object.keys(dataFull).length != fullFileCount){
			setTimeout(fullDataLoaded,100)
			return
		}
		var json = JSON.stringify(dataFull)
		$('#downloadImages')
			.attr('href', window.URL.createObjectURL(new Blob([json], {type: 'text/json;charset=utf-8'})))
			.attr('download',`${eventId}.full.json`)
		$('#transferJsonImages').val(json)
	}
	fullDataLoaded()
	function textDataLoaded(){
		if (Object.keys(dataText).length != textFileCount){
			setTimeout(textDataLoaded,100)
			return
		}
		var json = JSON.stringify(dataText)
		$('#downloadData')
			.attr('href', window.URL.createObjectURL(new Blob([json], {type: 'text/json;charset=utf-8'})))
			.attr('download',`${eventId}.dat.json`)
		$('#transferJsonData').val(json)
	}
	textDataLoaded()
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
