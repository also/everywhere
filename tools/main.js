import minimist from 'minimist';
import fs from 'fs';
import path from 'path';

export default function () {
  const argv = minimist(process.argv.slice(2));

  const commandName = argv._.shift();

  if (!commandName) {
    console.log('Available tools:');
    const toolsDir = __dirname;
    const files = fs.readdirSync(toolsDir);
    
    files
      .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && 
                     file !== 'main.js' && 
                     file !== 'index.js')
      .map(file => path.basename(file, path.extname(file)))
      .sort()
      .forEach(tool => console.log(`  ${tool}`));
    
    return;
  }

  let command = require(`./${commandName}`);
  if (command.default) {
    command = command.default;
  }
  Promise.resolve(command(argv)).catch((e) =>
    setImmediate(() => {
      throw e;
    })
  );
}
