var FILETYPE={
	unknown: 0
};

var FileType = function(){
	var me = {};

	var fileTypeCounter = 1;
	var handlers = [];

	me.register = function(handler){
		if (handler.fileTypes){
			for (var key in handler.fileTypes){
				if (handler.fileTypes.hasOwnProperty(key)){
					fileTypeCounter++;
					var type = handler.fileTypes[key];
					FILETYPE[key] = {
						id: fileTypeCounter,
						name: type.name,
						handler: handler,
						actions: type.actions,
						inspect: type.inspect
					}
				}
			}
		}
		handlers.push(handler);
	};

	me.detect = function(fileData){
		var file = BinaryStream(fileData.buffer,true);
		var fileFormat;

		for (var i = 0, max = handlers.length;i<max;i++){
			fileFormat = handlers[i].detect(file);
			if (fileFormat) break;
		}

		if (fileFormat){
			fileFormat.file = file;
			if (fileFormat.inspect) fileFormat.info = fileFormat.handler.inspect(file);
		}

		return fileFormat;
	};

	return me;
}();