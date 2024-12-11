import { findTool, StatefulTool, ToolWithName } from '.';

const anythingTool: StatefulTool<Map<ToolWithName, any>> = {
  createState() {
    return new Map();
  },
  async processFile(file, state) {
    const possibleTools = await findTool(file);
    if (possibleTools.length === 0) {
      console.warn('No tool could process file', file);
      return;
    }
    if (possibleTools.length > 1) {
      console.warn('Multiple tools could process file', file);
      return;
    }
    const tool = possibleTools[0];
    let toolState = state.get(tool);
    if (!toolState) {
      toolState = tool.createState();
      state.set(tool, toolState);
    }
    let result = await tool.processFile(file, toolState);
    if (result) {
      if (result.type === 'FeatureCollection') {
        for (const f of result.features) {
          f.properties = { ...f.properties, everywhereTool: tool.name };
        }
      } else if (result.type === 'Feature') {
        result.properties = { ...result.properties, everywhereTool: tool.name };
      } else {
        result = {
          type: 'Feature',
          geometry: result,
          properties: {
            everywhereTool: tool.name,
          },
        };
      }
      return result;
    }
  },
};

export default anythingTool;
