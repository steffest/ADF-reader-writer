var MUSICMOD = function(){

    var me = {};

    me.fileTypes={
        MOD: {name: "Music Module", actions:["Play in Tracker"]}
    };

    me.detect=function(file){

        var length = file.length;
		var id;
        if (length>1100){
            id = file.readString(4,1080);
        }

        switch (id){
            case "M.K.":
            case "M!K!":
            case "M&K!":
            case "FLT4":
            case "2CHN":
            case "6CHN":
            case "8CHN":
            case "10CH":
            case "12CH":
            case "14CH":
            case "16CH":
            case "18CH":
            case "20CH":
            case "22CH":
            case "24CH":
            case "26CH":
            case "28CH":
            case "30CH":
            case "32CH":
                return FILETYPE.MOD;
        }
    };

    me.handle = function(file,action){
        console.error("handle",file);

        var playFile = function(){
			if (AdfViewer) AdfViewer.showImage();
            BassoonTracker.load({
                name: "ADF file",
                buffer: file.buffer
            },true,function(){
                BassoonTracker.playSong();
            })
        };

        if (typeof BassoonTracker === "undefined"){
            var plugin = "https://www.stef.be/bassoontracker/script/bassoontracker-min.js";
            loadScript(plugin,function(){
                console.log("Tracker loaded");
                BassoonTracker.init({
                    plugin: true,
                    baseUrl: "https://www.stef.be/bassoontracker/",
                    canvas: document.getElementById("canvas"),
                    callback: function(){
                        console.log("Tracker init Done");
                        playFile();
                    }
                })
            });
        }else{
			playFile();
        }
    };


    if (FileType) FileType.register(me);

    return me;
}();