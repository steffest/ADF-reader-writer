/*
	Reads files and folders from Amiga Disk Format files.
	Currently only standard Amiga DD disks are supported.

	I once reverse engineered it from scratch for my Emerald Mine Level editor at http://www.steffest.com/DXboulder/
	But since I lost that source code (no GIT in 1995) now I took the info from http://lclevy.free.fr/adflib/adf_info.html
	Thanks Laurent Clevy.
*/

var adf = function(){
	var me = {};
	var disk;

	const SectorSize = 512; // the size in bytes of one sector;

	me.loadDisk = function(url,next){

		var onLoad = function(buffer){
			console.log("ADF loaded");

			disk = BinaryStream(buffer,true);

			if (disk.length == 901120){
				// only standard DD disks are support that can store 880kb
				// those disks have 1760 sectors of 512 bytes each
				console.log("880 kb disk");
				if (next) next(true);
			}else{
				console.error("this does not seem to be an uncompressed ADF file");
				if (next) next(false);
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

	me.getInfo = function(){
		disk.goto(0);

		var info = {};
		info.diskFormat = disk.readString(3);
		var diskType = disk.readUbyte();
		info.diskType = diskType == 0 ? "AmigaDOS 1.2" : 'Fast File System (AmigaDOS 2.04)';

		// read rootblock
		disk.goto(880 * SectorSize);
		info.inforootBlockType = disk.readLong();
		if (info.inforootBlockType !== 2){
			info.diskType = "UNKNOWN";
			info.diskFormat = "UNKNOWN";
		}

		disk.goto((880 * SectorSize) + SectorSize - 80);
		var nameLength = disk.readUbyte();
		info.label = disk.readString(nameLength);

		return info;
	};

	me.getSectorType = function(sector){
		if (sector == 0) return "BOOTBLOCK";
		if (sector == 880) return "ROOTBLOCK";
		if (sector == 881) return "BITMAP BLOCK";

		disk.goto(sector * SectorSize);
		var long = disk.readLong();
		if (long == 2) return "HEADER";
		if (long == 8) return "DATA BLOCK";
		if (long == 16) return "LIST (File extension block)";
		if (long == 33) return "DIRCACHE (Directory cache block)";

		return "EMPTY (or this is not a DOS disk)"
	};

	me.readFileAtSector = function(sector,includeContent){
		var file = {
			sector: sector
		};

		var block = readHeaderBlock(sector);
		for (var key in block.item){
			if (block.item.hasOwnProperty(key)) file[key] = block.item[key];
		}

		if (includeContent){
			file.content = new Uint8Array(file.size);

			// there are 2 ways to read a file:
			// 1 is to read the list of datablock pointers and collect each datablock
			// 2 is to follow the linked list of datablocks

			// the second one seems somewhat easier to implement
			// because otherwise we have to collect each extention block first
			var index = 0;
			var nextBlock = block.firstDataBlock;
			while (nextBlock !== 0){
				block = readDataBlock(nextBlock);
				file.content.set(block.content,index);
				index += block.dataSize;
				nextBlock = block.nextDataBlock;
			}
		}

		return file;
	};

	me.readFolderAtSector = function(sector){
		var directory = {
			folders: [],
			files: [],
			sector: sector
		};

		var block = readHeaderBlock(sector);
		for (var key in block.item){
			if (block.item.hasOwnProperty(key)) directory[key] = block.item[key];
		}

		// NOTE: block.pointers contains only the first 72 entries
		// the rest is linked to another entry (which is a weird design)
		var entries = [];
		block.pointers.forEach(function(sector){
			entries.push({
				sector: sector,
				name: getFileNameAtSector(sector),
				type: getFileTypeAtSector(sector)
			})
		});

		// NOTE:  entries.length may change in the loop if we find chained files
		for (var i = 0; i< entries.length; i++){
			var entry = entries[i];

			if (entry.type == "FILE"){
				var file = me.readFileAtSector(entry.sector,false);
				directory.files.push(file);
				if (file.linkedSector) entries.push(
						{
							sector: file.linkedSector,
							name: getFileNameAtSector(file.linkedSector),
							type: getFileTypeAtSector(file.linkedSector)
						}
				);
			}else{
				// TODO: shouldn't we also need to follow the linkedSector of Folders?
				// What if a folder has more then 72 subfolders?
				directory.folders.push(entry);
			}
		}

		return directory;
	};

	me.readRootFolder = function(){
		return me.readFolderAtSector(880);
	};

	function readDataBlock(sector){
		var block = {};
		disk.goto(sector * SectorSize);
		block.type = disk.readLong(); // should be 8 for DATA block
		block.headerSector  = disk.readLong(); // points to the file HEADER block this data block belongs to;
		block.number = disk.readLong(); // index in the file datablock list;
		block.dataSize = disk.readLong();
		block.nextDataBlock = disk.readLong(); // == 0 if this is the last block
		block.checkSum = disk.readLong();

		if (block.type == 8){
			block.content = new Uint8Array(block.dataSize);
			disk.goto((sector * SectorSize) + 24);
			for (var i = 0; i<block.dataSize; i++){
				block.content[i] = disk.readUbyte();
			}
		}else{
			// invalid file
			block.content = new Uint8Array(0);
			block.dataSize = 0;
			block.nextDataBlock = 0;
		}


		return block;
	}

	function readHeaderBlock(sector){
		disk.goto(sector * SectorSize);

		var block = {};
		block.type  = disk.readLong(); // should be 2 for HEADER block
		block.headerSector  = disk.readLong(); // self pointer, should be the same as the initial sector
		block.DataBlockCount = disk.readLong(); // the amount of datablocks for files, unused for folders
		block.dataSize = disk.readLong(); // not used for folders
		block.firstDataBlock = disk.readLong(); // should be the same as the first block in the dataBlock List for files, not used for folders
		block.checkSum = disk.readLong();

		block.pointers = [];
		// 72 longs
		// for folders thsese are pointers of files and directories in header sector
		// for files these are pointers to the datablocks
		for (var i = 1; i<= 72; i++){
			var b = disk.readLong();
			if (b) block.pointers.unshift(b);
		}


		disk.goto((sector * SectorSize) + SectorSize - 188);
		block.item = {};
		block.item.size = disk.readLong(); // filesize for files, not used for folders
		var dataLength = disk.readUbyte();
		block.item.comment = dataLength ? disk.readString(dataLength) : "";

		disk.goto((sector * SectorSize) + SectorSize - 92);
		block.item.lastChangeDays = disk.readLong(); // days since 1 jan 78
		block.item.lastChangeMinutes = disk.readLong();
		block.item.lastChangeTicks = disk.readLong(); // in 1/50s of a seconds

		dataLength = disk.readUbyte();
		block.item.name = dataLength ? disk.readString(dataLength) : "";

		disk.goto((sector * SectorSize) + SectorSize - 16);
		block.item.linkedSector = disk.readLong(); // sector of entry in the same folder
		block.item.parent = disk.readLong();
		block.item.dataBlockExtention = disk.readLong();
		block.item.type = disk.readLong() == 4294967293 ? "FILE" : "DIR"; // 4294967293 == -3 , should we read as signed ?
		// block.item.type == 2 : USERDIR

		return block;
	}

	function readExtentionBlock(sector){
		var block = {};
		disk.goto(sector * SectorSize);
		block.type = disk.readLong(); // should be 16 for LIST block
	}

	function getFileNameAtSector(sector){
		disk.goto((sector * SectorSize) + SectorSize - 80);
		var nameLength = disk.readUbyte();
		return disk.readString(nameLength);

	}

	function getFileTypeAtSector(sector){
		disk.goto((sector * SectorSize) + SectorSize - 4);
		var long = disk.readLong();
		return long == 4294967293 ? "FILE" : "DIR";
	}

	return me;
}();