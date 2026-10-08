/**
 * qrcode.js —— 零依赖二维码生成器（Node.js 命令行 / 可 require 的模块）
 *
 * 用途：把「IP + 端口」访问地址生成二维码图片，手机扫码即可打开。
 *       build&run.bat 与 server.js（/__qr.png 路由）都会调用它。
 *
 * 命令行用法：
 *   node qrcode.js "http://192.168.1.10:8901"
 *        -> 终端打印二维码 + 生成 qrcode.png
 *   node qrcode.js "http://192.168.1.10:8901" qr.png
 *        -> 指定输出文件名
 *   node qrcode.js "http://192.168.1.10:8901" qr.png --scale 12
 *        -> 指定每模块像素（默认 8，越大越清晰）
 *   node qrcode.js "http://192.168.1.10:8901" qr.png --no-ascii
 *        -> 不打印终端二维码（部分老旧终端显示中文/方块字符会乱码时用）
 *
 * 模块用法：
 *   const qr = require('./qrcode');
 *   fs.writeFileSync('a.png', qr.toPNG('http://192.168.1.10:8901', { scale: 8 }));
 *   console.log(qr.toASCII('http://192.168.1.10:8901'));
 *
 * 说明：算法移植自 Kazuhiko Arase 的 "QRCode for JavaScript"（MIT License，
 *      与项目 package.json 里的 qrcodejs2 同源），去掉了所有 DOM 依赖，
 *      并补上 PNG 编码，因此无需安装任何 npm 包即可在服务器上运行。
 *      仅保留版本 1~15（字节模式最多 412 字节，足够容纳 IP / 域名地址）。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ============================================================
 * 一、GF(256) 伽罗华域 指数 / 对数表
 * ============================================================ */
const EXP_TABLE = new Array(256);
const LOG_TABLE = new Array(256);
for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
for (let i = 8; i < 256; i++) {
  EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
}
for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

function glog(n) {
  if (n < 1) throw new Error('glog(' + n + ')');
  return LOG_TABLE[n];
}

function gexp(n) {
  while (n < 0) n += 255;
  while (n >= 256) n -= 255;
  return EXP_TABLE[n];
}

/* ============================================================
 * 二、多项式运算（RS 纠错用）
 * ============================================================ */
class QRPolynomial {
  constructor(num, shift) {
    if (num.length === undefined) throw new Error(num.length + '/' + shift);
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift).fill(0);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }

  get(index) {
    return this.num[index];
  }

  getLength() {
    return this.num.length;
  }

  multiply(e) {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new QRPolynomial(num, 0);
  }

  mod(e) {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = glog(this.get(0)) - glog(e.get(0));
    const num = new Array(this.getLength());
    for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
    for (let i = 0; i < e.getLength(); i++) num[i] ^= gexp(glog(e.get(i)) + ratio);
    return new QRPolynomial(num, 0).mod(e);
  }
}

/* ============================================================
 * 三、RS 分块表（版本 1~15，每组 [块数, 总码字, 数据码字]）
 *     顺序固定为 L / M / Q / H
 * ============================================================ */
const RS_BLOCK_TABLE = [
  /* v1  */ [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9]],
  /* v2  */ [[1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16]],
  /* v3  */ [[1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13]],
  /* v4  */ [[1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9]],
  /* v5  */ [[1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12]],
  /* v6  */ [[2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15]],
  /* v7  */ [[2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14]],
  /* v8  */ [[2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15]],
  /* v9  */ [[2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13]],
  /* v10 */ [[2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]],
  /* v11 */ [[4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13]],
  /* v12 */ [[2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15]],
  /* v13 */ [[4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12]],
  /* v14 */ [[3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13]],
  /* v15 */ [[5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12]]
];

/* 各版本字节模式的最大数据长度 [L, M, Q, H] */
const QR_LIMIT_LENGTH = [
  [17, 14, 11, 7], [32, 26, 20, 14], [53, 42, 32, 24], [78, 62, 46, 34], [106, 84, 60, 44],
  [134, 106, 74, 58], [154, 122, 86, 64], [192, 152, 108, 84], [230, 180, 130, 98], [271, 213, 151, 119],
  [321, 251, 177, 137], [367, 287, 203, 155], [425, 331, 241, 177], [458, 362, 258, 194], [520, 412, 292, 220]
];

