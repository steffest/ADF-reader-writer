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

		console.error(typeof url);

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

		disk.goto((sector * SectorSize));

		var file = {sector: sector};
		var block = {};
		block.type  = disk.readLong(); // should be 2 for HEADER block
		block.headerSector  = disk.readLong(); // self pointer, should be the same as the initial sector
		block.DataBlockCount = disk.readLong(); // the amount of datablocks;
		block.dataSize = disk.readLong(); // not used
		block.firstDataBlock = disk.readLong(); // should be the same as the first block in the dataBlock List
		block.checkSum = disk.readLong();

		var entries = [];
		// data block pointers are stored bottom to top ?
		// do we need to stop if numberDataBlocks is reached ?
		// do we even need this as the firstDataBlock pointer is also at offset 0x10 ?
		for (var i = 0; i<72; i++){
			var b = disk.readLong();
			if (b) entries.unshift(b);
		}
		file.datablocks = entries;

		disk.goto((sector * SectorSize) + SectorSize - 188);
		file.size = disk.readLong();
		var dataLength = disk.readUbyte();
		file.comment = dataLength ? disk.readString(dataLength) : "";
		disk.goto((sector * SectorSize) + SectorSize - 92);
		file.lastChangeDays = disk.readLong(); // days since 1 jan 78
		file.lastChangeMinutes = disk.readLong();
		file.lastChangeTicks = disk.readLong(); // in 1/50s of a seconds

		dataLength = disk.readUbyte();
		file.name = dataLength ? disk.readString(dataLength) : "";

		disk.goto((sector * SectorSize) + SectorSize - 16);
		file.hashChain = disk.readLong();
		file.parent = disk.readLong();
		file.dataBlockExtention = disk.readLong();
		file.type = disk.readLong() == 4294967293 ? "FILE" : "DIR"; // 4294967293 == -3 , should we read as signed ?

		if (includeContent){
			file.content = new Uint8Array(file.size);

			// TODO: dude - we still need to load the rest of the pointers for files > 2 kb ....
			var index = 0;
			entries.forEach(function(sector){
				var block = readDataBlock(sector);
				file.content.set(block.content,index);
				index += block.dataSize;
			});
		}

		return file;
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
		// todo - header block for files and folders are almost the same, no?
	}

	me.readSector = function(sector){
		disk.goto(sector * SectorSize);
		var result = new Uint8Array(SectorSize);
		for (var i = 0; i<SectorSize; i++){
			result[i] = disk.readUbyte();
		}
		return result;
	};


	me.readFolderAtSector = function(sector){

		var directory = {
			folders: [],
			files: []
		};

		var entries = [];

		disk.goto(sector * SectorSize);

		var block = {};
		block.type = disk.readLong(); // should be 2 = HEADER
		block.headerBlock = disk.readLong(); // should be the same as the initial sector
		block.unused = disk.readLong();
		block.unused = disk.readLong();
		block.unused = disk.readLong();
		block.checksum = disk.readLong();

		var pointers = [];
		// 72 longs for pointers of files and directories in header sector
		for (var i = 1; i<= 72; i++){
			var b = disk.readLong();
			if (b) pointers.unshift(b);
		}

		disk.goto((sector * SectorSize) + SectorSize - 184);
		var dataLength = disk.readUbyte();
		directory.comment = dataLength ? disk.readString(dataLength) : "";

		disk.goto((sector * SectorSize) + SectorSize - 92);
		directory.lastChangeDays = disk.readLong(); // days since 1 jan 78
		directory.lastChangeMinutes = disk.readLong();
		directory.lastChangeTicks = disk.readLong(); // in 1/50s of a seconds

		dataLength = disk.readUbyte();
		directory.name = dataLength ? disk.readString(dataLength) : "";

		disk.goto((sector * SectorSize) + SectorSize - 40);
		directory.nextLink = disk.readLong();


		disk.goto((sector * SectorSize) + SectorSize - 16);
		directory.nextHeaderSector = disk.readLong();
		directory.parent = disk.readLong();
		directory.dataBlockExtention = disk.readLong();
		directory.type = disk.readLong() == 4294967293 ? "FILE" : "DIR"; // 4294967293 == -3 , should we read as signed ?

		// 2: USERDIR

		pointers.forEach(function(sector){
			entries.push({
				sector: sector,
				name: getFileNameAtSector(sector),
				type: getFileTypeAtSector(sector)
			})
		});

		// note:  entries.length may change in the loop if we find chained files
		for (i = 0; i< entries.length; i++){
			var entry = entries[i];

			if (entry.type == "FILE"){
				var file = me.readFileAtSector(entry.sector,false);
				directory.files.push(file);
				if (file.hashChain) entries.push(
					{
						sector: file.hashChain,
						name: getFileNameAtSector(file.hashChain),
						type: getFileTypeAtSector(file.hashChain)
					}
				);
			}else{
				// TODO: shouldn't we also need to follow the hashChain of Folders?
				directory.folders.push(entry);
			}
		}

		return directory;
	};

	me.readRootFolder = function(){
		return me.readFolderAtSector(880);
	};

	return me;
}();