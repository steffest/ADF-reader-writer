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

function BinaryStream(arrayBuffer, bigEndian){
	var obj = {
		index: 0,
		litteEndian : !bigEndian
	};

	obj.goto = function(value){
		setIndex(value);
	};

	obj.jump = function(value){
		this.goto(this.index + value);
	};

	obj.readByte = function(position){
		setIndex(position);
		var b = this.dataView.getInt8(this.index);
		this.index++;
		return b;
	};

	obj.writeByte = function(value,position){
		setIndex(position);
		this.dataView.setInt8(this.index,value);
		this.index++;
	};

	obj.readUbyte = function(position){
		setIndex(position);
		var b = this.dataView.getUint8(this.index);
		this.index++;
		return b;
	};

	obj.writeUbyte = function(value,position){
		setIndex(position);
		this.dataView.setUint8(this.index,value);
		this.index++;
	};

	obj.readUint = function(position){
		setIndex(position);
		var i = this.dataView.getUint32(this.index,this.litteEndian);
		this.index+=4;
		return i;
	};

	obj.writeUint = function(value,position){
		setIndex(position);
		this.dataView.setUint32(this.index,value,this.litteEndian);
		this.index+=4;
	};

	obj.readBytes = function(len,position,buffer) {
		setIndex(position);


		var i = this.index;
		var src = this.dataView;
		if ((len += i) > this.length) len = this.length;
		var offset = 0;

		for (; i < len; ++i) buffer.setUint8(offset++, this.dataView.getUint8(i));
		this.index += len;
		return buffer;
	};

	obj.readString = function(len,position){
		setIndex(position);
		var i = this.index;
		var src = this.dataView;
		var text = "";

		if ((len += i) > this.length) len = this.length;

		for (; i < len; ++i){
			var c = src.getUint8(i);
			if (c == 0) break;
			text += String.fromCharCode(c);
		}

		this.index = len;
		return text;
	};

	obj.writeString = function(value,position){
		setIndex(position);
		var src = this.dataView;
		var len = value.length;
		for (var i = 0; i < len; i++) src.setUint8(this.index + i,value.charCodeAt(i));
		this.index += len;
	};

	obj.writeStringSection = function(value,max,paddValue,position){
		setIndex(position);
		max = max || 1;
		value = value || "";
		paddValue = paddValue || 0;
		var len = value.length;
		if (len>max) value = value.substr(0,max);
		obj.writeString(value);
		obj.fill(paddValue,max-len);
	};

	// same as readUshort
	obj.readWord = function(position){
		setIndex(position);
		var w = this.dataView.getUint16(this.index, this.litteEndian);
		this.index += 2;
		return w;
	};

	obj.writeWord = function(value,position){
		setIndex(position);
		this.dataView.setUint16(this.index,value,this.litteEndian);
		this.index += 2;
	};

	obj.readLong = obj.readDWord = obj.readUint;

	obj.readShort = function(value,position){
		setIndex(position);
		var w = this.dataView.getInt16(this.index, this.litteEndian);
		this.index += 2;
		return w;
	};

	obj.clear = function(length){
		obj.fill(0,length);
	};

	obj.fill = function(value,length){
		value = value || 0;
		length = length || 0;
		for (var i = 0; i<length; i++){
			obj.writeByte(value);
		}
	};

	obj.isEOF = function(margin){
		margin = margin || 0;
		return this.index >= (this.length-margin);
	};

	function setIndex(value){
		value = value === 0 ? value : value || obj.index;
		if (value<0) value = 0;
		if (value >= obj.length) value = obj.length-1;

		obj.index = value;
	}

	obj.buffer = arrayBuffer;
	obj.dataView = new DataView(arrayBuffer);
	obj.length = arrayBuffer.byteLength;

	return obj;

	// todo
	/*


	check if copying typed arraybuffers is faster then reading dataview

	 var dstU8 = new Uint8Array(dst, dstOffset, byteLength);
  	 var srcU8 = new Uint8Array(src, srcOffset, byteLength);
  	 dstU8.set(srcU8);


	 */
}

function loadFile(url,next) {
	var req = new XMLHttpRequest();
	req.open("GET", url, true);
	req.responseType = "arraybuffer";
	req.onload = function (event) {
		var arrayBuffer = req.response;
		if (arrayBuffer) {
			if (next) next(arrayBuffer);
		} else {
			console.error("unable to load", url);
			if (next) next(false);
		}
	};
	req.send(null);
}

function saveFile(b,filename){
	//NOTE: this doesn't work on all browsers, a more robust way is to use the filesaver.js of Eli Grey
	var a = document.createElement("a");
	document.body.appendChild(a);
	a.style = "display: none";
	url = window.URL.createObjectURL(b);
	a.href = url;
	a.download = filename;
	a.click();
	window.URL.revokeObjectURL(url);
}

