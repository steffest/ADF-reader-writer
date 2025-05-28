/*
	Amiga filesystem implementation in javascript.

	Read and write files and folders from/to Amiga Disk Format files.
	Currently only standard Amiga DD disks are supported.

	I once reverse engineered it from scratch for my Emerald Mine Level editor at http://www.steffest.com/DXboulder/
	But since I lost that source code (no GIT in 1995) now I took the info from http://lclevy.free.fr/adflib/adf_info.html
	Thanks Laurent Clevy.

	OFS and FFS are supported

	There are some sane limitations in place to keep things performant:
	- max size for a single file is 20MB
	- max size for a hardfile is about 2GB, depending on the browser

	MIT License

	Copyright (c) 2019-2023 Steffest - dev@stef.be

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

var adf = function(){
	var me = {};
	var disk;

	var defaultAdfSectorCount = 1760; // standard DD disk that can store 880kb have a disk.length == 901120
	var SectorSize = 512; // the default size in bytes of one sector in a standard Amiga disk
	var SectorCount = defaultAdfSectorCount;
	var rootSector = SectorCount/2;

	var BitmapSize = 127; // the amount of 32 values in a bitmap block

	me.loadDisk = function(url,next){

		var onLoad = function(buffer){
			disk = BinaryStream(buffer,true);

			var passed = false;

			SectorCount = disk.length/SectorSize;
			disk.sectorCount = SectorCount;
			if ((parseInt(SectorCount) === SectorCount) && SectorCount%2 === 0){
				rootSector = SectorCount/2;
				var info = me.getInfo();
				console.log(info);
				if (info.diskFormat === "DOS" || info.diskFormat === "RDSK"){
					passed = true;
				}
			}

			if (passed){
				if (next) next(true);
			}else{
				console.error("this does not seem to be an uncompressed disk with a valid DOS filesystem");
				if (next) next(false,disk);
			}
		};

		if (typeof url == "string"){
			loadFile(url,function(buffer){
				onLoad(buffer);
			});
		}

		if (typeof url == "object"){
			onLoad(url);
		}


	};

	me.setDisk = function(_disk){
		disk = _disk;
		return me.getInfo();
	};

	me.getInfo = function(){
		disk.goto(0);

		var info = {};
		info.diskFormat = disk.readString(3);
		var diskType = disk.readUbyte();
		info.diskType = (diskType%2) == 0 ? "OFS" : 'FFS';

		if (info.diskFormat === "RDS"){
			disk.goto(0);
			info.diskFormat = disk.readString(4);
			if (info.diskFormat === "RDSK"){
				info.diskType = "Partitioned";
				return info;
			}
		}

		// read rootblock
		disk.goto(rootSector * SectorSize);
		info.inforootBlockType = disk.readLong();
		if (info.inforootBlockType !== 2){
			info.diskType = "UNKNOWN";
			info.diskFormat = "UNKNOWN";
		}

		disk.goto((rootSector * SectorSize) + SectorSize - 80);
		var nameLength = disk.readUbyte();
		info.label = disk.readString(nameLength);

		disk.info = info;
		
		if (!disk.bitmap || disk.bitmap.length < 1){
			me.getFreeSize();
		}

		info.totalSize = disk.totalSize;
		info.free = disk.free;
		info.used = disk.used;

		return info;
	};

	me.isFFS = function(){
		return disk.info.diskType === "FFS";
	};

	me.getSectorType = function(sector){
		if (sector === 0) return "BOOTBLOCK";
		if (sector === rootSector) return "ROOTBLOCK";
		if (disk.bitmapBlocks.indexOf(sector)>=0) return "BITMAP BLOCK";

		disk.goto(sector * SectorSize);
		var long = disk.readLong();
		if (long === 2) return "HEADER";
		if (long === 8) return "DATA BLOCK";
		if (long === 16) return "LIST (File extension block)";
		if (long === 33) return "DIRCACHE (Directory cache block)";

		return "EMPTY (or this is not a DOS disk)"
	};

	me.readFileAtSector = function(sector,includeContent){
		var file = readHeaderBlock(sector);
        file.sector = sector;

		if (includeContent){
			file.content = new Uint8Array(file.size);
			var index = 0;

			// there are 2 ways to read a file in OFS:
			// 1 is to read the list of datablock pointers and collect each datablock
			// 2 is to follow the linked list of datablocks

			// the second one seems somewhat easier to implement
			// because otherwise we have to collect each extension block first
            var block = file;
			if (me.isFFS()){
				var sectors = block.pointers.slice().reverse();

				// let's set a sane max file size of 20MB
				while (block.dataBlockExtension && sectors.length<40960){
					block = readExtensionBlock(block.dataBlockExtension);
					sectors = sectors.concat(block.pointers.slice().reverse());
					console.log("appending block");
				}
				var maxSize = file.size;

				sectors.forEach(function(fileSector){
					if (fileSector){
                        block = readDataBlock(fileSector,maxSize);
                        file.content.set(block.content,index);
                        index += block.dataSize;
                        maxSize -= block.dataSize;
					}
				});
			}else{

				var nextBlock = block.firstDataBlock;
				while (nextBlock !== 0){
					block = readDataBlock(nextBlock);
					file.content.set(block.content,index);
					index += block.dataSize;
					nextBlock = block.nextDataBlock;
				}
			}

		}

		return file;
	};

	me.readFolderAtSector = function(sector){
		//console.error("readFolderAtSector " + sector);

		var directory = readHeaderBlock(sector);
        directory.folders = [];
        directory.files = [];
        directory.sector = sector;

		// NOTE: block.pointers DO NOT hold the list of all files
		// the index in de pointerslist is determined by the name of the item
		// multiple files/folders with the same name are linked to each other
		var entries = [];
        directory.pointers.forEach(function(sector){
			if (sector){
				let name = getFileNameAtSector(sector);
				let type = getFileTypeAtSector(sector);

				if (type === "FILE"){
					// some quick validation
					// apparently some of my test files have invalid sector pointers?
					let isEmpty = isEmptyBlock(sector);
					if (isEmpty){
						console.warn("Sector " + sector + " for "+type +" '"+name+"' is marked as empty, but should not be!");
					}
				}
                entries.push({
                    sector: sector,
                    name: name,
                    typeString: type
                })
			}
		});

		// NOTE:  entries.length may change in the loop if we find chained files
		for (var i = 0; i< entries.length; i++){
			var entry = entries[i];

			if (entry.typeString == "FILE"){ // TODO: can files only be linked to blocks?
				var file = me.readFileAtSector(entry.sector,false);
				directory.files.push(file);
				if (file.linkedSector){
					if (file.linkedSector>SectorCount){
						console.error("File " + file.name + " has an invalid linked sector: " + file.linkedSector);
					}else{
						entries.push(
							{
								sector: file.linkedSector,
								name: getFileNameAtSector(file.linkedSector),
								typeString: getFileTypeAtSector(file.linkedSector)
							}
						);
					}
				}
			}else if (entry.typeString == "DIR"){
				directory.folders.push(entry);
                var folderHeader = readHeaderBlock(entry.sector);
                if (folderHeader.linkedSector){
					if (folderHeader.linkedSector>SectorCount){
						console.error("Folder " + entry.name + " has an invalid linked sector: " + folderHeader.linkedSector);
					}else{
						entries.push(
							{
								sector: folderHeader.linkedSector,
								name: getFileNameAtSector(folderHeader.linkedSector),
								typeString: getFileTypeAtSector(folderHeader.linkedSector)
							}
						);
					}
				}
			}else{
				console.warn("Unknown entry type: " + entry.typeString + " at sector " + entry.sector);
			}
		}

		return directory;
	};

    me.deleteFileAtSector = function(sector){

		console.log("delete File At Sector " + sector);
		
        var fileHeaderBlock = readHeaderBlock(sector);
        var folderSector = fileHeaderBlock.parent;
        var linkedFile = fileHeaderBlock.linkedSector;
        var i,max;

        // remove file from Folder;
        var folderHeaderBlock = readHeaderBlock(folderSector);

        var index = getNameHashIndex(fileHeaderBlock.name);
        // can we always rely on the file being linked at the nameHash position on the hashtable?
		// seems so - otherwise the disk in invalid.

		var hashTableItem = folderHeaderBlock.pointers[index];

		if (hashTableItem === sector){
            console.log("file found in main pointer list");
            if (linkedFile){
                // link this file to the main index list
                folderHeaderBlock.pointers[index] = linkedFile;
            }else{
                // remove file from hash table
                folderHeaderBlock.pointers[index] = 0;
            }
            //rewrite folderHeader
            writeHeaderBlock(folderSector,folderHeaderBlock);
		}else{
            console.log("file not found, checking linked lists");

            while (hashTableItem){
                var linkedHeaderBlock = me.readHeaderBlock(hashTableItem);
                if (linkedHeaderBlock.linkedSector === sector){
                    console.log("file found, linked to " + hashTableItem);
                    if (linkedFile){
                        // link this file to the current file
                        linkedHeaderBlock.linkedSector = linkedFile;
                    }else{
                        // deleted file was last in the link list
                        linkedHeaderBlock.linkedSector = 0;
                    }
                    writeHeaderBlock(hashTableItem,linkedHeaderBlock);
                    break;
                }else{
                    hashTableItem = linkedHeaderBlock.linkedSector;
                }
			}
		}

        var sectors=[sector];
        sectors = sectors.concat(fileHeaderBlock.pointers);
        var block = fileHeaderBlock;
        while (block.dataBlockExtension && sectors.length<2000){
            block = readExtensionBlock(block.dataBlockExtension);
            sectors = sectors.concat(block.pointers);
        }

        // clear file blocks
		sectors.forEach(function(index){
			if (index){
                //me.clearSector(index); //  actually this is not really needed, maybe skip if this hurts performance
                markSectorUsed(index,false);
			}
		});

		// update bitmap
		updateBitmapForSector(sector);
		console.log("File deleted");

    };

    me.deleteFolderAtSector = function(sector){

        console.log("delete folder At sector " + sector);
        // note: the folder needs to be empty before we can delete it
		// recursive delete not yet implemented

        var folderHeaderBlock = readHeaderBlock(sector);
        var parentSector = folderHeaderBlock.parent;
        var linkedFile = folderHeaderBlock.linkedSector;
        var i,max;

        // check if folder is empty
		var isEmpty = true;
		for (i=0,max=folderHeaderBlock.pointers.length;i<max;i++){
			if (folderHeaderBlock.pointers[i]){
                isEmpty=false;
                break;
			}
		}
		if (!isEmpty) return false;

        // remove folder from Parent;
        var parentHeaderBlock = readHeaderBlock(parentSector);
        var index = getNameHashIndex(folderHeaderBlock.name);
        var hashTableItem = parentHeaderBlock.pointers[index];

        if (hashTableItem === sector){
            console.log("folder found in main pointer list");
            if (linkedFile){
                // link this file to the main index list
                parentHeaderBlock.pointers[index] = linkedFile;
            }else{
                // remove folder from hash table
                parentHeaderBlock.pointers[index] = 0;
            }
            //rewrite parentHeader
            writeHeaderBlock(parentSector,parentHeaderBlock);
        }else{
            console.log("folder not found, checking linked lists");

            while (hashTableItem){
                var linkedHeaderBlock = me.readHeaderBlock(hashTableItem);
                if (linkedHeaderBlock.linkedSector === sector){
                    console.log("folder found, linked to " + hashTableItem);
                    if (linkedFile){
                        // link this file to the current file
                        linkedHeaderBlock.linkedSector = linkedFile;
                    }else{
                        // deleted file as it was last in the link list
                        linkedHeaderBlock.linkedSector = 0;
                    }
                    writeHeaderBlock(hashTableItem,linkedHeaderBlock);
                    break;
                }else{
                    hashTableItem = linkedHeaderBlock.linkedSector;
                }
            }
        }

        // mark block as free
        //disk.bitmap[sector] = 1;
		markSectorUsed(sector,false);

        // update bitmap
		updateBitmapForSector(sector);
        return true;
    };

    me.writeFile = function(name,buffer,folder){
		var folderHeaderBlock = readHeaderBlock(folder);
		var nameIndex = getNameHashIndex(name);
		var data = new Uint8Array(buffer);
		var i;

        console.log("Write file: " + name);

		// check if file already exists
		let folderContent = me.readFolderAtSector(folder);
		folderContent.files.forEach(file => {
			if (file.name === name){
				console.warn("File already exists");
				// TODO Delete existing file ?
			}
		});


        // check if it will fit
		var freeBlocks = getFreeBlocks();
		console.log("Free blocks: " + freeBlocks);

		var fileSize = data.length;
        var dataBlockSize = me.isFFS() ? SectorSize : SectorSize-24;
        var dataBlockCount = Math.ceil(fileSize/dataBlockSize);
        var headerBlockCount = Math.ceil(dataBlockCount/72);

		var totalBlocks = dataBlockCount + headerBlockCount;
        
        console.log("File wil need " + totalBlocks + " blocks");

        if (totalBlocks>freeBlocks){
        	console.error("Not enough space on device");
			return false;
		}

		// keep track of what bitmap blocks need to be updated
		var bitmapBlocks = [];
		function markBitmapBlock(index){
			if (bitmapBlocks.indexOf(index) === -1){
				bitmapBlocks.push(index);
			}
		}

        // create file, starting with the main header block
        var sector = getEmptyBlock();
		console.log("free sector:" + sector);
        clearSector(sector);
        var header = createFileHeaderBlock(sector,name,data,folder);
		markBitmapBlock(markSectorUsed(sector,true));
		
		var headerBlocks = [header];
		if (headerBlockCount>1){
			console.log("Creating " + (headerBlockCount-1) + " Extension blocks");
			for (i = 1; i<headerBlockCount;i++){
				var newSector = getEmptyBlock();
				clearSector(newSector);
				markBitmapBlock(markSectorUsed(newSector,true));
				headerBlocks.push(createExtensionBlock(newSector,sector));
			}
			
			// chain them
			for (i = 0; i<headerBlockCount-1;i++){
				headerBlocks[i].dataBlockExtension = headerBlocks[i+1].sector;
			}
		}

        if (dataBlockCount){
			// create dataBlocks
			var dataBlocks = [];
			var headerIndex = 0;
			var pointerIndex = 72-1;

			for (i = 0; i<dataBlockCount; i++){
				
				// get empty block and mark as used
				var dataSector = getEmptyBlock();
				clearSector(dataSector);
				markBitmapBlock(markSectorUsed(dataSector,true));

				var contentIndex = i*dataBlockSize;
				var contentSize = Math.min(fileSize-contentIndex,dataBlockSize);

				var dataBlock = {
					type: 8,
					number: i+1,
					headerSector: sector, // or is this the extension block?
					sector: dataSector,
					content: new Uint8Array(contentSize),
					dataSize: contentSize,
					nextDataBlock: 0
				};

				// fill content
				for (var j = 0;j<contentSize;j++){
					dataBlock.content[j] = data[contentIndex + j];
				}
				
				// put them in headerBlock
				headerBlocks[headerIndex].pointers[pointerIndex] = dataSector;
				pointerIndex--;
				if (pointerIndex<0){
					// jump to next header block
					pointerIndex = 72-1;
					headerIndex++;
				}
				
				dataBlocks.push(dataBlock);
			}

			// chain datablocks
			header.firstDataBlock = dataBlocks[0].sector;
			for (i = 0; i<dataBlockCount-1; i++){
				dataBlocks[i].nextDataBlock = dataBlocks[i+1].sector
			}

			// write datablocks to disk
			for (i = 0; i<dataBlockCount; i++){
				console.log("write data block " + dataBlocks[i].sector);
				writeDataBlock(dataBlocks[i].sector,dataBlocks[i]);
			}

			// write extension blocks to disk
			for (i = 1; i<headerBlockCount; i++){
                console.log("write extension block " + headerBlocks[i].sector);
				writeExtensionBlock(headerBlocks[i].sector,headerBlocks[i]);
			}
			
        }

		console.log("nameIndex: " + nameIndex,name);
		// put file in folder, link other files if needed
        var currentFile = folderHeaderBlock.pointers[nameIndex];
		if (currentFile){
			console.log("File with the same hash already present: " + currentFile);
			// File with the same hash already present
			// link to new one
			header.linkedSector = currentFile;
		}

        console.log("Writing file header " + sector);
        writeHeaderBlock(sector,header);

        // add to folder
        folderHeaderBlock.pointers[nameIndex] = sector;
        writeHeaderBlock(folder,folderHeaderBlock);

		console.error(folderHeaderBlock.pointers);

        // update used Bitmap blocks
		bitmapBlocks.forEach(updateBitmapIndex);

		return sector;
	};

    me.createFolder = function(name,folder){

    	// TODO: check if folder already exists
        var folderHeaderBlock = readHeaderBlock(folder);
        var nameIndex = getNameHashIndex(name);

        var sector = getEmptyBlock();
        clearSector(sector);
        var header = createFolderHeaderBlock(sector,name,folder);
		markSectorUsed(sector,true);

		// write (empty) folder to disk
        header.linkedSector = folderHeaderBlock.pointers[nameIndex];
        writeHeaderBlock(sector,header);

        // add to folder
        folderHeaderBlock.pointers[nameIndex] = sector;
        writeHeaderBlock(folder,folderHeaderBlock);

        // update used blocks
		updateBitmapForSector(sector);
        
        return sector;
	};
    
    
    me.renameFileOrFolderAtSector=function(sector,newName){
		console.log("rename File or Folder At Sector " + sector);

		var fileHeaderBlock = readHeaderBlock(sector);
		var folderSector = fileHeaderBlock.parent;
		var linkedFile = fileHeaderBlock.linkedSector;
		var i,max;
		
		// update object in Folder;
		var folderHeaderBlock = readHeaderBlock(folderSector);

		var oldIndex = getNameHashIndex(fileHeaderBlock.name);
		var newIndex = getNameHashIndex(newName);
		
		if (oldIndex !== newIndex){
			// move from oldIndex, keeping the hashchain intact
			folderHeaderBlock.pointers[oldIndex] = fileHeaderBlock.linkedSector || 0;
			
			// move to new position
			fileHeaderBlock.linkedSector = folderHeaderBlock.pointers[newIndex] || 0;
			folderHeaderBlock.pointers[newIndex] = sector;

			writeHeaderBlock(folderSector,folderHeaderBlock);
		}

		fileHeaderBlock.name = newName;
		writeHeaderBlock(sector,fileHeaderBlock);
		
	};

	me.readRootFolder = function(){
		return me.readFolderAtSector(rootSector);
	};

	me.readbytes = function(start,count){
		count = count || 1;
		disk.goto(start);
		var result = new Uint8Array(count);
		for (var i = 0; i<count; i++){
			result[i] = disk.readUbyte();
		}
		return result;
	};

	me.readSector = function(sector,count){
		count = count || 1;
		disk.goto(sector * SectorSize);
		var size = SectorSize * count;
		var result = new Uint8Array(size);
		for (var i = 0; i<size; i++){
			result[i] = disk.readUbyte();
		}
		return result;
	};

    me.writeSector = function(sector,data){
        disk.goto(sector * SectorSize);
        for (var i = 0; i<SectorSize; i++){
        	disk.writeUbyte(data[i] || 0);
        }
    };

	function clearSector(sector){
		disk.goto(sector * SectorSize);
		for (var i = 0; i<SectorSize; i++){
			disk.writeUbyte(0);
		}
	};

	me.getMD5 = function(){
		return md5 ? md5(disk.buffer) : "md5 lib not loaded";
	};

	me.getDisk = function(){
		return disk;
	};

	me.getTrack = function(trackNumber){
		trackNumber = trackNumber || 0;
		var trackSize = SectorSize*11;
		disk.goto(trackNumber * trackSize);
		var result = new Uint8Array(trackSize);
		for (var i = 0; i<trackSize; i++){
			result[i] = disk.readUbyte();
		}
		return result;
	};

	me.getCylinder = function(index){
		index = index || 0;
		var size = SectorSize*22;
		disk.goto(index * size);
		var result = new Uint8Array(size);
		for (var i = 0; i<size; i++){
			result[i] = disk.readUbyte();
		}
		return result;
	};

	me.getBootblock = function(){
		disk.goto(0);
		var result = new Uint8Array(SectorSize*2);
		for (var i = 0; i<SectorSize*2; i++){
			result[i] = disk.readUbyte();
		}
		return result;
	};

	me.getBoottrack = function(){
		disk.goto(SectorSize*2);
		var max = SectorSize*9;
		var result = new Uint8Array(max);
		for (var i = 0; i<max; i++){
			result[i] = disk.readUbyte();
		}
		return result;
	};

	function readDataBlock(sector,size){
		var block = {};
		disk.goto(sector * SectorSize);

		if (me.isFFS()){
			block.dataSize = Math.min(size,SectorSize);
			block.content = new Uint8Array(block.dataSize);
			for (var i = 0; i<block.dataSize; i++){
				block.content[i] = disk.readUbyte();
			}
		}else{
			block.type = disk.readLong(); // should be 8 for DATA block
			block.headerSector  = disk.readLong(); // points to the file HEADER block this data block belongs to;
			block.number = disk.readLong(); // index in the file datablock list;
			block.dataSize = disk.readLong();
			block.nextDataBlock = disk.readLong(); // == 0 if this is the last block
			block.checkSum = disk.readLong();

			if (block.type == 8){
				block.content = new Uint8Array(block.dataSize);
				disk.goto((sector * SectorSize) + 24);
				for (i = 0; i<block.dataSize; i++){
					block.content[i] = disk.readUbyte();
				}
			}else{
				// invalid file
				block.content = new Uint8Array(0);
				block.dataSize = 0;
				block.nextDataBlock = 0;
			}
			
		}

		return block;
	}

    function writeDataBlock(sector,block){
        disk.goto(sector * SectorSize);

        if (me.isFFS()){
            for (var i = 0; i<block.dataSize; i++){
            	disk.writeUbyte(block.content[i]);
            }
        }else{
            disk.writeUint(block.type);
            disk.writeUint(block.headerSector);
            disk.writeUint(block.number);
            disk.writeUint(block.dataSize);
            disk.writeUint(block.nextDataBlock);
            disk.writeUint(0); // checksum
            for (i = 0; i<block.dataSize; i++){
                disk.writeUbyte(block.content[i] || 0);
            }

            // update checksum
            block.checkSum = calculateChecksum(sector);
            disk.goto(sector * SectorSize + 20);
            disk.writeUint(block.checkSum);
        }

        return block;
    }

	me.readHeaderBlock = function(sector){
		return readHeaderBlock(sector);
	};
	function readHeaderBlock(sector){
		disk.goto(sector * SectorSize);

		var block = {};
		block.type  = disk.readLong(); // should be 2 for HEADER block
		block.headerSector  = disk.readLong(); // self pointer, should be the same as the initial sector
		block.DataBlockCount = disk.readLong(); // the amount of datablocks for files, unused for folders
		block.dataSize = disk.readLong(); // for folders this is the hash table size , 72 for DD disks
		block.firstDataBlock = disk.readLong(); // should be the same as the first block in the dataBlock List for files, not used for folders
		block.checkSum = disk.readLong();

		block.pointers = [];
		// 72 longs
		// for folders
		//      these are pointers of file and directory headers
		//      THE LOCATION IF THE HASHTABLE IS DETERMINED BY THE FILE/FOLDER NAME !!!
		// for files
		//      these are pointers to the datablocks
		//      the first datablock is last in the list
		for (var i = 0; i< 72; i++){
            block.pointers.push(disk.readLong() || 0);
		}

		if (sector === rootSector){
			// Root Block

			// maybe check the last long? - should be 1

            block.headerSector = 0;
            block.DataBlockCount = 0;
            block.firstDataBlock = 0;

            disk.goto((sector * SectorSize) + SectorSize - 200);
            block.bm_flag = disk.readLong();

            //bitmap blocks pointers
            block.bitmapBlocks = [];
            for (i = 0; i<25; i++){
                block.bitmapBlocks.push(disk.readLong());
			}

            disk.goto((sector * SectorSize) + SectorSize - 96);
            block.bitmap_ext = disk.readLong(); // first bitmap extension block - Hard Disks >50 MB only

            disk.goto((sector * SectorSize) + SectorSize - 40);
            block.lastDiskChangeDays = disk.readLong(); // days since 1 jan 78
            block.lastDiskChangeMinutes = disk.readLong(); // minutes pas midnight
            block.lastDiskChangeTicks = disk.readLong(); // in 1/50s of a seconds, past lastt minute

            block.parent = 0;
            block.typeString = "ROOT";

		}else{
            disk.goto((sector * SectorSize) + SectorSize - 188);
            block.size = disk.readLong(); // filesize for files, not used for folders
            var dataLength = disk.readUbyte();
            block.comment = dataLength ? disk.readString(dataLength) : "";


            disk.goto((sector * SectorSize) + SectorSize - 16);
            block.linkedSector = disk.readLong(); // sector of entry in the same folder
            block.parent = disk.readLong();
            block.dataBlockExtension = disk.readLong();
            block.typeString = disk.readLong() == 4294967293 ? "FILE" : "DIR";
            // 4294967293 == -3 , should we read as signed ?
			// this value is 2 for folders and 1 for the root folder
		}


		disk.goto((sector * SectorSize) + SectorSize - 92);
		block.lastChangeDays = disk.readLong(); // days since 1 jan 78
		block.lastChangeMinutes = disk.readLong(); // minutes pas midnight
		block.lastChangeTicks = disk.readLong(); // in 1/50s of a seconds, past lastt minute

		dataLength = disk.readUbyte();
		block.name = dataLength ? disk.readString(dataLength) : ""; // max 30

		return block;
	}

	me.rewriteBlock = function(sector){
		var block = readHeaderBlock(sector);
		writeHeaderBlock(sector,block);
        var newBlock = readHeaderBlock(sector);
	};

    function writeHeaderBlock(sector,block){
        disk.goto(sector * SectorSize);

        disk.writeUint(2); // ID for header block
        disk.writeUint(block.typeString === "ROOT" ? 0 : sector); // self pointer, should be the same as the initial sector, unused for root block
        disk.writeUint(block.DataBlockCount || 0); // the amount of datablocks for files, unused for folders
        disk.writeUint(block.dataSize || 0);
        disk.writeUint(block.firstDataBlock || 0); // should be the same as the first block in the dataBlock List for files, not used for folders
        disk.writeUint(0); // Checksum, this will be calculated later

        for (var i = 0; i< 72; i++){
            disk.writeUint(block.pointers[i] || 0);
        }

        var blockTypeId = 2; // folder

        if (block.typeString === "ROOT"){
            blockTypeId = 1;

            disk.goto((sector * SectorSize) + SectorSize - 200);
            disk.writeUint(block.bm_flag);
            for (i = 0; i<25; i++){
                disk.writeUint(block.bitmapBlocks[i] || 0);
            }

            disk.goto((sector * SectorSize) + SectorSize - 96);
            disk.writeUint(block.bitmap_ext);

            disk.goto((sector * SectorSize) + SectorSize - 40);
            disk.writeUint(block.lastDiskChangeDays); // days since 1 jan 78
            disk.writeUint(block.lastDiskChangeMinutes);
            disk.writeUint(block.lastDiskChangeTicks);

        }else{

            if (block.typeString === "FILE"){
                blockTypeId = 4294967293; // -3
            }

            disk.goto((sector * SectorSize) + SectorSize - 188);
            disk.writeUint(block.size || 0); // filesize for files, not used for folders

            if (block.comment){
                disk.writeUbyte(block.comment.length);
                disk.writeString(block.comment); // max 79 chars
            }else{
                disk.writeUbyte(0);
			}


            disk.goto((sector * SectorSize) + SectorSize - 16);
            disk.writeUint(block.linkedSector);
            disk.writeUint(block.parent);
            disk.writeUint(block.dataBlockExtension);
		}

        disk.goto((sector * SectorSize) + SectorSize - 92);
        disk.writeUint(block.lastChangeDays); // days since 1 jan 78
        disk.writeUint(block.lastChangeMinutes);
        disk.writeUint(block.lastChangeTicks);

        if (block.name){
            disk.writeUbyte(block.name.length);
            disk.writeString(block.name); // TODO max length of name?
		}else{
            disk.writeUbyte(0);
		}

        disk.goto((sector * SectorSize) + SectorSize - 4);
        disk.writeUint(blockTypeId);

		// update checksum
        block.checkSum = calculateChecksum(sector);
        disk.goto(sector * SectorSize + 20);
        disk.writeUint(block.checkSum);

        return block;
    }

    function createFileHeaderBlock(sector,name,data,folder){

    	var dataBlockSize = me.isFFS() ? SectorSize : SectorSize-24;
    	var dataBlockCount = Math.ceil(data.length/dataBlockSize);

    	var header = {
            type: 2,
            typeString: "FILE",
			sector: sector,
            pointers: [],
            size: data.length,
            linkedSector: 0,
            parent:folder,
            dataBlockExtension:0,
            DataBlockCount:dataBlockCount,
            dataSize:0,
            firstDataBlock:0,
            name: name
        };
        for (var i=0;i<72;i++){header.pointers[i] = 0}

    	return header;
	}

    function createFolderHeaderBlock(sector,name,folder){
        var header = {
            type: 2,
            typeString: "DIR",
            sector: sector,
            pointers: [],
            linkedSector: 0,
            parent:folder,
            dataBlockExtension:0, // FFS Directory cache block
            name: name
        };
        for (var i=0;i<72;i++){header.pointers[i] = 0}

        return header;
    }

	function readExtensionBlock(sector){
		var block = {};
		disk.goto(sector * SectorSize);
		block.type = disk.readLong(); // should be 16 for LIST block

		block.headerSector  = disk.readLong();
		block.DataBlockCount = disk.readLong();

        disk.goto(sector * SectorSize + 20);
		block.checkSum = disk.readLong();

		disk.goto(sector * SectorSize + 24);
		block.pointers = [];
		for (var i = 0; i< 72; i++){
            block.pointers.push(disk.readLong() || 0);
		}
		disk.goto((sector * SectorSize) + SectorSize - 8);
		block.dataBlockExtension = disk.readLong();


		console.log("Extension block " + sector,block.DataBlockCount);
		return block;
	}

	function writeExtensionBlock(sector,block){
		disk.goto(sector * SectorSize);
		disk.writeUint(16); //LIST block
		disk.writeUint(sector); 
		disk.writeUint(block.pointers.length); 
		disk.writeUint(0); 
		disk.writeUint(0); 
		disk.writeUint(0); // checksum
		
		for (var i = 0; i< 72; i++){
			disk.writeUint(block.pointers[i] || 0);
		}
		disk.goto((sector * SectorSize) + SectorSize - 12);
		disk.writeUint(block.parent);
		disk.writeUint(block.dataBlockExtension);
		disk.writeUint(4294967293);



		// update checksum
		block.checkSum = calculateChecksum(sector);
		disk.goto(sector * SectorSize + 20);
		disk.writeUint(block.checkSum);

		return block;
	}

	function createExtensionBlock(sector,parent){
		var header = {
			type: 16,
			typeString: "EXTENSION",
			sector: sector,
			pointers: [],
            dataBlockExtension: 0,
			parent:parent,
			DataBlockCount:0
		};
		for (var i=0;i<72;i++){header.pointers[i] = 0}

		return header;
	}

    function readBitmapBlock(sector){
        var block = {};
        disk.goto(sector * SectorSize);
        block.checkSum = disk.readLong();

        block.longs = [];
        block.map = [];

		// NOTE: I assume the BitmapSize part is depending on the sector size?
		// TODO: test with other sector sizes
        for (var i = 0; i< BitmapSize; i++){
            var b = disk.readLong();
            block.longs.push(b);

            for (var j = 0; j<32; j++){
                block.map.push((b>>>j) & 1);
			}
        }

        return block;
    }
    
	function writeBitmapBlock(sector,bitmapData){
		disk.goto(sector * SectorSize);
        disk.writeUint(0); // checksum will be calculated later

		var index = 0;
		for (var i = 1; i<= BitmapSize; i++){
			var value = 0;
			for (var j = 0; j<31; j++){
				value += (bitmapData[index]<<j);
				index++;
			}
			// last one: javascript bitwise shift <<31 returns a negative number.
			if (bitmapData[index]) value += (1<<31>>>0);
			index++;
			disk.writeUint(value);
		}

		// update checksum
        var checksum = calculateChecksum(sector);
        disk.goto(sector * SectorSize);
        disk.writeUint(checksum);
	}

	function readBitmapExtensionBlock(sector){
		disk.goto(sector * SectorSize);
		var block = {
			pointers: []
		};
		for (var i = 0; i<127; i++){
			block.pointers.push(disk.readLong() || 0);
		}

		disk.goto((sector * SectorSize) + SectorSize - 4);
		block.next = disk.readLong();

		return block;
	}

	function getFileNameAtSector(sector){
		disk.goto((sector * SectorSize) + SectorSize - 80);
		var nameLength = disk.readUbyte();
		return disk.readString(nameLength);

	}

	function getFileTypeAtSector(sector){
		if (sector>= SectorCount){
			console.error("getFileTypeAtSector: sector out of range",sector);
			return "INVALID";
		}
		disk.goto((sector * SectorSize) + SectorSize - 4);
		var long = disk.readLong();
		return long == 4294967293 ? "FILE" : "DIR";
	}

	me.getBlock = function(sector){
        return readHeaderBlock(sector);
	};

	function getEmptyBlock(){
		for (var ri = 0; ri<disk.bitmap.length; ri++){
			let bitmap = disk.bitmap[ri] || [];
			var max = bitmap.length;
			for (let i = 0;i<max;i++){
				if (bitmap[i]){
					return (i + (ri * max))+2;
				}
			}
		}

        console.error("no empty block found ...")
	}

	function isEmptyBlock(sector){
		if (sector < 2 || sector >= SectorCount){
			console.error("isEmptyBlock: sector out of range",sector);
			return false;
		}

		let indexesPerBlock = BitmapSize * 32; // BitmapSize longs, 32 bits each
		let s = sector-2; // sector 0 and 1 are ignored in the bitmap blocks
		let blockIndex = Math.floor(s / indexesPerBlock);
		let mapIndex  = s % indexesPerBlock;

		if (blockIndex >= disk.bitmap.length){
			console.error("isEmptyBlock: no bitmap block for sector",sector);
			return false;
		}

		let map = disk.bitmap[blockIndex];
		if (!map){
			console.error("isEmptyBlock: no bitmap map for block",blockIndex,sector);
			let file = me.readFileAtSector(sector);
			console.error("File at sector",file);
			return false;
		}

		return disk.bitmap[blockIndex][mapIndex] === 1; // 1 = free, 0 = used
	}

	function calculateChecksum(sector,checksumPos){
        var cs = 0;
        var po = 0;
		if (typeof sector === "number"){
            var sectorData = me.readSector(sector);
		}else{
            sectorData = sector;
		}

		var ignore = (typeof checksumPos === "number") ? checksumPos : -1;

        for (var i = 0; i < SectorSize; i += 4) {
        	if (i === ignore){
        		// ignore previous checksum;
			}else{
                cs += ((sectorData[po + i] << 24) | (sectorData[po + i + 1] << 16) | (sectorData[po + i + 2] << 8) | sectorData[po + i + 3]) >>> 0;
			}
            if (cs > 0xffffffff) cs -= 0x100000000;
        }
        cs = -cs;
        if (cs < 0) cs += 0x100000000;

        return cs;
	};

	me.getFreeSize = function(refresh){
		// Free/used blocks are stored in bitmap blocks;
		// pointers to the bitmap blocks are stored in the rootblock;
		// this is the same for harddisks, but for >50MB ones - that have more then 25 bitmap blocks, there are "bitmap extension blocks" - of which the first one is linked in the bitmap_ext field of the Rootblock;

		let count = 0;

		if (refresh || !disk.bitmapBlocks){
			var rootBlock =  readHeaderBlock(rootSector);

			disk.bitmapBlocks = rootBlock.bitmapBlocks;
			var countIndex = 0;

			// read all bitmap blocks and count the free blocks
			disk.bitmap = [];
			for (var ri = 0; ri<disk.bitmapBlocks.length; ri++){
				var sector = disk.bitmapBlocks[ri];
				if (sector>0){
					let bitmapBlock = readBitmapBlock(sector);
					disk.bitmap[ri] = bitmapBlock.map;
					var max = bitmapBlock.map.length;
					for (let i = 0;i<max;i++){
						if (countIndex<SectorCount){
							count += bitmapBlock.map[i];
							countIndex++;
						}
					}
				}
			}

			if (rootBlock.bitmap_ext){
				// read bitmap extension blocks
				let sector = rootBlock.bitmap_ext;
				while (sector > 0){
					console.log("Disk has bitmap Extention Block: ",sector);
					let extensionBlock = readBitmapExtensionBlock(sector);
					extensionBlock.pointers.forEach(pointer => {
						if (pointer > 0){
							let bitmapBlock = readBitmapBlock(pointer);
							disk.bitmap.push(bitmapBlock.map);
							disk.bitmapBlocks.push(pointer);
							var max = bitmapBlock.map.length;
							for (let i = 0;i<max;i++){
								if (countIndex<SectorCount){
									count += bitmapBlock.map[i];
									countIndex++;
								}
							}
						}
					})
					sector = extensionBlock.next; // next extension block
				}
			}
			console.log("Total Bitmap Blocks: " + disk.bitmap.length);
		}else{
			// use existing bitmaps
			var countIndex = 0;
			for (var ri = 0; ri<disk.bitmap.length; ri++){
				let bitmap = disk.bitmap[ri] || [];
				var max = bitmap.length;
				for (let i = 0;i<max;i++){
					if (countIndex < SectorCount){
						count += bitmap[i];
						countIndex++;
					}
				}
			}
		}

        disk.freeBlocks = count;
		disk.totalSize = (SectorCount*SectorSize);
		disk.free = (count*SectorSize);
		disk.used = disk.totalSize - disk.free;
		return disk;

	};

	function getFreeBlocks(){
        me.getFreeSize();
		return disk.freeBlocks;
	}

	function markSectorUsed(sector,used){
		if (sector < 2 || sector >= SectorCount){
			console.error("markSectorUsed: sector out of range",sector);
			return;
		}

		let indexesPerBlock = BitmapSize * 32; // BitmapSize longs, 32 bits each
		let s = sector-2; // sector 0 and 1 are ignored in the bitmap blocks
		let blockIndex = Math.floor(s / indexesPerBlock);
		let mapIndex  = s % indexesPerBlock;

		if (blockIndex >= disk.bitmap.length){
			console.error("markSectorUsed: no bitmap block for sector",sector);
			return;
		}

		disk.bitmap[blockIndex][mapIndex] = used ? 0 : 1; // 1 = free, 0 = used

		return blockIndex;
	}

	function updateBitmapForSector(sector){
		let bitmapBlockIndex = Math.floor((sector-2) / (BitmapSize * 32));
		writeBitmapBlock(disk.bitmapBlocks[bitmapBlockIndex],disk.bitmap[bitmapBlockIndex]);
	}

	function updateBitmapIndex(bitmapBlockIndex){
		writeBitmapBlock(disk.bitmapBlocks[bitmapBlockIndex],disk.bitmap[bitmapBlockIndex]);
	}


	me.download = function(){
		var info = me.getInfo();
		var b = new Blob([disk.buffer], {type: "application/octet-stream"});

		var fileName = info.label + (SectorCount === defaultAdfSectorCount ? ".adf" : ".hdf");
		saveAs(b,fileName);
	};

	// see http://lclevy.free.fr/adflib/adf_info.html#p421
	// OK, I could have never figured that out myself ...
    function getNameHashIndex(name) {
        name = name.toUpperCase();
        var hash = name.length;
        for (var i = 0, max = name.length; i < max; i++) {
            hash=hash*13;
            hash=hash + name.charCodeAt(i);
            hash=hash&0x7ff;
        }
        hash = hash % ((SectorSize >> 2) - 56);
        // hash should be between 0 and 71 now ...
        return hash;
    }

	return me;
}();

