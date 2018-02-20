/*

  Based on dms.js of the Scripted Amiga Emulator (GPL) by Rupert Hausberger
  Which is based on the DMS reader in WinUAE 3.2.x by Toni Willen
  Which is based on :

  xDMS  v1.3  -  Portable DMS archive unpacker  -  Public Domain
  Written by     Andre Rodrigues de la Rocha  <adlroc@usa.net>

*/

var DMS = function() {

	var me = {};

	me.fileTypes={
		DMS: {name: "Disk Masher File"}
	};

	me.detect=function(file){
		var id = file.readString(4);
		if (id === "DMS!"){
			return FILETYPE.DMS;
		}
	};

	const DMS_LOG = false;

	/* Functions return codes */
	const NO_PROBLEM = 0;
	const DMS_FILE_END = 1;
	const ERR_NOMEMORY = 2;
	const ERR_CANTOPENIN = 3;
	const ERR_CANTOPENOUT = 4;
	const ERR_NOTDMS = 5;
	const ERR_SREAD = 6;
	const ERR_HCRC = 7;
	const ERR_NOTTRACK = 8;
	const ERR_BIGTRACK = 9;
	const ERR_THCRC = 10;
	const ERR_TDCRC = 11;
	const ERR_CSUM = 12;
	const ERR_CANTWRITE = 13;
	const ERR_BADDECR = 14;
	const ERR_UNKNMODE = 15;
	const ERR_NOPASSWD = 16;
	const ERR_BADPASSWD = 17;
	const ERR_FMS = 18;
	const ERR_GZIP = 19;
	const ERR_READDISK = 20;

	/* Command to execute */
	const CMD_VIEW = 1;
	const CMD_VIEWFULL = 2;
	const CMD_SHOWDIZ = 3;
	const CMD_SHOWBANNER = 4;
	const CMD_TEST = 5;
	const CMD_UNPACK = 6;
	const CMD_UNPKGZ = 7;
	const CMD_EXTRACT = 8;

	const OPT_VERBOSE = 1;
	const OPT_QUIET = 2;


	/*---------------------------------*/
	/* support */

	const d_code = [
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
		0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
		0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
		0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02, 0x02,
		0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
		0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
		0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04,
		0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
		0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
		0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08,
		0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09, 0x09,
		0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A,
		0x0B, 0x0B, 0x0B, 0x0B, 0x0B, 0x0B, 0x0B, 0x0B,
		0x0C, 0x0C, 0x0C, 0x0C, 0x0D, 0x0D, 0x0D, 0x0D,
		0x0E, 0x0E, 0x0E, 0x0E, 0x0F, 0x0F, 0x0F, 0x0F,
		0x10, 0x10, 0x10, 0x10, 0x11, 0x11, 0x11, 0x11,
		0x12, 0x12, 0x12, 0x12, 0x13, 0x13, 0x13, 0x13,
		0x14, 0x14, 0x14, 0x14, 0x15, 0x15, 0x15, 0x15,
		0x16, 0x16, 0x16, 0x16, 0x17, 0x17, 0x17, 0x17,
		0x18, 0x18, 0x19, 0x19, 0x1A, 0x1A, 0x1B, 0x1B,
		0x1C, 0x1C, 0x1D, 0x1D, 0x1E, 0x1E, 0x1F, 0x1F,
		0x20, 0x20, 0x21, 0x21, 0x22, 0x22, 0x23, 0x23,
		0x24, 0x24, 0x25, 0x25, 0x26, 0x26, 0x27, 0x27,
		0x28, 0x28, 0x29, 0x29, 0x2A, 0x2A, 0x2B, 0x2B,
		0x2C, 0x2C, 0x2D, 0x2D, 0x2E, 0x2E, 0x2F, 0x2F,
		0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37,
		0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F
	];
	const d_len = [
		0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
		0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
		0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
		0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
		0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04,
		0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04,
		0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04,
		0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04,
		0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04,
		0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04,
		0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
		0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
		0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
		0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
		0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
		0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
		0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
		0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
		0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
		0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
		0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
		0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
		0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
		0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
		0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08,
		0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08
	];

	const LOC_QUICK = 0;
	const LOC_MEDIUM = 1;
	const LOC_HEAVY = 2;
	const LOC_DEEP = 3;
	var dms_loc = new Uint16Array(4); //OWN

	const dms_mask_bits = [
		0x000000,0x000001,0x000003,0x000007,0x00000f,0x00001f,
		0x00003f,0x00007f,0x0000ff,0x0001ff,0x0003ff,0x0007ff,
		0x000fff,0x001fff,0x003fff,0x007fff,0x00ffff,0x01ffff,
		0x03ffff,0x07ffff,0x0fffff,0x1fffff,0x3fffff,0x7fffff,
		0xffffff
	];
	var dms_indata = null;
	var dms_indata_pos = 0; //OWN
	var dms_bitcount = 0;
	var dms_bitbuf = 0; //u32

	function GETBITS(n) {
		return (dms_bitbuf >>> (dms_bitcount - n)) & 0xffff;
	}
	function DROPBITS(n) {
		dms_bitcount -= n;
		dms_bitbuf = dms_bitbuf & dms_mask_bits[dms_bitcount];
		while (dms_bitcount < 16) {
			dms_bitbuf = ((dms_bitbuf << 8) | dms_indata[dms_indata_pos++]) >>> 0;
			dms_bitcount += 8;
		}
	}

	function initbitbuf(id) {
		dms_bitbuf = 0;
		dms_bitcount = 0;
		dms_indata = id;
		dms_indata_pos = 0;
		DROPBITS(0);
	}

	/*---------------------------------*/
	/* Run Length Encoding */

	function Unpack_RLE(src, dst, origsize) {
		var srco = 0, dsto = 0;
		var n = 0; //u16
		var a = 0, b = 0;

		while (dsto < origsize){
			if ((a = src[srco++]) != 0x90)
				dst[dsto++] = a;
			else if (!(b = src[srco++]))
				dst[dsto++] = a;
			else {
				a = src[srco++];
				if (b == 0xff) {
					n = src[srco++];
					n = (n << 8) + src[srco++];
				} else
					n = b;
				if (dsto + n > origsize) return 1;
				//memset(dst,a,n);
				memset(dst,dsto, a, n);
				dsto += n;
			}
		}
		return 0;
	}

	/*---------------------------------*/
	/* Quick */

	const QBITMASK = 0xff;

	function Unpack_QUICK(src, dst, origsize){
		var dsto = 0;
		var i = 0, j = 0;

		initbitbuf(src);
		while (dsto < origsize) {
			if (GETBITS(1) != 0) {
				DROPBITS(1);
				dst[dsto++] = dms_text[dms_loc[LOC_QUICK]++ & QBITMASK] = GETBITS(8) & 0xff; DROPBITS(8);
			} else {
				DROPBITS(1);
				j = GETBITS(2) + 2; DROPBITS(2);
				i = dms_loc[LOC_QUICK] - GETBITS(8) - 1; DROPBITS(8);
				while (j--) {
					dst[dsto++] = dms_text[dms_loc[LOC_QUICK]++ & QBITMASK] = dms_text[i++ & QBITMASK];
				}
			}
		}
		dms_loc[LOC_QUICK] = dms_loc[LOC_QUICK] + 5 & QBITMASK;
		return 0;
	}

	/*---------------------------------*/
	/* Medium */

	const MBITMASK = 0x3fff;

	function Unpack_MEDIUM(src, dst, origsize) {
		var dsto = 0;
		var i = 0, j = 0, c = 0;

		initbitbuf(src);
		while (dsto < origsize) {
			if (GETBITS(1) != 0) {
				DROPBITS(1);
				dst[dsto++] = dms_text[dms_loc[LOC_MEDIUM]++ & MBITMASK] = GETBITS(8) & 0xff;
				DROPBITS(8);
			} else {
				DROPBITS(1);
				c = GETBITS(8); DROPBITS(8);
				j = d_code[c] + 3;
				u = d_len[c];
				c = ((c << u) | GETBITS(u)) & 0xff; DROPBITS(u);
				u = d_len[c];
				c = (d_code[c] << 8) | (((c << u) | GETBITS(u)) & 0xff); DROPBITS(u);
				i = dms_loc[LOC_MEDIUM] - c - 1;

				while (j--) dst[dsto++] = dms_text[dms_loc[LOC_MEDIUM]++ & MBITMASK] = dms_text[i++ & MBITMASK];

			}
		}
		dms_loc[LOC_MEDIUM] = dms_loc[LOC_MEDIUM] + 66 & MBITMASK;
		return 0;
	}

	/*---------------------------------*/
	/* Deep, Lempel-Ziv-DynamicHuffman decompression */


	/* reported from xDMS  v1.3.3 */
	var deep_text_loc;
	var init_deep_tabs = 1;

	const DBITMASK  = 0x3fff;              /* uses 16Kb dictionary  */

	const F         = 60;                  /* lookahead buffer size */
	const THRESHOLD = 2;
	const N_CHAR    = 256 - THRESHOLD + F; /* kinds of characters (character code = 0..N_CHAR-1) */
	const T         = N_CHAR * 2 - 1;      /* size of table */
	const R         = T - 1;               /* position of root */
	const MAX_FREQ  = 0x8000;              /* updates tree when the */

	var freq = new Uint16Array(T + 1); /* frequency table */
	/* pointers to parent nodes, except for the */
	/* elements [T..T + N_CHAR - 1] which are used to get */
	/* the positions of leaves corresponding to the codes. */
	var prnt = new Uint16Array(T + N_CHAR);
	var son = new Uint16Array(T);   /* pointers to child nodes (son[], son[] + 1) */



	function Init_DEEP_Tabs(){
		var i = 0;
		var j = 0;

		for (i = 0; i < N_CHAR; i++) {
			freq[i] = 1;
			son[i] = USHORT(i + T);
			prnt[i + T] = i;
		}
		i = 0;
		j = N_CHAR;
		while (j <= R) {
			freq[j] = USHORT(freq[i] + freq[i + 1]);
			son[j] = i;
			prnt[i] = prnt[i + 1] = j;
			i += 2; j++;
		}
		freq[T] = 0xffff;
		prnt[R] = 0;

		init_deep_tabs = 0;
	}


	function Unpack_DEEP(src, dst, origsize){
		var i = 0, j = 0, c = 0;
		var dsto = 0;

		initbitbuf(src);
		if (init_deep_tabs) Init_DEEP_Tabs();

		while (dsto < origsize) {
			c = DecodeChar();
			if (c < 256) {
				dst[dsto++] = dms_text[deep_text_loc++ & DBITMASK] = c & 0xff;
			} else {
				j = (c - 255 + THRESHOLD);
				i = (deep_text_loc - DecodePosition() - 1);
				while (j--) {
					dst[dsto++] = dms_text[deep_text_loc++ & DBITMASK] = dms_text[i++ & DBITMASK];
				}
			}
		}

		deep_text_loc = (deep_text_loc + 60 & DBITMASK);

		return 0;
	}

	function DecodeChar(){
		var c = son[R];

		/* travel from root to leaf, */
		/* choosing the smaller child node (son[]) if the read bit is 0, */
		/* the bigger (son[]+1} if 1 */
		while (c < T) {
			c = son[c + GETBITS(1)];
			DROPBITS(1);
		}
		c -= T;
		update(c);
		return c;
	}

	function DecodePosition(){
		var i = GETBITS(8); DROPBITS(8);
		var c = (d_code[i] << 8);
		var j = d_len[i];
		i = USHORT(((i << j) | GETBITS(j)) & 0xff); DROPBITS(j);

		return (c | i);
	}


	/* reconstruction of tree */

	function reconst(){
		var i = 0, j = 0, k = 0, f = 0, l = 0, m = 0;

		/* collect leaf nodes in the first half of the table */
		/* and replace the freq by (freq + 1) / 2. */
		for (i = 0; i < T; i++) {
			if (son[i] >= T) {
				freq[j] = ((freq[i] + 1) >> 1);
				son[j] = son[i];
				j++;
			}
		}

		/* begin constructing tree by connecting sons */
		for (i = 0, j = N_CHAR; j < T; i += 2, j++) {
			k = (i + 1);
			f = freq[j] = (freq[i] + freq[k]);
			for (k = (j - 1); f < freq[k]; k--);
			k++;
			l = ((j - k) << 1);
			//l = j - k;
			//memmove(&freq[k + 1], &freq[k], (size_t)l);
			for (m = l-1; m >= 0; m--) freq[k + m + 1] = freq[k + m];
			freq[k] = f;
			//memmove(&son[k + 1], &son[k], (size_t)l);
			for (m = l-1; m >= 0; m--) son[k + m + 1] = son[k + m];
			son[k] = i;
		}
		/* connect prnt */
		for (i = 0; i < T; i++) {
			if ((k = son[i]) >= T) {
				prnt[k] = i;
			} else {
				prnt[k] = prnt[k + 1] = i;
			}
		}
	}

	/* increment frequency of given code by one, and update tree */

	function update(c){
		var i = 0, j = 0, k = 0, l = 0;

		if (freq[R] == MAX_FREQ)
			reconst();

		c = prnt[c + T];
		do {
			k = ++freq[c];

			/* if the order is disturbed, exchange nodes */

			if (k > freq[l = (c + 1)]) {
				while (k > freq[++l]);
				l--;
				freq[c] = freq[l];
				freq[l] = k;

				i = son[c];
				prnt[i] = l;
				if (i < T) prnt[i + 1] = l;

				j = son[l];
				son[l] = i;

				prnt[j] = c;
				if (j < T) prnt[j + 1] = c;
				son[c] = j;

				c = l;
			}
		} while ((c = prnt[c]) != 0); /* repeat up to root */
	}




	/*---------------------------------*/
	/* Heavy, Lempel-Ziv-Huffman decompression */

	const NC = 510;
	const NPT = 20;
	const N1 = 510;
	const OFFSET = 253;

	var c_len = new Uint8Array(NC);
	var c_table = new Uint16Array(4096);
	var pt_len = new Uint8Array(NPT);
	var pt_table = new Uint16Array(256);

	var dms_left = new Uint16Array(2 * NC - 1);
	var dms_right = new Uint16Array(2 * NC - 1 + 9);
	var dms_lastlen = 0, dms_np = 0; //u16

	function dms_make_table(nchar, bitlen, tablebits, table) {
		var c = 0; //s16
		var n = 0, tblsiz = 0, len = 0, depth = 0, maxdepth = 0, avail = 0; //u16
		var codeword = 0, bit = 0, tbl = null, err = 0; //u16
		var blen = null; //u8 *

		function mktbl() {
			var i = 0;

			if (err) return 0;

			if (len == depth) {
				while (++c < n)
					if (blen[c] == len) {
						i = codeword;
						codeword += bit;
						if (codeword > tblsiz) {
							err = 1;
							return 0;
						}
						while (i < codeword) tbl[i++] = c;
						return c;
					}
				c = -1;
				len++;
				bit >>= 1;
			}
			depth++;
			if (depth < maxdepth) {
				mktbl();
				mktbl();
			} else if (depth > 32) {
				err = 2;
				return 0;
			} else {
				if ((i = avail++) >= 2 * n - 1) {
					err = 3;
					return 0;
				}
				dms_left[i] = mktbl();
				dms_right[i] = mktbl();
				if (codeword >= tblsiz) {
					err = 4;
					return 0;
				}
				if (depth == maxdepth) tbl[codeword++] = i;
			}
			depth--;
			return i;
		}

		n = avail = nchar;
		blen = bitlen;
		tbl = table;
		tblsiz = 1 << tablebits;
		bit = tblsiz >> 1;
		maxdepth = tablebits + 1;
		depth = len = 1;
		c = -1;
		codeword = 0;
		err = 0;
		mktbl();	// left subtree
		if (err) return err;
		mktbl();	// right subtree
		if (err) return err;
		if (codeword != tblsiz) return 5;
		return 0;
	}

	function read_tree_c() {
		var n = GETBITS(9);
		DROPBITS(9);
		if (n > 0) {
			for (var i = 0; i < n; i++) {
				c_len[i] = GETBITS(5) & 0xff;
				DROPBITS(5);
			}
			for (i = n; i < 510; i++) c_len[i] = 0;
			if (dms_make_table(510, c_len, 12, c_table)) return 1;
		} else {
			n = GETBITS(9);
			DROPBITS(9);
			for (var i = 0; i < 510; i++) c_len[i] = 0;
			for (i = 0; i < 4096; i++) c_table[i] = n;
		}
		return 0;
	}
	function read_tree_p() {
		var n = GETBITS(5);
		DROPBITS(5);
		if (n > 0){
			for (var i = 0; i < n; i++) {
				pt_len[i] = GETBITS(4) & 0xff;
				DROPBITS(4);
			}
			for (i = n; i < dms_np; i++) pt_len[i] = 0;
			if (dms_make_table(dms_np, pt_len, 8, pt_table)) return 1;
		} else {
			n = GETBITS(5);
			DROPBITS(5);
			for (var i = 0; i < dms_np; i++) pt_len[i] = 0;
			for (i = 0; i < 256; i++) pt_table[i] = n;
		}
		return 0;
	}

	function decode_c(){
		var j = c_table[GETBITS(12)];
		if (j < N1) {
			DROPBITS(c_len[j]);
		} else {
			DROPBITS(12);
			var i = GETBITS(16);
			var m = 0x8000;
			do {
				if (i & m) j = dms_right[j];
				else       j = dms_left [j];
				m >>= 1;
			} while (j >= N1);
			DROPBITS(c_len[j] - 12);
		}
		return j;
	}
	function decode_p(){
		var j = pt_table[GETBITS(8)];
		if (j < dms_np) {
			DROPBITS(pt_len[j]);
		} else {
			DROPBITS(8);
			var i = GETBITS(16);
			var m = 0x8000;
			do {
				if (i & m) j = dms_right[j];
				else       j = dms_left [j];
				m >>= 1;
			} while (j >= dms_np);
			DROPBITS(pt_len[j] - 8);
		}
		if (j != dms_np-1) {
			if (j > 0) {
				j = GETBITS(i = j-1) | (1 << (j-1));
				DROPBITS(i);
			}
			dms_lastlen = j;
		}
		return dms_lastlen;
	}

	function Unpack_HEAVY(src, dst, flags, origsize){
		/*  Heavy 1 uses a 4Kb dictionary, Heavy 2 uses 8Kb  */
		if (flags & 8) {
			dms_np = 15;
			var bitmask = 0x1fff;
		} else {
			dms_np = 14;
			var bitmask = 0x0fff;
		}
		initbitbuf(src);

		if (flags & 2) {
			if (read_tree_c()) return 1;
			if (read_tree_p()) return 2;
		}

		var dsto = 0;
		while (dsto < origsize) {
			var c = decode_c();
			if (c < 256) {
				dst[dsto++] = dms_text[dms_loc[LOC_HEAVY]++ & bitmask] = c;
			} else {
				var j = c - OFFSET;
				var i = dms_loc[LOC_HEAVY] - decode_p() - 1;
				while (j--) dst[dsto++] = dms_text[dms_loc[LOC_HEAVY]++ & bitmask] = dms_text[i++ & bitmask];
			}
		}
		return 0;
	}

	/*---------------------------------*/

	function Init_Decrunchers() {
		dms_loc[LOC_QUICK] = 251;

		dms_loc[LOC_MEDIUM] = 0x3fbe;

		dms_loc[LOC_HEAVY] = 0;
		dms_lastlen = 0;
		dms_np = 0;

		deep_text_loc = 0x3fc4;
		init_deep_tabs = 1;

		//memset(dms_text,0,0x3fc8);
		memset(dms_text,0, 0, 0x3fc8);
	}

	/*-----------------------------------------------------------------------*/

	const HEADLEN = 56;
	const THLEN = 20;
	const TRACK_BUFFER_LEN = 32000;
	const TEMP_BUFFER_LEN = 32000;

	const DMSFLAG_ENCRYPTED = 2;
	const DMSFLAG_HD = 16;

	const DMS_MAX_EXTRA = 10;

	const modes = ["NOCOMP", "SIMPLE", "QUICK ", "MEDIUM", "DEEP  ", "HEAVY1", "HEAVY2"];

	var PWDCRC = 0; //u16
	var passfound = 0, passretries = 0;

	var dms_text = null; //u8 *

	/*---------------------------------*/

	function ctime(t){
		var a = new Date(t * 1000);
		var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
		var year = a.getFullYear();
		var month = months[a.getMonth()];
		var date = a.getDate();
		var hour = a.getHours();
		var min = a.getMinutes();
		var sec = a.getSeconds();
		return date + ' ' + month + ' ' + year + ' ' + hour + ":" + min + ":" + sec;
	}

	/*---------------------------------*/

	function log_error(track) {
		console.warn("DMS() Ignored error on track " +  track);
	}



	/*---------------------------------*/

	function dms_Calc_CheckSum(mem, size){
		var u = 0; //u16
		var p = 0;
		while (size--) {
			u += mem[p++];
			if (u > 0xffff) u -= 0x10000;
		}
		return u; //(u & 0xffff);
	}

	/*---------------------------------*/

	const CRCTab = [
		0x0000,0xC0C1,0xC181,0x0140,0xC301,0x03C0,0x0280,0xC241,
		0xC601,0x06C0,0x0780,0xC741,0x0500,0xC5C1,0xC481,0x0440,
		0xCC01,0x0CC0,0x0D80,0xCD41,0x0F00,0xCFC1,0xCE81,0x0E40,
		0x0A00,0xCAC1,0xCB81,0x0B40,0xC901,0x09C0,0x0880,0xC841,
		0xD801,0x18C0,0x1980,0xD941,0x1B00,0xDBC1,0xDA81,0x1A40,
		0x1E00,0xDEC1,0xDF81,0x1F40,0xDD01,0x1DC0,0x1C80,0xDC41,
		0x1400,0xD4C1,0xD581,0x1540,0xD701,0x17C0,0x1680,0xD641,
		0xD201,0x12C0,0x1380,0xD341,0x1100,0xD1C1,0xD081,0x1040,
		0xF001,0x30C0,0x3180,0xF141,0x3300,0xF3C1,0xF281,0x3240,
		0x3600,0xF6C1,0xF781,0x3740,0xF501,0x35C0,0x3480,0xF441,
		0x3C00,0xFCC1,0xFD81,0x3D40,0xFF01,0x3FC0,0x3E80,0xFE41,
		0xFA01,0x3AC0,0x3B80,0xFB41,0x3900,0xF9C1,0xF881,0x3840,
		0x2800,0xE8C1,0xE981,0x2940,0xEB01,0x2BC0,0x2A80,0xEA41,
		0xEE01,0x2EC0,0x2F80,0xEF41,0x2D00,0xEDC1,0xEC81,0x2C40,
		0xE401,0x24C0,0x2580,0xE541,0x2700,0xE7C1,0xE681,0x2640,
		0x2200,0xE2C1,0xE381,0x2340,0xE101,0x21C0,0x2080,0xE041,
		0xA001,0x60C0,0x6180,0xA141,0x6300,0xA3C1,0xA281,0x6240,
		0x6600,0xA6C1,0xA781,0x6740,0xA501,0x65C0,0x6480,0xA441,
		0x6C00,0xACC1,0xAD81,0x6D40,0xAF01,0x6FC0,0x6E80,0xAE41,
		0xAA01,0x6AC0,0x6B80,0xAB41,0x6900,0xA9C1,0xA881,0x6840,
		0x7800,0xB8C1,0xB981,0x7940,0xBB01,0x7BC0,0x7A80,0xBA41,
		0xBE01,0x7EC0,0x7F80,0xBF41,0x7D00,0xBDC1,0xBC81,0x7C40,
		0xB401,0x74C0,0x7580,0xB541,0x7700,0xB7C1,0xB681,0x7640,
		0x7200,0xB2C1,0xB381,0x7340,0xB101,0x71C0,0x7080,0xB041,
		0x5000,0x90C1,0x9181,0x5140,0x9301,0x53C0,0x5280,0x9241,
		0x9601,0x56C0,0x5780,0x9741,0x5500,0x95C1,0x9481,0x5440,
		0x9C01,0x5CC0,0x5D80,0x9D41,0x5F00,0x9FC1,0x9E81,0x5E40,
		0x5A00,0x9AC1,0x9B81,0x5B40,0x9901,0x59C0,0x5880,0x9841,
		0x8801,0x48C0,0x4980,0x8941,0x4B00,0x8BC1,0x8A81,0x4A40,
		0x4E00,0x8EC1,0x8F81,0x4F40,0x8D01,0x4DC0,0x4C80,0x8C41,
		0x4400,0x84C1,0x8581,0x4540,0x8701,0x47C0,0x4680,0x8641,
		0x8201,0x42C0,0x4380,0x8341,0x4100,0x81C1,0x8081,0x4040
	];
	function dms_CreateCRC(mem,memo, size) {
		var CRC = 0;

		while (size--)
			CRC = CRCTab[(CRC ^ mem[memo++]) & 255] ^ ((CRC >> 8) & 255);

		return CRC;
	}

	/*---------------------------------*/

	function addextra(name, extra, p, size) {

		console.log("add extra " + size);
		if (extra === null)
			return;
		for (var i = 0; i < DMS_MAX_EXTRA; i++) {
			if (extra[i] === null)
				break;
		}
		if (i == DMS_MAX_EXTRA)
			return;

		var arrayBufferOut = new ArrayBuffer(size);
		var zf = new BinaryStream(arrayBufferOut,true);
		zf.name = name;


		fwrite(p,0, size, 1, zf);
		zf.goto(0);
		extra[i] = zf;
	}

	/*---------------------------------*/

	/*  DMS uses a lame encryption  */
	function dms_decrypt(p, len, src){
		var srco = 0, po = 0;
		var t = 0; //u16

		while (len--) {
			t = src[srco++];
			p[po++] = t ^ (PWDCRC & 0xff);
			PWDCRC = ((PWDCRC >> 1) + t) & 0xffff;
		}
	}

	function Unpack_Track_2(b1, b2, pklen2, unpklen, cmode, flags){
		switch (cmode){
			case 0:
				/*   No Compression   */
				//b2.set(b1.subarray(0, unpklen)); //memcpy(b2,b1,(size_t)unpklen);
				memCopy(b2,b1,unpklen);
				break;
			case 1:
				/*   Simple Compression   */
				if (Unpack_RLE(b1, b2, unpklen)) return ERR_BADDECR;
				break;
			case 2:
				/*   Quick Compression   */
				if (Unpack_QUICK(b1, b2, pklen2)) return ERR_BADDECR;
				if (Unpack_RLE(b2, b1, unpklen)) return ERR_BADDECR;
				//b2.set(b1.subarray(0, unpklen)); //memcpy(b2,b1,(size_t)unpklen);
				memCopy(b2,b1,unpklen);
				break;
			case 3:
				/*   Medium Compression   */
				if (Unpack_MEDIUM(b1, b2, pklen2)) return ERR_BADDECR;
				if (Unpack_RLE(b2, b1, unpklen)) return ERR_BADDECR;
				//b2.set(b1.subarray(0, unpklen)); //memcpy(b2,b1,(size_t)unpklen);
				memCopy(b2,b1,unpklen);
				break;
			case 4:
				/*   Deep Compression   */
				if (Unpack_DEEP(b1, b2, pklen2)) return ERR_BADDECR;
				if (Unpack_RLE(b2, b1, unpklen)) return ERR_BADDECR;
				//b2.set(b1.subarray(0, unpklen)); //memcpy(b2,b1,(size_t)unpklen);
				memCopy(b2,b1,unpklen);
				break;
			case 5:
			case 6:
				/*   Heavy Compression   */
				if (cmode == 5) {
					/*   Heavy 1   */
					if (Unpack_HEAVY(b1,b2,flags & 7,pklen2)) return ERR_BADDECR;
				} else {
					/*   Heavy 2   */
					if (Unpack_HEAVY(b1,b2,flags | 8,pklen2)) return ERR_BADDECR;
				}
				if (flags & 4) {
					//memset(b1, 0, unpklen);
					memset(b1,0, 0, unpklen);
					/*  Unpack with RLE only if this flag is set  */
					if (Unpack_RLE(b2, b1, unpklen)) return ERR_BADDECR;
					//b2.set(b1.subarray(0, unpklen)); //memcpy(b2,b1,(size_t)unpklen);
					memCopy(b2,b1,unpklen);
				}
				break;
			default:
				return ERR_UNKNMODE;
		}
		if (!(flags & 1))
			Init_Decrunchers();

		return NO_PROBLEM;
	}

	var pass = 0;
	function Unpack_Track(b1, b2, pklen2, unpklen, cmode, flags, number, pklen1, usum1, enc) {
		//static USHORT pass;
		var r = 0, err = NO_PROBLEM;
		var prevpass = 0;

		if (passfound) {
			if (number != 80)
				dms_decrypt(b1, pklen1, b1);
			r = Unpack_Track_2(b1, b2, pklen2, unpklen, cmode, flags);
			if (r == NO_PROBLEM) {
				if (usum1 == dms_Calc_CheckSum(b2, unpklen))
					return NO_PROBLEM;
			}
			log_error(number);
			if (passretries <= 0)
				return ERR_CSUM;
		}

		passretries--;
		var pwrounds = 0;
		var maybeencrypted = 0;
		//UCHAR *tmp = (unsigned char*)malloc (pklen1);
		var tmp = new Uint8Array(pklen1);
		//tmp.set(b1.subarray(0, pklen1)); //memcpy(tmp, b1, pklen1);
		memCopy(tmp,b1,pklen1);

		memset(b2,0, 0, unpklen);
		for (;;) {
			console.log("unpacking");
			r = Unpack_Track_2(b1, b2, pklen2, unpklen, cmode, flags);
			if (r == NO_PROBLEM) {
				if (usum1 == dms_Calc_CheckSum(b2, unpklen)) {
					passfound = maybeencrypted;
					if (passfound)
						console.log("DMS() decryption key = " +  prevpass);
					err = NO_PROBLEM;
					pass = prevpass;
					break;
				}
			}
			if (number == 80 || !enc) {
				err = ERR_CSUM;
				break;
			}
			maybeencrypted = 1;
			prevpass = pass;
			PWDCRC = pass;
			pass++;
			dms_decrypt(b1, pklen1, tmp);
			pwrounds++;
			if (pwrounds == 65536) {
				err = ERR_CSUM;
				passfound = 0;
				break;
			}
		}
		//free(tmp);
		return err;
	}

	function Process_Track(fi, fo, b1, b2, cmd, opt, dmsflags, extra){
		var crcerr = 0;

		var l = fread(b1, 1, THLEN, fi);
		if (l != THLEN) {
			if (l == 0)
				return DMS_FILE_END;
			else
				return ERR_SREAD;
		}

		/*  "TR" identifies a Track Header  */
		if ((b1[0] != 84) || (b1[1] != 82))
			return ERR_NOTTRACK;

		/*  Track Header CRC  */
		var hcrc = ((b1[THLEN-2] << 8) | b1[THLEN-1]);

		if (dms_CreateCRC(b1,0, THLEN-2) != hcrc)
			return ERR_THCRC;

		var number = (b1[2] << 8) | b1[3];		/*  Number of track  */
		var pklen1 = (b1[6] << 8) | b1[7];		/*  Length of packed track data as in archive  */
		var pklen2 = (b1[8] << 8) | b1[9];		/*  Length of data after first unpacking  */
		var unpklen = (b1[10] << 8) | b1[11];	/*  Length of data after subsequent rle unpacking */
		var flags = b1[12];							/*  control flags  */
		var cmode = b1[13];							/*  compression mode used  */
		var usum = (b1[14] << 8) | b1[15];		/*  Track Data CheckSum AFTER unpacking  */
		var dcrc = (b1[16] << 8) | b1[17];		/*  Track Data CRC BEFORE unpacking  */


		if (DMS_LOG) {
			var out = "";
			if (number == 80)
				out += " FileID   ";
			else if (number == 0xffff)
				out += " Banner   ";
			else if ((number == 0) && (unpklen == 1024))
				out += " FakeBB   ";
			else
				out += number;

			out +=  pklen1 + ", " +  unpklen+ ", " + modes[cmode] + ", " + usum + ", " +hcrc + ", " + dcrc + ", " + flags;
			console.log(out);
		}

		if ((pklen1 > TRACK_BUFFER_LEN) || (pklen2 > TRACK_BUFFER_LEN) || (unpklen > TRACK_BUFFER_LEN))
			return ERR_BIGTRACK;

		if (fread(b1, 1, pklen1, fi) != pklen1)
			return ERR_SREAD;

		if (dms_CreateCRC(b1,0, pklen1) != dcrc) {
			log_error(number);
			crcerr = 1;
		}
		/*  track 80 is FILEID.DIZ, track 0xffff (-1) is Banner  */
		/*  and track 0 with 1024 bytes only is a fake boot block with more advertising */
		/*  FILE_ID.DIZ is never encrypted  */

		//if (pwd && (number!=80)) dms_decrypt(b1,pklen1); ORG

		var normaltrack = false;
		if ((cmd == CMD_UNPACK) && (number < 80) && (unpklen > 2048)) {
			//memset(b2, 0, unpklen);
			memset(b2,0, 0, unpklen);
			if (!crcerr)
				Unpack_Track(b1, b2, pklen2, unpklen, cmode, flags, number, pklen1, usum, dmsflags & DMSFLAG_ENCRYPTED);

			if (number == 0 && fo.index == 512 * 22) {
				// did we have another cylinder 0 already?
				fo.goto(0);

				var p = new Uint8Array(512 * 22);
				fread(p, 512 * 22, 1, fo);
				addextra("BigFakeBootBlock", extra, p, 512 * 22);
				//xfree(p);
				delete p;
			}

			fo.goto(number * 512 * 22 * ((dmsflags & DMSFLAG_HD) ? 2 : 1));

			if (fwrite(b2,0, 1, unpklen, fo) != unpklen)
				return ERR_CANTWRITE;
			normaltrack = true;
		} else if (number == 0 && unpklen == 1024) {
			//b2.set(0, 0, unpklen); //memset(b2, 0, unpklen);
			memCopy(b2,0,unpklen);
			if (!crcerr)
				Unpack_Track(b1, b2, pklen2, unpklen, cmode, flags, number, pklen1, usum, dmsflags & DMSFLAG_ENCRYPTED);
			addextra("FakeBootBlock", extra, b2, unpklen);
		}

		if (crcerr)
			return NO_PROBLEM;

		if (number == 0xffff) {
			Unpack_Track(b1, b2, pklen2, unpklen, cmode, flags, number, pklen1, usum, dmsflags & DMSFLAG_ENCRYPTED);
			if (extra)
				addextra("Banner", extra, b2, unpklen);

			//printbandiz(b2, unpklen);
		}

		if (number == 80) {
			Unpack_Track(b1, b2, pklen2, unpklen, cmode, flags, number, pklen1, usum, dmsflags & DMSFLAG_ENCRYPTED);
			if (extra)
				addextra("FILEID.DIZ", extra, b2, unpklen);

			//printbandiz(b2, unpklen);
		}

		if (!normaltrack)
			Init_Decrunchers();

		return NO_PROBLEM;
	}

	function DMS_Process_File(fi, fo, cmd, opt, PCRC, pwd, part, extra) {
		passfound = 0;
		passretries = 2;

		b1 = new Uint8Array(TRACK_BUFFER_LEN);
		b2 = new Uint8Array(TRACK_BUFFER_LEN);
		dms_text = new Uint8Array(TEMP_BUFFER_LEN);

		fi.goto(0);
		if (fread(b1, 1, HEADLEN, fi) != HEADLEN) {
			dms_text = null;
			return ERR_SREAD;
		}

		/*  Check the first 4 bytes of file to see if it is "DMS!"  */
		//if ((b1[0] != 'D') || (b1[1] != 'M') || (b1[2] != 'S') || (b1[3] != '!')) {
		if (!(b1[0] == 68 && b1[1] == 77 && b1[2] == 83 && b1[3] == 33)) { /* DMS! */
			dms_text = null;
			return ERR_NOTDMS;
		}

		/* Header CRC */
		var hcrc = (b1[HEADLEN - 2] << 8) | b1[HEADLEN - 1];
		if (hcrc != dms_CreateCRC(b1,4, HEADLEN - 6)) {
			dms_text = null;
			return ERR_HCRC;
		}

		var geninfo = (b1[10] << 8) | b1[11]; /* General info about archive */
		var date = (((b1[12]) << 24) | ((b1[13]) << 16) | ((b1[14]) << 8) | b1[15]) >>> 0; /* date in standard UNIX/ANSI format */
		var low = (b1[16] << 8) | b1[17]; /*  Lowest track in archive. May be incorrect if archive is "appended" */
		var high = (b1[18] << 8) | b1[19]; /*  Highest track in archive. May be incorrect if archive is "appended" */

		if (part && low < 30) {
			dms_text = null;
			return DMS_FILE_END;
		}

		var pkfsize = (((b1[21]) << 16) | ((b1[22]) << 8) | b1[23]) >>> 0; /*  Length of total packed data as in archive   */
		var unpkfsize = (((b1[25]) << 16) | ((b1[26]) << 8) | b1[27]) >>> 0; /*  Length of unpacked data. Usually 901120 bytes  */

		var c_version = (b1[46] << 8) | b1[47]; /*  version of DMS used to generate it  */
		var disktype = (b1[50] << 8) | b1[51]; /*  Type of compressed disk  */
		var cmode = (b1[52] << 8) | b1[53]; /*  Compression mode mostly used in this archive  */

		PWDCRC = PCRC;

		if (DMS_LOG) {
			var pv = Math.floor(c_version / 100);

			console.log(" Created with DMS version " + pv + "." + (c_version - pv * 100) + " " + ((geninfo & 0x80) ? "Registered" : "Evaluation"));
			console.log(" Creation date : " + ctime(date) );
			console.log(" Lowest track in archive : " +  low);
			console.log(" Highest track in archive : " +  high);
			console.log(" Packed data size : " +  pkfsize);
			console.log(" Unpacked data size : " +  unpkfsize);

			var out = " Disk type of archive : ";
			switch (disktype) {
				case 0:
				case 1:
					/* Can also be a non-dos disk */
					out += "AmigaOS 1.0 OFS\n";
					break;
				case 2:
					out += "AmigaOS 2.0 FFS\n";
					break;
				case 3:
					out += "AmigaOS 3.0 OFS / International\n";
					break;
				case 4:
					out += "AmigaOS 3.0 FFS / International\n";
					break;
				case 5:
					out += "AmigaOS 3.0 OFS / Dir Cache\n";
					break;
				case 6:
					out += "AmigaOS 3.0 FFS / Dir Cache\n";
					break;
				case 7:
					out += "FMS Amiga System File\n";
					break;
				default:
					out += "Unknown\n";
			}
			console.log(out);

			out = " Compression mode used : ";
			if (cmode > 6)
				out += "Unknown !\n";
			else
				out += modes[cmode] + "\n";
			console.log(out);

			out = " General info : ";
			if ((geninfo == 0) || (geninfo == 0x80)) out += "None";
			if (geninfo & 1) out += "NoZero ";
			if (geninfo & 2) out += "Encrypted ";
			if (geninfo & 4) out += "Appends ";
			if (geninfo & 8) out += "Banner ";
			if (geninfo & 16) out += "HD ";
			if (geninfo & 32) out += "MS-DOS ";
			if (geninfo & 64) out += "DMS_DEV_Fixed ";
			if (geninfo & 256) out += "FILEID.DIZ";
			out += "\n";
			console.log(out);

			console.log(" Info Header CRC : ", hcrc.toString(16));
		}

		if (disktype == 7) {
			/*  It's not a DMS compressed disk image, but a FMS archive  */
			dms_text = null;
			return ERR_FMS;
		}

		if (DMS_LOG)	{
			console.log(" Track   Plength  Ulength  Cmode   USUM  HCRC  DCRC Cflag\n");
			console.log(" ------  -------  -------  ------  ----  ----  ---- -----\n");
		}

		//	if (((cmd==CMD_UNPACK) || (cmd==CMD_SHOWBANNER)) && (geninfo & 2) && (!pwd))
		//		return ERR_NOPASSWD;

		var ret = NO_PROBLEM;

		Init_Decrunchers();


		if (cmd != CMD_VIEW) {
			if (cmd == CMD_SHOWBANNER) /*  Banner is in the first track  */
				ret = Process_Track(fi, null, b1, b2, cmd, opt, geninfo, extra);
			else {
				Init_Decrunchers();
				for (;;) {
					ret = Process_Track(fi, fo, b1, b2, cmd, opt, geninfo, extra);
					if (ret == DMS_FILE_END)
						break;
					if (ret == NO_PROBLEM){
						continue;
					}
					break;

				}
			}
		}
		if ((cmd == CMD_VIEWFULL) || (cmd == CMD_SHOWDIZ) || (cmd == CMD_SHOWBANNER))
			console.log("---");

		if (ret == DMS_FILE_END)
			ret = NO_PROBLEM;

		/*  Used to give an error message, but I have seen some DMS  */
		/*  files with texts or zeros at the end of the valid data   */
		/*  So, when we find something that is not a track header,   */
		/*  we suppose that the valid data is over. And say it's ok. */
		if (ret == ERR_NOTTRACK)
			ret = NO_PROBLEM;


		dms_text = null;
		return ret;
	}

	me.toADF = function(z, index, retcode) {

		if (typeof index == "undefined") index = 0;
		if (typeof retcode == "undefined") retcode = null;

		//static int recursive;
		var orgname = z.name || "dms.adf";
		var newname = "";
		var zextra = new Array(DMS_MAX_EXTRA); //zfile *
		for (var vi = 0; vi < DMS_MAX_EXTRA; vi++)
			zextra[vi] = null;

		//if (checkwrite(z, retcode)) return null;
		//if (recursive) return null;

		var ext = orgname.lastIndexOf('.');
		if (ext != -1) {
			newname = orgname.substr(0, ext);
			newname += ".ADF";
		} else
			newname = orgname + ".ADF";


		var arrayBufferOut = new ArrayBuffer(1760 * 512);
		var zo = new BinaryStream(arrayBufferOut,true);
		zo.name = newname;

		pass = 0;
		var ret = DMS_Process_File(z, zo, CMD_UNPACK, OPT_VERBOSE, 0, null, false, zextra);
		if (ret == NO_PROBLEM) { // || ret == DMS_FILE_END) {

			zo.goto(0);

			if (index > 0) {
				zo = null;
				for (var i = 0; i < DMS_MAX_EXTRA && zextra[i]; i++);
				if (index > i) {
					//goto end;
					return zo;
				}
				zo = zextra[index - 1];
				zextra[index - 1] = null;
			}

			//if (retcode !== null) *retcode = 1;

			z = null;

			console.log("DMS() converted '"+orgname+"' to '"+newname+"'");
		} else {
			zo = null;

			console.error("Can't convert '"+orgname+"' to ADF. (error "+ret+")");
		}
		//end:
		console.log("extras:");
		for (i = 0; i < DMS_MAX_EXTRA; i++){
			if (zextra[i]) console.log(zextra[i].name);
		}

		return zo;
	};


	function fread(buffer, l1, lengthToRead, fromFile) {

		if (fromFile.index + l1 * lengthToRead > fromFile.length) {
			lengthToRead = l1 ? Math.floor((fromFile.length - fromFile.index) / l1) : 0;
			if (lengthToRead < 0) lengthToRead = 0;
		}

		for (var i = 0, max = l1 * lengthToRead; i<max;i++){
			buffer[i] = fromFile.readByte();
		}

		return lengthToRead;
	}

	function fwrite(sourceData,sourceIndex, l1, l2, file) {
		var off = file.index + l1 * l2; //s64

		if (file.length == 0) {
			console.warn("Can't write to empty file");
			return 0;
		}
		if (off > file.length) {

			// TODO: when does this happen ?
			// we just ignore this for now ...
		}

		for (var i = 0, max=l1 * l2;i<max;i++){
			file.writeByte(sourceData[sourceIndex+i]);
		}

		return l2;
	}


	function memset(dst,dsto, value, length) {
		for (var i = dsto, j = dsto + length; i < j; i++)
			dst[i] = value;
	}


	function memCopy(to,from,length){
		if (from.length){
			length = length||from.length;
			for (var i = 0, max=length;i<max;i++){
				to[i] = from[i];
			}
		}else{
			for (i = 0, max=length;i<max;i++){
				to[i] = from;
			}
		}
	}

	if (typeof FileType !== "undefined") FileType.register(me);

	return me;
}();


