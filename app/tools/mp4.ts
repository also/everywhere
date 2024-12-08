import { Tool } from '.';
import { SeekableBlobBuffer } from '../../tools/parse/buffers';
import { extractGps } from '../../tools/parse/gopro-gps';
import { bind, fileRoot } from '../../tools/parse';
import { parser as mp4Parser } from '../../tools/parse/mp4';
import { getMeta } from '../../tools/parse/gpmf';

const mp4Tool: Tool = {
  couldProcessFileByExtension(extension) {
    return extension === 'mp4' ? 'yes' : 'no';
  },
  async processFile(file) {
    const data = new SeekableBlobBuffer(file.file.file, 1024000);
    const mp4 = bind(mp4Parser, data, fileRoot(data));
    const track = await getMeta(mp4);
    return await extractGps(track, mp4);
  },
};

export default mp4Tool;
