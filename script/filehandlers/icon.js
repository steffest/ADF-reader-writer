/*

	MIT License

	Copyright (c) 2019 Steffest - dev@stef.be

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	
 */

var Icon = function(){
	// Detect and decode Amiga .info icon files
	// icon format info on 
	// 		http://krashan.ppa.pl/articles/amigaicons/
	//		http://www.evillabs.net/index.php/Amiga_Icon_Formats
	// all Amiga icons formats are supported except newIcons

	var me = {};

	me.fileTypes={
		ICON: {name: "Icon file", actions:["show"], inspect: true}
	};

	var WB13Palette = [
		[85,170,255],
		[255,255,255],
		[0,0,0],
		[255,136,0]
	];

	var MUIPalette = [
		[149,149,149],
		[0,0,0],
		[255,255,255],
		[59,103,162],
		[123,123,123],
		[175,175,175],
		[170,144,124],
		[255,169,151]
	];

	me.parse = function(file,decodeBody){
		var icon = {};
		file.goto(2);
		icon.version = file.readWord();
		icon.nextGadget = file.readDWord();
		icon.leftEdge = file.readWord();
		icon.topEdge = file.readWord();
		icon.width = file.readWord();
		icon.height = file.readWord();
        icon.flags = file.readWord();
		icon.activation = file.readWord();
		icon.gadgetType = file.readWord();
		icon.gadgetRender = file.readDWord();
		icon.selectRender = file.readDWord();
		icon.gadgetText = file.readDWord(); //Unused. Usually 0.
		icon.mutualExclude = file.readDWord(); //Unused. Usually 0.
		icon.specialInfo = file.readDWord(); //Unused. Usually 0.
		icon.gadgetID = file.readWord(); //Unused. Usually 0.
		icon.userData = file.readDWord(); // Used for icon revision. 0 for OS 1.x icons. 1 for OS 2.x/3.x icons.
		icon.type = file.readUbyte(); /*
			A type of icon:
				1 – disk or volume.
				2 – drawer (folder).
				3 – tool (executable).
				4 – project (data file).
				5 – trashcan.
				6 – device.
				7 – Kickstart ROM image.
				8 – an appicon (placed on the desktop by application).
		*/

		icon.padding = file.readUbyte();
		icon.hasDefaultTool = file.readDWord();
		icon.hasToolTypes = file.readDWord();
		icon.currentX = file.readDWord();
		icon.currentY = file.readDWord();
		icon.hasDrawerData = file.readDWord(); // unused
		icon.hasToolWindow = file.readDWord(); // I don't think this is used somewhere?
		icon.stackSize = file.readDWord(); 
		
		// total size 78 bytes
		
		var offset = 78;
		
		var drawerData = {};
		if (icon.hasDrawerData){
			// skip for now
			offset += 56;
		}
		icon.drawerData = drawerData;
		

		icon.img = readIconImage(file,offset);
		
		if (icon.selectRender) icon.img2 = readIconImage(file);
		
		if (icon.hasDefaultTool) icon.defaultTool = readText(file);

		icon.toolTypes = [];
		if (icon.hasToolTypes){
			icon.toolTypeCount =  file.readDWord();
			if (icon.toolTypeCount){
				icon.toolTypeCount = (icon.toolTypeCount/4) - 1; // seriously ... who invents this stuff? ...
			
				for (var i = 0; i< icon.toolTypeCount; i++){
					icon.toolTypes.push(readText(file));
				}
			}
		}
		
		if (icon.hasToolWindow) icon.hasToolWindow = readText(file);

		if (icon.hasDrawerData && icon.userData){
			// OS2.x+ drawers
			
			icon.drawerData2 = {};
			icon.drawerData2.flags = file.readDWord();
			icon.drawerData2.ViewModes = file.readWord();
		}
		

		if (file.index<file.length){
			// we're not at the end of the file
			// check for FORM ICON file

			console.log("checking for IFF structure");

			var id = file.readString(4);
			if (id === "FORM"){

				console.log("IFF file found");
				
				var size = file.readDWord();
				if ((size + 8) <= file.length){
					// the size check isn't always exact for images?
					var format = file.readString(4);

                    icon.colorIcon = readIFFICON(file);
				}
			}

		}
		
		return icon;
	};

	me.detect=function(file){
		var id = file.readWord(0);
		if (id === 0xE310){
				return (typeof FILETYPE !== "undefined") ? FILETYPE.ICON : true;
		}
	};

	me.inspect = function(file){
		var result = "icon";
		var info = me.parse(file,false);

		return result;
	};
	
	me.getImage = function(icon,index){
		index = index || 0;

		if (icon.colorIcon){
			return me.toCanvas(icon.colorIcon,index);
		}else{
			var img = index?icon.img2:icon.img;
			if (img){
				img.palette = icon.userData ? MUIPalette : WB13Palette;
				return(me.toCanvas(img));
			}
		}
	};
	
	me.handle = function(file,action){
		console.log(action);
		if (action === "show"){
			var icon = me.parse(file,true);
			var canvas = me.getImage(icon,0);
			if (AdfViewer) AdfViewer.showImage(canvas);
		}
	};

	me.toCanvas = function(img,index){
		var canvas = document.createElement("canvas");
		canvas.width = img.width;
		canvas.height = img.height;
		var pixelWidth = 1;
		var ctx = canvas.getContext("2d");
		
		if (img.states){
			// colorIcon or ARGB
			var state = img.states[index || 0];
			if (state){
				for (var y=0;y<img.height;y++){
					for (var x=0;x<img.width;x++){
						var pixel = state.pixels[y*img.width + x];
						if (state.rgba){
							var color = pixel;
						}else{
							color = state.palette[pixel] || [0,0,0,0];
						}
						if (color.length < 4) color[3] = 1;
						if (pixel === 0) color = [0,0,0,0];
						ctx.fillStyle = "rgba("+ color.join(",") + ")";
						ctx.fillRect(x*pixelWidth, y, pixelWidth, 1 );
					}
				}
			}
		}else{
            // WB Icon
            for (var y=0;y<img.height;y++){
                for (var x=0;x<img.width;x++){
                    var pixel = img.pixels[y][x];
                    var color = img.palette[pixel] || [0,0,0,0];
					if (color.length < 4) color[3] = 1;
					if (pixel === 0) color = [0,0,0,0];
					ctx.fillStyle = "rgba("+ color.join(",") + ")";
                    ctx.fillRect(x*pixelWidth, y, pixelWidth, 1 );
                }
            }
		}

		return canvas;
	};
	
	function readIconImage(file,offset){
		if (offset) file.goto(offset);
		var img = {};
		img.leftEdge = file.readWord();
		img.topEdge = file.readWord();
		img.width = file.readWord();
		img.height = file.readWord();
		img.depth = file.readWord();
		img.hasimageData = file.readDWord();
		img.planePick = file.readUbyte(); // not used
		img.planeOnOff = file.readUbyte(); // not used
		img.nextImage = file.readDWord(); // not used

		//img.depth = 1;

		if (img.hasimageData){
			var lineWidth = ((img.width + 15) >> 4) << 1; // in bytes
			var pixels = [];

			for (var plane=0;plane<img.depth;plane++){
				for (var y = 0; y<img.height; y++){
					pixels[y] = pixels[y] || [];

					var line = [];
					for (var x = 0; x<lineWidth; x++) line.push(file.readUbyte());

					// add bitplane line to pixel values;
					for (var b = 0; b<lineWidth; b++){
						var val = line[b];
						for (var i = 7; i >= 0; i--) {
							x = (b*8) + (7-i);
							var bit = val & (1 << i) ? 1 : 0;
							var p = pixels[y][x] || 0;
							pixels[y][x] = p + (bit<<plane);
						}
					}
				}

			}

			img.pixels = pixels;
		}
		
		return img;
	}
	
	function readText(file,offset){
		if (offset) file.goto(offset);
		var length = file.readDWord();
		var s = file.readString(length-1);
		file.readUbyte(); // zero byte;
		return s;
	}
	
	function readIFFICON(file){
		
		var index = file.index;
		var img = {states:[]};
		
		function readChunk(){
			var chunk = {};
			chunk.name = file.readString(4);
			chunk.size = file.readDWord();
			return chunk;
		}

		while (index<file.length-4){
			file.goto(index);
			var chunk = readChunk();
			index += chunk.size + 8;
			if (chunk.size%2 === 1) index++;
			
			switch (chunk.name){
				case "FACE":
					img.width = file.readUbyte() + 1;
					img.height = file.readUbyte() + 1;
					img.flags = file.readUbyte();
					img.aspectRatio = file.readUbyte(); //upper 4 bits:x aspect, lower 4 bits: y aspect
					img.MaxPaletteSize = file.readWord();
					break;
				case "IMAG":
					var endIndex = file.index + chunk.size;

					var state = {};
					state.transparentIndex = file.readUbyte();
					state.NumColors = file.readUbyte() + 1;
					state.flags = file.readUbyte();
					state.imageCompression = file.readUbyte();
					state.paletteCompression = file.readUbyte();
					state.depth = file.readUbyte();
					state.imageSize = file.readWord() + 1;
					state.paletteSize = file.readWord() + 1;

					state.pixels = [];
					state.palette = [];

					var imageDataOffset = file.index;
					var paletteDataOffset = imageDataOffset + state.imageSize;

                    if (state.imageCompression){
						// note: this is BIT aligned, not byte aligned ...
						// -> RLE control chars are 8 bits, but the data elements are n bits, determined by state.depth

						var max = (state.imageSize-1) * 8;
						var bitIndex = 0;

						while (bitIndex < max) {
							var b = file.readBits(8,bitIndex,imageDataOffset);
                            bitIndex += 8;
							
							if (b > 128) {
								var b2 = file.readBits(state.depth,bitIndex,imageDataOffset);
                                bitIndex += state.depth;
								for (var k = 0; k < 257 - b; k++) state.pixels.push(b2);
							}
							if (b < 128) {
								for (k = 0; k <= b; k++){
									state.pixels.push(file.readBits(state.depth,bitIndex,imageDataOffset));
                                    bitIndex += state.depth;
                                }
							}
						}
					}else{
                        // note: uncompressed data is BYTE aligned, even if state.depth < 8
						for (var i = 0; i < state.imageSize; i++){
							state.pixels.push(file.readUbyte())
						}
					}

					if (state.paletteSize){
                        file.goto(paletteDataOffset);
                        var rgb = [];

                        if (state.paletteCompression){
                            var max = (state.paletteSize-1) * 8;
                            var bitIndex = 0;

                            while (bitIndex < max) {
                                var b = file.readBits(8,bitIndex,paletteDataOffset);
                                bitIndex += 8;

                                if (b > 128) {
                                    var b2 = file.readBits(state.depth,bitIndex,paletteDataOffset);
                                    bitIndex += state.depth;
                                    for (var k = 0; k < 257 - b; k++) rgb.push(b2);
                                }
                                if (b < 128) {
                                    for (k = 0; k <= b; k++){
                                        rgb.push(file.readBits(state.depth,bitIndex,paletteDataOffset));
                                        bitIndex += state.depth;
                                    }
                                }
                            }
                        }else{
                            for (i = 0; i < state.paletteSize; i++){
                                rgb.push(file.readUbyte())
                            }
                        }

                        if (rgb.length>2){
                        	for (i = 0, max = rgb.length; i<max; i+=3){
                        		state.palette.push([rgb[i],rgb[i+1],rgb[i+2]])
							}
						}
					}
					
					if (img.states.length){
						window.pp2 = state.pixels;
					}else{
						window.pp1 = state.pixels;
					}
					
					img.states.push(state);


					break;
				case "ARGB":
					// zlib compressed
					// found some info/structure on https://amigaworld.net//modules/newbb/viewtopic.php?viewmode=flat&order=0&topic_id=34625&forum=15&post_id=639101#639062

					console.log("decoding ARGB data");
					
					var state = {};

					state.rgba = true;
					state.pixels = [];
					state.palette = [];
					
					
					for (var offset = 0; offset<10;offset++){
						// no idea what this data structure is ...
						// first DWORD always seem to be 1?
						state.dummy = file.readUbyte();
						//console.log(state.dummy);
					}
					
					var size = chunk.size-offset;
					var data = new Uint8Array(size);
					for (var i = 0; i<size; i++){
						data[i] = file.readUbyte();
					}

					try{
						var a = new Zlib.Inflate(data).decompress();
						
						for (var y = 0; y<img.height; y++){
							for (var x = 0; x<img.width; x++){
								var pixelIndex = (y*img.width + x) * 4;
								var color = [a[pixelIndex+1]||0,a[pixelIndex+2]||0,a[pixelIndex+3]||0,(a[pixelIndex]||0)/255];
								state.pixels.push(color);
							}
						}
						
						img.states.push(state);
						
						
					}catch (e) {
						console.log("invalid zlib structure");
					}
					
					break;
				default:
					console.log("unhandled IFF chunk: " + chunk.name);
					break;
			}
			
		}
		
		return img;
	}


	if (typeof FileType !== "undefined") FileType.register(me);

	return me;
	
}();