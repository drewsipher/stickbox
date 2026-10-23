#!/usr/bin/env python3
"""Print Stickbox's "words I don't know yet" lists straight from Chrome's localStorage files.

Chrome keeps localStorage in a LevelDB under <profile>/Local Storage/leveldb. Keys look like
"_<origin>\\x00\\x01stickbox.unknownWords"; values start with a byte saying how the JSON is encoded
(0 = UTF-16LE, 1 = Latin-1). Table files (*.ldb) hold Snappy-compressed blocks, the write-ahead
log (*.log) holds raw write batches. No third-party modules needed.

Usage: python3 tools/wishlist_from_chrome.py [chrome-config-dir ...]
"""
import glob, json, os, struct, sys, time

MAGIC = bytes.fromhex('57fb808b247547db')


def snappy(buf):
    pos = shift = ulen = 0
    while True:
        b = buf[pos]; pos += 1
        ulen |= (b & 0x7f) << shift; shift += 7
        if not b & 0x80:
            break
    out = bytearray()
    while pos < len(buf):
        tag = buf[pos]; pos += 1
        t = tag & 3
        if t == 0:
            ln = (tag >> 2) + 1
            if ln > 60:
                nb = ln - 60; ln = int.from_bytes(buf[pos:pos + nb], 'little') + 1; pos += nb
            out += buf[pos:pos + ln]; pos += ln
        else:
            if t == 1:
                ln = ((tag >> 2) & 7) + 4; off = ((tag >> 5) << 8) | buf[pos]; pos += 1
            elif t == 2:
                ln = (tag >> 2) + 1; off = int.from_bytes(buf[pos:pos + 2], 'little'); pos += 2
            else:
                ln = (tag >> 2) + 1; off = int.from_bytes(buf[pos:pos + 4], 'little'); pos += 4
            if off == 0 or off > len(out):
                raise ValueError('bad back-reference')
            start = len(out) - off
            for i in range(ln):
                out.append(out[start + i])
    if len(out) != ulen:
        raise ValueError('length mismatch')
    return bytes(out)


def varint(buf, pos):
    shift = val = 0
    while True:
        b = buf[pos]; pos += 1
        val |= (b & 0x7f) << shift; shift += 7
        if not b & 0x80:
            return val, pos


def block(data, off, size):
    blk = data[off:off + size]
    return snappy(blk) if data[off + size] == 1 else blk


def entries(blk):
    n_restarts = struct.unpack('<I', blk[-4:])[0]
    end = len(blk) - 4 - n_restarts * 4
    pos, key, out = 0, b'', []
    while pos < end:
        shared, pos = varint(blk, pos); unshared, pos = varint(blk, pos); vlen, pos = varint(blk, pos)
        key = key[:shared] + blk[pos:pos + unshared]; pos += unshared
        out.append((key, blk[pos:pos + vlen])); pos += vlen
    return out


def ldb_records(path):
    data = open(path, 'rb').read()
    if data[-8:] != MAGIC:
        return []
    p = 0
    _, p = varint(data[-48:], p); _, p = varint(data[-48:], p); ix_off, p = varint(data[-48:], p); ix_sz, p = varint(data[-48:], p)
    recs = []
    for _, v in entries(block(data, ix_off, ix_sz)):
        boff, q = varint(v, 0); bsz, q = varint(v, q)
        try:
            recs += entries(block(data, boff, bsz))
        except Exception:
            pass
    return recs


def log_records(path):
    data = open(path, 'rb').read()
    recs, pos = [], 0
    while pos + 7 <= len(data):
        if pos % 32768 > 32768 - 7:
            pos = (pos // 32768 + 1) * 32768; continue
        ln = struct.unpack('<H', data[pos + 4:pos + 6])[0]; typ = data[pos + 6]
        payload = data[pos + 7:pos + 7 + ln]; pos += 7 + ln
        if typ != 1 or len(payload) < 12:
            continue
        cnt = struct.unpack('<I', payload[8:12])[0]; q = 12
        try:
            for _ in range(cnt):
                kind = payload[q]; q += 1
                klen, q = varint(payload, q); key = payload[q:q + klen]; q += klen
                if kind == 1:
                    vlen, q = varint(payload, q); recs.append((key, payload[q:q + vlen])); q += vlen
        except Exception:
            pass
    return recs


def decode(v):
    if not v:
        return None
    return v[1:].decode('utf-16-le', 'ignore') if v[0] == 0 else v[1:].decode('latin1')


def main():
    roots = sys.argv[1:] or [os.path.expanduser('~/.config/google-chrome'), os.path.expanduser('~/.config/chromium')]
    files = []
    for r in roots:
        files += glob.glob(os.path.join(r, '*', 'Local Storage', 'leveldb', '*.ldb')) + glob.glob(os.path.join(r, '*', 'Local Storage', 'leveldb', '*.log'))
    found = {}
    for f in sorted(files, key=os.path.getmtime):
        try:
            recs = ldb_records(f) if f.endswith('.ldb') else log_records(f)
        except Exception:
            continue
        for k, v in recs:
            if b'stickbox.unknownWords' not in k:
                continue
            origin = k.split(b'\x00')[0].decode('latin1').lstrip('_')
            try:
                obj = json.loads(decode(v))
            except Exception:
                continue
            found[origin] = (f, os.path.getmtime(f), obj)
    if not found:
        print('No wish list found in', ', '.join(roots)); return
    for origin, (f, mt, obj) in found.items():
        print('== %s  (%s, %s)' % (origin, f, time.strftime('%Y-%m-%d %H:%M', time.localtime(mt))))
        if not obj:
            print('   (empty)')
        for w, r in sorted(obj.items(), key=lambda kv: -kv[1].get('count', 0)):
            typed = ', '.join(r.get('typed') or [])
            print('   %-26s x%-3s %s' % (w, r.get('count', 1), ('typed as: ' + typed) if typed else ''))


if __name__ == '__main__':
    main()
