# ADF reader/writer
This is an implementation of the Amiga Filesystem in plain javascript.  
It can be used to read, extract and write files from/to Amiga Disk Format (*.adf and *.hdf) files.


Both Original (OFS) and Fast File System (FFS) are supported in both ADF floppy disk images and HDF hard disk images.
Hard disk images with multiple partitions are not supported yet.

The main module is [adf.js](https://github.com/steffest/ADF-reader/blob/master/script/adf.js)  
It uses a binary file wrapper at [file.js](https://github.com/steffest/ADF-reader/blob/master/script/file.js) for easy parsing binary data.

The rest of the package is a small demo, providing a simple user interface to 
 - browse the disk
 - extract/view files
 - create folders and files
Live demo at [http://www.stef.be/adfviewer/](http://www.stef.be/adfviewer/)

It can disregard all block checksums and file attributes, which makes it quite useful to salvage files from corrupt disks.
For further digging, you can also extract raw sectors for reconstructing deleted files etc.  

I mainly wrote it to quickly inspect .adf files for Amiga music tracker files or [Emerald Mine disks](http://www.emeraldmines.net/) without the need to fire up an Amiga Emulator.  
Basic writing support was added for interaction with the [Scripted Amiga Emulator](https://github.com/naTmeg/ScriptedAmigaEmulator)

### Main API:

#### adf.loadDisk(source)
> Loads a disk from an adf or hdf file. When source is a string, it's considered as a URI, otherwise you can pass an ArrayBuffer.  
> All future actions will be done on this disk.

#### adf.getInfo()
> Returns some basic info on the disk.

#### adf.getFreeSize()
> Returns the used and free space of the disk (in blocks and bytes).

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

#### adf.writeFile(name,buffer,folderSector)
> Creates a new file into a specific folder.  
> It returns the sector of the new file on succes or *False* on failure. (e.g. because diskspace is insufficient)
> Buffer is an ArrayBuffer with the binary content
> Sequential datablocks are used as much as possible to speed up reading on an actual (or emulated) Amiga." 

#### adf.deleteFileAtSector(sector)
> Deletes a file  
> Just as on the Amiga only the entry of the file in its folder is removed, all the header and datablocks are left intact,
> so it's possible to reconstruct the file as long as no new data is written to the disk. 

#### adf.createFolder(name,folderSector)
> Creates a folder.  
> it returns the sector of the new folder  

#### adf.deleteFolderAtSector(sector)
> Deletes a folder
> Please note that the folder must me empty so for recursive deletion you should first list the folder,
> then delete all files and finally delete the folder  

#### adf.renameFileOrFolderAtSector(sector,newname)
> Renames a file or a folder.  
> the maximum length of a name is 30 chars.  
> the characters / and : are not allowed  


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

#### readExtensionBlock(sector)
> Returns a parsed extentionBlock

#### readBitmapblock(sector)
> Returns a parsed bitmapBlock

#### readBitmapExtensionBlock(sector)
> Returns a parsed extended bitmapBlock

#### getDisk()
> Returns the current disk structure. the "buffer" property contains the binary data of the disk

### Notes
**Writing support is still a bit experimental**.   
Don't use it for important stuff, it certainly is **not** production ready.  
When writing, all dates are ignore for the time being, so "last changed" and "last accessed" dates will not be updated.  




