import { Tool } from '.';
import { mp4ToGeoJson } from '../file-data';

const mp4Tool: Tool = {
  couldProcessFileByExtension(extension) {
    return extension === 'mp4' ? 'yes' : 'no';
  },
  async processFile(file) {
    return mp4ToGeoJson(file.file.file);
  },
};

export default mp4Tool;
