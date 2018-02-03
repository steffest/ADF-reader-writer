var AdfViewer = function(){
	var me = {};

	var currentSector;
	var currentFile;

	me.load = function(url){
		if (!url) url = el("diskurl").value;

		if (typeof url == "string"){
			if (url == "") return;
		}

		adf.loadDisk(url,function(success){
			if (success){
				var info = adf.getInfo();
				if (info.diskFormat == "DOS"){
					el("feedback").style.display = "none";
					el("folder").style.display = "block";
					me.showRoot();
				}else{
					el("feedback").innerHTML = "This does not seem to be an AmigaDOS disk";
					el("feedback").style.display = "block";
				}
			}else{
				el("feedback").innerHTML = "This does not seem to be a standard Amiga DD disk file";
				el("feedback").style.display = "block";
			}
		});
	};

	function listFolder(folder){

		var container = el("list");
		container.innerHTML = "";

		var path = adf.getInfo().label;
		if (folder.parent){
			container.appendChild(createListItem({
				sector: folder.parent,
				name: "..",
				type: "DIR"
			}));
			path += "/" + folder.name;
		}

		el("disklabel").innerHTML = path;


		function sortByName(a,b) {
			if (a.name < b.name)
				return -1;
			if (a.name > b.name)
				return 1;
			return 0;
		}
		folder.folders.sort(sortByName);
		folder.files.sort(sortByName);


		folder.folders.forEach(function(f){
			container.appendChild(createListItem(f));
		});

		folder.files.forEach(function(f){
			container.appendChild(createListItem(f));
		});

		showInfo(folder);
	}

	function createListItem(f){
		var item = document.createElement("div");
		item.className = "listitem " + f.type;

		var icon = document.createElement("i");
		icon.className = "fa fa-folder";

		var label = document.createElement("span");
		label.className = "label";
		label.innerHTML = f.name;

		var size;
		if (f.type == "FILE"){
			icon.className = "fa fa-file-o";

			size = document.createElement("span");
			size.className = "size";
			size.innerHTML = formatSize(f.size);
		}

		item.onclick = function(){
			if (f.type == "FILE"){
				showInfo(f);
			}else{
				var dir = adf.readFolderAtSector(f.sector);
				listFolder(dir);
			}

		};

		item.appendChild(icon);
		item.appendChild(label);
		if (size) item.appendChild(size);

		return item;
	}

	function showInfo(f){
		var container = el("fileinfo");

		var content = "";
		content += '<h3>' + f.name + '</h3><div class="info"><table border="0" cellspacing="0" cellpadding="2" width="100%">';
		content += "<tr><td>Type:</td><td>" + f.type + "</td></tr>";

		if (f.size) content += "<tr><td>Size:</td><td>" + formatSize(f.size) + "</td></tr>";
		if (f.comment) content += "<tr><td>Comment:</td><td>" + f.comment + "</td></tr>";
		if (f.lastChangeDays && f.lastChangeDays>1000){
			content += "<tr><td>LastChanged:</td><td>" + formatDateTime(f.lastChangeDays,f.lastChangeMinutes,f.lastChangeTicks) + "</td></tr>";
		}

		content += "</table>";


		if (f.type == "FILE"){
			currentFile=f;
			content += "<h4>Actions</h4>";
			content += '<div class="action" onclick="AdfViewer.showAscii('+f.sector+')">Show as text</div>';
			content += '<div class="action" onclick="AdfViewer.showHex('+f.sector+')">Show as hex</div>';
			content += '<div class="action" onclick="AdfViewer.download('+f.sector+')">Download</div>';
			content += '<div id="filetypeactions"></div>';
		}

		content += "</div>";
		container.innerHTML = content;

		if (f.type == "FILE"){
			var fileType = AdfViewer.detectFileType(f.sector);
			console.log(fileType);

			if (fileType){
				container = el("filetypeactions");
				var info = fileType.name;
				if (fileType.info) info += "<br>" + fileType.info;
				var intro = "This is a";
				if (["a","e","i","o","u"].indexOf(info.substr(0,1).toLowerCase())>=0) intro+="n";

				container.innerHTML = intro + " " + info;
				if (fileType.actions){
					fileType.actions.forEach(function(action){
						var div = document.createElement("div");
						div.innerHTML = action;
						div.className = "action";
						div.onclick = function(){fileType.handler.handle(fileType.file,action)};
						container.appendChild(div);
					});
				}
			}
		}
	}

	function el(id){
		return document.getElementById(id);
	}

	function formatSize(size){
		var result = Math.round(size / 1024);
		if (result == 0) result = 1;
		return result + " kb";
	}

	function formatDateTime(days,minutes,ticks){
		var start = 252457200000; // 1 jan 1978;
		var monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

		// ticks = 50 ticks a second
		var d = new Date(start + (days * 86400000) + (minutes * 3600000) + (ticks * 50000));
		var m = d.getMinutes();
		var h = d.getHours();
		if (m<10) m = "0" + m;
		if (h<10) m = "0" + h;
		return d.getDate() + " " + monthNames[d.getMonth()] + " " + d.getFullYear() + " " + h + ":" + m;
	}

	me.showAscii = function(sector){
		showFile(sector,true);
	};

	me.showHex = function(sector){
		showFile(sector,false);
	};

	me.showImage = function(image){
		showImage(image);
	};

	me.detectFileType = function(sector){
		var file = adf.readFileAtSector(sector,true);
		return FileType.detect(file.content);
	};

	function showFile(sector,asAscii){
		currentSector = sector;
		var file = adf.readFileAtSector(sector,true);

		el("filelabel").innerHTML = file.name;

		el("file").style.display = "block";
		el("folder").style.display = "none";
		el("canvas").className = "hidden";

		var hex = el("hex");
		var ascii = el("ascii");
		hex.className = asAscii ? "ascii" : "hex";
		ascii.className = asAscii ? "ascii" : "hex";

		var s = "";
		var a = "";

		for (var i = 1; i<= file.size; i++){
			var eol = "";
			if (i%16 == 0) eol = "\n";
			var b = file.content[i-1];
			s += formatHex(b) + " " + eol;
			a += String.fromCharCode(b);
			if (!asAscii) (a += " " + eol);
		}

		hex.value = s;
		ascii.value = a;
	}

	function showImage(image){
		el("filelabel").innerHTML = currentFile.name;

		el("file").style.display = "block";
		el("folder").style.display = "none";
		el("hex").className = "hidden";
		el("ascii").className = "hidden";

		if (image){
			var canvas = el("canvas");
			var ctx = canvas.getContext("2d");
			ctx.fillStyle = "black";
			ctx.fillRect(0,0,canvas.width,canvas.height);
			el("canvas").className = "";

			var w = canvas.width;
			var h = w * (image.height/image.width);

			if (h>canvas.height){
				h = canvas.height;
				w = h * (image.width/image.height);
			}
			var x = (canvas.width - w)>>1;
			var y = (canvas.height - h)>>1;

			ctx.imageSmoothingEnabled= false;
			ctx.drawImage(image,x,y,w,h);
		}
	}


	me.showFolder = function(){
		el("file").style.display = "none";
		el("folder").style.display = "block";
		el("raw").style.display = "none";
	};

	me.showRoot = function(){
		listFolder(adf.readRootFolder());
	};

	me.download = function(sector){
		sector = sector || currentSector;
		var file = adf.readFileAtSector(sector,true);


		var b = new Blob([file.content], {type: "application/octet-stream"});

		var fileName = file.name;
		saveAs(b,fileName);
	};

	me.showSector = function(sector){
		currentSector = sector || 0;

		if (isNaN(currentSector)) currentSector = 0;
		if (currentSector<0) currentSector=0;
		if (currentSector>=1760) currentSector = 1759;

		el("sector").value = currentSector;
		el("sectorinfo").innerHTML = adf.getSectorType(sector);

		el("file").style.display = "none";
		el("folder").style.display = "none";
		el("raw").style.display = "block";

		var content = adf.readSector(currentSector);

		var hex = el("sectorhex");
		var ascii = el("sectorascii");

		var s = "";
		var a = "";

		for (var i = 1; i<= content.length; i++){
			var eol = "";
			if (i%16 == 0) eol = "\n";
			var b = content[i-1];
			s += formatHex(b) + " " + eol;
			a += String.fromCharCode(b) + " " + eol;
		}

		hex.value = s;
		ascii.value = a;

	};

	me.nextSector = function(){
		me.showSector(++currentSector);
	};
	me.prevSector = function(){
		me.showSector(--currentSector);
	};
	me.onSectorUpdate = function(){
		var value = el("sector").value;
		if (isNaN(value)) value = 0;
		if (value != currentSector) me.showSector(value);
	};

	me.handleDragEnter = function(e){
		e.stopPropagation();
		e.preventDefault();
		el("dropzone").className = "over";
	};

	me.handleDragOver = function(e){
		e.stopPropagation();
		e.preventDefault();
	};

	me.handleDrop = function(e){
		e.stopPropagation();
		e.preventDefault();

		var dt = e.dataTransfer;
		var files = dt.files;

		if (files.length){
			var file = files[0];

			var reader = new FileReader();
			reader.onload = function(){
				me.load(reader.result);
			};
			reader.readAsArrayBuffer(file);
		}
	};

	function formatHex(nr){
		var result = nr.toString(16).toUpperCase();
		if (result.length<2) result = "0" + result;
		return result;
	}

	return me;
}();



function getUrlParameter(param){
	if (window.location.getParameter){
		return window.location.getParameter(param);
	} else if (location.search) {
		var parts = location.search.substring(1).split('&');
		for (var i = 0; i < parts.length; i++) {
			var nv = parts[i].split('=');
			if (!nv[0]) continue;
			if (nv[0] == param) {
				return nv[1] || true;
			}
		}
	}
}

function loadScript(url,next){
	var s = document.createElement('script');
	s.type = 'application/javascript';
	s.src = url;
	s.addEventListener('error', function(){
		console.error("Failed loading script " + url);
	}, false);
	s.addEventListener('load', function(){
		if (next) next();
	}, false);
	document.getElementsByTagName('head')[0].appendChild(s);
}
