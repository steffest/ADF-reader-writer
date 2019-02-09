var AMOS = function(){

	// see http://alvyn.sourceforge.net/amos_file_formats.html

	var me = {};

	me.fileTypes={
		AMBK: {name: "Amos Pac.Pic file"},
		AMSP: {name: "Amos Sprite bank", inspect:true},
		AMIC: {name: "Amos Icon bank"}
	};

	me.detect=function(file){

		var id = file.readString(4,0);

		if (id === "AmBk") return FILETYPE.AMBK;
		if (id === "AmSp") return FILETYPE.AMSP;
		if (id === "AmIc") return FILETYPE.AMIC;
	};

	me.inspect = function(file){
		var result = "";

		var id = file.readString(4,0);
		if (id === "AmSp"){
			var count = file.readWord();
			result = "containing " + count + " sprites";
		}
		
		return result;
	};

	if (FileType) FileType.register(me);

	return me;
}();