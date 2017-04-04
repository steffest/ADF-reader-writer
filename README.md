# ADF-reader
Read and extract files from Amiga Disk Format (*.adf) files in plain javascript.  
Currently only standard Amiga Double Density disk are supported (the 880 kb ones)  
For folder and file parsing, only AmigaDOS formatted disks are supported.  

The main module is [adf.js](https://github.com/steffest/ADF-reader/blob/master/script/adf.js)  
It uses a binary file wrapper at [file.js](https://github.com/steffest/ADF-reader/blob/master/script/file.js) for easy parsing binary data.

The rest of the package is a small demo, providing a simple user interface to browse the disk.  
Live demo at [http://www.stef.be/adfviewer/](http://www.stef.be/adfviewer/)

It disregards all block checksums and file attributes, which makes it quite useful to salvage files from corrupt disks.  
For further digging, you can also extract raw sectors for reconstructing deleted files etc.  

I mainly wrote it to quickly inspect .adf files for Amiga music tracker files or [Emerald Mine disks](http://www.emeraldmines.net/) without the need to fire up an Amiga Emulator.

### Main API:

#### adf.loadDisk(source)
> Loads a disk from an adf file. When source is a string, it's considered as a URI, otherwise you can pass an ArrayBuffer.  
> All future actions will be done on this disk.

#### adf.getInfo()
> Returns some basic info on the disk.

#### adf.readRootFolder()
> Returns the files and directories of the root folder of the disk.  
> Each file and folder has a *sector* parameters which points to the start sector of the file or folder.

#### adf.readFolderAtSector(sector)
> Returns the files and directories of a specific folder that starts at *sector*.  
> The starting sector is usually obtained from listing the root folder.  
> Each file and folder has a *sector* parameters which points to the start sector of the file or folder.  
> Each file and folder also has a *parent* parameter indicating the parent folder so you can traverse back up.

#### adf.readFileAtSector(sector,includeContent)
> Returns the file info (and optional content) of the file starting at *sector*  
> The starting sector is usually obtained from listing a folder.  
> If *includeContent* is true then the *content* parameter contains the binary content of the file.

### additional API
The following methods are available for low level disk reading  

#### readSector(sector)
> Returns a raw sector from the disk.  
> A sector of a standard Amiga is 512 bytes

#### getSectorType(sector)
> Returns the type of the sector (headerBlock, dataBlock, extentionBlock, ...)

#### readHeaderBlock(sector)
> Returns a parsed headerBlock

#### readDataBlock(sector)
> Returns a parsed dataBlock

#### readExtentionBlock(sector)
> Returns a parsed extentionBlock