const ERROR_LEVEL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };

function getRSBlocks(typeNumber, levelIndex) {
  const table = RS_BLOCK_TABLE[typeNumber - 1][levelIndex];
  const list = [];
  const groups = table.length / 3;
  for (let i = 0; i < groups; i++) {
    const count = table[i * 3];
    const totalCount = table[i * 3 + 1];
    const dataCount = table[i * 3 + 2];
    for (let j = 0; j < count; j++) list.push({ totalCount, dataCount });
  }
  return list;
}

/* 定位图案（Pattern Position Table），版本 1~15 */
const PATTERN_POSITION_TABLE = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
  [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70]
];

/* ============================================================
 * 四、位缓冲 & 字节模式数据
 * ============================================================ */
class QRBitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }

  get(index) {
    const bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
  }

  put(num, length) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  getLengthInBits() {
    return this.length;
  }

  putBit(bit) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    this.length++;
  }
}

/** 8bit 字节模式数据（UTF-8 编码） */
class QR8bitByte {
  constructor(data) {
    this.mode = 4; // MODE_8BIT_BYTE
    this.data = data;
    this.parsedData = Buffer.from(data, 'utf8');
  }

  getLength() {
    return this.parsedData.length;
  }

  write(buffer) {
    for (let i = 0; i < this.parsedData.length; i++) {
      buffer.put(this.parsedData[i], 8);
    }
  }
}

/* ============================================================
 * 五、工具函数（BCH、掩码、掩码评分、位数）
 * ============================================================ */
const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
const G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

function getBCHDigit(data) {
  let digit = 0;
  while (data !== 0) {
    digit++;
    data >>>= 1;
  }
  return digit;
}

function getBCHTypeInfo(data) {
  let d = data << 10;
  while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
    d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15));
  }
  return ((data << 10) | d) ^ G15_MASK;
}

function getBCHTypeNumber(data) {
  let d = data << 12;
  while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
    d ^= G18 << (getBCHDigit(d) - getBCHDigit(G18));
  }
  return (data << 12) | d;
}

function getMask(maskPattern, i, j) {
  switch (maskPattern) {
    case 0: return (i + j) % 2 === 0;
    case 1: return i % 2 === 0;
    case 2: return j % 3 === 0;
    case 3: return (i + j) % 3 === 0;
    case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
    default: throw new Error('bad maskPattern: ' + maskPattern);
  }
}

function getErrorCorrectPolynomial(errorCorrectLength) {
  let a = new QRPolynomial([1], 0);
  for (let i = 0; i < errorCorrectLength; i++) {
    a = a.multiply(new QRPolynomial([1, gexp(i)], 0));
  }
  return a;
}

function getLengthInBits(mode, type) {
  if (type >= 1 && type < 10) {
    switch (mode) {
      case 1: return 10;
      case 2: return 9;
      case 4: return 8;
      case 8: return 8;
      default: throw new Error('mode:' + mode);
    }
  } else if (type < 27) {
    switch (mode) {
      case 1: return 12;
      case 2: return 11;
      case 4: return 16;
      case 8: return 10;
      default: throw new Error('mode:' + mode);
    }
  }
  switch (mode) {
    case 1: return 14;
    case 2: return 13;
    case 4: return 16;
    case 8: return 12;
    default: throw new Error('mode:' + mode);
  }
}

