var AdfViewer = function(){
    var me = {};

    var currentSector;
    var files;
    var fileIndex;
    var diskIcon = '<i class="fa fa-floppy-o"></i> ';

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
                    el("filemanager").style.display = "block";
                    me.showRoot();
                }else{
                    el("feedback").innerHTML = 'Sorry, This does not seem to be an AmigaDOS disk<br><div class="button">OK</div>';
                    el("feedback").style.display = "block";
                }
            }else{
                el("feedback").innerHTML = 'This does not seem to be a standard Amiga DD disk file<br><div class="button">OK</div>';
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
            content += "<h4>Actions</h4>";
            content += '<div class="action" onclick="AdfViewer.showAscii('+f.sector+')">Show as text</div>';
            content += '<div class="action" onclick="AdfViewer.showHex('+f.sector+')">Show as hex</div>';
            content += '<div class="action" onclick="AdfViewer.download('+f.sector+')">Download</div>';
        }

        content += "</div>";
        container.innerHTML = content;
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

    function showFile(sector,asAscii){
        currentSector = sector;
        var file = adf.readFileAtSector(sector,true);

        el("filelabel").innerHTML = file.name;

        el("file").style.display = "block";
        el("folder").style.display = "none";

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
        el("dropzone").classList.add("over");
    };

    me.handleDragLeave = function(e){
        e.stopPropagation();
        e.preventDefault();
        el("dropzone").classList.remove("over");
    };

    me.handleDragOver = function(e){
        e.stopPropagation();
        e.preventDefault();
    };

    me.handleDrop = function(e){
        e.stopPropagation();
        e.preventDefault();
        el("dropzone").classList.remove("over");
        el("dropzone").classList.add("small");

        var dt = e.dataTransfer;
        files = dt.files;
        var filelist = el("filelist");

        el("filemanager").style.display = "none";
        el("closebutton").onclick = function(){
            el("filemanager").style.display = "none";
            el("feedback").style.display = "none";
            filelist.style.display = "block";
        };
        el("feedback").onclick = el("closebutton").onclick;

        if (files.length){
            var file;
            /*if (files.length == 1){
                filelist.style.display = "none";
                file = files[0];
                el("feedback").innerHTML = "checking " + file.name;
                el("feedback").style.display = "block";

                var reader = new FileReader();
                reader.onload = function(){
                    me.load(reader.result);
                };
                reader.readAsArrayBuffer(file);
            }else{*/
                filelist.innerHTML = '<div class="caption"><div class="name">Name</div><div class="info">TOSEC</div></div>';
                filelist.style.display = "block";

                for (var i = 0, max=files.length;i<max;i++){
                    file = files[i];
                    var f = div("file","file" + i);
                    f.appendChild(div("name","name" + i,diskIcon + file.name));
                    f.appendChild(div("inspect","","INSPECT"));
                    f.appendChild(div("info","info" + i,"waiting ..."));

                    f.onclick=openDisk;
                    filelist.appendChild(f);
                }
                fileIndex =0;
                procesNextFile();
            //}
        }
    };

    me.checkTosec = function(sMd5,next){
        var apiUrl = "https://www.stef.be/adfviewer/tosec/api/";

        var req = new XMLHttpRequest();

        req.onload = function(e) {
            var result = req.responseText;

            if (result && result.indexOf('"match"')){
                var data = JSON.parse(result);
                if (next) next(data);
            }else{
                if (next) next({match:0,error:"invalid response"});
            }
        };
        req.onerror = function(e){
            if (next) next({match:0,error:e});
        };
        req.open("GET", apiUrl + "?md5=" + sMd5);
        req.send();
    };

    function formatHex(nr){
        var result = nr.toString(16).toUpperCase();
        if (result.length<2) result = "0" + result;
        return result;
    }

    function div(className,id,content){
        var d = document.createElement("div");
        if (className) d.className = className;
        if (id) d.id = id;
        if (content) d.innerHTML = content;
        return d;
    }

    function procesNextFile(){
        var file = files[fileIndex];
        var container = el("file" + fileIndex);
        var infoContainer = el("info" + fileIndex);
        infoContainer.innerHTML = "checking ...";
        var reader = new FileReader();
        reader.onload = function(){

            adf.loadDisk(reader.result,function(success){
                if (success){
                    infoContainer.innerHTML = "checking TOSEC ...";

                    me.checkTosec(adf.getMD5(),function(result){
                        if (result.match){
                            var feedback = "Yes: ";
                            if (result.result && result.result[0]) feedback+= result.result[0].name;
                            infoContainer.innerHTML = feedback;
                            container.classList.add("known");
                        }else{
                            if (result.error){
                                infoContainer.innerHTML = "Sorry, something went wrong ...";
                            }else{
                                infoContainer.innerHTML = "Nope!  This disk is not in TOSEC!";
                                container.classList.add("unknown");
                            }
                        }
                    });
                }else{
                    infoContainer.innerHTML = "This is not a standard Amiga DD disk";
                }

                fileIndex++;
                if (fileIndex<files.length){
                    setTimeout(function(){
                        procesNextFile();
                    },200)
                }
            });
        };

        reader.readAsArrayBuffer(file);
    }

    function openDisk(){
        console.log(this);

        var id = parseInt(this.id.substr(4),10);
        if (isNaN(id)) return;

        filelist.style.display = "none";
        var file = files[id];

        var reader = new FileReader();
        reader.onload = function(){
            me.load(reader.result);
        };
        reader.readAsArrayBuffer(file);
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

