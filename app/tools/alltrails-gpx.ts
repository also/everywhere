// https://github.com/whatwg/dom/issues/1217
// DOMParser is not available in workers ?!
import { DOMParser } from 'xmldom';

import { gpx } from '@tmcw/togeojson';

import { Tool } from '.';

const alltrailsGpxTool: Tool = {
  couldProcessFileByExtension(extension) {
    return extension === 'gpx' ? 'yes' : 'no';
  },

  async processFile({ file: { file } }) {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/xml');
    return gpx(doc);
  },
};

export default alltrailsGpxTool;