function getLostPoint(qrCode) {
  const moduleCount = qrCode.getModuleCount();
  let lostPoint = 0;

  // 1. 同色相邻模块
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      let sameCount = 0;
      const dark = qrCode.isDark(row, col);
      for (let r = -1; r <= 1; r++) {
        if (row + r < 0 || moduleCount <= row + r) continue;
        for (let c = -1; c <= 1; c++) {
          if (col + c < 0 || moduleCount <= col + c) continue;
          if (r === 0 && c === 0) continue;
          if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
        }
      }
      if (sameCount > 5) lostPoint += 3 + sameCount - 5;
    }
  }

  // 2. 2x2 同色块
  for (let row = 0; row < moduleCount - 1; row++) {
    for (let col = 0; col < moduleCount - 1; col++) {
      let count = 0;
      if (qrCode.isDark(row, col)) count++;
      if (qrCode.isDark(row + 1, col)) count++;
      if (qrCode.isDark(row, col + 1)) count++;
      if (qrCode.isDark(row + 1, col + 1)) count++;
      if (count === 0 || count === 4) lostPoint += 3;
    }
  }

  // 3. 横向 1:1:3:1:1 图案
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount - 6; col++) {
      if (
        qrCode.isDark(row, col) &&
        !qrCode.isDark(row, col + 1) &&
        qrCode.isDark(row, col + 2) &&
        qrCode.isDark(row, col + 3) &&
        qrCode.isDark(row, col + 4) &&
        !qrCode.isDark(row, col + 5) &&
        qrCode.isDark(row, col + 6)
      ) lostPoint += 40;
    }
  }

  // 4. 纵向 1:1:3:1:1 图案
  for (let col = 0; col < moduleCount; col++) {
    for (let row = 0; row < moduleCount - 6; row++) {
      if (
        qrCode.isDark(row, col) &&
        !qrCode.isDark(row + 1, col) &&
        qrCode.isDark(row + 2, col) &&
        qrCode.isDark(row + 3, col) &&
        qrCode.isDark(row + 4, col) &&
        !qrCode.isDark(row + 5, col) &&
        qrCode.isDark(row + 6, col)
      ) lostPoint += 40;
    }
  }

  // 5. 黑白比例
  let darkCount = 0;
  for (let col = 0; col < moduleCount; col++) {
    for (let row = 0; row < moduleCount; row++) {
      if (qrCode.isDark(row, col)) darkCount++;
    }
  }
  const ratio = Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5;
  lostPoint += ratio * 10;

  return lostPoint;
}

/* ============================================================
 * 六、二维码矩阵
 * ============================================================ */
const PAD0 = 0xec;
const PAD1 = 0x11;

class QRCodeModel {
  constructor(typeNumber, levelIndex) {
    this.typeNumber = typeNumber;
    this.levelIndex = levelIndex;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }

  addData(data) {
    this.dataList.push(new QR8bitByte(data));
    this.dataCache = null;
  }

  isDark(row, col) {
    if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
      throw new Error(row + ',' + col);
    }
    return this.modules[row][col];
  }

  getModuleCount() {
    return this.moduleCount;
  }

  make() {
    this.makeImpl(false, this.getBestMaskPattern());
  }

  makeImpl(test, maskPattern) {
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount);
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = new Array(this.moduleCount).fill(null);
    }

    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(test, maskPattern);
    if (this.typeNumber >= 7) this.setupTypeNumber(test);

    if (this.dataCache === null) {
      this.dataCache = QRCodeModel.createData(this.typeNumber, this.levelIndex, this.dataList);
    }
    this.mapData(this.dataCache, maskPattern);
  }

  setupPositionProbePattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        if (
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }

  getBestMaskPattern() {
    let minLostPoint = 0;
    let pattern = 0;
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i);
      const lostPoint = getLostPoint(this);
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  }

  setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] != null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] != null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  }

  setupPositionAdjustPattern() {
    const pos = PATTERN_POSITION_TABLE[this.typeNumber - 1];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i];
        const col = pos[j];
        if (this.modules[row][col] != null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
              this.modules[row + r][col + c] = true;
            } else {
              this.modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  }

  setupTypeNumber(test) {
    const bits = getBCHTypeNumber(this.typeNumber);
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
    }
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }

  setupTypeInfo(test, maskPattern) {
    // 格式信息里的纠错等级编码固定为 L=1, M=0, Q=3, H=2（与内部索引不同）
    const levelCode = [1, 0, 3, 2][this.levelIndex];
    const value = (levelCode << 3) | maskPattern;
    const bits = getBCHTypeInfo(value);

    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.moduleCount - 15 + i][8] = mod;
    }
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
      else this.modules[8][15 - i - 1] = mod;
    }
    this.modules[this.moduleCount - 8][8] = !test;
  }

  mapData(data, maskPattern) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;

    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (;;) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] == null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            if (getMask(maskPattern, row, col - c)) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }
}

QRCodeModel.createData = function (typeNumber, levelIndex, dataList) {
  const rsBlocks = getRSBlocks(typeNumber, levelIndex);
  const buffer = new QRBitBuffer();

  for (let i = 0; i < dataList.length; i++) {
    const data = dataList[i];
    buffer.put(data.mode, 4);
    buffer.put(data.getLength(), getLengthInBits(data.mode, typeNumber));
    data.write(buffer);
  }

  let totalDataCount = 0;
  for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;

  if (buffer.getLengthInBits() > totalDataCount * 8) {
    throw new Error('内容过长（' + buffer.getLengthInBits() + ' > ' + totalDataCount * 8 + '）');
  }

  if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
  while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(false);

  for (;;) {
    if (buffer.getLengthInBits() >= totalDataCount * 8) break;
    buffer.put(PAD0, 8);
    if (buffer.getLengthInBits() >= totalDataCount * 8) break;
    buffer.put(PAD1, 8);
  }

  return QRCodeModel.createBytes(buffer, rsBlocks);
};

QRCodeModel.createBytes = function (buffer, rsBlocks) {
  let offset = 0;
  let maxDcCount = 0;
  let maxEcCount = 0;
  const dcdata = new Array(rsBlocks.length);
  const ecdata = new Array(rsBlocks.length);

  for (let r = 0; r < rsBlocks.length; r++) {
    const dcCount = rsBlocks[r].dataCount;
    const ecCount = rsBlocks[r].totalCount - dcCount;
    maxDcCount = Math.max(maxDcCount, dcCount);
    maxEcCount = Math.max(maxEcCount, ecCount);

    dcdata[r] = new Array(dcCount);
    for (let i = 0; i < dcdata[r].length; i++) {
      dcdata[r][i] = 0xff & buffer.buffer[i + offset];
    }
    offset += dcCount;

    const rsPoly = getErrorCorrectPolynomial(ecCount);
    const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
    const modPoly = rawPoly.mod(rsPoly);

    ecdata[r] = new Array(rsPoly.getLength() - 1);
    for (let i = 0; i < ecdata[r].length; i++) {
      const modIndex = i + modPoly.getLength() - ecdata[r].length;
      ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
    }
  }

  let totalCodeCount = 0;
  for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;

  const data = new Array(totalCodeCount);
  let index = 0;
  for (let i = 0; i < maxDcCount; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < dcdata[r].length) data[index++] = dcdata[r][i];
    }
  }
  for (let i = 0; i < maxEcCount; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < ecdata[r].length) data[index++] = ecdata[r][i];
    }
  }
  return data;
};

/* ============================================================
 * 七、对外 API
 * ============================================================ */

/** 根据内容长度自动选择最小可容纳的版本号 */
function chooseTypeNumber(text, level) {
  const bytes = Buffer.byteLength(text, 'utf8');
  const idx = ERROR_LEVEL_INDEX[level];
  for (let v = 1; v <= QR_LIMIT_LENGTH.length; v++) {
    if (bytes <= QR_LIMIT_LENGTH[v - 1][idx]) return v;
  }
  throw new Error('内容过长，超过版本 ' + QR_LIMIT_LENGTH.length + ' 的容量上限（' + bytes + ' 字节）');
}

/**
 * 生成二维码矩阵
 * @param {string} text  要编码的内容
 * @param {string} level 'L' | 'M' | 'Q' | 'H'，默认 M
 * @returns {QRCodeModel}
 */
function make(text, level = 'M') {
  if (typeof text !== 'string' || text.length === 0) throw new Error('内容不能为空');
  if (!(level in ERROR_LEVEL_INDEX)) throw new Error('纠错等级只能是 L/M/Q/H');
  const typeNumber = chooseTypeNumber(text, level);
  const qr = new QRCodeModel(typeNumber, ERROR_LEVEL_INDEX[level]);
  qr.addData(text);
  qr.make();
  return qr;
}

/* ---------- PNG 编码（零依赖，用 Node 内置 zlib） ---------- */
const CRC_TABLE = (function () {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * 生成 PNG 图片
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.scale=8]   每个模块的像素边长
 * @param {number} [options.quiet=4]   四周留白（模块数），标准值 4
 * @param {string} [options.level='M'] 纠错等级
 * @param {number[]} [options.dark=[0,0,0]]    前景 RGB
 * @param {number[]} [options.light=[255,255,255]] 背景 RGB
 * @returns {Buffer} PNG 二进制
 */
function toPNG(text, options = {}) {
  const qr = make(text, options.level || 'M');
  const scale = Math.max(2, options.scale || 8);
  const quiet = options.quiet === undefined ? 4 : options.quiet;
  const dark = options.dark || [0, 0, 0];
  const light = options.light || [255, 255, 255];

  const n = qr.getModuleCount();
  const size = (n + quiet * 2) * scale;

  // 每行：1 字节滤波器(0) + size*3 字节 RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    const mr = Math.floor(y / scale) - quiet;
    for (let x = 0; x < size; x++) {
      const mc = Math.floor(x / scale) - quiet;
      const isDark = mr >= 0 && mr < n && mc >= 0 && mc < n && qr.isDark(mr, mc);
      const c = isDark ? dark : light;
      raw[p++] = c[0];
      raw[p++] = c[1];
      raw[p++] = c[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

/**
 * 生成终端可显示的二维码（用半块字符压缩，1 字符 = 1 宽 × 2 高）
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.quiet=2]
 * @param {string} [options.level='M']
 * @returns {string}
 */
function toASCII(text, options = {}) {
  const qr = make(text, options.level || 'M');
  const quiet = options.quiet === undefined ? 2 : options.quiet;
  const n = qr.getModuleCount();
  const isDark = (r, c) => r >= 0 && r < n && c >= 0 && c < n && qr.isDark(r, c);
  const lines = [];

  for (let r = -quiet; r < n + quiet; r += 2) {
    let line = '';
    for (let c = -quiet; c < n + quiet; c++) {
      const top = isDark(r, c);
      const bottom = isDark(r + 1, c);
      if (top && bottom) line += '█';
      else if (top) line += '▀';
      else if (bottom) line += '▄';
      else line += ' ';
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}

/* ============================================================
 * 八、命令行入口
 * ============================================================ */
function main() {
  const argv = process.argv.slice(2);
  const positional = [];
  let scale = 8;
  let noAscii = false;
  let quiet = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-ascii') noAscii = true;
    else if (a === '--quiet') quiet = true;
    else if (a === '--help' || a === '-h') help = true;
    else if (a === '--scale') scale = Number(argv[++i]) || 8;
    else if (a.indexOf('--scale=') === 0) scale = Number(a.slice(8)) || 8;
    else positional.push(a);
  }

  if (help || positional.length === 0) {
    console.log('Usage: node qrcode.js <text-or-url> [out.png] [--scale 8] [--no-ascii] [--quiet]');
    console.log('e.g. : node qrcode.js "http://192.168.1.10:8901" "qrcode.png"');
    process.exit(positional.length === 0 && !help ? 1 : 0);
  }

  const text = positional[0];
  const outFile = path.resolve(positional[1] || 'qrcode.png');

  const png = toPNG(text, { scale });
  fs.writeFileSync(outFile, png);

  if (quiet) return;
  if (!noAscii) {
    console.log('');
    console.log(toASCII(text));
  }
  console.log('');
  console.log('url : ' + text);
  console.log('file: ' + outFile + '  (' + Math.round(png.length / 1024) + ' KB)');
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('[qrcode] failed: ' + e.message);
    process.exit(1);
  }
}

module.exports = { make, toPNG, toASCII, chooseTypeNumber };
